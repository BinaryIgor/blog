import * as Dates from "../shared/dates.js";
import * as Logger from "../shared/logger.js";
import * as Validator from "./validator.js";

export const DAY_SECONDS = 24 * 60 * 60;
export const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
export const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
export const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
export const THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS = DAY_SECONDS * 365;
export const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;
export const LAST_DAY_STATS_VIEW = "lastDay";
export const LAST_7_DAYS_STATS_VIEW = "last7Days";
export const LAST_30_DAYS_STATS_VIEW = "last30Days";
export const LAST_90_DAYS_STATS_VIEW = "last90Days";
export const LAST_365_DAYS_STATS_VIEW = "last365Days";
export const ALL_TIME_STATS_VIEW = "allTime";

const VIEW_TYPE = 'VIEW';
const SCROLL_TYPE = 'SCROLL';
const PING_TYPE = 'PING';
// 2 pings per minute so should be 30 in theory but there could be retries, lags and so on
const NO_PINGS_WINDOW_SECONDS = 20;
const MIN_SCROLL = 0;
// Some pages (posts) might allow to overscroll a bit
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
        const validatedEvent = this.#validatedEvent(event);

        await this.#validatePathExists(validatedEvent);

        await this.#validateIpHashUniqueVisitorsLimit(validatedEvent);

        if (event.type == PING_TYPE) {
            await this.#validateVisitorPingsFrequency(validatedEvent);
        }

        await this.eventsSaver.addEvent(validatedEvent);
    }

    #validatedEvent(event) {
        Validator.validateEventContext(event);

        const supportedEvent = event.type == VIEW_TYPE || event.type == SCROLL_TYPE || event.type == PING_TYPE;
        if (!supportedEvent) {
            throw new Error('Unsupported event type!');
        }

        const data = this.#validatedEventData(event);

        return { ...event, data };
    }

    #validatedEventData(event) {
        if (event.type == VIEW_TYPE) {
            return null;
        }
        return this.#validatedScrollPosition(event.data);
    }

    #validatedScrollPosition(position) {
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

    async #validateIpHashUniqueVisitorsLimit(event) {
        const timestampAgoToCheck = Dates.timestampSecondsAgo(this.clock.nowTimestamp(), DAY_SECONDS);

        const uniqueVisitorIdsOfIp = await this.analyticsRepository
            .countDistinctVisitorIdsAfterTimestamp(event.ipHash, timestampAgoToCheck);

        if (uniqueVisitorIdsOfIp >= MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY) {
            throw new Error(`Too many visitor ids for a given ipHash in the last day (${uniqueVisitorIdsOfIp})`);
        }
    }

    async #validatePathExists(event) {
        const inAllowedPaths = this.allowedPaths.some(p => p === event.path);
        if (inAllowedPaths) {
            return;
        }

        if (!this.postsSource.postOfPathExists(event.path)) {
            throw new Error(`Path: ${event.path} is neither allowed nor it has associated post`);
        }
    }

    async #validateVisitorPingsFrequency(event) {
        const timestampAgoToCheck = Dates.timestampSecondsAgo(this.clock.nowTimestamp(), NO_PINGS_WINDOW_SECONDS);
        const notAllowedPings = await this.analyticsRepository.countPingsAfterTimestamp(event.visitorId, event.path, timestampAgoToCheck);
        if (notAllowedPings > 0) {
            throw new PingsFrequencyError(`No pings are allowed in the last ${NO_PINGS_WINDOW_SECONDS} seconds, but ${event.visitorId} has ${notAllowedPings} for ${event.path} path`);
        }
    }
}

export class Event {
    constructor(timestamp, visitorId, sessionId, ipHash, source, medium, campaign, ref, path, type, data = null) {
        this.timestamp = timestamp;
        this.visitorId = visitorId;
        this.sessionId = sessionId;
        this.ipHash = ipHash;
        this.source = source;
        this.medium = medium;
        this.campaign = campaign;
        this.ref = ref;
        this.path = path;
        this.type = type;
        this.data = data;
    }
}

export class PingsFrequencyError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class Stats {
    constructor(views, visitors, ipHashes, sessions, scrolls, pings, visitorsBySource, pages) {
        this.views = views;
        this.visitors = visitors;
        this.sessions = sessions;
        this.ipHashes = ipHashes;
        this.scrolls = scrolls;
        this.pings = pings;
        this.visitorsBySource = visitorsBySource;
        this.pages = pages;
    }

    static empty() {
        return new Stats(0, 0, 0, SessionsStats.empty(),
            { all: { events: 0, ids: 0 }, byPosition: [] },
            { all: PingStats.empty(), byPosition: [] },
            [], []);
    }
}

/**
 * @typedef SessionThresholdStat
 * @param {number} duration
 * @param {number} sessions
 */

export class SessionsStats {

    /**
     * @param {number} sessions 
     * @param {number} meanDuration - in milliseconds
     * @param {number} maxDuration - in milliseconds 
     * @param {number} minDuration - in milliseconds 
     * @param {Array<SessionThresholdStat>} thresholds 
     */
    constructor(sessions, meanDuration, maxDuration, minDuration, thresholds) {
        this.sessions = sessions;
        this.meanDuration = meanDuration;
        this.maxDuration = maxDuration;
        this.minDuration = minDuration;
        this.thresholds = thresholds;
    }

    static empty() {
        return new SessionsStats(0, 0, 0, 0, []);
    }
}

export class PingStats {
    constructor(events, ids, minById, maxById, meanById, pingersStats) {
        this.events = events;
        this.ids = ids;
        this.minById = minById;
        this.maxById = maxById;
        this.meanById = meanById;
        this.pingersStats = pingersStats;
    }

    static empty() {
        return new PingStats(0, 0, 0, 0, 0,
            PingersStats.atLeastStats({})
        );
    }
}

export class PingersStats {
    constructor(minPings, pingers) {
        this.minPings = minPings;
        this.pingers = pingers;
    }

    static atLeastSix(row) {
        return new PingersStats(6, row['pingers6'] ?? 0);
    }

    static atLeastTwenty(row) {
        return new PingersStats(20, row['pingers20'] ?? 0);
    }

    static atLeastSixty(row) {
        return new PingersStats(60, row['pingers60'] ?? 0);
    }

    static atLeastStats(row) {
        return [
            PingersStats.atLeastSix(row),
            PingersStats.atLeastTwenty(row),
            PingersStats.atLeastSixty(row)
        ]
    }
}

export class VisitorsBySource {
    constructor(source, visitors) {
        this.source = source;
        this.visitors = visitors;
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

    async close() {
        this.saveEvents();
    }
}

export class StatsViews {

    #analyticsRepository;
    #db;
    #subscribersStatsSupplier;
    #clock;
    #lastShorterPeriodsViewsSaveTimestamp;
    #lastLongerPeriodsViewsSaveTimestamp;
    #lastAllTimeViewSaveTimestamp;

    constructor(analyticsRepository, subscribersStatsSupplier, db, clock) {
        this.#analyticsRepository = analyticsRepository;
        this.#subscribersStatsSupplier = subscribersStatsSupplier;
        this.#db = db;
        this.#clock = clock;
        this.#lastShorterPeriodsViewsSaveTimestamp = null;
        this.#lastLongerPeriodsViewsSaveTimestamp = null;
        this.#lastAllTimeViewSaveTimestamp = null;
    }

    schedule(scheduler,
        { shorterPeriodsViewsInterval,
            longerPeriodsViewsInterval, longerPeriodsViewsScheduleDelay,
            allTimeViewInterval, allTimeViewSheduleDelay }) {
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

        scheduler.schedule(async () => {
            try {
                Logger.logInfo("Calculating all time stats view...");
                await this.saveAllTimeView();
                Logger.logInfo("All time stats view calculated");
            } catch (e) {
                Logger.logError("Failed to calculate all time stats view", e);
            }
        }, allTimeViewInterval, allTimeViewSheduleDelay);
    }

    async saveViewsForShorterPeriods() {
        const now = this.#clock.nowTimestamp();

        const timestampDayAgo = Dates.timestampSecondsAgo(now, DAY_SECONDS);
        const lastDayStats = await this.#statsViewForPeriod(timestampDayAgo, now);

        const timestampSevenDaysAgo = Dates.timestampSecondsAgo(now, SEVEN_DAYS_SECONDS);
        const lastSevenDaysStats = await this.#statsViewForPeriod(timestampSevenDaysAgo, now);

        await this.#saveView(new StatsView(LAST_DAY_STATS_VIEW, lastDayStats, now));
        await this.#saveView(new StatsView(LAST_7_DAYS_STATS_VIEW, lastSevenDaysStats, now));

        this.#lastShorterPeriodsViewsSaveTimestamp = now;
    }

    async #statsViewForPeriod(fromTimestamp, toTimestamp) {
        const analyticsStats = this.#analyticsRepository.stats(fromTimestamp, toTimestamp);
        const subscribersStats = this.#subscribersStatsSupplier(fromTimestamp, toTimestamp);
        return { ...await analyticsStats, subscribers: await subscribersStats };
    }

    async saveViewsForLongerPeriods() {
        const now = this.#clock.nowTimestamp();

        const timestampThirtyDaysAgo = Dates.timestampSecondsAgo(now, THIRTY_DAYS_SECONDS);
        const lastThirtyDaysStats = await this.#statsViewForPeriod(timestampThirtyDaysAgo, now);

        const timestampNinentyDaysAgo = Dates.timestampSecondsAgo(now, NINENTY_DAYS_SECONDS);
        const lastNinentyDaysStats = await this.#statsViewForPeriod(timestampNinentyDaysAgo, now);

        const timestampThreeHundredSixtyFiveDaysAgo = Dates.timestampSecondsAgo(now, THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS);
        const lastThreeHundredSixtyFiveDaysStats = await this.#statsViewForPeriod(timestampThreeHundredSixtyFiveDaysAgo, now);

        await this.#saveView(new StatsView(LAST_30_DAYS_STATS_VIEW, lastThirtyDaysStats, now));
        await this.#saveView(new StatsView(LAST_90_DAYS_STATS_VIEW, lastNinentyDaysStats, now));
        await this.#saveView(new StatsView(LAST_365_DAYS_STATS_VIEW, lastThreeHundredSixtyFiveDaysStats, now));

        this.#lastLongerPeriodsViewsSaveTimestamp = now;
    }

    async saveAllTimeView() {
        const now = this.#clock.nowTimestamp();
        const allTimeStats = await this.#statsViewForPeriod(null, now);
        await this.#saveView(new StatsView(ALL_TIME_STATS_VIEW, allTimeStats, now));

        this.#lastAllTimeViewSaveTimestamp = now;
    }

    #saveView(statsView) {
        return this.#db.execute(`
            INSERT INTO stats_view (period, stats, calculated_at)
            VALUES (?, ?, json(?))
            ON CONFLICT (period) 
            DO UPDATE SET 
            stats = EXCLUDED.stats,
            calculated_at = EXCLUDED.calculated_at
            `, [statsView.period, JSON.stringify(statsView.stats), statsView.calculatedAt]);
    }

    views() {
        return this.#db.query("SELECT * FROM stats_view")
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
            const argsPlaceholders = events.map(_ => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .join(",\n");
            const argsValues = events.flatMap(e => [e.timestamp, e.visitorId, e.sessionId, e.ipHash,
            e.source, e.medium, e.campaign, e.ref, e.path, e.type, e.data]);

            return this.db.execute(`
            INSERT INTO event (timestamp, visitor_id, session_id, ip_hash, source, medium, campaign, ref, path, type, data)
            VALUES ${argsPlaceholders}`, argsValues);
        }
        return Promise.resolve();
    }

    countDistinctVisitorIdsAfterTimestamp(ipHash, timestamp) {
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

    countPingsAfterTimestamp(visitorId, path, timestamp) {
        return this.db.queryOne("SELECT COUNT(*) AS pings FROM ping WHERE visitor_id = ? AND path = ? AND timestamp >= ?",
            [visitorId, path, timestamp])
            .then(r => {
                if (r) {
                    return r["pings"];
                }
                return 0;
            })
    }

    async stats(fromTimestamp, toTimestamp) {
        const viewsVisitorsIpHashes = this._viewsVisitorsIpHashesStats(fromTimestamp, toTimestamp);
        const sessions = this.#sessionsStats(fromTimestamp, toTimestamp);
        const scrolls = this._scrollStats(fromTimestamp, toTimestamp);
        const pings = this._pingsStats(fromTimestamp, toTimestamp);

        const visitorsBySource = this.#visitorsByTopSourcesStats(fromTimestamp, toTimestamp, 25);
        const pages = this._pagesStats(fromTimestamp, toTimestamp);

        const { views, visitors, ipHashes } = await viewsVisitorsIpHashes;

        return new Stats(views, visitors, ipHashes, await sessions,
            await scrolls, await pings, await visitorsBySource, await pages);
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

    _queryWithOptionalWhereInTimestampsClause(query, fromTimestamp, toTimestamp, additionalClause = undefined) {
        const whereInTimestampsClause = this._whereInTimestampsClause(fromTimestamp, toTimestamp);
        if (whereInTimestampsClause) {
            const withWhereQuery = `${query} ${whereInTimestampsClause}`;
            if (additionalClause) {
                return `${withWhereQuery} AND ${additionalClause}`;
            }
            return withWhereQuery;
        }
        if (additionalClause) {
            return `${query} AND ${additionalClause}`;
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

    async #sessionsStats(fromTimestamp, toTimestamp) {
        const sessionsQuery = this._queryWithOptionalWhereInTimestampsClause(`
            SELECT COUNT(DISTINCT session_id) AS sessions FROM event`,
            fromTimestamp, toTimestamp, "session_id !=''"
        );
        const sessionsDurationQuery = this._queryWithOptionalWhereInTimestampsClause(`
            SELECT session_id, MAX(timestamp) - MIN(timestamp) AS duration FROM event`,
            fromTimestamp, toTimestamp, "session_id != ''"
        ) + " GROUP BY session_id";

        const meanMaxMinSessionsQuery = `
        SELECT AVG(duration) AS mean_duration, MAX(duration) AS max_duration, MIN(duration) AS min_duration
        FROM (${sessionsDurationQuery}) AS durations`;

        // keep in sync with tests!
        const sessionsThresholdsQuery = `
        SELECT 
            CASE 
                WHEN duration >= 10800000 THEN 10800000
                WHEN duration >= 3600000  THEN 3600000
                WHEN duration >= 600000   THEN 600000
                WHEN duration >= 180000   THEN 180000
                WHEN duration >= 60000    THEN 60000
                ELSE 0
            END AS duration_threshold,
            COUNT(*) AS sessions
        FROM (${sessionsDurationQuery}) AS durations
        GROUP BY duration_threshold
        ORDER BY duration_threshold`;

        const sessions = await this.db.queryOne(sessionsQuery)
            .then(r => {
                if (r) {
                    return r["sessions"]
                }
                return 0;
            });

        if (sessions == 0) {
            return SessionsStats.empty();
        }

        const meanMaxMinSessionsQueryPromise = this.db.queryOne(meanMaxMinSessionsQuery)
            .then(r => ({ meanDuration: r["mean_duration"], maxDuration: r["max_duration"], minDuration: r["min_duration"] }));
        const sessionsThresholdsQueryPromise = this.db.query(sessionsThresholdsQuery)
            .then(rows => rows.map(r => ({
                duration: r['duration_threshold'],
                sessions: r['sessions']
            })));
        const { meanDuration, maxDuration, minDuration } = await meanMaxMinSessionsQueryPromise;
        const thresholds = await sessionsThresholdsQueryPromise;
        return new SessionsStats(sessions, meanDuration, maxDuration, minDuration, thresholds);
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
          COALESCE(AVG(pings), 0) AS mean_pings,
          ${this._pingerSumsClauses()}
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
                        r["min_pings"], r["max_pings"], r["mean_pings"],
                        PingersStats.atLeastStats(r)
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

    _pingerSumsClauses() {
        return `
        COALESCE(SUM(CASE WHEN pings >= 6 THEN 1 ELSE 0 END), 0) AS pingers6,
        COALESCE(SUM(CASE WHEN pings >= 20 THEN 1 ELSE 0 END), 0) AS pingers20,
        COALESCE(SUM(CASE WHEN pings >= 60 THEN 1 ELSE 0 END), 0) AS pingers60`;
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
          COALESCE(AVG(pings), 0) AS mean_pings,
          ${this._pingerSumsClauses()}
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
                r['min_pings'], r['max_pings'], r['mean_pings'],
                PingersStats.atLeastStats(r)));
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

    #visitorsByTopSourcesStats(fromTimestamp, toTimestamp, limit) {
        const query = `${this._queryWithOptionalWhereInTimestampsClause(
            'SELECT source, COUNT(DISTINCT visitor_id) AS visitors FROM view',
            fromTimestamp, toTimestamp
        )} GROUP BY source ORDER BY visitors DESC, source ASC LIMIT ${limit}`;

        return this.db.query(query).then(rows => rows.map(r => new VisitorsBySource(r['source'], r['visitors'])));
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
                    pPingsAll ? pPingsAll : PingStats.empty(),
                    pPingsByPosition ? pPingsByPosition : []));
        });
    }
}