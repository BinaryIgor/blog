import { createHash } from "crypto";

export function hashedIp(ip) {
    const hasher = createHash('sha256');
    hasher.update(ip)
    return hasher.digest("base64");
}
