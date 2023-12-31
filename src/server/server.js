import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import { AnalyticsService, DeferredEventsSaver, SqliteAnalyticsRepository, Event } from "./analytics.js";
import { Scheduler } from "./scheduler.js";
import * as Logger from "../shared/logger.js";

import * as Web from "./web.js"

import * as Config from "./config.js";

import { SqliteDb, SqliteDbBackuper } from "./db.js";

import { Clock } from "../shared/dates.js";
import { PostsSource } from "./posts.js";

const REAL_IP_HEADER = "X-Real-Ip";

let server;
let scheduler;
let db;

export async function start(clock = new Clock(),
    schedulePosts = true,
    postsRetryConfig = {
        retries: 5,
        initialDelay: 500,
        backoffMultiplier: 2
    }) {
    const config = Config.read();

    db = new SqliteDb(config.dbPath);

    await db.executeRaw(`
    CREATE TABLE IF NOT EXISTS event (
        timestamp INTEGER(8) NOT NULL,
        visitor_id TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS event_timestamp ON event(timestamp);

    CREATE VIEW IF NOT EXISTS view AS SELECT * FROM event WHERE type = 'VIEW';
    CREATE VIEW IF NOT EXISTS read AS SELECT * FROM event WHERE type = 'READ';
    `);

    scheduler = new Scheduler();

    new SqliteDbBackuper(db, config.dbBackupPath, scheduler, config.dbBackupDelay);

    const postsSource = new PostsSource(config.postsPath,
        postsRetryConfig,
        schedulePosts ? scheduler : null,
        schedulePosts ? config.postsReadDelay : null);

    const analyticsRepository = new SqliteAnalyticsRepository(db);
    const eventsSaver = new DeferredEventsSaver(analyticsRepository, scheduler, config.viewsWriteDelay);
    const analylitcsService = new AnalyticsService(analyticsRepository, eventsSaver, postsSource, config.analyticsAllowedPaths, clock);

    const app = express();

    app.use(bodyParser.json());

    const corsOptions = {
        origin: config.corsAllowedOrigin
    };
    app.use(cors(corsOptions));

    app.post("/analytics/events", async (req, res) => {
        try {
            const ip = req.header(REAL_IP_HEADER) || req.socket.remoteAddress;
            const ipHash = Web.hashedIp(ip);
            const reqBody = req.body;
            const event = new Event(clock.nowTimestamp(), reqBody.visitorId, ipHash, reqBody.source, reqBody.path, reqBody.type);
            await analylitcsService.addEvent(event);
        } catch (e) {
            Logger.logError(`Failed to add event ${JSON.stringify(req.body)}, ignoring the result`, e);
        }

        res.sendStatus(200);
    });

    app.get("/meta/stats", async (req, res) => {
        try {
            const stats = await analylitcsService.stats();
            res.send(stats);
        } catch (e) {
            Logger.logError("Problem while getting stats...", e);
            res.sendStatus(500);
        }
    });

    app.get("/meta/posts", async (req, res) => {
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

    //TODO: graceful shutdown
    process.on('SIGTERM', () => {
        Logger.logInfo("Received SIGTERM signal, exiting...");
        stop();
        process.exit();
    });

    process.on('SIGINT', () => {
        Logger.logInfo("Received SIGINT signal, exiting...");
        stop();
        process.exit();
    });
}

export function stop() {
    if (server) {
        server.close();
    }
    if (scheduler) {
        scheduler.close();
    }
    if (db) {
        db.close();
    }
}

//Start only if called directly from the console
const entryFile = process.argv?.[1];

if (entryFile.endsWith("server.js")) {
    Logger.logInfo("Starting server...");
    start();
} else {
    Logger.logInfo(`Different than ${entryFile} file, not starting the server!`);
}