export function delay(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

export function randomDelay(min, max) {
    const delayMillis = min + ((max - min) * Math.random());
    return delay(delayMillis);
}