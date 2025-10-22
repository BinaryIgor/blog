import * as Validator from '../shared/validator.js';
import * as Logger from "../shared/logger.js";

const MAX_EMAIL_LENGTH = 125;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_SUBSCRIBER_SIGN_UP_PLACEMENTS = ["POST_MID", "POST_END", "POST_FLOATING", "LANDING"];

export class SubscriberService {

    /**
     * @type {SqliteSubscriberRepository} its interface really
     */
    #repository;
    #api;
    #clock;

    constructor(repository, api, clock) {
        this.#repository = repository;
        this.#api = api;
        this.#clock = clock;
    }

    /**
     * @param {Subscriber} subscriber
     * @returns {Promise<SubscribeResult>} one of the possible results
     */
    async subscribe(subscriber) {
        try {
            this.#validateSubscriber(subscriber);
        } catch (e) {
            Logger.logInfo("Invalid subscriber, rejecting it", e, subscriber);
            return SubscribeResult.INVALID_SUBSCRIBER_DATA;
        }

        const dbSubscriber = await this.#repository.createReturningExisting(subscriber);
        if (dbSubscriber.state == SubscriberState.UNSUBSCRIBED) {
            return await this.#resubscribe(dbSubscriber);
        }
        if (dbSubscriber.state != SubscriberState.CREATED) {
            return SubscribeResult.SUBSCRIBER_EXISTS;
        }

        const response = await this.#api.create(dbSubscriber.email);
        if (response.success()) {
            const apiSubscriber = response.data;
            await this.#repository.update({
                ...dbSubscriber,
                externalId: apiSubscriber.id,
                externalSource: apiSubscriber.source,
                externalType: apiSubscriber.type
            });
            return SubscribeResult.SUBSCRIBER_CREATED;
        }

        if (response.error == CreateSubsriberError.SUBSCRIBER_EXISTS) {
            return SubscribeResult.SUBSCRIBER_EXISTS;
        }
        return SubscribeResult.INVALID_SUBSCRIBER_DATA;
    }

    #validateSubscriber(subscriber) {
        if (!this.#isEmailValid(subscriber.email)) {
            throw new Error(`${subscriber.email} is not a valid email`);
        }
        Validator.validateEventContext(subscriber.signUpContext);
        if (!subscriber.placement || !ALLOWED_SUBSCRIBER_SIGN_UP_PLACEMENTS.includes(subscriber.placement)) {
            throw new Error(`${subscriber.placement} placement is not included in the allowed placements: ${ALLOWED_SUBSCRIBER_SIGN_UP_PLACEMENTS}`);
        }
    }

    #isEmailValid(email) {
        return email && email.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(email);
    }

    async #resubscribe(subscriber) {
        const apiSubscriber = await this.#api.get(subscriber.email);
        if (apiSubscriber.type == ApiSubscriberType.Unsubscribed) {
            await this.#api.update(subscriber.email, ApiSubscriberType.Regular);
        } else {
            Logger.logInfo(`Subscriber ${subscriber.email} has ${apiSubscriber.type} API type, not need to update them there `);
        }
        const updatedSubscriber = { ...subscriber, externalType: ApiSubscriberType.Regular };
        await this.#repository.update(updatedSubscriber);
    }

    async onSubscriberCreated(externalId) {
        // TODO: we might get them like this + it might be easier to just save them here!
    }

    // TODO: impls & tests
    async onSubscriberConfirmed(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);

        await this.#repository.update({
            ...dbSubscriber,
            externalId: apiSubscriber.id,
            externalSource: apiSubscriber.source,
            externalType: apiSubscriber.type,
            confirmedAt: this.#clock.nowTimestamp()
        });
    }

    async onSubscriberUnsubscribed(externalId) {

    }

    async onSubscriberDeleted(externalId) {

    }

    async onSubscriberUpdated(externalId) {

    }

    async onSubscriberOpened(externalId) {

    }

    async onSubscriberClicked(externalId) {

    }
}

export class SqliteSubscriberRepository {

    /**
     * interface from db.js file
     */
    #db;

    constructor(db) {
        this.#db = db;
    }

    async ofEmail(email) {
        // TODO
    }

    async createReturningExisting(subscriber) {
        // TODO impl
        return Promise.resolve(subscriber);
    }

    async update(subscriber) {

    }
}

export class ButtondownSubscriberApi {

    #url;
    #apiKey;

    constructor(url, apiKey) {
        this.#url = url;
        this.#apiKey = apiKey;
    }

    async create(email) {
        const response = await fetch(this.#subscribersUrl(), {
            method: "POST",
            headers: this.#withAuthorizationHeaders(),
            body: JSON.stringify({ email_address: email })
        });
        if (response.ok) {
            return ApiResponse.ofData(await response.json());
        }

        Logger.logWarn(`Failed to create subscriber - ${response.status}:`, await response.text());

        if (response.status == 409) {
            return ApiResponse.ofError(CreateSubsriberError.SUBSCRIBER_EXISTS);
        }
        if (response.status >= 500) {
            throw new Error(`Unhandled create subscriber error ` + response.status);
        }
        return ApiResponse.ofError(CreateSubsriberError.INVALID_OR_SUSPICIOUS_EMAIL);
    }

    #subscribersUrl() {
        return `${this.#url}/subscribers`;
    }

    #withAuthorizationHeaders(headers = {}) {
        return { ...headers, "Authorization": `Token: ${this.#apiKey}` };
    }

    async update(emailOrId, type) {

    }

    async get(emailOrId) {

    }
}

export class ButtondownWebhookHandler {

    #subscriberService;

    constructor(subscriberService) {
        this.#subscriberService = subscriberService;
    }

    async handle(event) {
        const eventType = event.event_type;
        const eventData = event.data;

        if (eventType == NewsletterWebhookEventType.SUBSCRIBER_CREATED) {
            this.#subscriberService.onSubscriberCreated(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_CONFIRMED) {
            this.#subscriberService.onSubscriberConfirmed(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_OPENED) {
            this.#subscriberService.onSubscriberOpened(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_CLICKED) {
            this.#subscriberService.onSubscriberOpened(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_UNSUBUBSCRIBED) {
            this.#subscriberService.onSubscriberUnsubscribed(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_DELETED) {
            this.#subscriberService.onSubscriberDeleted(eventData.subscriber);
        } else if (eventType == NewsletterWebhookEventType.SUBSCRIBER_UPDATED) {
            this.#subscriberService.onSubscriberUpdated(eventData.subscriber);
        } else {
            Logger.logWarn("Got webhook event but don't have dedicated handler for it just yet: ", event);
        }
    }
}

export const SubscriberState = {
    CREATED: "CREATED",
    CONFIRMED: "CONFIRMED",
    UNSUBSCRIBED: "UNSUBSCRIBED",
    DELETED: "DELETED"
};

export class Subscriber {

    get state() {
        if (this.deletedAt != null) {
            return SubscriberState.DELETED;
        }
        if (this.unsubscribedAt != null && this.externalType == ApiSubscriberType.Unsubscribed) {
            return SubscriberState.UNSUBSCRIBED;
        }
        if (this.confirmedAt != null) {
            return SubscriberState.CONFIRMED;
        }
        return SubscriberState.CREATED;
    }

    constructor(email, externalId, externalSource, externalType,
        createdAt, signedUpAt, signedUpCount,
        confirmedAt, unsubscribedAt, unsubscribedReason,
        lastOpenedAt, lastClickedAt, deletedAt,
        signUpContext) {
        this.email = email;
        this.externalId = externalId;
        this.externalSource = externalSource;
        this.externalType = externalType;
        this.createdAt = createdAt;
        this.signedUpAt = signedUpAt;
        this.signedUpCount = signedUpCount;
        this.confirmedAt = confirmedAt;
        this.unsubscribedAt = unsubscribedAt;
        this.unsubscribedReason = unsubscribedReason;
        this.lastOpenedAt = lastOpenedAt;
        this.lastClickedAt = lastClickedAt;
        this.deletedAt = deletedAt;
        this.signUpContext = signUpContext;
    }

    static newOne(email, now, signUpContext) {
        return new Subscriber(email, null, null, null, now, now, 1, null, null, null, null, null, null, signUpContext);
    }
}

export class SubscriberSignUpContext {
    constructor(visitorId, sessionId, source, medium, campaign, ref, placement) {
        this.visitorId = visitorId;
        this.sessionId = sessionId;
        this.source = source;
        this.medium = medium;
        this.campaign = campaign;
        this.ref = ref;
        this.placement = placement;
    }
}

export const SubscribeResult = {
    SUBSCRIBER_CREATED: "SUBSCRIBER_CREATED",
    SUBSCRIBER_EXISTS: "SUBSCRIBER_EXISTS",
    INVALID_SUBSCRIBER_DATA: "INVALID_SUBSCRIBER_DATA",
    FAILURE: "FAILURE"
};

// Subset of https://docs.buttondown.com/api-subscribers-type
const ApiSubscriberType = {
    Premium: 'Premium',
    Regular: 'Regular',
    Unactivated: 'Unactivated',
    Undeliverable: 'Undeliverable',
    Unsubscribed: 'Unsubscribed'
};

class ApiSubscriber {
    constructor(id, creation_date, avatar_url, churn_date, email_address,
        last_click_date, last_open_date, metadata, notes, source, tags,
        type, undeliverability_date, undeliverability_reason,
        unsubscription_date, unsubscription_reason,
        utm_campaign, utm_medium, utm_source) {
        this.id = id;
        this.creation_date = creation_date;
        this.avatar_url = avatar_url;
        this.churn_date = churn_date;
        this.email_address = email_address;
        this.last_click_date = last_click_date;
        this.last_open_date = last_open_date;
        this.metadata = metadata;
        this.notes = notes;
        this.source = source;
        this.tags = tags;
        this.type = type;
        this.undeliverability_date = undeliverability_date;
        this.undeliverability_reason = undeliverability_reason;
        this.unsubscription_date = unsubscription_date;
        this.unsubscription_reason = unsubscription_reason;
        this.utm_campaign = utm_campaign;
        this.utm_medium = utm_medium;
        this.utm_source = utm_source;
    }
}

const CreateSubsriberError = {
    SUBSCRIBER_EXISTS: "SUBSCRIBER_EXISTS",
    INVALID_OR_SUSPICIOUS_EMAIL: "INVALID_OR_SUSPICIOUS_EMAIL"
};

class ApiResponse {
    constructor(data, error) {
        this.data = data;
        this.error = error;
    }

    static ofData(data) {
        return new ApiResponse(data, null);
    }

    static ofError(error) {
        return new ApiResponse(null, error);
    }

    success() {
        return !this.error;
    }
}

export const NewsletterWebhookEventType = {
    SUBSCRIBER_BOUNCED: 'subscriber.bounced',
    SUBSCRIBER_CHANGED_EMAIL: 'subscriber.changed_email',
    SUBSCRIBER_CLICKED: 'subscriber.clicked',
    SUBSCRIBER_CONFIRMED: 'subscriber.confirmed',
    SUBSCRIBER_CREATED: 'subscriber.created',
    SUBSCRIBER_DELETED: 'subscriber.deleted',
    SUBSCRIBER_OPENED: 'subscriber.opened',
    SUBSCRIBER_UNSUBUBSCRIBED: 'subscriber.unsubscribed',
    SUBSCRIBER_UPDATED: 'subscriber.updated'
};