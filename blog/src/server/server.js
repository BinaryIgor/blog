import bodyParser from "body-parser";
import express from "express";
import { createHash } from "crypto";
import { AnalyticsService, SqliteAnalyticsRepository, View } from "./analytics.js";

import * as Config from "./config.js";

import { SqliteDb } from "./db.js";

import { Clock } from "../shared/clock.js";

const config = Config.read();

const db = new SqliteDb(config.dbPath);

const VALID_PATHS = [
    "/",
    "index.html",
    "about.html",
    "posts.html"
];

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

const analyticsRepository = new SqliteAnalyticsRepository(db);
const analylitcsService = new AnalyticsService(analyticsRepository, clock);

const app = express();

app.use(bodyParser.json());

app.post("/analytics/view", async (req, res) => {
    console.log("Getting view...");
    console.log(req.url);
    console.log(req.body);

    try {
        const ipHash = hashedIp(req);
        const reqBody = req.body;
        const view = new View(Date.now(), reqBody.visitorId, ipHash, reqBody.sourceUrl, "/some-post.html");
        await analylitcsService.addView(view);
    } catch (e) {
        console.log("Failed to add view, ignoring the result", e);
    }

    res.sendStatus(200);
});

function hashedIp(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Ip address...", ip);
    //Shorter hash!
    const hasher = createHash('sha1');
    hasher.update(ip)
    return hasher.digest("hex");
}

app.post("/analytics/post-view", (req, res) => {
    console.log("Getting post view...");
    console.log(req.url);
    console.log(req.body);

    res.sendStatus(200);
});

app.get("/stats", async (req, res) => {
    try {
        const stats = await analyticsRepository.generalStats();
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
        error: "ERROR"
    });
});

app.listen(8080, () => {
    console.log(`Server started on 8080`);
});