import { Event } from "../src/server/analytics.js";
import { randomNumber, randomString } from "./test-utils.js";
import { hashedIp } from "../src/server/web.js";
import crypto from 'crypto';

export const VIEW_EVENT_TYPE = "VIEW";
export const READ_EVENT_TYPE = "READ";

function randomEventType() {
    return Math.random < 0.5 ? VIEW_EVENT_TYPE : READ_EVENT_TYPE;
}

export const TestObjects = {
    randomEvent({
        timestamp = randomNumber(1, Date.now()),
        visitorId = crypto.randomUUID(),
        ipHash = hashedIp(randomString(24)),
        source = `https://${randomString(5)}.com`,
        path = "/index.html",
        type = randomEventType() } = {}
    ) {
        return new Event(timestamp, visitorId, ipHash, source, path, type);
    }
};