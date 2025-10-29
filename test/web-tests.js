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

    postNewsletterSubscriber(request, headers = {}) {
        return fetch(`${this.#serverUrl}/newsletter/subscribers`, {
            method: "POST",
            body: JSON.stringify(request),
            headers: { ...headers, "content-type": "application/json" }
        });
    }

    postWebhookNewsletterEvent(request, headers = {}) {
        return fetch(`${this.#serverUrl}/webhooks/newsletter`, {
            method: "POST",
            body: request,
            headers: { ...headers, "content-type": "application/json" }
        });
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

export function assertCreatedResponseCode(requestResponse) {
    assertResponseCode(requestResponse, 201);
}

export function assertConflictResponseCode(requestResponse) {
    assertResponseCode(requestResponse, 409);
}

export function assertUnprocessableContentResponseCode(requestResponse) {
    assertResponseCode(requestResponse, 422);
}

export function assertUnauthenticatedResponseCode(requestResponse) {
    assertResponseCode(requestResponse, 401);
}