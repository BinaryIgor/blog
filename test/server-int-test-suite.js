import * as Server from "../src/server/server.js";
import { delay } from "../src/shared/promises.js";
import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import { TestClock } from "./test-utils.js";
import { SqliteDb } from "../src/server/db.js";
import * as MockServer from "./mock-server.js";
import { TestRequests } from "./web-tests.js";
import {
    routes as buttondownApiRoutes,
    authToken as buttondownApiKey,
    webhookSigningKey as buttondownWebhookSigningKey
} from './buttondown-api-stub.js';
import { route as postsRoute } from './posts-api-stub.js';

export const testClock = new TestClock();
export let testRequests;

export let appConfig;

let eventsSaver = null;
let statsViews = null;
export let subscriberRepository = null;
export let newsletterWebhookHandler = null;
export let newsletterWebhookSynchronizer = null;

let tmpDir;
let dbPath;

const NoOpScheduler = {
    schedule() { },
    close() { }
};

export const serverIntTestSuite = (testsDescription, testsCallback) => {
    describe(testsDescription, function () {
        this.slow(250);

        before(async function () {
            tmpDir = `/tmp/${crypto.randomUUID()}`;
            const serverPort = randomPort();
            const serverUrl = `http://localhost:${serverPort}`;
            const mockServerPort = randomPort();
            const mockServerlUrl = `http://localhost:${mockServerPort}`;
            dbPath = path.join(tmpDir, "analytics.db");

            testRequests = new TestRequests(serverUrl);

            fs.mkdirSync(tmpDir);

            process.env['SERVER_PORT'] = serverPort;
            process.env['DB_PATH'] = dbPath;
            process.env['DB_BACKUP_PATH'] = path.join(tmpDir, "analytics_backup.db");

            process.env['POSTS_HOST'] = mockServerlUrl;

            process.env["BUTTONDOWN_API_URL"] = mockServerlUrl;
            process.env["BUTTONDOWN_API_KEY"] = buttondownApiKey;
            process.env["BUTTONDOWN_WEBHOOK_URL"] = mockServerlUrl;
            process.env["BUTTONDOWN_WEBHOOK_SIGNING_KEY"] = buttondownWebhookSigningKey;

            MockServer.start({
                port: mockServerPort,
                routes: [...buttondownApiRoutes, postsRoute]
            });
            const app = await Server.start(testClock, NoOpScheduler, { retries: 3, initialDelay: 10, backoffMultiplier: 2 });
            ({ config: appConfig, eventsSaver, statsViews, subscriberRepository, newsletterWebhookHandler, newsletterWebhookSynchronizer } = app);

            // Currently, good enough hack to wait for MockServer and Server readiness
            await delay(250);
            //Read posts.json
            await testRequests.reloadPosts();
        });

        afterEach(async () => {
            const db = new SqliteDb(dbPath);
            await db.execute("DELETE FROM event");
            await db.execute("DELETE FROM subscriber");
            await db.execute("DELETE FROM stats_view");
        });

        after(() => {
            Server.stop(false);
            MockServer.stop();
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        testsCallback();
    })
};

export async function assertAnalyticsEventsSaved() {
    await eventsSaver.saveEvents();
}

export async function assertStatsViewsCalculated() {
    await statsViews.saveViewsForShorterPeriods();
    await statsViews.saveViewsForLongerPeriods();
    await statsViews.saveAllTimeView();
}

export async function assertAnalyticsEventsSavedAndStatsViewCalculated() {
    await assertAnalyticsEventsSaved();
    await assertStatsViewsCalculated();
}

function randomPort() {
    return 10_000 + Math.ceil(Math.random() * 10_000);
}