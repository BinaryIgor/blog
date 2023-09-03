import { View } from "../src/server/analytics.js";
import { randomNumber, randomString } from "./test-utils.js";
import { hashedIp } from "../src/server/web.js";
import crypto from 'crypto';

export const TestObjects = {
    randomView({
        timestamp = randomNumber(1, Date.now()),
        visitorId = crypto.randomUUID(),
        ipHash = hashedIp(randomString(24)),
        source = `https://${randomString(5)}.com`,
        path = "/index.html" } = {}
    ) {
        return new View(timestamp, visitorId, ipHash, source, path);
    }
};