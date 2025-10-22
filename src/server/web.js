import { createHash } from "crypto";

const REAL_IP_HEADER = "X-Real-Ip";

export function sourceIp(req) {
    return req.header(REAL_IP_HEADER) || req.socket.remoteAddress;
}

export function hashedIp(ip) {
    const hasher = createHash('sha256');
    hasher.update(ip)
    return hasher.digest("base64");
}