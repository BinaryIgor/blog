import { assert } from "chai";

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomNumber(from, to) {
    if (from >= to) {
        throw new Error(`From must be grater that to! From: ${from}, to: ${to}`);
    }
    return from + Math.floor(Math.random() * (to - from));
}

export function randomString(length = 10) {
    let result = "";

    while (result.length < length) {
        result += CHARACTERS.charAt(randomNumber(0, CHARACTERS.length));
    }

    return result;
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

    moveTimeByResonableAmount() {
        this.moveTimeBy(10);
    }

    now() {
        return this._now;
    }

    nowTimestamp() {
        return this.now().getTime();
    }
}