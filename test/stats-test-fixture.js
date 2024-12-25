import { URL } from "url";

import { Stats, ViewsBySource, PageStats } from "../src/server/analytics.js";
import { randomElement, randomNumber, randomBoolean, sortByField } from "./test-utils.js";
import { SCROLL_EVENT_TYPE, PING_EVENT_TYPE } from "./test-objects.js";
import { Event } from "../src/server/analytics.js";

const PINGS_AS_READ_WINDOW_MILLIS = 4 * 60 * 1000;
const PINGS_AS_READ_COUNT_THRESHOLD = 6;
const PINGS_AS_READ_MIN_SCROLL_THRESHOLD = 50;

export const StatsTestFixture = {
    prepareRandomEvents({ fromTimestamp, toTimestamp, visitorIds, ipHashes, sources, paths, eventType, count }) {
        function randomEventTimestamp() {
            if (eventType != PING_EVENT_TYPE) {
                return randomNumber(fromTimestamp, toTimestamp);
            }

            if (randomBoolean()) {
                const higherChanceForBeingReadToTimestamp = fromTimestamp + (2 * PINGS_AS_READ_WINDOW_MILLIS);
                const toEventTimestamp = higherChanceForBeingReadToTimestamp > toTimestamp ? toTimestamp : higherChanceForBeingReadToTimestamp;
                return randomNumber(fromTimestamp, toEventTimestamp);
            }

            const higherChanceForBeingReadFromTimestamp = toTimestamp - (2 * PINGS_AS_READ_WINDOW_MILLIS);
            const fromEventTimestamp = higherChanceForBeingReadFromTimestamp < fromTimestamp ? higherChanceForBeingReadFromTimestamp : fromTimestamp;
            return randomNumber(fromEventTimestamp, toTimestamp);
        }

        const events = [];
        for (let i = 0; i < count; i++) {
            const data = eventType == SCROLL_EVENT_TYPE || eventType == PING_EVENT_TYPE ? randomNumber(0, 100) : null;

            events.push(
                new Event(randomEventTimestamp(),
                    randomElement(visitorIds),
                    randomElement(ipHashes),
                    randomElement(sources),
                    randomElement(paths),
                    eventType, data));
        }
        return events;
    },
    eventsToExpectedStats({ views, scrolls, pings, normalizeSourceUrls = false, requireReads = false }) {
        const eventVisitors = countDistinct(views.map(e => e.visitorId));
        const eventIpHashes = countDistinct(views.concat(scrolls).concat(pings).map(e => e.ipHash));
        const paths = distinctPaths({ views, scrolls, pings });
        const reads = toExpectedReads(pings);

        if (requireReads && reads.events <= 0) {
            throw new Error("Reads are required, but none was found in pings");
        }

        return new Stats(views.length, eventVisitors, eventIpHashes,
            toExpectedScrolls(scrolls), toExpectedPings(pings), reads,
            toExpectedViewsBySource(views, normalizeSourceUrls),
            toExpectedStatsByPath({ paths, views, scrolls, pings }));
    }


};

function sourceHost(source) {
    return new URL(source).host;
}

function distinctPaths({ views, scrolls, pings }) {
    const paths = [...views, ...scrolls, ...pings].map(e => e.path);
    return [...new Set(paths)];
}

function countDistinct(elements) {
    return new Set(elements).size;
}

function toExpectedScrolls(events) {
    const scrollsByPosition = new Map();
    const allScrolls = events.length;
    let uniqueScrollers = new Set();
    events.forEach(e => {
        uniqueScrollers.add(e.visitorId);

        let scrolls = scrollsByPosition.get(e.data);
        if (!scrolls) {
            scrolls = {
                position: e.data,
                events: 0,
                ids: new Set()
            };
            scrollsByPosition.set(e.data, scrolls);
        }
        scrolls.events += 1;
        scrolls.ids.add(e.visitorId);
    });

    const byPosition = sortByPosition([...scrollsByPosition.values()])
        .map(e => ({ ...e, ids: e.ids.size }));

    return { all: { events: allScrolls, ids: uniqueScrollers.size }, byPosition };
}

function sortByPosition(elements) {
    return sortByField(elements, "position");
}

function toExpectedPings(events) {
    const pingsByPosition = new Map();
    const allPings = events.length;
    let uniquePingers = new Set();
    events.forEach(e => {
        uniquePingers.add(e.visitorId);

        const position = pingPositionBucket(e.data);
        let pings = pingsByPosition.get(position);
        if (!pings) {
            pings = {
                position: position,
                events: 0,
                ids: new Set()
            };
            pingsByPosition.set(position, pings);
        }
        pings.events += 1;
        pings.ids.add(e.visitorId);
    });

    const byPosition = sortByPosition([...pingsByPosition.values()])
        .map(e => ({ ...e, ids: e.ids.size }));

    return { all: { events: allPings, ids: uniquePingers.size }, byPosition };
}

// similar grouping to the one in SQL; check out SqliteAnalyticsRepository._pingsAsReadsQuery()
function toExpectedReads(pings) {
    const pingsByTimestampWindowVisitorId = new Map();
    pings.forEach(e => {
        const timestampWindow = Math.trunc(e.timestamp / PINGS_AS_READ_WINDOW_MILLIS);
        const key = `${timestampWindow}_${e.visitorId}`;
        let groupedEvents = pingsByTimestampWindowVisitorId.get(key);
        if (!groupedEvents) {
            groupedEvents = [];
            pingsByTimestampWindowVisitorId.set(key, groupedEvents);
        }
        groupedEvents.push(e);
    });

    let reads = 0;
    const readers = new Set();
    [...pingsByTimestampWindowVisitorId.values()].forEach((events) => {
        const scrollPositions = events.map(e => e.data);
        const minScroll = Math.min(...scrollPositions);
        const maxScroll = Math.max(...scrollPositions);
        if (events.length >= PINGS_AS_READ_COUNT_THRESHOLD &&
            maxScroll > minScroll && maxScroll >= PINGS_AS_READ_MIN_SCROLL_THRESHOLD) {
            reads++;
            readers.add(events[0].visitorId);
        }
    });

    return {
        events: reads,
        ids: readers.size
    };
}

function pingPositionBucket(position) {
    if (position < 25) {
        return 0;
    }
    if (position < 50) {
        return 25;
    }
    if (position < 75) {
        return 50;
    }
    if (position < 100) {
        return 75;
    }
    return 100;
}

function toExpectedViewsBySource(events, normalizeSource) {
    const viewsBySource = new Map();

    events.forEach(e => {
        const source = normalizeSource == true ? sourceHost(e.source) : e.source;
        const views = viewsBySource.get(source) ?? { source, views: 0 };
        views.views += 1;
        viewsBySource.set(source, views);
    });

    // first by views desc, then source asc
    return [...viewsBySource.values()]
        .sort((a, b) => {
            if (a.views > b.views) {
                return -1;
            }
            if (b.views > a.views) {
                return 1;
            }
            return a.source > b.source ? 1 : -1;
        }).map(e => new ViewsBySource(e.source, e.views));
}

function toExpectedStatsByPath({ paths, views, scrolls, pings }) {
    return paths.map(path => {
        const pathViews = views.filter(v => v.path == path);
        const pathScrolls = scrolls.filter(s => s.path == path);
        const pathPings = pings.filter(p => p.path == path);

        return new PageStats(path,
            {
                events: pathViews.length,
                ids: countDistinct(pathViews.map(e => e.visitorId))
            },
            toExpectedScrolls(pathScrolls),
            toExpectedPings(pathPings),
            toExpectedReads(pathPings));
    }).sort((a, b) => {
        // first by views desc, then path asc
        const aViews = a.views.events;
        const bViews = b.views.events;
        if (aViews > bViews) {
            return -1;
        }
        if (bViews > aViews) {
            return 1;
        }
        return a.path > b.path ? 1 : -1;
    });
}