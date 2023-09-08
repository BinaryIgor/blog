export class Clock {

    nowTimestamp() {
        return Date.now();
    }
}

export function timestampSecondsAgo(timestamp, seconds) {
    return timestamp - (seconds * 1000);
}