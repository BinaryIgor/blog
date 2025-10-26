import request from 'supertest';
import { assert } from "chai";

export class TestRequests {

    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }

    async postEvent(request, headers = {}) {
        let req = this.#appRequest()
            .post("/analytics/events");

        for (let [k, v] of Object.entries(headers)) {
            req.set(k, v);
        }

        return req.send(request);
    }

    async getStats() {
        return this.#appRequest().get("/meta/stats");
    }

    async reloadPosts() {
        return this.#appRequest().post("/internal/reload-posts");
    }

    postNewsletterSubscriber(request, headers = {}) {
        let req = this.#appRequest()
            .post("/newsletter/subscribers");

        for (let [k, v] of Object.entries(headers)) {
            req.set(k, v);
        }

        return req.send(request);
    }

    #appRequest() {
        return request(this.serverUrl);
    }
}

export function assertJsonResponse(requestResponse, bodyAssert, responseCode = 200) {
    assertResponseCode(requestResponse, responseCode);
    assert.isTrue(requestResponse.header['content-type'].startsWith("application/json"));
    bodyAssert(requestResponse.body)
}

export function assertResponseCode(requestResponse, responseCode) {
    assert.equal(requestResponse.statusCode, responseCode);
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