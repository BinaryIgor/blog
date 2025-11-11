import express from "express";
import cors from "cors";
import { AnalyticsService, DeferredEventsSaver, StatsViews, SqliteAnalyticsRepository, Event, PingsFrequencyError } from "./analytics.js";
import {
    SubscriberService, SqliteSubscriberRepository, Subscriber, SubscriberSignUpContext, ButtondownSubscriberApi, NewsletterWebhookHandler,
    SubscriberExistsError, SubscriberValidationError,
    NewsletterWebhookSynchronizer
} from "./newsletter.js";
import { subscribersStatsSupplierFactory } from './shared.js';
import { Scheduler } from "./scheduler.js";
import * as Logger from "../shared/logger.js";

import * as Web from "./web.js"

import * as Config from "./config.js";

import { initSchema, SqliteDb, SqliteDbBackuper } from "./db.js";

import { Clock } from "../shared/dates.js";
import { PostsSource } from "./posts.js";

let server;
let scheduler;
let eventsSaver;
let db;

export async function start(appClock = new Clock(), appScheduler = new Scheduler(),
    postsRetryConfig = {
        retries: 5,
        initialDelay: 500,
        backoffMultiplier: 2
    }) {
    const clock = appClock;
    scheduler = appScheduler;

    const config = await Config.read();

    db = await SqliteDb.initInstance(config.dbPath);

    await initSchema(db);

    const dbBackuper = new SqliteDbBackuper(db, config.dbBackupPath, clock);
    dbBackuper.schedule(scheduler, config.dbBackupInterval, config.dbBackupScheduleDelay);

    const postsSource = new PostsSource(config.postsPath, postsRetryConfig);
    postsSource.schedule(scheduler, config.postsReadInterval);

    const subscriberRepository = new SqliteSubscriberRepository(db);
    const subscriberApi = new ButtondownSubscriberApi(config.buttondownApiUrl, config.buttondownApiKey);
    const subscriberService = new SubscriberService(subscriberRepository, subscriberApi, clock);
    const newsletterWebhookHandler = new NewsletterWebhookHandler(subscriberService, config.buttondownWebhookSigningKey);
    const newsletterWebhookSynchronizer = new NewsletterWebhookSynchronizer(config.buttondownApiUrl, config.buttondownWebhookUrl,
        config.buttondownWebhookDescription, config.buttondownApiKey, config.buttondownWebhookSigningKey);

    const analyticsRepository = new SqliteAnalyticsRepository(db);

    const statsViews = new StatsViews(analyticsRepository, subscribersStatsSupplierFactory(subscriberRepository), db, clock);
    statsViews.schedule(scheduler, {
        shorterPeriodsViewsInterval: config.statsViewsCalculateShorterPeriodsInterval,
        longerPeriodsViewsInterval: config.statsViewsCalculateLongerPeriodsInterval,
        longerPeriodsViewsScheduleDelay: config.statsViewsCalculateLongerPeriodsScheduleDelay,
        allTimeViewInterval: config.statsViewsCalculateAllTimeInterval,
        allTimeViewSheduleDelay: config.statsViewsCalculateAllTimeScheduleDelay
    });

    eventsSaver = new DeferredEventsSaver(analyticsRepository, config.eventsMaxInMemory, clock);
    eventsSaver.schedule(scheduler, config.eventsWriteInterval);

    const analyticsService = new AnalyticsService(analyticsRepository, eventsSaver, postsSource, config.analyticsAllowedPaths, clock);

    const app = express();

    app.use((req, res, next) => {
        if (req.originalUrl.startsWith("/webhooks/")) {
            express.raw({ type: "application/json" })(req, res, next);
        } else {
            express.json()(req, res, next);
        }
    });

    const corsOptions = {
        origin: config.corsAllowedOrigin,
        maxAge: config.corsMaxAgeSeconds
    };
    app.use(cors(corsOptions));

    // TODO: some metrics + diagnostics endpoint!
    app.post("/analytics/events", async (req, res) => {
        try {
            const ip = Web.sourceIp(req);
            const ipHash = Web.hashedIp(ip);
            const reqBody = req.body;
            const event = new Event(clock.nowTimestamp(), reqBody.visitorId, reqBody.sessionId, ipHash,
                reqBody.source, reqBody.medium, reqBody.campaign, reqBody.ref,
                reqBody.path, reqBody.type, reqBody.data);
            await analyticsService.addEvent(event);
        } catch (e) {
            if (e instanceof PingsFrequencyError) {
                // known issue; there is some kind of edge case, not worth investigating (for know)
            } else {
                Logger.logError(`Failed to add event ${JSON.stringify(req.body)}, ignoring it.`, e);
            }
        }

        res.sendStatus(200);
    });

    app.post("/newsletter/subscribers", async (req, res) => {
        try {
            const { email, placement, visitorId, sessionId, source, medium, campaign, ref, path } = req.body;
            const context = new SubscriberSignUpContext(visitorId, sessionId, source, medium, campaign, ref, path, placement);
            const subscriber = Subscriber.newOne(email, clock.nowTimestamp(), context);
            if (config.fixedNewsletterSubscribeResponseStatus) {
                setTimeout(() => res.sendStatus(config.fixedNewsletterSubscribeResponseStatus), 1000);
            } else {
                await subscriberService.subscribe(subscriber);
                res.sendStatus(201);
            }
        } catch (e) {
            if (e instanceof SubscriberExistsError) {
                res.sendStatus(409);
            } else if (e instanceof SubscriberValidationError) {
                res.sendStatus(422);
            } else {
                Logger.logError('Failed to create subscriber:', req.body, e);
                res.sendStatus(500);
            }
        }
    });

    app.post("/webhooks/newsletter", async (req, res) => {
        try {
            const signature = req.header("X-Buttondown-Signature") ?? "";
            if (await newsletterWebhookHandler.handle(req.body, signature)) {
                res.sendStatus(200);
            } else {
                Logger.logWarn("Invalid signature for webhook - rejecting it. Headers: ", req.headers);
                res.sendStatus(401);
            }
        } catch (e) {
            Logger.logError(`Failed to handle webhook event`, JSON.stringify(req.body), e);
            res.sendStatus(500);
        }
    });

    app.post("/internal/webhooks/newsletter", async (req, res) => {
        try {
            const { event_type, data } = req.body;
            await newsletterWebhookHandler.handleEvent(event_type, data);
            res.sendStatus(200);
        } catch (e) {
            Logger.logError(`Failed to handle webhook event ${JSON.stringify(req.body)}:`, e);
            res.sendStatus(500);
        }
    });

    app.post("/internal/synchronize-newsletter-webhook", async (_, res) => {
        try {
            await newsletterWebhookSynchronizer.synchronize();
            res.sendStatus(200);
        } catch (e) {
            Logger.logError(`Failed to synchronize newsletter webhook`, e);
            res.sendStatus(500);
        }
    });

    app.get("/meta/stats", async (_, res) => {
        try {
            const stats = await statsViews.views();
            res.send(stats);
        } catch (e) {
            Logger.logError("Problem while getting stats...", e);
            res.sendStatus(500);
        }
    });

    app.get("/meta/posts", async (_, res) => {
        try {
            res.send(postsSource.knownPosts());
        } catch (e) {
            Logger.logError("Problem while getting posts...", e);
            res.sendStatus(500);
        }
    });

    app.post("/internal/reload-posts", async (req, res) => {
        try {
            await postsSource.reload();
            res.send(postsSource.knownPosts());
        } catch (e) {
            Logger.logError("Problem while reloading posts...", e);
            res.sendStatus(500);
        }
    });

    app.post("/internal/calculate-stats-views", async (_, res) => {
        try {
            await statsViews.saveViewsForShorterPeriods();
            await statsViews.saveViewsForLongerPeriods();
            await statsViews.saveAllTimeView();

            const newViews = await statsViews.views();
            res.send(newViews);
        } catch (e) {
            Logger.logError("Problem while calculating stats views...", e);
            res.sendStatus(500);
        }
    });

    app.post("/internal/execute-db-query", async (req, res) => {
        try {
            await db.executeRaw(req.body.query);
            res.sendStatus(200);
        } catch (e) {
            Logger.logError(`Problem while executing arbitrary db query...`, req.body, e);
            res.sendStatus(500);
        }
    });

    app.use((error, req, res, next) => {
        Logger.logError("Something went wrong...", error);
        res.status(500);
        res.send({
            error: "INTERNAL_ERROR"
        });
    });

    server = app.listen(config.serverPort, () => {
        Logger.logInfo(`Server started on ${config.serverPort}`);
    });

    process.on('uncaughtException', err => {
        Logger.logError('Unhandled exception: ', err);
    });

    process.on('SIGTERM', () => {
        Logger.logInfo("Received SIGTERM signal, exiting...");
        stop();
    });

    process.on('SIGINT', () => {
        Logger.logInfo("Received SIGINT signal, exiting...");
        stop();
    });

    return {
        config, eventsSaver, statsViews, subscriberRepository, subscriberService,
        newsletterWebhookHandler, newsletterWebhookSynchronizer
    };
}

let closing = false;
export function stop(exit = true) {
    if (!server || closing) {
        return;
    }

    closing = true;

    server.close(async () => {
        try {
            Logger.logInfo("Server closed - closing scheduler, events saver and db");
            await scheduler.close();

            Logger.logInfo("Scheduler closed - saving potentially pending events");
            await eventsSaver.close();

            Logger.logInfo("All events saved - closing db");
            await db.close();

            Logger.logInfo("Db closed as well - the whole processed is about to exit successfully");

            if (exit) {
                process.exit(0);
            } else {
                Logger.logInfo("Exit disabled - process is owned somewhere upstream");
            }
        } catch (e) {
            Logger.logError("Problem when stopping the app - exiting with the error code", e);
            if (exit) {
                process.exit(1);
            } else {
                Logger.logInfo("Exit disabled - process is owned somewhere upstream");
            }
        }
    });

    Logger.logInfo("Closing all idle connections...");
    server.closeIdleConnections();

    setTimeout(() => {
        Logger.logWarn("Some connections refused to close; force-closing them");
        server.closeAllConnections();
    }, 3000);
}

//Start only if called directly from the console
const entryFile = process.argv?.[1];

if (entryFile.endsWith("server.js")) {
    Logger.logInfo("Starting server...");
    start();
} else {
    Logger.logInfo(`Different than ${entryFile} file, not starting the server!`);
}