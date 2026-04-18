import { assert } from "chai";

export class TestRequests {

    #serverUrl;

    constructor(serverUrl) {
        this.#serverUrl = serverUrl;
    }

    async postEvent(request, headers = {}) {
        return fetch(`${this.#serverUrl}/analytics/events`, {
            method: "POST",
            body: JSON.stringify(request),
            headers: { ...headers, "content-type": "application/json" }
        });
    }

    async getStats() {
        return fetch(`${this.#serverUrl}/meta/stats`);
    }

    async reloadPosts() {
        return fetch(`${this.#serverUrl}/internal/reload-posts`, { method: "POST" });
    }
}

export async function assertJsonResponse(requestResponse, bodyAssert, responseCode = 200) {
    assertResponseCode(requestResponse, responseCode);
    assert.isTrue(requestResponse.headers.get('content-type').startsWith("application/json"));
    bodyAssert(await requestResponse.json())
}

export function assertResponseCode(requestResponse, responseCode) {
    assert.equal(requestResponse.status, responseCode);
}

export function assertOkResponseCode(requestResponse) {
    assertResponseCode(requestResponse, 200);
}