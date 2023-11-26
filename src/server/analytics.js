import { URL } from "url";
import * as Dates from "../shared/dates.js";

export const MAX_VISITOR_ID_LENGTH = 50;
export const MAX_PATH_LENGTH = 500;
export const DAY_SECONDS = 24 * 60 * 60;
export const MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY = 25;

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

        this.eventsSaver.addEvent(validatedEvent);
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

    async stats() {
        const general = await this.analyticsRepository.generalStats();
        const pagesStats = await this.analyticsRepository.pagesStats();

        return new Stats(general, pagesStats);
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

export class GeneralStats {
    constructor(views, uniqueVisitors, ipHashes, reads, uniqueReaders, viewsBySource) {
        this.views = views;
        this.uniqueVisitors = uniqueVisitors;
        this.ipHashes = ipHashes;
        this.reads = reads;
        this.uniqueReaders = uniqueReaders;
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
    constructor(path, views, reads, uniqueViewers, uniqueReaders) {
        this.path = path;
        this.views = views;
        this.reads = reads;
        this.uniqueViewers = uniqueViewers;
        this.uniqueReaders = uniqueReaders;
    }
}

export class Stats {
    constructor(general, pages) {
        this.general = general;
        this.pages = pages;
    }
}

export class DeferredEventsSaver {
    constructor(analyticsRepository, scheduler, writeDelay) {
        this.analyticsRepository = analyticsRepository;
        this.eventsToSave = [];

        scheduler.schedule(async () => this._saveEvents(), writeDelay);
    }

    async _saveEvents() {
        const toSave = [...this.eventsToSave];

        if (toSave.length > 0) {
            try {
                this.eventsToSave = [];
                await this.analyticsRepository.saveEvents(toSave);
            } catch (e) {
                console.error("Failed to save events:", e);
                this.eventsToSave.push(...toSave);
            }
        }
    }

    addEvent(event) {
        this.eventsToSave.push(event);
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

    async generalStats() {
        const viewsUniqueVisitorsIpHashesPromise = this._viewsUniqueVisitorsIpHashesStats();
        const readsUiqueReadersPromise = this._readsUniqueReadersStats();
        const viewsBySourcePromise = this._viewsBySourceStats();

        const { views, uniqueVisitors, ipHashes } = await viewsUniqueVisitorsIpHashesPromise;
        const { reads, uniqueReaders } = await readsUiqueReadersPromise;
        const viewsBySourceFromDb = await viewsBySourcePromise;

        let viewsBySource;
        if (views > 0) {
            viewsBySource = viewsBySourceFromDb.map(v => new ViewsBySource(v.source, v.views * 100 / views));
        } else {
            viewsBySource = [];
        }

        return new GeneralStats(views, uniqueVisitors, ipHashes, reads, uniqueReaders, viewsBySource);
    }

    _viewsUniqueVisitorsIpHashesStats() {
        return this.db.queryOne(`SELECT 
        COUNT(*) as views, 
        COUNT(DISTINCT visitor_id) as unique_visitors,
        COUNT(DISTINCT ip_hash) as ip_hashes
        FROM view`)
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

    _readsUniqueReadersStats() {
        return this.db.queryOne(`SELECT COUNT(*) as reads, COUNT(DISTINCT visitor_id) as unique_readers FROM read`)
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

    async pagesStats() {
        const readsPromise = this.db.query(`SELECT path, 
            COUNT(*) AS reads,
            COUNT(DISTINCT visitor_id) AS unique_readers 
            FROM read 
            GROUP BY path`);

        const viewsPromise = this.db.query(`SELECT 
            path,
            COUNT(*) AS views, 
            COUNT(DISTINCT visitor_id) AS unique_viewers
            FROM view
            GROUP BY path
            ORDER BY views DESC
        `);

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