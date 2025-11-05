import { Stats, VisitorsBySource, PageStats, SessionsStats } from "../src/server/analytics.js";
import { randomBoolean, randomElement, randomElementOrNull, randomNumber, sortByField } from "./test-utils.js";
import { SCROLL_EVENT_TYPE, PING_EVENT_TYPE, TestObjects } from "./test-objects.js";
import { Event, PingStats, PingersStats } from "../src/server/analytics.js";
import { SubscribersStats } from "../src/server/shared.js";

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
    prepareRandomSubscribers({ fromTimestamp, toTimestamp, sources, paths, placements, count }) {
        const subscribers = [];
        for (let i = 0; i < count; i++) {
            subscribers.push(TestObjects.randomSubscriber(
                {
                    createdAt: randomNumber(fromTimestamp, toTimestamp),
                    confirmedAt: randomBoolean() ? randomNumber(fromTimestamp, toTimestamp) : null,
                    unsubscribedAt: randomBoolean() ? randomNumber(fromTimestamp, toTimestamp) : null,
                    signUpContext: TestObjects.randomSubscriberSignUpContext({
                        source: randomElementOrNull(sources),
                        path: randomElementOrNull(paths),
                        placement: randomElementOrNull(placements)
                    })
                }
            ));
        }
        return subscribers;
    },
    eventsToExpectedStats({ views, scrolls, pings, subscribers }) {
        const eventVisitors = countDistinct(views.map(e => e.visitorId));
        const eventIpHashes = countDistinct(views.concat(scrolls).concat(pings).map(e => e.ipHash));
        const paths = distinctPaths({ views, scrolls, pings });

        const analyticsStats = new Stats(views.length, eventVisitors, eventIpHashes, toExpectedSessions(views, scrolls, pings),
            toExpectedScrolls(scrolls), toExpectedPings(pings),
            toExpectedVistorsBySource(views),
            toExpectedStatsByPath({ paths, views, scrolls, pings }));
        const subscribersStats = toExpectedSubscribersStats(subscribers);

        return { ...analyticsStats, subscribers: subscribersStats };
    }
};

function distinctPaths({ views, scrolls, pings }) {
    const paths = [...views, ...scrolls, ...pings].map(e => e.path);
    return [...new Set(paths)];
}

function countDistinct(elements) {
    return new Set(elements).size;
}

function toExpectedSessions(views, scrolls, pings) {
    const events = [...views, ...scrolls, ...pings];

    const sessions = countDistinct(events.map(e => e.sessionId));

    const eventTimestampsBySessionId = new Map();
    events.forEach(e => {
        let sessionTimestamps = eventTimestampsBySessionId.get(e.sessionId);
        if (!sessionTimestamps) {
            sessionTimestamps = [];
            eventTimestampsBySessionId.set(e.sessionId, sessionTimestamps);
        }
        sessionTimestamps.push(e.timestamp);
    });

    const durationsBySessionId = new Map();
    eventTimestampsBySessionId.forEach((timestamps, sessionId) => {
        const maxTimestamp = Math.max(...timestamps);
        const minTimestamp = Math.min(...timestamps);
        durationsBySessionId.set(sessionId, (maxTimestamp - minTimestamp));
    });

    const durations = [...durationsBySessionId.values()];

    const meanDuration = durations.reduce((acc, d) => acc + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const durationsCountByThreshold = new Map();
    durations.forEach(d => {
        const threshold = sessionDurationThreshold(d);
        const tDurations = durationsCountByThreshold.get(threshold);
        if (tDurations) {
            durationsCountByThreshold.set(threshold, tDurations + 1);
        } else {
            durationsCountByThreshold.set(threshold, 1);
        }
    });

    const thresholds = [...durationsCountByThreshold.entries()]
        .map(kv => ({ duration: kv[0], sessions: kv[1] }));
    const sortedThresholds = sortByField(thresholds, "duration");

    return new SessionsStats(sessions, meanDuration, maxDuration, minDuration, sortedThresholds);
}

// keep in sync with SqliteAnalyticsRepository
function sessionDurationThreshold(duration) {
    let threshold;
    if (duration >= 10800_000) {
        threshold = 10800_000;
    } else if (duration >= 3600_000) {
        threshold = 3600_000;
    } else if (duration >= 900_000) {
        threshold = 900_000;
    } else if (duration >= 180_000) {
        threshold = 180_000;
    } else if (duration >= 60_000) {
        threshold = 60_000;
    } else {
        threshold = 0;
    }
    return threshold;
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

function toExpectedVistorsBySource(events) {
    const visitorIdsBySource = new Map();

    events.forEach(e => {
        const source = e.source;
        const visitorIds = visitorIdsBySource.get(source) ?? [];
        visitorIds.push(e.visitorId);
        visitorIdsBySource.set(source, visitorIds);
    });

    const visitorsBySource = [...visitorIdsBySource.entries()]
        .map(kv => ({ source: kv[0], visitors: countDistinct(kv[1]) }));

    // first by visitors desc, then source asc
    return visitorsBySource
        .sort((a, b) => {
            if (a.visitors > b.visitors) {
                return -1;
            }
            if (b.visitors > a.visitors) {
                return 1;
            }
            return a.source > b.source ? 1 : -1;
        }).map(e => new VisitorsBySource(e.source, e.visitors));
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

function toExpectedSubscribersStats(subscribers) {
    const created = subscribers.length;
    const confirmed = subscribers.filter(s => s.confirmedAt != null).length;
    const unsubscribed = subscribers.filter(s => s.unsubscribedAt != null).length;

    const subscribersByPlacement = new Map();
    const subscribersBySource = new Map();
    const subscribersByPath = new Map();
    subscribers.forEach(s => {
        const placement = s.signUpContext.placement ?? "OTHER";
        let ofPlacement = subscribersByPlacement.get(placement);
        if (ofPlacement) {
            ofPlacement.created = ofPlacement.created + 1;
            if (s.confirmedAt) {
                ofPlacement.confirmed = ofPlacement.confirmed + 1;
            }
        } else {
            subscribersByPlacement.set(placement, { placement, created: 1, confirmed: s.confirmedAt ? 1 : 0 });
        }

        const source = s.signUpContext.source ?? "other";
        let ofSource = subscribersBySource.get(source);
        if (ofSource) {
            ofSource.created = ofSource.created + 1;
            if (s.confirmedAt) {
                ofSource.confirmed = ofSource.confirmed + 1;
            }
        } else {
            subscribersBySource.set(source, { source, created: 1, confirmed: s.confirmedAt ? 1 : 0 });
        }

        const path = s.signUpContext.path ?? "/other";
        let ofPath = subscribersByPath.get(path);
        if (ofPath) {
            ofPath.created = ofPath.created + 1;
            if (s.confirmedAt) {
                ofPath.confirmed = ofPath.confirmed + 1;
            }
        } else {
            subscribersByPath.set(path, { path, created: 1, confirmed: s.confirmedAt ? 1 : 0 });
        }
    });

    return new SubscribersStats(created, confirmed, unsubscribed,
        sortByField([...subscribersByPlacement.values()], "created", true, "confirmed", true, "placement"),
        sortByField([...subscribersBySource.values()], "created", true, "confirmed", true, "source"),
        sortByField([...subscribersByPath.values()], "created", true, "confirmed", true, "path"));
}