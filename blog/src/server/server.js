import bodyParser from "body-parser";
import express from "express";
import { createHash } from "crypto";
import {AnalyticsService, View, PostView } from "./analytics.js";

const analylitcsService = new AnalyticsService({});

const app = express();

app.use(bodyParser.json());

app.post("/analytics/view", (req, res) => {
    console.log("Getting view...");
    console.log(req.url);
    console.log(req.body);

    const ipHash = hashedIp(req);

    try {
        const reqBody = req.body;
        const view = new View(reqBody.sourceUrl, Date.now(), ipHash, reqBody.visitorId);
        analylitcsService.addView(view);
    } catch(e) {
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
    res.send({ views: 1000});
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