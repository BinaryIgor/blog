import { URL } from "url";
import * as Dates from "../shared/dates.js";

export const MAX_VISITOR_ID_LENGTH = 50;
export const MAX_PATH_LENGTH = 500;
export const DAY_SECONDS = 24 * 60 * 60;
export const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class AnalyticsService {

    constructor(analyticsRepository, viewsSaver, postsSource, allowedPaths, clock) {
        this.analyticsRepository = analyticsRepository;
        this.viewsSaver = viewsSaver;
        this.postsSource = postsSource;
        this.clock = clock;
        this.allowedPaths = allowedPaths;
    }

    async addView(view) {
        const validatedView = this._validatedView(view);

        await this._validatePathExists(view);

        await this._validateIpHashUniqueVisitorsLimit(view);

        this.viewsSaver.addView(validatedView);
    }

    _validatedView(view) {
        const sourceUrl = new URL(view.source);

        this._validateVisitorId(view.visitorId);

        if (!view.path || view.path.length > MAX_PATH_LENGTH) {
            throw new Error(`Path can't be empty and must be less than ${MAX_PATH_LENGTH} of length, but was: ${view.path}`);
        }

        return { ...view, source: sourceUrl.host }
    }

    _validateVisitorId(visitorId) {
        if (!visitorId || visitorId.length > MAX_VISITOR_ID_LENGTH) {
            throw new Error(`VisitorId should no be empty and have max ${MAX_VISITOR_ID_LENGTH} characters`)
        }

        const match = visitorId.match(UUID_REGEX);
        if (match === null) {
            throw new Error("VisitorId should be valid UUID, but was: " + visitorId);
        }

        return true;
    }


    async _validateIpHashUniqueVisitorsLimit(view) {
        const timestampAgoToCheck = Dates.timestampSecondsAgo(this.clock.nowTimestamp(), DAY_SECONDS);

        const uniqueVisitorIdsOfIp = await this.analyticsRepository
            .countDistinctVisitorIdsOfIpHashAfterTimestamp(view.ipHash, timestampAgoToCheck);

        if (uniqueVisitorIdsOfIp >= MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY) {
            throw new Error(`Too many visitor ids for a given ipHash in the last day (${uniqueVisitorIdsOfIp})`);
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

export class DeferredViewsSaver {
    constructor(analyticsRepository, scheduler, writeDelay) {
        this.analyticsRepository = analyticsRepository;
        this._viewsToSave = [];

        scheduler.schedule(async () => this._saveViews(), writeDelay);
    }

    async _saveViews() {
        const toSave = [...this._viewsToSave];

        if (toSave.length > 0) {
            try {
                this._viewsToSave = [];
                await this.analyticsRepository.saveViews(toSave);
            } catch (e) {
                console.error("Failed to save views:", e);
                this._viewsToSave.push(...toSave);
            }
        }
    }

    addView(view) {
        this._viewsToSave.push(view);
    }
}

export class SqliteAnalyticsRepository {

    constructor(db) {
        this.db = db;
    }

    saveViews(views) {
        if (views.length > 0) {
            const argsPlaceholders = views.map(_ => "(?, ?, ?, ?, ?)")
                .join(",\n");
            const argsValues = views.flatMap(v => [v.timestamp, v.visitorId, v.ipHash, v.source, v.path]);

            return this.db.execute(`
            INSERT INTO view (timestamp, visitor_id, ip_hash, source, path)
            VALUES ${argsPlaceholders}`, argsValues);
        }
        return Promise.resolve();
    }

    countDistinctVisitorIdsOfIpHashAfterTimestamp(ipHash, timestamp) {
        return this.db.queryOne(
            `SELECT COUNT(DISTINCT visitor_id) AS visitor_ids 
            FROM view
            WHERE ip_hash = ? AND timestamp >= ?`,
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