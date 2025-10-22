export class SubscriberRepository {

    async create(subscriber) {
        // TODO
    }
}

export class Subscriber {
    constructor(email, createdAt, confirmedAt, context) {
        this.email = email;
        this.createdAt = createdAt;
        this.confirmedAt = confirmedAt;
        this.context = context;
    }
}

export class SubscriberContext {
    constructor(visitorId, sessionId, source, medium, ref, placement) {
        this.visitorId = visitorId;
        this.sessionId = sessionId;
        this.source = source;
        this.medium = medium;
        this.ref = ref;
        this.placement = placement;
    }
}