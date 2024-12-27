import { assert } from "chai";

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomBoolean() {
    return Math.random() < 0.5;
}

export function randomNumber(from, to) {
    if (from >= to) {
        throw new Error(`From must be grater that to! From: ${from}, to: ${to}`);
    }
    return from + Math.floor(Math.random() * (to - from));
}

export function randomElement(elements) {
    if (elements.length == 0) {
        throw new Error("Can't return random element from empty set!");
    }
    return elements[randomNumber(0, elements.length)];
}

export function randomString(length = 10) {
    let result = "";

    while (result.length < length) {
        result += CHARACTERS.charAt(randomNumber(0, CHARACTERS.length));
    }

    return result;
}

export function sortByField(elements, field, reverse = false) {
    if (reverse) {
        return elements.sort((a, b) => a[field] < b[field] ? 1 : (a[field] == b[field]) ? 0 : -1);
    }
    return elements.sort((a, b) => a[field] > b[field] ? 1 : (a[field] == b[field]) ? 0 : -1);
}

export async function assertThrowsException(func, type, containsMessage = null) {
    try {
        await func;
        assert.isFalse(true, "No exception was thrown");
    } catch (e) {
        assert.instanceOf(e, type);
        if (e instanceof Error && containsMessage) {
            assert.isTrue(e.message.includes(containsMessage));
        }
    }
}

export class TestClock {

    _now = new Date();
    _initialTime = new Date(this._now.getTime());

    setInitialTime() {
        this._now.setTime(this._initialTime.getTime());
    }

    setTime(now) {
        this._now = now;
    }

    moveTimeBy(seconds) {
        this._now.setTime(this._now.getTime() + (seconds * 1000));
    }

    moveTimeByReasonableAmount() {
        this.moveTimeBy(10);
    }

    now() {
        return this._now;
    }

    nowTimestamp() {
        return this.now().getTime();
    }
}