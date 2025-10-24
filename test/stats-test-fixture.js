import { URL } from "url";

import { Stats, ViewsBySource, PageStats } from "../src/server/analytics.js";
import { randomElement, randomElementOrNull, randomNumber, sortByField } from "./test-utils.js";
import { SCROLL_EVENT_TYPE, PING_EVENT_TYPE } from "./test-objects.js";
import { Event, PingStats, PingersStats } from "../src/server/analytics.js";

export const StatsTestFixture = {
    prepareRandomEvents({ fromTimestamp, toTimestamp, visitorIds, sessionIds, ipHashes, sources, mediums, campaigns, refs, paths, eventType, count }) {
        const events = [];
        for (let i = 0; i < count; i++) {
            const data = eventType == SCROLL_EVENT_TYPE || eventType == PING_EVENT_TYPE ? randomNumber(0, 100) : null;

            events.push(
                new Event(randomNumber(fromTimestamp, toTimestamp),
                    randomElement(visitorIds),
                    randomElement(sessionIds),
                    randomElement(ipHashes),
                    randomElement(sources),
                    randomElementOrNull(mediums),
                    randomElementOrNull(campaigns),
                    randomElementOrNull(refs),
                    randomElement(paths),
                    eventType, data));
        }
        return events;
    },
    eventsToExpectedStats({ views, scrolls, pings }) {
        const eventVisitors = countDistinct(views.map(e => e.visitorId));
        const eventIpHashes = countDistinct(views.concat(scrolls).concat(pings).map(e => e.ipHash));
        const paths = distinctPaths({ views, scrolls, pings });

        return new Stats(views.length, eventVisitors, eventIpHashes,
            toExpectedScrolls(scrolls), toExpectedPings(pings),
            toExpectedViewsBySource(views),
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
    const allPings = events.length;
    if (allPings == 0) {
        return { all: PingStats.empty(), byPosition: [] };
    }

    const pingsByPosition = new Map();
    let pingsByPingers = new Map();
    events.forEach(e => {
        const pingerPings = pingsByPingers.get(e.visitorId);
        if (pingerPings) {
            pingsByPingers.set(e.visitorId, pingerPings + 1);
        } else {
            pingsByPingers.set(e.visitorId, 1);
        }

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

    const pingsOfPingers = [...pingsByPingers.values()];
    const minPingsById = Math.min(...pingsOfPingers);
    const maxPingsById = Math.max(...pingsOfPingers);
    const meanPingsById = pingsOfPingers.reduce((acc, p) => acc + p, 0) / pingsOfPingers.length;

    let pingers6 = 0;
    let pingers20 = 0;
    let pingers60 = 0;

    pingsOfPingers.forEach(pings => {
        if (pings >= 6) {
            pingers6++;
        }
        if (pings >= 20) {
            pingers20++;
        }
        if (pings >= 60) {
            pingers60++;
        }
    });

    return {
        all: new PingStats(allPings, pingsByPingers.size, minPingsById, maxPingsById, meanPingsById,
            [
                new PingersStats(6, pingers6),
                new PingersStats(20, pingers20),
                new PingersStats(60, pingers60)
            ]),
        byPosition
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

function toExpectedViewsBySource(events) {
    const viewsBySource = new Map();

    events.forEach(e => {
        const source = e.source;
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
            toExpectedPings(pathPings))
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