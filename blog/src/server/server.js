import bodyParser from "body-parser";
import express from "express";
import { createHash } from "crypto";
import { AnalyticsService, SqliteAnalyticsRepository, View } from "./analytics.js";

import sqlite3 from "sqlite3";

const db = new sqlite3.Database(":memory:");

db.serialize(() => {
    db.run(`
    CREATE TABLE view (
        timestamp INTEGER(8) NOT NULL,
        visitor_id TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        path TEXT NOT NULL
    );

    CREATE INDEX view_timestamp ON view(timestamp);
    `);

});

const analyticsRepository = new SqliteAnalyticsRepository(db);
const analylitcsService = new AnalyticsService(analyticsRepository);

const app = express();

app.use(bodyParser.json());

app.post("/analytics/view", (req, res) => {
    console.log("Getting view...");
    console.log(req.url);
    console.log(req.body);

    try {
        const ipHash = hashedIp(req);
        const reqBody = req.body;
        const view = new View(Date.now(), reqBody.visitorId, ipHash, reqBody.sourceUrl, "/some-post.html");
        analylitcsService.addView(view);
    } catch (e) {
        console.log("Failed to add view, ignoring the result", e);
    }

    res.sendStatus(200);
});

function hashedIp(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log("Ip address...", ip);
    const hasher = createHash('sha256');
    hasher.update(ip)
    return hasher.digest("hex");
}

app.post("/analytics/post-view", (req, res) => {
    console.log("Getting post view...");
    console.log(req.url);
    console.log(req.body);

    res.sendStatus(200);
});

app.get("/stats", (req, res) => {

    analyticsRepository.generalStats();

    res.send({ views: 1000 });
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