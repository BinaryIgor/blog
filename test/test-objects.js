import { Event } from "../src/server/analytics.js";
import { randomNumber, randomElement, randomString } from "./test-utils.js";
import { hashedIp } from "../src/server/web.js";
import crypto from 'crypto';

export const VIEW_EVENT_TYPE = "VIEW";
export const READ_EVENT_TYPE = "READ";
export const SCROLL_EVENT_TYPE = "SCROLL";
export const PING_EVENT_TYPE = "PING";

const EVENT_TYPES = [VIEW_EVENT_TYPE, READ_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE];

function randomEventType() {
    return randomElement(EVENT_TYPES);
}

export const TestObjects = {
    randomEvent({
        timestamp = randomNumber(1, Date.now()),
        visitorId = crypto.randomUUID(),
        ipHash = hashedIp(randomString(24)),
        source = `https://${randomString(5)}.com`,
        path = "/index.html",
        type = randomEventType(),
        data = type == SCROLL_EVENT_TYPE || type == PING_EVENT_TYPE ? 22 : null } = {}
    ) {
        return new Event(timestamp, visitorId, ipHash, source, path, type, data);
    }
};