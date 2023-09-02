import * as Server from "../src/server/server.js";
import * as Files from "../src/shared/files.js";
import fs from "fs";
import crypto from 'crypto';
import path from 'path';

const TMP_DIR = `/tmp/${crypto.randomUUID()}`;
const SERVER_PORT = 10_000 + Math.ceil(Math.random() * 10_000);
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;

const SCHEDULED_TASKS_DELAY = 100;

const POSTS = [
    {
        slug: "about-postgres"
    },
    {
        slug: "abstractions"
    }
];

export const serverIntTestSuite = (testsDescription, testsCallback) => {
    describe(testsDescription, () => {
        before(async function () {
            console.log("Current dir: ", Files.currentDir());

            fs.mkdirSync(TMP_DIR);

            process.env['SERVER_PORT'] = SERVER_PORT;
            process.env['DB_PATH'] = path.join(TMP_DIR, "analytics.db");
            process.env['DB_BACKUP_PATH'] = path.join(TMP_DIR, "analytics_backup.db");

            const postsPath = path.join(TMP_DIR, "posts.json");

            process.env['POSTS_PATH'] = postsPath;

            await Files.writeTextFileContent(postsPath, JSON.stringify(POSTS));

            process.env["POSTS_READ_DELAY"] = SCHEDULED_TASKS_DELAY;
            process.env["VIEWS_WRITE_DELAY"] = SCHEDULED_TASKS_DELAY;

            await Server.start();
        });

        afterEach(async () => {
            console.log("After each...");

            fs.rmSync(TMP_DIR, { recursive: true, force: true });
        });

        after(() => {
            Server.stop();
        });

        testsCallback();
    })
};

export async function awaitForNextScheduledTasksRun() {
    await new Promise((resolve) => {
        setTimeout(resolve, SCHEDULED_TASKS_DELAY * 2);
    });
}