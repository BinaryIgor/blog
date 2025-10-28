import { Event } from "../src/server/analytics.js";
import { Subscriber, SubscriberSignUpContext, SubscriberState, ApiSubscriber, ApiSubscriberType } from "../src/server/newsletter.js";
import { randomNumber, randomElement, randomElementOrNull, randomString, randomBoolean } from "./test-utils.js";
import { hashedIp } from "../src/server/web.js";
import crypto from 'crypto';

export const VIEW_EVENT_TYPE = "VIEW";
export const SCROLL_EVENT_TYPE = "SCROLL";
export const PING_EVENT_TYPE = "PING";

const EVENT_TYPES = [VIEW_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE];

const SOURCES = ["chatgpt.com", "binaryigor.com"];
const MEDIUMS = ["organic", "social", "email"];
const CAMPAIGNS = ["interesting-initiative", "not-so-interesting"];
const REFS = ["some-external-site/amazing-links/", "binaryigor/posts.html"];
const SUBSCRIBER_SIGN_UP_PLACEMENTS = ["POST_MID", "POST_END", "POST_FLOATING", "LANDING"];
const SUBSCRIBER_STATES = [SubscriberState.CREATED, SubscriberState.CONFIRMED, SubscriberState.UNSUBSCRIBED];

// https://docs.buttondown.com/api-subscribers-type
const API_SUBSCRIBER_TYPES = ['Premium', 'Regular', 'Unactivated', 'Undeliverable', 'Unsubscribed'];
// https://docs.buttondown.com/api-subscribers-source
const API_SUBSCRIBER_SOURCES = ['Admin', 'API', 'Organic'];

function randomEventType() {
    return randomElement(EVENT_TYPES);
}

function randomPastTimestamp() {
    return randomNumber(1, Date.now());
}

function randomPastIsoDateTime() {
    return new Date(randomPastTimestamp()).toISOString();
}

export const TestObjects = {
    randomEvent({
        timestamp = randomPastTimestamp(),
        visitorId = crypto.randomUUID(),
        sessionId = crypto.randomUUID(),
        ipHash = hashedIp(randomString(24)),
        source = randomElement(SOURCES),
        medium = randomElementOrNull(MEDIUMS),
        campaign = randomElementOrNull(CAMPAIGNS),
        ref = randomElementOrNull(REFS),
        path = "/index.html",
        type = randomEventType(),
        data = type == SCROLL_EVENT_TYPE || type == PING_EVENT_TYPE ? 22 : null
    } = {}) {
        return new Event(timestamp, visitorId, sessionId, ipHash,
            source, medium, campaign, ref, path, type, data);
    },
    randomSubscriberSignUpContext({
        visitorId = crypto.randomUUID(),
        sessionId = crypto.randomUUID(),
        source = randomElement(SOURCES),
        medium = randomElementOrNull(MEDIUMS),
        campaign = randomElementOrNull(CAMPAIGNS),
        ref = randomElementOrNull(REFS),
        placement = randomElement(SUBSCRIBER_SIGN_UP_PLACEMENTS)
    } = {}) {
        return new SubscriberSignUpContext(visitorId, sessionId, source, medium, campaign, ref, placement);
    },
    randomEmail() {
        return `${randomString()}@email.com`;
    },
    randomSubscriber({ email = this.randomEmail(),
        externalId = randomBoolean() ? crypto.randomUUID() : null,
        externalSource = randomElementOrNull(API_SUBSCRIBER_SOURCES),
        externalType = randomElementOrNull(API_SUBSCRIBER_TYPES),
        createdAt = randomPastTimestamp(),
        signedUpAt = randomPastTimestamp(),
        state = randomElement(SUBSCRIBER_STATES),
        confirmedAt = state == SubscriberState.CREATED ? null : randomPastTimestamp(),
        unsubscribedAt = state == SubscriberState.UNSUBSCRIBED ? randomPastTimestamp() : null,
        unsubscribedReason = state == SubscriberState.UNSUBSCRIBED ? "some reason" : null,
        lastOpenedAt = randomBoolean() ? randomPastTimestamp() : null,
        lastClickedAt = randomBoolean() ? randomPastTimestamp() : null,
        signUpContext = this.randomSubscriberSignUpContext()
    } = {}) {
        return new Subscriber(email, externalId, externalSource, externalType,
            createdAt, signedUpAt, confirmedAt, unsubscribedAt, unsubscribedReason,
            lastOpenedAt, lastClickedAt, state, signUpContext);
    },
    randomApiSubscriber({ id = crypto.randomUUID(),
        creationDate = randomPastIsoDateTime(),
        avatar_url = null,
        churn_date = null,
        email_address = this.randomEmail(),
        last_click_date = randomBoolean ? randomPastIsoDateTime() : null,
        last_open_date = randomBoolean() ? randomPastIsoDateTime() : null,
        metadata = {},
        notes = "",
        source = randomElement(API_SUBSCRIBER_SOURCES),
        tags = null,
        type = randomElement(API_SUBSCRIBER_TYPES),
        undeliverability_date = null,
        undeliverability_reason = null,
        unsubscription_date = type == ApiSubscriberType.Unsubscribed ? randomPastIsoDateTime() : null,
        unsubscription_reason = type == ApiSubscriberType.Unsubscribed ? randomString() : null,
        utm_campaign = null,
        utm_medium = null,
        utm_source = null
    } = {}) {
        return new ApiSubscriber(id, creationDate, avatar_url, churn_date, email_address,
            last_click_date, last_open_date, metadata, notes, source, tags, type,
            undeliverability_date, undeliverability_reason, unsubscription_date, unsubscription_reason,
            utm_campaign, utm_medium, utm_source);
    }
};