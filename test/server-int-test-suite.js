import * as Server from "../src/server/server.js";
import { delay } from "../src/shared/promises.js";
import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import { TestClock, randomNumber } from "./test-utils.js";
import { SqliteDb } from "../src/server/db.js";
import * as MockServer from "./mock-server.js";
import { TestRequests } from "./web-tests.js";

const TMP_DIR = `/tmp/${crypto.randomUUID()}`;
const SERVER_PORT = 10_000 + Math.ceil(Math.random() * 10_000);
const MOCK_SERVER_PORT = 10_000 + Math.ceil(Math.random() * 10_000);
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;
const DB_PATH = path.join(TMP_DIR, "analytics.db");

export const testClock = new TestClock();
export const testRequests = new TestRequests(SERVER_URL);

const POSTS = [
    {
        slug: "about-postgres"
    },
    {
        slug: "abstractions"
    }
];
let additionalPosts = [];

let postsFetchesToFail = 0;

let eventsSaver = null;
let statsViews = null;

function postsHandler(req, res) {
    if (postsFetchesToFail > 0) {
        res.sendStatus(500);
        postsFetchesToFail--;
    } else {
        res.send([...POSTS, ...additionalPosts]);
    }
}

const NoOpScheduler = {
    schedule() { },
    close() { }
};

export const serverIntTestSuite = (testsDescription, testsCallback) => {
    describe(testsDescription, () => {
        before(async function () {
            fs.mkdirSync(TMP_DIR);

            process.env['SERVER_PORT'] = SERVER_PORT;
            process.env['DB_PATH'] = DB_PATH;
            process.env['DB_BACKUP_PATH'] = path.join(TMP_DIR, "analytics_backup.db");

            process.env['POSTS_HOST'] = MOCK_SERVER_URL;

            MockServer.start({
                port: MOCK_SERVER_PORT, getRoutes: [{
                    path: "/posts.json",
                    handler: postsHandler
                }
                ]
            });
            const app = await Server.start(testClock, NoOpScheduler, { retries: 3, initialDelay: 10, backoffMultiplier: 2 });
            ({ eventsSaver, statsViews } = app);

            // Currently good enough hack to wait for MockServer and Server readiness
            await delay(500);
            //Read posts.json
            await testRequests.reloadPosts();
        });

        afterEach(async () => {
            additionalPosts = [];
            await new SqliteDb(DB_PATH).execute("DELETE FROM event");
        });

        after(() => {
            Server.stop();
            MockServer.stop();
            fs.rmSync(TMP_DIR, { recursive: true, force: true });
        });

        testsCallback();
    })
};

export function randomAllowedPostPath() {
    const post = POSTS[randomNumber(0, POSTS.length)];
    return `/${post.slug}.html`;
}

export function failNextNPostsFetches(n) {
    postsFetchesToFail = n;
}

export function addPosts(posts) {
    additionalPosts = posts.map(p => { return { slug: p }; });
}

export async function assertAnalyticsEventsSaved() {
    await eventsSaver.saveEvents();
}

export async function assertStatsViewsCalculated() {
    await statsViews.saveViewsForShorterPeriods();
    await statsViews.saveViewsForLongerPeriods();
}

export async function assertAnalyticsEventsSavedStatsViewCalculated() {
    await assertAnalyticsEventsSaved();
    testClock.moveTimeByResonableAmount();
    await assertStatsViewsCalculated();
}