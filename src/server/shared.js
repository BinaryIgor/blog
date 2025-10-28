export class SubscribersStats {

    /**
     * @param {number} created 
     * @param {number} confirmed 
     * @param {number} unsubscribed 
     * @param {Array<SubscribersByPlacementStats>} byPlacement 
     * @param {Array<SubscribersBySourceStats>} bySource 
     */

    constructor(created, confirmed, unsubscribed, byPlacement, bySource) {
        this.created = created;
        this.confirmed = confirmed;
        this.unsubscribed = unsubscribed;
        this.byPlacement = byPlacement;
        this.bySource = bySource;
    }

    static empty() {
        return new SubscribersStats(0, 0, 0, [], []);
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

export const subscribersStatsSupplierFactory = (subscriberRepository) =>
    (fromTimestamp, toTimestamp) => subscriberRepository.subscribersStats(fromTimestamp, toTimestamp);