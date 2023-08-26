import { URL } from "url";
import {promisify}  from "util";

const MAX_VISITOR_ID_LENGTH = 100;

export class AnalyticsService {

    constructor(analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    addView(view) {
        console.log("Validating view...", view);
        this._validateView(view);
        console.log("Adding view...", view);

        this.analyticsRepository.addView(view);
    }

    _validateView(view) {
        const sourceUrl = new URL(view.source);

        this._validateVisitorId(view.visitorId);
    }

    _validateVisitorId(visitorId) {
        if (!visitorId || visitorId.length > MAX_VISITOR_ID_LENGTH) {
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
    constructor(timestamp, visitorId, ipHash, source, path) {
        this.timestamp = timestamp;
        this.visitorId = visitorId;
        this.ipHash = ipHash;
        this.source = source;
        this.path = path;
    }
}

export class GeneralStats {
    constructor(views, uniqueVisitors) {
        this.views = views;
        this.uniqueVisitors = uniqueVisitors;
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

export class SqliteAnalyticsRepository {
    constructor(db) {
        this.db = db;
    }

    addView(view) {
        this.db.run(`
            INSERT INTO view (timestamp, visitor_id, ip_hash, source, path)
                VALUES (?, ?, ?, ?, ?)
        `, [view.timestamp, view.visitorId, view.ipHash, view.source, view.path]);

        this.db.each("SELECT * FROM view", (err, row) => {
            console.log("row: ", row);
        });
    }

    generalStats() {
        this.db.all("SELECT * FROM view", (rows, error ) => {
            console.log(rows);
        })
    }
}