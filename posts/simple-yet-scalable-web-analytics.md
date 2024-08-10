---
{
    "title": "Simple yet Scalable Web Analytics: JSON in SQL with batch inserts",
    "slug": "simple-yet-scalable-web-analytics",
    "publishedAt": "2024-08-16",
    "excerpt": "When building landing pages and blogs, we usually want to have some traffic data and its analytics. Monitoring activity on our web pages turns out to be quite useful ... Similarly, when we build web applications, we want to have analytical data to understand the behaviors and interactions of our users.",
    "researchLog": [ 5, 2 ],
    "writingLog": [ 1, 1, 2, 6, 2, 6 ]
}
---

When building landing pages and blogs, we usually want to have some traffic data and its analytics. Monitoring activity on our web pages turns out to be quite useful; it allows us to answer questions of the following kind:
* How many views do we get?
* How many unique visitors do we have?
* Do people just view our page and exit, or maybe they stay for longer?
* What browsers, operating systems and devices do our visitors use?
* How many times and by who was our *Call To Action* acted upon?

Similarly, when we build web applications, we want to have analytical data to understand the behaviors and interactions of our users. Thanks to this, we can know things like:
* which features are used and are important, which are not
* where users spend the most amount of time and attention
* how they navigate between screens, do they get lost
* how often, when, and for how long they use our app

\
As it is a rather common and generic problem, there are many ready to use solutions on the market. But because:
* they always require some frontend work for the integration, in many cases no less than a custom solution
* we need to send rather sensitive data to a third party - IP addresses, users' actions and behaviors
* it can be expensive to use a managed solution or time consuming to host and maintain it
* they are often not flexbile enough
* this problem is not that complicated

and what is more, I am always deeply curious *how things really work* and see a tremendous value in having this understanding. For these reasons, **I have come up with my own, quite scalable yet simple and universal, solution.** Let's then explore it!

## Solution

### High-level overview

1. There is a backend: example implementation is in Java but it is a secondary concern, it can be rewritten to any programming language
2. Backend needs to have just one endpoint: `POST: /analytics/events` that accepts semi-structured events data; it means that there are a few required fields, like *deviceId, browser, operatingSystem* or *device*, but arbitrary *data json*, without any schema, can be sent as well
3. Thanks to this approach, we have some common, required data for events but we can also add any additional, arbitrary data, depending on the event type
4. Events are saved in the SQL database with solid JSON support (at least PostgreSQL, MySQL and SQLite have it)
5. By using JSON in SQL, we can benefit from all its features: widely-known and supported query language, rich ecosystem of tools and libraries - while still having flexible schema for events data
6. **To make it highly scalable, with the ability to handle thousands of events per second and more, events are saved in batches**, with a slight delay, not immediately as they come; there is a simple condition: 
    * `if there are >= N events in memory after addition`
    * `or`
    * `every M milliseconds check if there are any events in memory`
    * *save all events*
7. In the example implementation, we mostly take device data from the `userAgent` property on the frontend (client) side but it can be done on the backend as well

### Detailed walkthrough

**[As an example is worth a thousand words](https://github.com/BinaryIgor/code-examples/tree/master/simple-web-analytics), I have implemented and tested this approach in Java 21 with Postgres.**

Now, let's go over it.

We have an [analytics event table](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/db/init_db.sql), with some indexes: 
```
CREATE TABLE analytics_event (
  timestamp TIMESTAMP NOT NULL,
  ip TEXT NOT NULL,
  device_id UUID NOT NULL,
  user_id UUID,
  url TEXT NOT NULL,
  browser TEXT NOT NULL,
  os TEXT NOT NULL,
  device TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB
);

CREATE INDEX analytics_event_timestamp ON analytics_event(timestamp);
CREATE INDEX analytics_event_type_timestamp ON analytics_event(type, timestamp);
```
Explanation:
* `timestamp` is simply a time when event has occurred
* `ip` is an IP address of the client
* `device_id` is a unique id of the client device; in our implementation, it is just a random *UUID* stored in the browser's local storage
* `user_id` is an id of currently signed-in user or null - for anonymous sessions/requests
* `url` is a url of the current web page - can help with debugging or checking out path and/or query params
* `browser` is an enum: *Chrome, Firefox, Safari, Edge, Opera, etc.*
* `os` is an enum: *Linux, Windows, Mac, Android, iOs, etc.*
* `device` is an enum, describing device type: *Mobile, Tablet, Desktop*
* `type` is an arbirary enum describing event's type; it can be anything, for example: *landing-page-view, landing-page-scrolled, sign-up-click, home-page-view, user-profile-view* and so on
* `data` is an arbtrary, optional piece of data that can have any schema; it represents additional details that might be needed for some events, such as:
    * `{ "user-profile-id": "484099e3-e5bc-4e66-88d0-98be6e86a53b" }`
    * `{ "view-time": 1000 }`
    * `{ "search-input": "Some gold" }`

\
We also have [an endpoint that accepts most of the table data](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/src/main/java/com/binaryigor/simplewebanalytics/web/WebAnalyticsController.java):
```
POST: /analytics/events

Headers: 
real-ip (optional): if we host it behind reverse proxy

Body:
{
  "deviceId": UUID,
  "url": String,
  "browser": String,
  "os": String,
  "device": String,
  "type": String,
  "data": Object (any type or null)
}
```
What is different here:
* `userId` is taken from the *current user session/authToken*; for obvious (security) reasons, only backend can set it
* `ip` is either extracted from the request by the reverse proxy and set in the `real-ip` header or the backend itself extracts it
* `timestamp` is set by the backend, when the event appears

Also, we perform some [rudimentary validation](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/src/main/java/com/binaryigor/simplewebanalytics/core/AnalyticsEventHandler.java#L78), which is important, especially considering the fact that this endpoint must be public. Checks performed here are very basic: whether required fields are null or empty,  or too long - we do not want to be attacked with random events of arbitrary size. We should probably also check whether there is no arbitrary JavaScript in these fields to avoid an [XSS attack](https://owasp.org/www-community/attacks/xss/), if we visualize this data in the UI susceptible to this attack.

When it comes to scalability, our bottleneck will be the SQL database first, server resources - second. How can we optimize db writes? [The idea is very simple, yet highly effective](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/src/main/java/com/binaryigor/simplewebanalytics/core/AnalyticsEventHandler.java):
* we have in-memory `toCreateEvents` list
* it has a maximum size N
* on new event, we do not create it immediately but:
    * acquire *lock*
    * add event to `toCreateEvents` list
    * check its size: if it is less than N, release *lock* and return, else...
    * ...create N events in a batch, single SQL insert query
    * empty `toCreateEvents` list
    * release *lock*
* we perform similar check every M milliseconds: if `toCreateEvents` list is not empty, we insert all events and empty the list
* it is done mainly because `toCreateEvents` list might never reach N size and events should be available, more or less, in real-time

**It does have a tradeoff: there is a possibility of losing some events.** We do not have a guarantee that the database does not crash in a time period between receiving an event and the attempt to insert it later on, in a batch. Fortunately, there are two conditions: greater than N size of `toCreateEvents` list and the scheduler that wil retry insertion every M milliseconds. If we stop the backend, we might still lose them - but these are analytical events, and this low probability possibility is a perfectly acceptable tradeoff for the huge performance gains it brings. **Depending on the batch size (N), this approach can reduce the number of inserts by 100- to 1000-fold.**

**[On the frontend](https://github.com/BinaryIgor/code-examples/blob/103f31f00b79b9c727fa472dcf80d3896785cdf2/simple-web-analytics/src/main/resources/static/analytics.js#L143), we take most of the device data from the *userAgent* property.** It is possible to extract the operating system and browser from it (versions as well); it looks like this:
```
// iOS, Safari
Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) 
AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1

// Linux, Chrome
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) 
Chrome/126.0.0.0 Safari/537.36

// Windows, Firefox
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) 
Gecko/20100101 Firefox/129.0
```
On top of that, the `deviceId` is generated as *UUID* and stored in the *Local Storage*; `device` enum is computed based on the screen size:
```
const DESKTOP_DEVICE_WIDTH_THRESHOLD = 1200;
const MOBILE_DEVICE_SIZE_THRESHOLD = 500;

export function getDevice() {
  const portraitMode = window.innerWidth < window.innerHeight;
  const landscapeMode = window.innerWidth >= window.innerHeight;

  if ((portraitMode && window.innerWidth < MOBILE_DEVICE_SIZE_THRESHOLD) ||
    (landscapeMode && window.innerHeight < MOBILE_DEVICE_SIZE_THRESHOLD)) {
      return MOBILE_DEVICE;
  }

  if (window.innerWidth < DESKTOP_DEVICE_WIDTH_THRESHOLD) {
    return TABLET_DEVICE;
  }

  if (window.innerWidth >= DESKTOP_DEVICE_WIDTH_THRESHOLD) {
    return DESKTOP_DEVICE;
  }

  return UNKNOWN_DEVICE;
}
```

\
As we now know how it works, let's generate some data and run analytical queries - that is the whole purpose after all!

## Example data and analytics

### Data

How can we have some example data? 

From the the `simple-web-analytics/db` directory, run (for the requirements, check out [README](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/README.md)):
```
bash build_and_run.bash
```

In a different terminal and from the `simple-web-analytics` directory, start the backend:
```
bash build_and_run.bash
```

In yet another terminal, same directory, start the script to generate some random data:
```
bash generate_random_analytics_events.bash
```
It will generate random `100_000` events for the last month period - it should take no more than 15 to 30 seconds.
Once it is done, we can query the data.

### Analytics

Simple events count in various periods:
```
SELECT COUNT(*) AS events 
FROM analytics_event 
WHERE timestamp >= (NOW() - INTERVAL '1 hour');

 events 
--------
    132


SELECT COUNT(*) AS events 
FROM analytics_event 
WHERE timestamp >= (NOW() - INTERVAL '1 day');

 events 
--------
   3175


SELECT COUNT(*) AS events 
FROM analytics_event 
WHERE timestamp >= (NOW() - INTERVAL '1 month');

 events 
--------
  99996
```

\
Unique *IP addresses* per day:
```
SELECT
  timestamp::DATE AS day, 
  COUNT(DISTINCT ip) AS ips
FROM analytics_event
WHERE timestamp >= (NOW() - interval '7 day')
GROUP BY day
ORDER BY day;

    day     | ips 
------------+-----
 2024-08-08 | 312
 2024-08-09 | 312
 2024-08-10 | 312
 2024-08-11 | 312
 2024-08-12 | 312
 2024-08-13 | 312
 2024-08-14 | 312
 2024-08-15 | 295
```

\
Unique *deviceIds* per day:

```
SELECT
  timestamp::DATE AS day,
  COUNT(DISTINCT device_id) AS device_ids
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY day
ORDER BY day;

    day     | device_ids 
------------+------------
 2024-08-08 |        901
 2024-08-09 |        959
 2024-08-10 |        963
 2024-08-11 |        957
 2024-08-12 |        971
 2024-08-13 |        951
 2024-08-14 |        957
 2024-08-15 |        609
```

\
Unique *userIds* per day:
```
SELECT
  timestamp::DATE AS day,
  COUNT(DISTINCT user_id) AS user_ids
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY day
ORDER BY day;

    day     | user_ids 
------------+----------
 2024-08-08 |      448
 2024-08-09 |      474
 2024-08-10 |      484
 2024-08-11 |      481
 2024-08-12 |      482
 2024-08-13 |      479
 2024-08-14 |      481
 2024-08-15 |      329
```

\
Anonymous vs user sessions:
```
SELECT 
  timestamp::DATE AS day, 
  SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS anonymous_sessions,
  SUM(CASE WHEN user_id IS NULL THEN 0 ELSE 1 END) AS user_sessions
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY day
ORDER BY day;

    day     | anonymous_sessions | user_sessions 
------------+--------------------+---------------
 2024-08-08 |               1109 |          1140
 2024-08-09 |               1598 |          1590
 2024-08-10 |               1642 |          1618
 2024-08-11 |               1705 |          1597
 2024-08-12 |               1649 |          1639
 2024-08-13 |               1678 |          1575
 2024-08-14 |               1641 |          1655
 2024-08-15 |                445 |           515
```

\
Browsers, operating systems and devices:
```
SELECT browser, COUNT(*) AS sessions
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY browser
ORDER BY browser;

 browser | sessions 
---------+----------
 Chrome  |     3833
 Edge    |     3807
 Firefox |     3881
 Opera   |     3837
 Safari  |     3770
 Unknown |     3655


SELECT os, COUNT(*) AS sessions
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY os
ORDER BY os;

   os    | sessions 
---------+----------
 Android |     3792
 iOS     |     3736
 Linux   |     3749
 Mac OS  |     3847
 Unknown |     3826
 Windows |     3832


SELECT device, COUNT(*) AS sessions
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY device
ORDER BY device;

 device  | sessions 
---------+----------
 Desktop |     5690
 Mobile  |     5654
 Tablet  |     5670
 Unknown |     5768
```

\
Event types count:
```
SELECT type, COUNT(*) AS events
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
GROUP BY type
ORDER BY type;

     type     | events 
--------------+--------
 account-view |   3804
 home-view    |   3778
 profile-edit |   3715
 profile-view |   3830
 search-input |   3899
 search-view  |   3749
```

\
Some custom data from events:
```
SELECT data->'input' AS search_input
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day') 
  AND type = 'search-input'
LIMIT 10;

         search_input         
------------------------------
 "Inflation facts"
 "Gold vs BTC"
 "BTC"
 "Gold"
 "Gold"
 "LLMs vs Humans"
 "Is AI really that powerful"
 "Inflation facts"
 "Inflation facts"
 "Gold vs BTC"


SELECT data->'userId' AS user_id
FROM analytics_event
WHERE timestamp >= (NOW() - INTERVAL '7 day')
  AND type = 'profile-view'
LIMIT 10;

                user_id                 
----------------------------------------
 "2e30beb1-f010-4746-af78-ba8a8170b3cb"
 "b04c50b1-c2a1-4048-ad7e-6b721014533c"
 "cf38ecb9-2e6d-40a8-9694-43f862c389a9"
 "a4b460a1-fe80-42d4-b1c1-363463613390"
 "2856fd14-80db-417e-8c62-28809c8cf815"
 "87079753-fcaa-4391-97de-009728b06c54"
 "46f73a4a-860c-480d-97dd-8a3fa874f15a"
 "f30dd417-4f33-47f7-8bb9-8020a944a77d"
 "b9444e78-e0e6-4a75-a1d9-218d9c0c3c53"
 "02654b38-42ad-479f-8227-a7a6753bc2fc"
```

\
It is also trivial to use Grafana or any other visualization tool that supports SQL to create nice-looking dashboards and reports from this data and analyze it there.

## Performance
As mentioned already, thanks to the *batch inserts* we can handle quite heavy loads. In the environment:
* [Postgres](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/db/build_and_run.bash) with 1GB of RAM and 1 CPU
* [analytics-backend](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/build_and_run.bash) with 2GB of RAM and 4 CPUs

**we can easily [send more than 1000 event requests per second](https://github.com/BinaryIgor/code-examples/blob/master/simple-web-analytics/generate_random_analytics_events.bash) and save 100 000 events in the following time**:
```
...

2024-08-15T08:04:20.492Z  INFO 1 --- [simple-web-analytics] [  virtual-93212] c.b.s.generator.EventsGenerator          : 92000/100000 events were inserted...
2024-08-15T08:04:20.566Z  INFO 1 --- [simple-web-analytics] [  virtual-93837] c.b.s.generator.EventsGenerator          : 93000/100000 events were inserted...
2024-08-15T08:04:20.612Z  INFO 1 --- [simple-web-analytics] [  virtual-94630] c.b.s.generator.EventsGenerator          : 94000/100000 events were inserted...
2024-08-15T08:04:20.700Z  INFO 1 --- [simple-web-analytics] [  virtual-95494] c.b.s.generator.EventsGenerator          : 95000/100000 events were inserted...
2024-08-15T08:04:20.851Z  INFO 1 --- [simple-web-analytics] [  virtual-96377] c.b.s.generator.EventsGenerator          : 96000/100000 events were inserted...
2024-08-15T08:04:20.921Z  INFO 1 --- [simple-web-analytics] [  virtual-97311] c.b.s.generator.EventsGenerator          : 97000/100000 events were inserted...
2024-08-15T08:04:20.994Z  INFO 1 --- [simple-web-analytics] [  virtual-98831] c.b.s.generator.EventsGenerator          : 98000/100000 events were inserted...
2024-08-15T08:04:21.147Z  INFO 1 --- [simple-web-analytics] [  virtual-99415] c.b.s.generator.EventsGenerator          : 99000/100000 events were inserted...
2024-08-15T08:04:21.183Z  INFO 1 --- [simple-web-analytics] [ virtual-100166] c.b.s.generator.EventsGenerator          : 100000/100000 events were inserted...
2024-08-15T08:04:21.183Z  INFO 1 --- [simple-web-analytics] [           main] c.b.s.generator.EventsGenerator          : 100000 events inserted! It took: PT13.277879125S

...
```

which is:
```
100 000 / 13.28 = 7530 saved events per second
```

It is also done with rather limited db (1 CPU, 100% available) and backend load (4 CPUs, 400% available):
```
docker stats --no-stream
CONTAINER ID   NAME                CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
0db8f828a0c2   analytics-backend   17.09%    630.6MiB / 1.953GiB   31.53%    0B / 0B   0B / 152kB    43
1002768e044c   analytics-db        0.73%     109.5MiB / 1000MiB    10.95%    0B / 0B   0B / 468MB    9

docker stats --no-stream
CONTAINER ID   NAME                CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
0db8f828a0c2   analytics-backend   125.45%   631.5MiB / 1.953GiB   31.57%    0B / 0B   0B / 164kB    43
1002768e044c   analytics-db        15.34%    110.1MiB / 1000MiB    11.01%    0B / 0B   0B / 472MB    9

docker stats --no-stream
CONTAINER ID   NAME                CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
0db8f828a0c2   analytics-backend   172.69%   622.9MiB / 1.953GiB   31.15%    0B / 0B   0B / 164kB    43
1002768e044c   analytics-db        23.75%    110.4MiB / 1000MiB    11.04%    0B / 0B   0B / 500MB    9

docker stats --no-stream
CONTAINER ID   NAME                CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
0db8f828a0c2   analytics-backend   195.60%   625.7MiB / 1.953GiB   31.29%    0B / 0B   0B / 176kB    43
1002768e044c   analytics-db        22.40%    111MiB / 1000MiB      11.10%    0B / 0B   0B / 530MB    9
```

## Final thoughts

As we saw, creating simple yet scalable web analytics solution from scratch is not that complicated: but is it *production-ready*? Yes, just a few things to be mindful of:
* `POST: /analytics/events` endpoint must be public - we need to take care of input validation, mainly limiting its size as we did here but we should also add *rate limiting*, which was not shown, but can be easily done with the help of a reverse proxy (Nginx for example). Without it, we are susceptible to the [DDoS attack](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/): for example, somebody might attack us with lots of random event requests exhausting our database's disk space; then, we will no longer be able to save any events
* Parsing `userAgent` string on the frontend can get quite tricky; as an alternative, if we do not want to bother with it there, we can parse `User-Agent` header, sent automatically by the browser, on the backend
* If we expect to have significantly higher load for analytics events than the regular backend of our app - it might be a wise idea to scale horizontally and deploy analytics backend separately, not as a part of our app's backend, since it can slow down our app. Scaling vertically, by just giving our app more resources to handle additional analytics traffic is another good solution 
* **Use separate database for analytics and the application** - higher load on the analytics database should not have an impact on our app
* Presented here Java 21 + Postgres implementation is just an example. This approach is generic and can be reimplemented in any backend programming language with any JSON-supporting SQL database
* In the event of a longer, not temporary, database crash, we might lose some events - if we insist of having 100% guarantee that all analytics events are saved, more resillient code can be added. It would save events temporarily to a file or another, alternative storage and move them to the database once it is healthy again; but let's keep in mind that these are only analytical events, it is most likely just not worth the complexity to have a redundant setup like this

**Keeping these points in mind, we can enjoy the power of SQL and a batch insert trick to handle thousands of events per second with this straightforward yet highly scalable, flexible, and generic approach.**

Have a great time collecting and analyzing your events!

<div id="post-extras">

<div class="post-delimiter">---</div>

### Links

1. Example implementation source code: https://github.com/BinaryIgor/code-examples/tree/master/simple-web-analytics
2. JSON support in various SQL databases:
    1. PostgreSQL: https://www.postgresql.org/docs/current/datatype-json.html
    2. MySQL: https://dev.mysql.com/doc/refman/8.4/en/json.html
    3. SQLite: https://www.sqlite.org/json1.html
    4. SQL Server: https://learn.microsoft.com/en-us/sql/relational-databases/json/json-data-sql-server
    5. Oracle: https://docs.oracle.com/en/database/oracle/oracle-database/23/adjsn/json-in-oracle-database.html
3. User Agent:
    1. property: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgent
    2. header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent

</div>