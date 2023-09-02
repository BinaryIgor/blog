import { URL } from "url";

const MAX_VISITOR_ID_LENGTH = 100;
const MAX_PATH_LENGTH = 250;
const DAY_SECONDS = 24 * 60 * 60;
const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;

export class AnalyticsService {

    constructor(analyticsRepository, postsSource, allowedPaths, clock) {
        this.analyticsRepository = analyticsRepository;
        this.postsSource = postsSource;
        this.clock = clock;
        this.allowedPaths = allowedPaths;
    }

    async addView(view) {
        console.log("Validating view...", view);

        const validatedView = this._validateView(view);

        await this._validatePathExists(view);

        await this._validateIpHashUniqueVisitorsLimit(view);

        console.log("Adding view...", validatedView);

        this.analyticsRepository.addView(validatedView);
    }

    _validateView(view) {
        //TODO: truncate source
        const sourceUrl = new URL(view.source);

        console.log("Source...", sourceUrl);

        this._validateVisitorId(view.visitorId);

        if (!view.path || view.path.length > MAX_PATH_LENGTH) {
            throw new Error(`Path can't be empty and must be less than ${MAX_PATH_LENGTH} of lenght, but was: ${view.path}`);
        }

        return { ...view, source: sourceUrl.host }
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


    async _validateIpHashUniqueVisitorsLimit(view) {
        const timestampAgoTocheck = this.clock.timestampSecondsAgo(DAY_SECONDS);

        const uniqueVisitorIdsOfIp = await this.analyticsRepository
            .countDistinctVisitorIdsOfIpHashAfterTimestamp(view.ipHash, timestampAgoTocheck);

        if (uniqueVisitorIdsOfIp >= MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY) {
            throw new Error(`Too many visitor ids for a given ipHash in the last day`);
        }
    }

    async _validatePathExists(view) {
        const inAllowedPaths = this.allowedPaths.some(p => p === view.path);
        if (inAllowedPaths) {
            return;
        }

        if (!this.postsSource.postOfPathExists(view.path)) {
            throw new Error(`Path: ${view.path} is neither allowed nor it has associated post`);
        }
    }

    async stats() {
        const general = await this.analyticsRepository.generalStats();
        const pagesStats = await this.analyticsRepository.pagesStats();

        return new Stats(general, pagesStats);
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
    constructor(views, uniqueVisitors, viewsBySource) {
        this.views = views;
        this.uniqueVisitors = uniqueVisitors;
        this.viewsBySource = viewsBySource;
    }
}

export class ViewsBySource {
    constructor(source, views) {
        this.source = source;
        this.views = views;
    }
}

export class PageStats {
    constructor(path, views, uniqueVisitors) {
        this.path = path;
        this.views = views;
        this.uniqueVisitors = uniqueVisitors;
    }
}

export class Stats {
    constructor(general, pages) {
        this.general = general;
        this.pages = pages;
    }
}


export class DeferredSqliteAnalyticsRepository {

    constructor(db) {
        this.db = db;
        this._viewsToSave = [];

        setInterval(async () => {
            if (this._viewsToSave.length > 0) {
                try {
                    this._saveViews();
                    this._viewsToSave = [];
                } catch (e) {
                    console.log("Failed to save views:", e);
                }
            }
        }, 1000);
    }

    async _saveViews() {
        const argsPlaceholders = this._viewsToSave.map(_ => "(?, ?, ?, ?, ?)")
            .join(",\n");
        const argsValues = this._viewsToSave.flatMap(v => [v.timestamp, v.visitorId, v.ipHash, v.source, v.path]);

        await this.db.execute(`
            INSERT INTO view (timestamp, visitor_id, ip_hash, source, path)
            VALUES ${argsPlaceholders}`, argsValues);
    }

    addView(view) {
        this._viewsToSave.push(view);
    }

    countDistinctVisitorIdsOfIpHashAfterTimestamp(ipHash, timestamp) {
        return this.db.queryOne(`SELECT COUNT(DISTINCT visitor_id) AS visitor_ids 
            FROM view WHERE ip_hash = ? AND timestamp >= ?`,
            [ipHash, timestamp])
            .then(r => {
                if (r) {
                    return r["visitor_ids"]
                }
                return 0;
            });
    }

    async generalStats() {
        const viewsVisitorsPromise = this._viewsUniqueVisitorsStats();
        const viewsBySourcePromise = this._viewsBySourceStats();

        const viewsVisitors = await viewsVisitorsPromise;
        const viewsBySourceFromDb = await viewsBySourcePromise;

        let viewsBySource;
        if (viewsVisitors.views > 0) {
            viewsBySource = viewsBySourceFromDb.map(v => new ViewsBySource(v.source, v.views * 100 / viewsVisitors.views));
        } else {
            viewsBySource = [];
        }

        return new GeneralStats(viewsVisitors.views, viewsVisitors.uniqueVisitors, viewsBySource);
    }

    _viewsUniqueVisitorsStats() {
        return this.db.queryOne(`SELECT 
        COUNT(*) as views, 
        COUNT(DISTINCT visitor_id) as unique_visitors
        FROM view`)
            .then(r => {
                if (r) {
                    return { views: r['views'], uniqueVisitors: r['unique_visitors'] }
                }
                return { views: 0, uniqueVisitors: 0 };
            });
    }

    _viewsBySourceStats() {
        return this.db.query(
            `SELECT source, COUNT(*) as views FROM view GROUP BY source ORDER BY views DESC`)
            .then(rows => rows.map(r => {
                return {
                    source: r['source'],
                    views: r['views']
                };
            }));
    }

    pagesStats() {
        return this.db.query(`SELECT 
            path,
            COUNT(*) as views, 
            COUNT(DISTINCT visitor_id) as unique_visitors
            FROM view
            GROUP BY path
            ORDER BY views DESC
        `).then(rows => rows.map(r =>
            new PageStats(r["path"],
                r["views"],
                r["unique_visitors"])));
    }
}