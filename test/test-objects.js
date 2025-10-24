import { Event } from "../src/server/analytics.js";
import { randomNumber, randomElement, randomElementOrNull, randomString } from "./test-utils.js";
import { hashedIp } from "../src/server/web.js";
import crypto from 'crypto';

export const VIEW_EVENT_TYPE = "VIEW";
export const SCROLL_EVENT_TYPE = "SCROLL";
export const PING_EVENT_TYPE = "PING";

const EVENT_TYPES = [VIEW_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE];

const SOURCES = ["chatgpt.com", "binaryigor.com"];
const MEDIUMS = ["organic", "social", "email"];
const CAMPAIGNS = ["interesting-initiative", "not-so-interesting"];
const REFS = ["some-external-site/amazing-links/", "binaryigor/posts.html"];

function randomEventType() {
    return randomElement(EVENT_TYPES);
}

export const TestObjects = {
    randomEvent({
        timestamp = randomNumber(1, Date.now()),
        visitorId = crypto.randomUUID(),
        sessionId = crypto.randomUUID(),
        ipHash = hashedIp(randomString(24)),
        source = randomElement(SOURCES),
        medium = randomElementOrNull(MEDIUMS),
        campaign = randomElementOrNull(CAMPAIGNS),
        ref = randomElementOrNull(REFS),
        path = "/index.html",
        type = randomEventType(),
        data = type == SCROLL_EVENT_TYPE || type == PING_EVENT_TYPE ? 22 : null
    } = {}) {
        return new Event(timestamp, visitorId, sessionId, ipHash,
            source, medium, campaign, ref, path, type, data);
    }
};