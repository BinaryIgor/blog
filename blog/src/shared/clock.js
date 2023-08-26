export class Clock {

    nowTimestamp() {
        return Date.now();
    }

    timestampSecondsAgo(seconds) {
        return this.nowTimestamp() - (seconds * 1000); 
    }
}