import { URL } from "url";

const MAX_VISITOR_ID_LENGTH = 100;
const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 10;
const DAY_SECONDS = 24 * 60 * 60;

export class AnalyticsService {

    constructor(analyticsRepository, clock) {
        this.analyticsRepository = analyticsRepository;
        this.clock = clock;
    }

    async addView(view) {
        console.log("Validating view...", view);
        this._validateView(view);
        console.log("Adding view...", view);

        await this._validateIpHashUniqueVisitorsLimit(view);

        await this.analyticsRepository.addView(view);
    }

    _validateView(view) {
        const sourceUrl = new URL(view.source);

        this._validateVisitorId(view.visitorId);
    }

    async _validateIpHashUniqueVisitorsLimit(view) {
        const timestampAgoTocheck = this.clock.timestampSecondsAgo(DAY_SECONDS);

        const uniqueVisitorIdsOfIp = await this.analyticsRepository
            .countDistinctVisitorIdsOfIpHashAfterTimestamp(view.ipHash, timestampAgoTocheck);

        if (uniqueVisitorIdsOfIp > MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY) {
            throw new Error(`To many visitor ids for a given ipHash in the last day`);
        }
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

export class SqliteAnalyticsRepository {

    constructor(db) {
        this.db = db;
    }

    async addView(view) {
        await this.db.execute(`
            INSERT INTO view (timestamp, visitor_id, ip_hash, source, path)
                VALUES (?, ?, ?, ?, ?)
        `, [view.timestamp, view.visitorId, view.ipHash, view.source, view.path]);
    }

    countDistinctVisitorIdsOfIpHashAfterTimestamp(ipHash, timestamp) {
        return this.db.queryOne(`SELECT COUNT(DISTINCT visitor_id) AS visitor_ids 
            FROM view WHERE ip_hash = ? AND timestamp >= ?`,
            [ipHash, timestamp])
            .then(r => {
                if (r) {
                    return r["visitor_ids"]
                }
                return r;
            });
    }

    generalStats() {
        return this.db.query("SELECT * FROM view");
    }
}