import { URL } from "url";
import * as Dates from "../shared/dates.js";
import * as Logger from "../shared/logger.js";

export const MAX_VISITOR_ID_LENGTH = 50;
export const MAX_PATH_LENGTH = 500;
export const DAY_SECONDS = 24 * 60 * 60;
export const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
export const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
export const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
export const ONE_HUNDRED_EIGHTY_DAYS_SECONDS = DAY_SECONDS * 180;
export const THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS = DAY_SECONDS * 365;
export const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;
export const LAST_DAY_STATS_VIEW = "lastDay";
export const LAST_7_DAYS_STATS_VIEW = "last7Days";
export const LAST_30_DAYS_STATS_VIEW = "last30Days";
export const LAST_90_DAYS_STATS_VIEW = "last90Days";
export const LAST_180_DAYS_STATS_VIEW = "last180Days";
export const LAST_365_DAYS_STATS_VIEW = "last365Days";
export const ALL_TIME_STATS_VIEW = "allTime";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const VIEW_TYPE = 'VIEW';
const SCROLL_TYPE = 'SCROLL';
const PING_TYPE = 'PING';
const MIN_SCROLL = 0;
// Some pages might allow to overscroll a bit
const MAX_SCROLL = 150;

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

        await this._validatePathExists(validatedEvent);

        await this._validateIpHashUniqueVisitorsLimit(validatedEvent);

        await this.eventsSaver.addEvent(validatedEvent);
    }

    _validatedEvent(event) {
        const sourceUrl = new URL(event.source);

        this._validateVisitorId(event.visitorId);

        if (!event.path || event.path.length > MAX_PATH_LENGTH) {
            throw new Error(`Path can't be empty and must be less than ${MAX_PATH_LENGTH} of length, but was: ${event.path}`);
        }

        const supportedEvent = event.type == VIEW_TYPE || event.type == SCROLL_TYPE || event.type == PING_TYPE;
        if (!supportedEvent) {
            throw new Error('Unsupported event type!');
        }

        const data = this._validatedEventData(event);

        return { ...event, data: data, source: sourceUrl.host }
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

    _validatedEventData(event) {
        if (event.type == VIEW_TYPE) {
            return null;
        }
        return this._validatedScrollPosition(event.data);
    }

    _validatedScrollPosition(position) {
        try {
            const parsed = parseInt(position);
            if (isNaN(parsed)) {
                throw new Error(`${position} is not a number!`);
            }
            if (parsed < MIN_SCROLL || parsed > MAX_SCROLL) {
                throw new Error(`${parsed} (from ${position}) position is not within allowed scroll value`);
            }
            return parsed;
        } catch (e) {
            throw e;
        }
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
    constructor(timestamp, visitorId, ipHash, source, path, type, data = null) {
        this.timestamp = timestamp;
        this.visitorId = visitorId;
        this.ipHash = ipHash;
        this.source = source;
        this.path = path;
        this.type = type;
        this.data = data;
    }
}

export class Stats {
    constructor(views, visitors, ipHashes, scrolls, pings, viewsBySource, pages) {
        this.views = views;
        this.visitors = visitors;
        this.ipHashes = ipHashes;
        this.scrolls = scrolls;
        this.pings = pings;
        this.viewsBySource = viewsBySource;
        this.pages = pages;
    }

    static empty() {
        return new Stats(0, 0, 0,
            { all: { events: 0, ids: 0 }, byPosition: [] },
            { all: PingStats.empty(), byPosition: [] },
            [], []);
    }
}

export class PingStats {
    constructor(events, ids, minById, maxById, meanById) {
        this.events = events;
        this.ids = ids;
        this.minById = minById;
        this.maxById = maxById;
        this.meanById = meanById;
    }

    static empty() {
        return new PingStats(0, 0, 0, 0, 0);
    }
}

export class ViewsBySource {
    constructor(source, views) {
        this.source = source;
        this.views = views;
    }
}

export class PageStats {
    constructor(path, views, scrolls, pings) {
        this.path = path;
        this.views = views;
        this.scrolls = scrolls;
        this.pings = pings;
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
                Logger.logInfo("Calculating shorter periods stats views...");
                await this.saveViewsForShorterPeriods();
                Logger.logInfo("Shorter periods stats views calculated");
            } catch (e) {
                Logger.logError("Failed to calculate shorter periods stats views", e);
            }
        }, shorterPeriodsViewsInterval);

        scheduler.schedule(async () => {
            try {
                Logger.logInfo("Calculating longer periods stats views...");
                await this.saveViewsForLongerPeriods();
                Logger.logInfo("Longer periods stats views calculated");
            } catch (e) {
                Logger.logError("Failed to calculate longer periods stats views", e);
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

        const timestampOneHundredEightyDaysAgo = Dates.timestampSecondsAgo(now, ONE_HUNDRED_EIGHTY_DAYS_SECONDS);
        const lastOneHundredEightyDaysStats = await this.analyticsRepository.stats(timestampOneHundredEightyDaysAgo, now);

        const timestampThreeHundredSixtyFiveDaysAgo = Dates.timestampSecondsAgo(now, THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS);
        const lastThreeHundredSixtyFiveDaysStats = await this.analyticsRepository.stats(timestampThreeHundredSixtyFiveDaysAgo, now);

        const allTimeStats = await this.analyticsRepository.stats(null, now);

        await this._saveView(new StatsView(LAST_30_DAYS_STATS_VIEW, lastThirtyDaysStats, now));
        await this._saveView(new StatsView(LAST_90_DAYS_STATS_VIEW, lastNinentyDaysStats, now));
        await this._saveView(new StatsView(LAST_180_DAYS_STATS_VIEW, lastOneHundredEightyDaysStats, now));
        await this._saveView(new StatsView(LAST_365_DAYS_STATS_VIEW, lastThreeHundredSixtyFiveDaysStats, now));
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
            const argsPlaceholders = events.map(_ => "(?, ?, ?, ?, ?, ?, ?)")
                .join(",\n");
            const argsValues = events.flatMap(e => [e.timestamp, e.visitorId, e.ipHash, e.source, e.path, e.type, e.data]);

            return this.db.execute(`
            INSERT INTO event (timestamp, visitor_id, ip_hash, source, path, type, data)
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
        const viewsVisitorsIpHashes = this._viewsVisitorsIpHashesStats(fromTimestamp, toTimestamp);
        const scrolls = this._scrollStats(fromTimestamp, toTimestamp);
        const pings = this._pingsStats(fromTimestamp, toTimestamp);

        const viewsBySource = this._viewsByTopSourceStats(fromTimestamp, toTimestamp, 25);
        const pages = this._pagesStats(fromTimestamp, toTimestamp);

        const { views, visitors, ipHashes } = await viewsVisitorsIpHashes;

        return new Stats(views, visitors, ipHashes,
            await scrolls, await pings, await viewsBySource, await pages);
    }

    _viewsVisitorsIpHashesStats(fromTimestamp, toTimestamp) {
        const query = this._queryWithOptionalWhereInTimestampsClause(`
        SELECT 
            COUNT(*) AS views, 
            COUNT(DISTINCT visitor_id) AS unique_visitors,
            COUNT(DISTINCT ip_hash) AS ip_hashes
        FROM view`, fromTimestamp, toTimestamp);

        return this.db.queryOne(query)
            .then(r => {
                if (r) {
                    return {
                        views: r['views'],
                        visitors: r['unique_visitors'],
                        ipHashes: r['ip_hashes']
                    };
                }
                return { views: 0, visitors: 0, iphashes: 0 };
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

    _viewsByPathStatsUnmapped(fromTimestamp, toTimestamp) {
        const query = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS unique_viewers
            FROM view`,
            fromTimestamp, toTimestamp
        )}
        GROUP BY path
        ORDER BY views DESC, path ASC`;
        return this.db.query(query);
    }

    _emptyEventsIds() {
        return { events: 0, ids: 0 };
    }

    async _scrollStats(fromTimestamp, toTimestamp) {
        const query = this._queryWithOptionalWhereInTimestampsClause(`
            SELECT COUNT(*) AS scrolls, COUNT(DISTINCT visitor_id) AS unique_scrollers 
            FROM scroll`,
            fromTimestamp, toTimestamp
        );
        const queryByPosition = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT 
                CAST(data AS INTEGER) AS position,
                COUNT(*) AS scrolls, 
                COUNT(DISTINCT visitor_id) AS unique_scrollers 
            FROM scroll`,
            fromTimestamp, toTimestamp
        )} GROUP BY position ORDER BY position`;

        const queryPromise = this.db.queryOne(query)
            .then(r => {
                if (r) {
                    return { events: r['scrolls'], ids: r["unique_scrollers"] };
                }
                return this._emptyEventsIds();
            });
        const queryByPositionPromise = this.db.query(queryByPosition)
            .then(rows => rows.map(r => ({
                position: r['position'],
                events: r['scrolls'],
                ids: r['unique_scrollers']
            })));

        return this._allAndByPositionStats(await queryPromise, await queryByPositionPromise);
    }

    _allAndByPositionStats(all, byPosition) {
        return { all, byPosition };
    }

    async _scrollsByPathStats(fromTimestamp, toTimestamp) {
        const query = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT path, COUNT(*) AS scrolls, COUNT(DISTINCT visitor_id) AS unique_scrollers 
            FROM scroll`,
            fromTimestamp, toTimestamp
        )} GROUP BY path ORDER BY path`;
        const queryByPosition = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT 
                path, 
                CAST(data AS INTEGER) AS position,
                COUNT(*) AS scrolls,
                COUNT(DISTINCT visitor_id) AS unique_scrollers 
            FROM scroll`,
            fromTimestamp, toTimestamp
        )} GROUP BY path, position ORDER BY path, position`;

        const queryPromise = this.db.query(query);
        const queryByPositionPromise = this.db.query(queryByPosition);

        const scrolls = new Map();
        (await queryPromise).forEach(r => {
            scrolls.set(r['path'], {
                events: r['scrolls'],
                ids: r['unique_scrollers']
            });
        });
        const scrollsByPosition = new Map();
        (await queryByPositionPromise).forEach(r => {
            const path = r['path'];
            let pScrolls = scrollsByPosition.get(path);
            if (!pScrolls) {
                pScrolls = [];
                scrollsByPosition.set(path, pScrolls);
            }
            pScrolls.push({
                position: r['position'],
                events: r['scrolls'],
                ids: r['unique_scrollers']
            });
        });

        return this._allAndByPositionStats(scrolls, scrollsByPosition);
    }

    async _pingsStats(fromTimestamp, toTimestamp) {
        const query = `
        SELECT COALESCE(SUM(pings), 0) AS pings, 
          COUNT(visitor_id) AS unique_pingers,
          COALESCE(MIN(pings), 0) AS min_pings,
          COALESCE(MAX(pings), 0) AS max_pings,
          COALESCE(AVG(pings), 0) AS mean_pings
        FROM (
          ${this._queryWithOptionalWhereInTimestampsClause(`
          SELECT visitor_id, COUNT(*) AS pings 
          FROM ping`, fromTimestamp, toTimestamp)}
          GROUP BY visitor_id
        )`;
        const queryByPosition = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT 
                ${this._aggregatedPositionClause()} AS position,
                COUNT(*) AS pings, 
                COUNT(DISTINCT visitor_id) AS unique_pingers 
            FROM ping`,
            fromTimestamp, toTimestamp
        )} GROUP BY position ORDER BY position`;

        const queryPromise = this.db.queryOne(query)
            .then(r => {
                if (r) {
                    return new PingStats(r["pings"], r["unique_pingers"],
                        r["min_pings"], r["max_pings"], r["mean_pings"]
                    );
                }
                return PingStats.empty();
            });
        const queryByPositionPromise = this.db.query(queryByPosition)
            .then(rows => rows.map(r => ({
                position: r['position'],
                events: r['pings'],
                ids: r['unique_pingers']
            })));

        return this._allAndByPositionStats(await queryPromise, await queryByPositionPromise);
    }

    _aggregatedPositionClause() {
        return `
        CASE
          WHEN CAST(data AS INTEGER) < 25 THEN
            0
          WHEN CAST(data AS INTEGER) < 50 THEN
            25
          WHEN CAST(data AS INTEGER) < 75 THEN
            50
          WHEN CAST(data AS INTEGER) < 100 THEN
            75
          ELSE
            100
          END`;
    }

    async _pingsByPathStats(fromTimestamp, toTimestamp) {
        const query = `
        SELECT path,
          COALESCE(SUM(pings), 0) AS pings, 
          COUNT(visitor_id) AS unique_pingers,
          COALESCE(MIN(pings), 0) AS min_pings,
          COALESCE(MAX(pings), 0) AS max_pings,
          COALESCE(AVG(pings), 0) AS mean_pings
        FROM (
          ${this._queryWithOptionalWhereInTimestampsClause(`
          SELECT path, visitor_id, COUNT(*) AS pings 
          FROM ping`, fromTimestamp, toTimestamp)}
          GROUP BY path, visitor_id
        ) 
        GROUP BY path
        ORDER BY path`;
        const queryByPosition = `${this._queryWithOptionalWhereInTimestampsClause(`
            SELECT 
                path, 
                ${this._aggregatedPositionClause()} AS position,
                COUNT(*) AS pings,
                COUNT(DISTINCT visitor_id) AS unique_pingers
            FROM ping`,
            fromTimestamp, toTimestamp
        )} GROUP BY path, position ORDER BY path, position`;

        const queryPromise = this.db.query(query);
        const queryByPositionPromise = this.db.query(queryByPosition);

        const pings = new Map();
        (await queryPromise).forEach(r => {
            pings.set(r['path'], new PingStats(r['pings'], r['unique_pingers'],
                r['min_pings'], r['max_pings'], r['mean_pings']));
        });
        const pingsByPosition = new Map();
        (await queryByPositionPromise).forEach(r => {
            const path = r['path'];
            let pPings = pingsByPosition.get(path);
            if (!pPings) {
                pPings = [];
                pingsByPosition.set(path, pPings);
            }
            pPings.push({
                position: r['position'],
                events: r['pings'],
                ids: r['unique_pingers']
            });
        });

        return this._allAndByPositionStats(pings, pingsByPosition);
    }

    _viewsByTopSourceStats(fromTimestamp, toTimestamp, limit) {
        const query = `${this._queryWithOptionalWhereInTimestampsClause(
            'SELECT source, COUNT(*) AS views FROM view',
            fromTimestamp, toTimestamp
        )} GROUP BY source ORDER BY views DESC, source ASC LIMIT ${limit}`;

        return this.db.query(query).then(rows => rows.map(r => new ViewsBySource(r['source'], r['views'])));
    }

    async _pagesStats(fromTimestamp, toTimestamp) {
        const { all: scrollsAll, byPosition: scrollsByPosition } = await this._scrollsByPathStats(fromTimestamp, toTimestamp);
        const { all: pingsAll, byPosition: pingsByPosition } = await this._pingsByPathStats(fromTimestamp, toTimestamp);

        const viewsRaw = await this._viewsByPathStatsUnmapped(fromTimestamp, toTimestamp);

        return viewsRaw.map(r => {
            const path = r['path'];

            const pScrollsAll = scrollsAll.get(path);
            const pScrollsByPosition = scrollsByPosition.get(path);

            const pPingsAll = pingsAll.get(path);
            const pPingsByPosition = pingsByPosition.get(path);

            return new PageStats(path,
                { events: r["views"], ids: r["unique_viewers"] },
                this._allAndByPositionStats(
                    pScrollsAll ? pScrollsAll : this._emptyEventsIds(),
                    pScrollsByPosition ? pScrollsByPosition : []),
                this._allAndByPositionStats(
                    pPingsAll ? pPingsAll : this._emptyEventsIds(),
                    pPingsByPosition ? pPingsByPosition : []));
        });
    }
}