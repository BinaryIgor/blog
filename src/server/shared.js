export class SubscribersStats {

    /**
     * @param {number} created 
     * @param {number} confirmed 
     * @param {number} unsubscribed 
     * @param {Array<SubscribersByPlacementStats>} byPlacement 
     * @param {Array<SubscribersBySourceStats>} bySource 
     * @param {Array<SubscribersByPathStats>} byPath
     */

    constructor(created, confirmed, unsubscribed, byPlacement, bySource, byPath) {
        this.created = created;
        this.confirmed = confirmed;
        this.unsubscribed = unsubscribed;
        this.byPlacement = byPlacement;
        this.bySource = bySource;
        this.byPath = byPath;
    }

    static empty() {
        return new SubscribersStats(0, 0, 0, [], [], []);
    }
}

export class SubscribersByPlacementStats {
    constructor(placement, created, confirmed) {
        this.placement = placement;
        this.created = created;
        this.confirmed = confirmed;
    }
}

export class SubscribersBySourceStats {
    constructor(source, created, confirmed) {
        this.source = source;
        this.created = created;
        this.confirmed = confirmed;
    }
}

export class SubscribersByPathStats {
    constructor(path, created, confirmed) {
        this.path = path;
        this.created = created;
        this.confirmed = confirmed;
    }
}

export const subscribersStatsSupplierFactory = (subscriberRepository) =>
    (fromTimestamp, toTimestamp) => subscriberRepository.subscribersStats(fromTimestamp, toTimestamp);