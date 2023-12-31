import request from 'supertest';
import { assert } from "chai";

export class TestRequests {

    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }

    async addEventRequest(request, headers={}) {
        let req = this._appRequest()
            .post("/analytics/events");

        for (let [k, v] of Object.entries(headers)) {
            req.set(k, v);
        }

        return req.send(request);
    }

    async getStats() {
        return this._appRequest().get("/meta/stats");
    }

    async reloadPosts() { 
        return this._appRequest().post("/internal/reload-posts");
    }

    _appRequest() {
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