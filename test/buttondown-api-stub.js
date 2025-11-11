import { ApiSubscriberType } from "../src/server/newsletter.js";
import { TestObjects } from './test-objects.js';
import crypto from "crypto";

export const authToken = crypto.randomUUID();
export const webhookSigningKey = crypto.randomUUID();

export const routes = [
    {
        path: '/subscribers',
        method: "POST",
        handler: createSubscriberHandler
    },
    {
        path: '/subscribers/:emailOrId',
        method: "GET",
        handler: getSubscriberHandler
    },
    {
        path: '/subscribers/:emailOrId',
        method: "PATCH",
        handler: updateSubscriberHandler
    },
    {
        path: '/webhooks',
        method: "GET",
        handler: getWebhooksHandler
    },
    {
        path: '/webhooks',
        method: "POST",
        handler: createWebhookHandler
    },
    {
        path: '/webhooks/:id',
        method: "PATCH",
        handler: updateWebhookHandler
    }
];

let _nextCreateSubscriberResponse = {
    status: 201,
    expectedEmailAddress: '',
    expectedIpAddress: '',
    body: {
        id: crypto.randomUUID(),
        source: "API",
        type: ApiSubscriberType.Regular
    }
};
export function nextCreateSubscriberResponse(response) {
    _nextCreateSubscriberResponse = response;
}

function createSubscriberHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.body.email_address, _nextCreateSubscriberResponse.expectedEmailAddress);
        validateRequestMatchesSetResponseValue(req.body.ip_address, _nextCreateSubscriberResponse.expectedIpAddress);
        if (_nextCreateSubscriberResponse.body) {
            res.status(_nextCreateSubscriberResponse.status)
                .send(_nextCreateSubscriberResponse.body);
        } else {
            res.sendStatus(_nextCreateSubscriberResponse.status);
        }
    } else {
        res.sendStatus(401);
    }
}

function isAuthenticated(req) {
    return req.header("Authorization")?.replace("Token ", "") == authToken;
}

let _nextGetSubscriberResponse = {
    status: 200,
    expectedEmailOrId: '',
    body: TestObjects.randomApiSubscriber()
};
export function nextGetSubscriberResponse(response) {
    _nextGetSubscriberResponse = response;
}
function getSubscriberHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.params.emailOrId, _nextGetSubscriberResponse.expectedEmailOrId);
        if (_nextGetSubscriberResponse.body) {
            res.status(_nextGetSubscriberResponse.status)
                .send(_nextGetSubscriberResponse.body)
        } else {
            res.sendStatus(_nextGetSubscriberResponse.status);
        }
    } else {
        res.sendStatus(401);
    }
}

function validateRequestMatchesSetResponseValue(reqValue, resValue) {
    const requestMatchingSetResponse = isFieldMatching(reqValue, resValue);
    if (!requestMatchingSetResponse) {
        console.error("Request doesn't match set response value!", reqValue, resValue);
        throw new Error("Request doesn't match set response value");
    }
}

function isFieldMatching(reqValue, resValue) {
    if (!resValue) {
        return true;
    }
    return resValue == reqValue;
}

let _nextUpdateSubscriberResponse = {
    status: 200,
    expectedEmailOrId: '',
    expectedType: '',
    body: TestObjects.randomApiSubscriber()
};
export function nextUpdateSubscriberResponse(response) {
    _nextUpdateSubscriberResponse = response;
}
function updateSubscriberHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.params.emailOrId, _nextUpdateSubscriberResponse.expectedEmailOrId);
        validateRequestMatchesSetResponseValue(req.body.type, _nextUpdateSubscriberResponse.expectedType);
        if (_nextUpdateSubscriberResponse.body) {
            res.status(_nextUpdateSubscriberResponse.status)
                .send(_nextUpdateSubscriberResponse.body);
        } else {
            res.sendStatus(_nextUpdateSubscriberResponse.status);
        }
    } else {
        res.sendStatus(401);
    }
}

export function signedWebhookEvent(eventType, data, signingKey = webhookSigningKey) {
    const event = Buffer.from(JSON.stringify({ event_type: eventType, data }), "utf-8");
    const signature = crypto.createHmac('sha256', signingKey)
        .update(event)
        .digest("hex");
    return { event, signature: `sha256=${signature}` };
}

let _nextGetWebhooksResponse = {
    status: 200,
    body: {
        results: [],
        count: 0
    }
};
export function nextGetWebhooksResponse(response) {
    _nextGetWebhooksResponse = response;
}
function getWebhooksHandler(req, res) {
    if (isAuthenticated(req)) {
        if (_nextGetWebhooksResponse.body) {
            res.status(_nextGetWebhooksResponse.status)
                .send(_nextGetWebhooksResponse.body);
        } else {
            res.sendStatus(_nextGetWebhooksResponse.status);
        }
    } else {
        res.sendStatus(401);
    }
}

let _nextCreateWebhookResponse = {
    status: 201,
    assertReceivedExpectedBody: (received) => { }
};
export function nextCreateWebhookResponse(response) {
    _nextCreateWebhookResponse = response;
}
function createWebhookHandler(req, res) {
    if (isAuthenticated(req)) {
        _nextCreateWebhookResponse.assertReceivedExpectedBody(req.body);
        res.sendStatus(_nextCreateWebhookResponse.status);
    } else {
        res.sendStatus(401);
    }
}

let _nextUpdateWebhookResponse = {
    status: 200,
    expectedId: '',
    assertReceivedExpectedBody: (received) => { }
};
export function nextUpdateWebhookResponse(response) {
    _nextUpdateWebhookResponse = response;
}
function updateWebhookHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.params.id, _nextUpdateWebhookResponse.expectedId);
        _nextUpdateWebhookResponse.assertReceivedExpectedBody(req.body);
        res.sendStatus(_nextCreateWebhookResponse.status);
    } else {
        res.sendStatus(401);
    }
}

