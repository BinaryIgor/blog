import bodyParser from "body-parser";
import express from "express";
import { createHash } from "crypto";
import { AnalyticsService, DeferredSqliteAnalyticsRepository, View } from "./analytics.js";

import * as Config from "./config.js";

import { SqliteDb } from "./db.js";

import { Clock } from "../shared/clock.js";
import { PostsSource } from "./posts.js";

const REAL_IP_HEADER = "X-Real-Ip";

export async function start() {
    const config = Config.read();

    const db = new SqliteDb(config.dbPath);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS view (
        timestamp INTEGER(8) NOT NULL,
        visitor_id TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        path TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS view_timestamp ON view(timestamp);
    `);

    const clock = new Clock();

    const postsSource = new PostsSource(config.postsPath);

    const analyticsRepository = new DeferredSqliteAnalyticsRepository(db);
    const analylitcsService = new AnalyticsService(analyticsRepository, postsSource, config.analyticsAllowedPaths, clock);

    const app = express();

    app.use(bodyParser.json());

    app.post("/analytics/view", async (req, res) => {
        console.log("Posting view...");
        console.log(req.url);
        console.log(req.body);

        try {
            const ipHash = hashedIp(req);
            const reqBody = req.body;
            const view = new View(Date.now(), reqBody.visitorId, ipHash, reqBody.sourceUrl, reqBody.path);
            await analylitcsService.addView(view);
        } catch (e) {
            console.log("Failed to add view, ignoring the result", e);
        }

        res.sendStatus(200);
    });

    function hashedIp(req) {
        const ip = req.headers[REAL_IP_HEADER] || req.socket.remoteAddress;
        const hasher = createHash('sha256');
        hasher.update(ip)
        return hasher.digest("base64");
    }

    app.get("/stats", async (req, res) => {
        try {
            const stats = await analylitcsService.stats();
            res.send(stats);
        } catch (e) {
            console.log("Problem while getting stats...", e);
            res.sendStatus(500);
        }
    });

    app.use((error, req, res, next) => {
        console.error("Something went wrong...", error);
        res.status(500);
        res.send({
            error: "INTERNAL_ERROR"
        });
    });

    app.listen(config.serverPort, () => {
        console.log(`Server started on ${config.serverPort}`);
    });

    //TODO: graceful shutdown
    process.on('SIGTERM', () => {
        console.log("Received SIGTERM signal, exiting...")
        process.exit();
    });

    process.on('SIGINT', () => {
        console.log("Received SIGINT signal, exiting...")
        process.exit();
    });
}

//Start only if called directly from the console
const entryFile = process.argv?.[1];

if (entryFile.endsWith("server.js")) {
    console.log("Starting server...");
    start();
} else {
    console.log(`Different than ${entryFile} file, not starting the server!`);
}