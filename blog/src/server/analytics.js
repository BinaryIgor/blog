import {URL} from "url";

const MAX_VISITOR_ID_LENGTH = 100;

export class AnalyticsService {

    constructor(analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    addView(view) {
        console.log("Validating view...", view);
        this._validateView(view);
        console.log("Adding view...", view);
    }

    _validateView(view) {
        const sourceUrl = new URL(view.source);
        
        this._validateVisitorId(view.visitorId);
    }

    _validateVisitorId(visitorId) {
        if(!visitorId || visitorId.length > MAX_VISITOR_ID_LENGTH) {
            throw new Error(`VisitorId should no be empty and have max ${MAX_VISITOR_ID_LENGTH} characters`)
        }

        const match = visitorId.match('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
        if (match === null) {
          throw new Error("VisitorId should be valid UUID, but was: " + visitorId);
        }

        return true;
    }

    addPostView(postView) {
        console.log("Adding post view...", postView);
    }
}

export class View {
    constructor(source, timestamp, ipHash, visitorId) {
        this.source = source;
        this.timestamp = timestamp;
        this.ipHash = ipHash;
        this.visitorId = visitorId;
    }
}

export class PostView {
    constructor(timestamp, ipHash, visitorId, post) {
        this.timestamp = timestamp;
        this.ipHash = ipHash;
        this.visitorId = visitorId;
        this.post = post;
    }
}

class InMemoryAnalyticsRepository {
    constructor() {
        this._db = {};
    }

    addView(view) {
        const key = `${view.date}-${view.visitorId}-${view.source}`;
    }


}