export class Clock {
    nowTimestamp() {
        return Date.now();
    }
}

export function timestampSecondsAgo(timestamp, seconds) {
    return timestamp - (seconds * 1000);
}

export function timestampFromIsoDateTime(isoDateTime) {
    return new Date(isoDateTime).getTime();
}