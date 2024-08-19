import { URL } from "url";
import * as Dates from "../shared/dates.js";
import * as Logger from "../shared/logger.js";

export const MAX_VISITOR_ID_LENGTH = 50;
export const MAX_PATH_LENGTH = 500;
export const DAY_SECONDS = 24 * 60 * 60;
export const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
export const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
export const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
export const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;

export const LAST_DAY_STATS_VIEW = "lastDay";
export const LAST_7_DAYS_STATS_VIEW = "last7Days";
export const LAST_30_DAYS_STATS_VIEW = "last30Days";
export const LAST_90_DAYS_STATS_VIEW = "last90Days";
export const ALL_TIME_STATS_VIEW = "allTime";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const VIEW_TYPE = 'VIEW';
const READ_TYPE = 'READ';

export class AnalyticsService {

    constructor(analyticsRepository, eventsSaver, postsSource, allowedPaths, clock) {
        this.analyticsRepository = analyticsRepository;
        this.eventsSaver = eventsSaver;
        this.postsSource = postsSource;
        this.clock = clock;
        this.allowedPaths = allowedPaths;
    }

    async addEvent(event) {
        const validatedEvent = this._validatedEvent(event);

        await this._validatePathExists(event);

        await this._validateIpHashUniqueVisitorsLimit(event);

        await this.eventsSaver.addEvent(validatedEvent);
    }

    _validatedEvent(event) {
        const sourceUrl = new URL(event.source);

        this._validateVisitorId(event.visitorId);

        if (!event.path || event.path.length > MAX_PATH_LENGTH) {
            throw new Error(`Path can't be empty and must be less than ${MAX_PATH_LENGTH} of length, but was: ${event.path}`);
        }

        if (event.type != VIEW_TYPE && event.type != READ_TYPE) {
            throw new Error('Unsupported event type!');
        }

        return { ...event, source: sourceUrl.host }
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

    async _validateIpHashUniqueVisitorsLimit(event) {
        const timestampAgoToCheck = Dates.timestampSecondsAgo(this.clock.nowTimestamp(), DAY_SECONDS);

        const uniqueVisitorIdsOfIp = await this.analyticsRepository
            .countDistinctVisitorIdsOfIpHashAfterTimestamp(event.ipHash, timestampAgoToCheck);

        if (uniqueVisitorIdsOfIp >= MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY) {
            throw new Error(`Too many visitor ids for a given ipHash in the last day (${uniqueVisitorIdsOfIp})`);
        }
    }

    async _validatePathExists(event) {
        const inAllowedPaths = this.allowedPaths.some(p => p === event.path);
        if (inAllowedPaths) {
            return;
        }

        if (!this.postsSource.postOfPathExists(event.path)) {
            throw new Error(`Path: ${event.path} is neither allowed nor it has associated post`);
        }
    }
}

export class Event {
    constructor(timestamp, visitorId, ipHash, source, path, type) {
        this.timestamp = timestamp;
        this.visitorId = visitorId;
        this.ipHash = ipHash;
        this.source = source;
        this.path = path;
        this.type = type;
    }
}

export class Stats {
    constructor(views, uniqueVisitors, ipHashes, reads, uniqueReaders, viewsBySource, pages) {
        this.views = views;
        this.uniqueVisitors = uniqueVisitors;
        this.ipHashes = ipHashes;
        this.reads = reads;
        this.uniqueReaders = uniqueReaders;
        this.viewsBySource = viewsBySource;
        this.pages = pages;
    }
}

export class ViewsBySource {
    constructor(source, views) {
        this.source = source;
        this.views = views;
    }
}

export class PageStats {
    constructor(path, views, reads, uniqueViewers, uniqueReaders) {
        this.path = path;
        this.views = views;
        this.reads = reads;
        this.uniqueViewers = uniqueViewers;
        this.uniqueReaders = uniqueReaders;
    }
}

export class StatsView {
    constructor(period, stats, calculatedAt) {
        this.period = period;
        this.stats = stats;
        this.calculatedAt = calculatedAt;
    }
}

// TODO: diagnostics endpoint
export class DeferredEventsSaver {
    constructor(analyticsRepository, maxInMemoryEvents, clock) {
        this.analyticsRepository = analyticsRepository;
        this.maxInMemoryEvents = maxInMemoryEvents;
        this.eventsToSave = [];
        this.clock = clock;
        this.lastSaveTimestamp = null;
    }

    schedule(scheduler, writeDelay) {
        scheduler.schedule(async () => this.saveEvents(), writeDelay);
    }

    async saveEvents() {
        const toSave = [...this.eventsToSave];

        if (toSave.length > 0) {
            try {
                this.eventsToSave = [];
                await this.analyticsRepository.saveEvents(toSave);
                this.lastSaveTimestamp = this.clock.nowTimestamp();
            } catch (e) {
                console.error("Failed to save events:", e);
                this.eventsToSave.push(...toSave);
            }
        } else {
            this.lastSaveTimestamp = this.clock.nowTimestamp();
        }
    }

    async addEvent(event) {
        this.eventsToSave.push(event);
        if (this.eventsToSave.length >= this.maxInMemoryEvents) {
            await this.saveEvents();
        }
    }
}

export class StatsViews {
    constructor(analyticsRepository, db, clock) {
        this.analyticsRepository = analyticsRepository;
        this.db = db;
        this.clock = clock;
        this.lastShorterPeriodsViewsSaveTimestamp = null;
        this.lastLongerPeriodsViewsSaveTimestamp = null;
    }

    schedule(scheduler, shorterPeriodsViewsInterval, longerPeriodsViewsInterval, longerPeriodsViewsScheduleDelay) {
        scheduler.schedule(async () => {
            try {
                Logger.logInfo("Calculating shorter periods stats view...");
                await this.saveViewsForShorterPeriods();
                Logger.logInfo("Shorter periods stats views calculated");
            } catch (e) {
                Logger.logError("Failed to calculate shorter periods stats view", e);
            }
        }, shorterPeriodsViewsInterval);

        scheduler.schedule(async () => {
            try {
                Logger.logInfo("Calculating longer periods stats view...");
                await this.saveViewsForLongerPeriods();
                Logger.logInfo("Longer periods stats views calculated");
            } catch (e) {
                Logger.logError("Failed to calculate longer periods stats view", e);
            }
        }, longerPeriodsViewsInterval, longerPeriodsViewsScheduleDelay);
    }

    async saveViewsForShorterPeriods() {
        const now = this.clock.nowTimestamp();

        const timestampDayAgo = Dates.timestampSecondsAgo(now, DAY_SECONDS);
        const lastDayStats = await this.analyticsRepository.stats(timestampDayAgo, now);

        const timestampSevenDaysAgo = Dates.timestampSecondsAgo(now, SEVEN_DAYS_SECONDS);
        const lastSevenDaysStats = await this.analyticsRepository.stats(timestampSevenDaysAgo, now);

        await this._saveView(new StatsView(LAST_DAY_STATS_VIEW, lastDayStats, now));
        await this._saveView(new StatsView(LAST_7_DAYS_STATS_VIEW, lastSevenDaysStats, now));

        this.lastShorterPeriodsViewsSaveTimestamp = now;
    }

    async saveViewsForLongerPeriods() {
        const now = this.clock.nowTimestamp();

        const timestampThirtyDaysAgo = Dates.timestampSecondsAgo(now, THIRTY_DAYS_SECONDS);
        const lastThirtyDaysStats = await this.analyticsRepository.stats(timestampThirtyDaysAgo, now);

        const timestampNinentyDaysAgo = Dates.timestampSecondsAgo(now, NINENTY_DAYS_SECONDS);
        const lastNinentyDaysStats = await this.analyticsRepository.stats(timestampNinentyDaysAgo, now);

        const allTimeStats = await this.analyticsRepository.stats(null, now);

        await this._saveView(new StatsView(LAST_30_DAYS_STATS_VIEW, lastThirtyDaysStats, now));
        await this._saveView(new StatsView(LAST_90_DAYS_STATS_VIEW, lastNinentyDaysStats, now));
        await this._saveView(new StatsView(ALL_TIME_STATS_VIEW, allTimeStats, now));

        this.lastLongerPeriodsViewsSaveTimestamp = now;
    }

    _saveView(statsView) {
        return this.db.execute(`
            INSERT INTO stats_view (period, stats, calculated_at)
            VALUES (?, ?, json(?))
            ON CONFLICT (period) 
            DO UPDATE SET 
            stats = EXCLUDED.stats,
            calculated_at = EXCLUDED.calculated_at
            `, [statsView.period, JSON.stringify(statsView.stats), statsView.calculatedAt]);
    }

    views() {
        return this.db.query("SELECT * FROM stats_view")
            .then(rows => rows.map(r => {
                const stats = JSON.parse(r["stats"]);
                return new StatsView(r["period"], stats, r["calculated_at"]);
            }));
    }
}

export class SqliteAnalyticsRepository {

    constructor(db) {
        this.db = db;
    }

    saveEvents(events) {
        if (events.length > 0) {
            const argsPlaceholders = events.map(_ => "(?, ?, ?, ?, ?, ?)")
                .join(",\n");
            const argsValues = events.flatMap(e => [e.timestamp, e.visitorId, e.ipHash, e.source, e.path, e.type]);

            return this.db.execute(`
            INSERT INTO event (timestamp, visitor_id, ip_hash, source, path, type)
            VALUES ${argsPlaceholders}`, argsValues);
        }
        return Promise.resolve();
    }

    countDistinctVisitorIdsOfIpHashAfterTimestamp(ipHash, timestamp) {
        return this.db.queryOne(
            `SELECT COUNT(DISTINCT visitor_id) AS visitor_ids 
            FROM event
            WHERE ip_hash = ? AND timestamp >= ?`,
            [ipHash, timestamp])
            .then(r => {
                if (r) {
                    return r["visitor_ids"]
                }
                return 0;
            });
    }

    async stats(fromTimestamp, toTimestamp) {
        const viewsUniqueVisitorsIpHashesPromise = this._viewsUniqueVisitorsIpHashesStats(fromTimestamp, toTimestamp);
        const readsUiqueReadersPromise = this._readsUniqueReadersStats(fromTimestamp, toTimestamp);
        const viewsBySourcePromise = this._viewsByTopSourceStats(fromTimestamp, toTimestamp, 25);
        const pagesPromise = this._pagesStats(fromTimestamp, toTimestamp);

        const { views, uniqueVisitors, ipHashes } = await viewsUniqueVisitorsIpHashesPromise;
        const { reads, uniqueReaders } = await readsUiqueReadersPromise;
        const viewsBySource = await viewsBySourcePromise;
        const pages = await pagesPromise;

        return new Stats(views, uniqueVisitors, ipHashes, reads, uniqueReaders, viewsBySource, pages);
    }

    _viewsUniqueVisitorsIpHashesStats(fromTimestamp, toTimestamp) {
        const query = this._queryWithOptionalWhereInTimestampsClause(`
        SELECT 
            COUNT(*) as views, 
            COUNT(DISTINCT visitor_id) as unique_visitors,
            COUNT(DISTINCT ip_hash) as ip_hashes
        FROM view`, fromTimestamp, toTimestamp);

        return this.db.queryOne(query)
            .then(r => {
                if (r) {
                    return {
                        views: r['views'],
                        uniqueVisitors: r['unique_visitors'],
                        ipHashes: r['ip_hashes']
                    };
                }
                return { views: 0, uniqueVisitors: 0, iphashes: 0 };
            });
    }

    _queryWithOptionalWhereInTimestampsClause(query, fromTimestamp, toTimestamp) {
        const whereInTimestampsClause = this._whereInTimestampsClause(fromTimestamp, toTimestamp);
        if (whereInTimestampsClause) {
            return query + ` ${whereInTimestampsClause}`;
        }
        return query;
    }

    _whereInTimestampsClause(fromTimestamp, toTimestamp) {
        let fromClause = fromTimestamp ? `timestamp >= ${fromTimestamp}` : '';
        let toClause = toTimestamp ? `timestamp <= ${toTimestamp}` : '';

        if (!fromClause && !toClause) {
            return '';
        }

        let whereClause = "WHERE ";

        if (fromClause) {
            whereClause += fromClause;
            if (toClause) {
                whereClause += ` AND ${toClause}`;
            }
        } else if (toClause) {
            whereClause += toClause;
        }

        return whereClause;
    }

    _readsUniqueReadersStats(fromTimestamp, toTimestamp) {
        const query = this._queryWithOptionalWhereInTimestampsClause(
            `SELECT COUNT(*) as reads, COUNT(DISTINCT visitor_id) as unique_readers FROM read`,
            fromTimestamp, toTimestamp
        );

        return this.db.queryOne(query)
            .then(r => {
                if (r) {
                    return {
                        reads: r['reads'],
                        uniqueReaders: r['unique_readers']
                    };
                }
                return { reads: 0, uniqueReaders: 0 };
            });
    }

    _viewsByTopSourceStats(fromTimestamp, toTimestamp, limit) {
        const query = `${this._queryWithOptionalWhereInTimestampsClause(
            'SELECT source, COUNT(*) as views FROM view',
            fromTimestamp, toTimestamp
        )} GROUP BY source ORDER BY views DESC LIMIT ${limit}`;

        return this.db.query(query).then(rows => rows.map(r => new ViewsBySource(r['source'], r['views'])));
    }

    async _pagesStats(fromTimestamp, toTimestamp) {
        const readsQuery = `${this._queryWithOptionalWhereInTimestampsClause(
            `SELECT 
            path, 
            COUNT(*) AS reads,
            COUNT(DISTINCT visitor_id) AS unique_readers 
            FROM read`,
            fromTimestamp, toTimestamp
        )} GROUP BY path`;
        const readsPromise = this.db.query(readsQuery);

        const viewsQuery = `${this._queryWithOptionalWhereInTimestampsClause(
            `SELECT 
            path,
            COUNT(*) AS views, 
            COUNT(DISTINCT visitor_id) AS unique_viewers
            FROM view`,
            fromTimestamp, toTimestamp
        )}
        GROUP BY path
        ORDER BY views DESC`;
        const viewsPromise = this.db.query(viewsQuery);

        const reads = new Map();
        (await readsPromise).forEach(r => {
            reads.set(r['path'], {
                reads: r['reads'],
                readers: r['unique_readers']
            });
        });

        return (await viewsPromise).map(r => {
            const path = r['path'];
            const pReads = reads.get(path);
            return new PageStats(path,
                r["views"],
                pReads ? pReads.reads : 0,
                r["unique_viewers"],
                pReads ? pReads.readers : 0)
        });
    }
}