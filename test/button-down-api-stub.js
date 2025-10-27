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
    }
];

let _nextCreateSubscriberResponse = {
    status: 201,
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
    emailOrId: '',
    body: TestObjects.randomApiSubscriber()
};
export function nextGetSubscriberResponse(response) {
    _nextGetSubscriberResponse = response;
}
export function getSubscriberHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.params.emailOrId, _nextGetSubscriberResponse.emailOrId);
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
    emailOrId: '',
    type: '',
    body: TestObjects.randomApiSubscriber()
};
export function nextUpdateSubscriberResponse(response) {
    _nextUpdateSubscriberResponse = response;
}
export function updateSubscriberHandler(req, res) {
    if (isAuthenticated(req)) {
        validateRequestMatchesSetResponseValue(req.params.emailOrId, _nextUpdateSubscriberResponse.emailOrId);
        validateRequestMatchesSetResponseValue(req.params.type, _nextUpdateSubscriberResponse.type);
        if (_nextUpdateSubscriberResponse.body) {
            res.status(_nextUpdateSubscriberResponse.status)
                .send(_nextUpdateSubscriberResponse.body)
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