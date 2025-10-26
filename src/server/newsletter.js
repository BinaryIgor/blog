import * as Validator from './validator.js';
import * as Logger from "../shared/logger.js";
import * as Dates from '../shared/dates.js';
import * as Promises from '../shared/promises.js';
import { snakeCasedObject } from './db.js';

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
            Logger.logWarn("Invalid subscriber, rejecting it", e, subscriber);
            throw new SubscriberValidationError('Invalid subscriber data');
        }

        const dbSubscriber = await this.#repository.createReturningExisting(subscriber);
        if (dbSubscriber.state == SubscriberState.UNSUBSCRIBED) {
            await this.#resubscribe(dbSubscriber);
            return;
        }
        if (dbSubscriber.state == SubscriberState.CONFIRMED || dbSubscriber.hasExternalId()) {
            throw SubscriberExistsError.ofEmail(subscriber.email);
        }

        const apiSubscriber = await this.#api.create(dbSubscriber.email);

        await this.#repository.updateOfEmail(dbSubscriber.email, {
            externalId: apiSubscriber.id,
            externalSource: apiSubscriber.source,
            externalType: apiSubscriber.type
        });
    }

    #validateSubscriber(subscriber) {
        if (!this.#isEmailValid(subscriber.email)) {
            throw new Error(`${subscriber.email} is not a valid email`);
        }

        if (!subscriber.signUpContext) {
            return;
        }

        Validator.validateEventContext(subscriber.signUpContext);

        const placement = subscriber.signUpContext.placement;
        if (!placement || !ALLOWED_SUBSCRIBER_SIGN_UP_PLACEMENTS.includes(placement)) {
            throw new Error(`${placement} sign up placement is not included in the allowed placements: ${ALLOWED_SUBSCRIBER_SIGN_UP_PLACEMENTS}`);
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
            Logger.logInfo(`Subscriber ${subscriber.email} has ${apiSubscriber.type} API type, not need to update them there`);
        }
        await this.#repository.updateOfEmail(subscriber.email, {
            externalType: ApiSubscriberType.Regular,
            signedUpAt: this.#clock.nowTimestamp()
        });
    }

    async onSubscriberCreated(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);
        if (dbSubscriber) {
            Logger.logInfo(`Subscriber ${dbSubscriber.email}:${externalId} exists, not need to create them`);
        } else {
            const newSubscriber = Subscriber.newOne(apiSubscriber.email_address, this.#clock.nowTimestamp(), null, {
                externalId: apiSubscriber.id,
                externalSource: apiSubscriber.source,
                externalType: apiSubscriber.type
            });
            Logger.logInfo("Got completely new subscriber from a webhook, creating them!", newSubscriber);
            await this.#repository.createReturningExisting(newSubscriber);
        }
    }

    async onSubscriberConfirmed(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const updated = await this.#repository.updateOfEmail(apiSubscriber.email_address, {
            externalId: apiSubscriber.id,
            externalSource: apiSubscriber.source,
            externalType: apiSubscriber.type,
            confirmedAt: this.#clock.nowTimestamp(),
            state: SubscriberState.CONFIRMED
        });
        if (!updated) {
            Logger.logWarn("Received non existing subscriber confirmation:", apiSubscriber);
        }
    }

    async onSubscriberUnsubscribed(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);
        if (dbSubscriber) {
            await this.#repository.updateOfEmail(apiSubscriber.email_address, {
                unsubscribedAt: Dates.timestampFromIsoDateTime(apiSubscriber.unsubscription_date),
                unsubscribedReason: apiSubscriber.unsubscription_reason,
                state: SubscriberState.UNSUBSCRIBED
            });
        } else {
            Logger.logWarn("Non existing subscriber unsubscribed; ignoring it", apiSubscriber);
        }
    }

    async onSubscriberDeleted(externalId) {
        const subscriber = await this.#repository.ofExternalId(externalId);
        if (subscriber) {
            Logger.logInfo('Deleting subscriber:', subscriber);
            await this.#repository.deleteOfEmail(subscriber.email);
        } else {
            Logger.logWarn('Received non existing subscribed deletion; ignoring it', subscriber);
        }
    }

    // TODO: impl if needed
    async onSubscriberUpdated(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);
        if (dbSubscriber) {
            Logger.logInfo("Received update request for subscriber. API vs DB:", apiSubscriber, dbSubscriber);
        } else {
            Logger.logWarn("Received update request for non existing subscriber; ignoring it:", apiSubscriber);
        }
    }

    async onSubscriberOpened(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);
        if (dbSubscriber) {
            await this.#repository.updateOfEmail(apiSubscriber.email_address, {
                lastOpenedAt: Dates.timestampFromIsoDateTime(apiSubscriber.last_open_date)
            });
        }
    }

    async onSubscriberClicked(externalId) {
        const apiSubscriber = await this.#api.get(externalId);
        const dbSubscriber = await this.#repository.ofEmail(apiSubscriber.email_address);
        if (dbSubscriber) {
            await this.#repository.updateOfEmail(apiSubscriber.email_address, {
                lastClickedAt: Dates.timestampFromIsoDateTime(apiSubscriber.last_click_date)
            });
        }
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
        const row = await this.#db.queryOne(`SELECT * FROM subscriber WHERE email = ?`, [email]);
        return row ? this.#rowToSubscriber(row) : null;
    }

    #rowToSubscriber(row) {
        return new Subscriber(row['email'], row['external_id'], row['external_source'], row['external_type'],
            row['created_at'], row['signed_up_at'], row['confirmed_at'],
            row['unsubscribed_at'], row['unsubscribed_reason'],
            row['last_opened_at'], row['last_clicked_at'], row['state'],
            this.#rowToSubscriberSignUpContext(row)
        );
    }

    #rowToSubscriberSignUpContext(row) {
        let visitorId = row['sign_up_context_visitor_id'];
        if (!visitorId) {
            return null;
        }
        return new SubscriberSignUpContext(visitorId, row['sign_up_context_session_id'],
            row['sign_up_context_source'], row['sign_up_context_medium'], row['sign_up_context_campaign'],
            row['sign_up_context_ref'], row['sign_up_context_placement']
        );
    }

    async ofExternalId(externalId) {
        const row = await this.#db.queryOne(`SELECT * FROM subscriber WHERE external_id = ?`, [externalId]);
        return row ? this.#rowToSubscriber(row) : null;
    }

    async createReturningExisting(subscriber) {
        const row = await this.#db.queryOne(`
        INSERT INTO subscriber (email, external_id, external_source, external_type, 
            created_at, signed_up_at, confirmed_at, unsubscribed_at, unsubscribed_reason,
            last_opened_at, last_clicked_at, state, 
            sign_up_context_visitor_id,
            sign_up_context_session_id,
            sign_up_context_source,
            sign_up_context_medium,
            sign_up_context_campaign,
            sign_up_context_ref,
            sign_up_context_placement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (email)
        DO UPDATE
        SET signed_up_at = EXCLUDED.signed_up_at
        RETURNING *`, [subscriber.email, subscriber.externalId, subscriber.externalSource, subscriber.externalType,
        subscriber.createdAt, subscriber.signedUpAt, subscriber.confirmedAt, subscriber.unsubscribedAt, subscriber.unsubscribedReason,
        subscriber.lastOpenedAt, subscriber.lastClickedAt, subscriber.state,
        subscriber.signUpContext?.visitorId,
        subscriber.signUpContext?.sessionId,
        subscriber.signUpContext?.source,
        subscriber.signUpContext?.medium,
        subscriber.signUpContext?.campaign,
        subscriber.signUpContext?.ref,
        subscriber.signUpContext?.placement
        ]);
        return this.#rowToSubscriber(row);
    }

    async updateOfEmail(email, fields) {
        const fieldsToUpdate = [];
        const fieldsToUpdateValues = [];

        for (const [key, value] of Object.entries(snakeCasedObject(fields))) {
            fieldsToUpdateValues.push(value);
            fieldsToUpdate.push(key);
        }

        if (fieldsToUpdate.length == 0) {
            throw new Error(`No fields to update for subscriber of ${email} email`);
        }

        const sql = `
        UPDATE subscriber SET ${fieldsToUpdate.map(f => `${f} = ?`).join(",\n")}
        WHERE email = ?`;

        const result = await this.#db.execute(sql, [...fieldsToUpdateValues, email]);
        return result > 0;
    }

    async deleteOfEmail(email) {
        return this.#db.execute("DELETE FROM subscriber WHERE email = ?", [email]);
    }
}

export class ButtondownSubscriberApi {

    #url;
    #apiKey;
    #minRetry;
    #maxRetry;

    constructor(url, apiKey, minRetry = 500, maxRetry = 3000) {
        this.#url = url;
        this.#apiKey = apiKey;
        this.#minRetry = minRetry;
        this.#maxRetry = maxRetry;
    }

    async create(email) {
        const response = await this.#executeRequestRetrying(() => this.#createRequest(email));
        if (response.ok) {
            return await response.json();
        }

        Logger.logWarn(`Failed to create subscriber - ${response.status}:`, await response.text());

        if (response.status == 401 || response.status == 403) {
            throw new ApiAuthError(`Api auth error when creating subscriber: ${response.status}`);
        }
        if (response.status == 409) {
            throw SubscriberExistsError.ofEmail(email);
        }
        if (response.status >= 500) {
            throw new SubscriberFailureError(`Unhandled create subscriber error ${response.status}`);
        }
        throw new SubscriberValidationError("Invalid or suspicious subscriber data");
    }

    #createRequest(email) {
        return fetch(this.#subscribersUrl(), {
            method: "POST",
            headers: this.#withAuthorizationHeaders(),
            body: JSON.stringify({ email_address: email })
        });
    }

    /**
     * @param {Function<Promise<Response>} requestPromise 
     */
    async #executeRequestRetrying(requestPromise) {
        let response;
        try {
            response = await requestPromise();
        } catch (e) {
            response = null;
        }
        if (response == null || response.status >= 500) {
            await Promises.randomDelay(this.#minRetry, this.#maxRetry);
            response = await requestPromise();
        }
        return response;
    }

    #subscribersUrl(idOrEmail) {
        const url = `${this.#url}/subscribers`;
        return idOrEmail ? `${url}/${idOrEmail}` : url;
    }

    #withAuthorizationHeaders(headers = {}) {
        return { ...headers, "Authorization": `Token ${this.#apiKey}` };
    }

    async update(emailOrId, type) {
        const response = await this.#executeRequestRetrying(() => this.#updateRequest(emailOrId, type));
        if (response.ok) {
            return await response.json();
        }

        Logger.logWarn(`Failed to update subscriber - ${response.status}:`, await response.text());

        if (response.status == 401 || response.status == 403) {
            throw new ApiAuthError(`Api auth error when updating subscriber: ${response.status}`);
        }
        if (response.status == 409) {
            throw SubscriberExistsError.ofEmail(email);
        }
        if (response.status >= 500) {
            throw new SubscriberFailureError(`Unhandled update subscriber error ${response.status}`);
        }
        throw new SubscriberValidationError("Invalid or suspicious subscriber data");
    }

    #updateRequest(emailOrId, type) {
        return fetch(this.#subscribersUrl(emailOrId), {
            method: "PATCH",
            headers: this.#withAuthorizationHeaders(),
            body: JSON.stringify({ type })
        });
    }

    async get(emailOrId) {
        const response = await this.#executeRequestRetrying(() => this.#getRequest(emailOrId));
        if (response.ok) {
            return await response.json();
        }

        Logger.logWarn(`Failed to get subscriber - ${response.status}:`, await response.text());
        if (response.status == 401 || response.status == 403) {
            throw new ApiAuthError(`Api auth error when getting subscriber: ${response.status}`);
        }
        if (response.status == 404) {
            throw new SubscriberNotFoundError(`Subscriber of email or id ${emailOrId} not found`);
        }
        throw new SubscriberFailureError(`Unhandled get subscriber error ${response.status}`);
    }

    #getRequest(emailOrId) {
        return fetch(this.#subscribersUrl(emailOrId), {
            method: "GET",
            headers: this.#withAuthorizationHeaders()
        });
    }
}

export class NewsletterWebhookHandler {

    #subscriberService;

    constructor(subscriberService) {
        this.#subscriberService = subscriberService;
    }

    async handle(event) {
        const { type, data } = event;
        Logger.logInfo(`Handling ${type} webhook event with the payload:`, data);
        if (type == NewsletterWebhookEventType.SUBSCRIBER_CREATED) {
            await this.#subscriberService.onSubscriberCreated(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_CONFIRMED) {
            await this.#subscriberService.onSubscriberConfirmed(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_OPENED) {
            await this.#subscriberService.onSubscriberOpened(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_CLICKED) {
            await this.#subscriberService.onSubscriberClicked(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_UNSUBSCRIBED) {
            await this.#subscriberService.onSubscriberUnsubscribed(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_DELETED) {
            await this.#subscriberService.onSubscriberDeleted(data.subscriber);
        } else if (type == NewsletterWebhookEventType.SUBSCRIBER_UPDATED) {
            await this.#subscriberService.onSubscriberUpdated(data.subscriber);
        } else {
            Logger.logWarn(`Got webhook event of ${type} but don't have dedicated handler for it just yet`);
        }
    }
}

export const SubscriberState = {
    CREATED: "CREATED",
    CONFIRMED: "CONFIRMED",
    UNSUBSCRIBED: "UNSUBSCRIBED"
};

export class Subscriber {

    constructor(email, externalId, externalSource, externalType,
        createdAt, signedUpAt, confirmedAt, unsubscribedAt, unsubscribedReason,
        lastOpenedAt, lastClickedAt, state,
        signUpContext) {
        this.email = email;
        this.externalId = externalId;
        this.externalSource = externalSource;
        this.externalType = externalType;
        this.createdAt = createdAt;
        this.signedUpAt = signedUpAt;
        this.confirmedAt = confirmedAt;
        this.unsubscribedAt = unsubscribedAt;
        this.unsubscribedReason = unsubscribedReason;
        this.lastOpenedAt = lastOpenedAt;
        this.lastClickedAt = lastClickedAt;
        this.state = state;
        this.signUpContext = signUpContext;
    }

    static newOne(email, now, signUpContext,
        { externalId, externalSource, externalType } = { externalId: null, externalSource: null, externalType: null }) {
        return new Subscriber(email, externalId, externalSource, externalType, now, now, null, null, null, null, null,
            SubscriberState.CREATED, signUpContext);
    }

    hasExternalId() {
        return this.externalId;
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

export class SubscriberExistsError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }

    static ofEmail(email) {
        return new SubscriberExistsError(`Subscriber of ${email} exists already`);
    }
}

export class SubscriberValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class SubscriberFailureError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class SubscriberNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ApiAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

// Subset of https://docs.buttondown.com/api-subscribers-type
export const ApiSubscriberType = {
    Premium: 'Premium',
    Regular: 'Regular',
    Unactivated: 'Unactivated',
    Undeliverable: 'Undeliverable',
    Unsubscribed: 'Unsubscribed'
};

export class ApiSubscriber {
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

export const NewsletterWebhookEventType = {
    SUBSCRIBER_BOUNCED: 'subscriber.bounced',
    SUBSCRIBER_CHANGED_EMAIL: 'subscriber.changed_email',
    SUBSCRIBER_CONFIRMED: 'subscriber.confirmed',
    SUBSCRIBER_CREATED: 'subscriber.created',
    SUBSCRIBER_UNSUBSCRIBED: 'subscriber.unsubscribed',
    SUBSCRIBER_DELETED: 'subscriber.deleted',
    SUBSCRIBER_OPENED: 'subscriber.opened',
    SUBSCRIBER_CLICKED: 'subscriber.clicked',
    SUBSCRIBER_UPDATED: 'subscriber.updated'
};