---
{
    "title": "SQLite DB: simple, in-process, resilient, fast",
    "slug": "sqlite-db-simple-in-process-resilient-fast",
    "startedAt": "2024-12-12",
    "publishedAt": "2024-12-23",
    "excerpt": "Simplicity is beautiful, and what is simpler than SQLite - a single-file, in-process database? It runs alongside your application, no separate server needed.",
    "researchLog": [ 1, 3, 4.5, 7, 2, 2.5 ],
    "writingLog": [ 4.5, 1.5, 8 ]
}
---

## Simplicity and Resilience

As you can tell from my writing on [HTMX](htmx-simpler-web-based-app-or-system.html), [Modularity](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html) or [Infrastructure](/kubernetes-maybe-a-few-bash-python-scripts-is-enough.html), 
I love simplicty. [Complexity is our eternal enemy](https://grugbrain.dev/#grug-on-complexity) and Simplicity is beautiful; rarely something is as simple as SQLite - a single-file, in-process database. 
It runs alongside our application, there is no need for a separate database server.

In the more traditional setup, we have a separate database server: Postgres, MySQL, MSSQL, Oracle and so on. 
That gives us flexibility, when it comes to scaling or multi-application/process access for example, but it also brings additional Complexity.
This isolated database server/process needs to be maintained and monitored, since it can fail at any time and together with it - our applications. 
We also often forget that the [network is not reliable](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing).
Network can fail at any time as well, so can our application together with it, and do we always account for this failure? 
Additionally, how often a single logical (not physical) database needs to be accessed by multiple processes and applications, living on different machines, at the same time?
Usually, the database is just a dedicated storage of data tailored to our application or its module. Do we really need to share it across the network?

SQLite is an embedded SQL database engine that lives as a library, inside the process and runs together with it; it writes and reads from a single database file.
Because of this Simplicity, we get Resilience - network cannot fail us, since we operate on simple, local files. 
In many cases, we will also get performance, since the latency of local file operations is often an order of magnitude faster than network access.

**Is it all roses? Of course not, nothing is - there are just better and worse tradeoffs, depending on the context and use case.**
But, as we are about to explore, SQLite might just be a better option for the vast majority of the systems/applications out there. It does have limitations - we can access it from a single machine for example, it is just a local file after all.
To examine whether SQLite can be treated as a drop-in replacement for relational database management systems (RDBMS) in our specific case, we will go through the following:
1. [Performance and Scalability: how far can it go?](#performance-and-scalability-how-far-can-it-go)
2. [Availability: is it really a problem?](#availability-is-it-really-a-problem)
3. [Features: is it enough?](#features-is-it-enough)
4. [Limitations and Quirks](#limitations-and-quirks)
5. [Final thoughts](#final-thoughts)


## Performance and Scalability: how far can it go?

Recently, [I have ran some performance tests against SQLite on my YouTube channel](https://www.youtube.com/watch?v=s1ODKXTg2Yo). 
To sum it up, we there had a table:
``` 
CREATE TABLE account (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  version INTEGER
);
CREATE INDEX account_name ON account(name);
```
[Test results](https://github.com/BinaryIgor/code-examples/tree/master/sqlite-performance-limits/test-results):

1. **Writes 100%**
    * 20 000 queries were executed with 808 queries/second rate (1000/s attempt), in 24.757 s
    * Min: 0.015 ms, Max: 1332.919 ms, Mean: 2.398 ms
    * Percentile 50 (Median): 0.941 ms, Percentile 90: 1.788 ms
    * Percentile 99: 3.899 ms, Percentile 99.9: 532.287 ms
2. **Reads 100%**
    * 1 000 000 queries were executed with 49 547 queries/second rate (50 000/s attempt), in 20.183 s
    * Min: 0.008 ms, Max: 107.297 ms, Mean: 0.017 ms
    * Percentile 50 (Median): 0.013 ms, Percentile 90: 0.016 ms
    * Percentile 99: 0.035 ms, Percentile 99.9: 0.064 ms
3. **Writes 50%, Reads 50%**
    * 40 000 queries were executed with 1586 queries/second rate (2000/s attempt), in 25.225 s
    * Min: 0.01 ms, Max: 1434.965 ms, Mean: 1.219 ms
    * Percentile 50 (Median): 0.068 ms, Percentile 90: 1.646 ms
    * Percentile 99: 2.309 ms, Percentile 99.9: 131.528 ms
4. **Writes 10%, Reads 90%**
    * 150 000 queries were executed with 7144 queries/second rate (7500/s attempt), in 20.996 s
    * Min: 0.008 ms, Max: 1134.174 ms, Mean: 0.262 ms
    * Percentile 50 (Median): 0.016 ms, Percentile 90: 0.064 ms
    * Percentile 99: 1.753 ms, Percentile 99.9: 19.357 ms

All tests were run with resources limited to 1GB of RAM and 2 CPUs in Docker, on a machine with 32 GB of RAM, Intel® Core™ i7-9750HF CPU @ 2.60GHz × 12 and Ubuntu 22 OS.
Test table had ~ 1 million records; every write modified one record, every read used an index.

As we can see, writes are limitations here  - all writes to a single database in SQLite are serialized, there is only one writer at any given time. 
But still, how many applications need to have close to 1000 writes per second on the ongoing, not temporary, basis?
**Most applications do mostly reads and sometimes writes and looking at the *Writes 10%, Reads 90%* case - SQLite can handle 7000 queries per second!**

That is amazing performance as far as SQLite alone goes; but how would it perform in the application, in the real production environment? Well, some time ago, [we have tested limits of a single machine http server](/how-many-http-requests-can-a-single-machine-handle.html). There we have a few machine sizes to test - small, medium and large - and a basic Spring Boot, Java 21 + PostgreSQL app, all running on a single VPS (droplet) provided by the Digital Ocean. It is a setup that you would absolutely use in production (only https support is lacking, easy to add with Nginx + Let's Eencrypt). I decided to run very similar tests, swapping PostgreSQL for SQLite. For the context, we have a similar table:
```
CREATE TABLE account (
  -- UUID really, no dedicated type for it in SQLite --
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX account_name ON account(name);
```
We also initialize SQLite with some additional, non-default settings:
```
PRAGMA cache_size=100000;
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```
Increased cache size allows SQLite to cache more pages in memory; it is a page - 4096B by default - multiplier.
[Write-Ahead-Logging (WAL)](https://www.sqlite.org/wal.html) mode increases concurrency - single writer (that is how SQLite works) does not block readers. We also increase `busy_timeout` to 5 seconds, so that potentially queued up writes have a chance to finish.

We also have realistic load characteristics: tests consist primarily of read requests with approximately 10% of writes. They call our REST API which makes use of the SQLite database with a reasonable amount of data (over one million rows).
[Here are the results](https://github.com/BinaryIgor/TODO):

1. **Small machine - 1 CPU, 1 GB of memory**
    * Can handle sustained load of *200 - 300 RPS*
    * For 15 seconds, it was able to handle *1000 RPS* with stats:
      * Min: 0.001s, Max: 0.2s, Mean: 0.013s
      * Percentile 90: 0.026s, Percentile 95: 0.034s
      * Percentile 99: 0.099s
2. **Medium machine - 2 CPUs, 2 GB of memory**
    * Can handle sustained load of *500 - 1000 RPS*
    * For 15 seconds, it was able to handle *1000 RPS* with stats:
      * Min: 0.001s, Max: 0.135s, Mean: 0.004s 
      * Percentile 90: 0.007s, Percentile 95: 0.01s
      * Percentile 99: 0.023s 
3. **Large machine - 4 CPUs, 8 GB of memory**
    * Can handle sustained load of *2000 - 3000 RPS*
    * For 15 seconds, it was able to handle *4000 RPS* with stats:
      * Min: 0.0s, (less than 1ms), Max: 1.05s, Mean: 0.058s
      * Percentile 90: 0.124s, Percentile 95: 0.353s
      * Percentile 99: 0.746s
TODO: assumptions here, clean up results.

As you can see, performance is amazing; again, how many systems do hundreds of writes per second on the ongoing, not temporary, basis? How many get to have thousands of read requests?

What is more, there are straightforward ways to scale it even further by sharding SQLite and having multiple databases (shards):
* Modular Monolith - use a database per module. There should not be cross-module transactions anyways, so it does not complicate anything and gives additional, per module, scalability
* Just have N shards (databases) of SQLite based on user/account id, country code or whatever else that is specific to your application. Route requests to one of these shards, depending on the request sharding key (user/account id, country code etc.)

With these simple tricks (multiple SQLite dbs), it is safe to say that we can increase SQLite performance at least five to ten times (3 to 5?) - at some point, we will be limited by the underyling OS and hardware IO operations, not the SQLite db. With these assumptions, it comes down:
```
35 000 - 70 000 RPS:
3500 - 7000 writes (10%) 
31500 - 63000 reads (90%)
```

\
As we can see, the performance of SQLite is enough for the vast majority of applications/systems out there. But what about the availability of the single machine system?


## Availability: is it really a problem?

Virtual Private Server (VPS) is not really a single physical machine - it is a single logical machine, with many levels of redundancy, both on the hardware and software level, implemented by cloud providers to guarantee high availability. Most cloud providers claim to have *at least 99.9% availability* in their service-level agreements (SLA) and some - [DigitalOcean](https://docs.digitalocean.com/products/droplets/details/sla/) and [AWS](https://aws.amazon.com/compute/sla/) for example - offer *99.99% availability*. That comes down to:
```
24 * 60 = 1440 minutes in a day
30 * 1440 = 43200 minutes in a month
60 * 1440 = 86400 seconds in a day

99.9% availability:
86400 - 86400 * 0.999 = 86.4 seconds of downtime per day
43200 - 43200 * 0.999 = 43.2 minutes of downtime per month

99.99% availability:
86400 - 86400 * 0.9999 = 8.64 seconds of downtime per day
43200 - 43200 * 0.9999 = 4.32 minutes of downtime per month
```

**Depending on the chosen cloud provider, this is the availability we can expect from a simplest possible system, running on a single virtual server.** What if that is not enough for us? Or maybe we simply do no trust these claims and want to have more redundancy, but still enjoy the benefits of SQLite simplicity? Can it be improved?

First, let's consider short periods of unavailability - up to a few seconds. 
These will most likely be the most frequent ones and fortunately, the easiest to fix. 
If our Virtual Private Servier is not available for just 1 - 5 seconds, it can be fixed purely on the client side by having request retries - retrying every request up to a few seconds, it the server is not available.
For the user, certain requests will just be slower - because of possible, short server unavailability - but they will suceeded eventually, unless we are dealing with a longer unavailability. 
Before going into solution for this case, it is worth pausing and asking - maybe that is enough? 
Let's remember, that with *99.9%* and *99.99%* availability, we can expect to be daily unavailable for just *86.4 seconds* or *8.64 seconds*. 
Most likely, these interruptions will be spread throughout the day, so simple retries will take care of most of them, probably users not even noticing it. 
But, if we really want to have additional redundancy and be able to deal with longer outages, there are a solution for that. 

First, we can write to an external volume - Block Storage. These are flexible network-based devices that provide additional storage for Virtual Machines; most cloud providers offer them as a service - there is [DigitalOcean Volumes Block Storage](https://docs.digitalocean.com/products/volumes/) or [Amazon Elastic Block Storage](https://aws.amazon.com/ebs/) for example. 
In this setup, we have a virtual machine with attached external volume, where SQLite data lives. These volumes usually have higher availability than virtual machines and are independent from them. If our single virtual machine becomes unavailable, we can have a failover procedure of the kind:
* virtual machine needs to be proxied by some kind of gateway/load balancer with a static IP address
* create new virtual machine
* detach volume from the old machine, attach it to the new one
* deploy application/applications to the new machine
* discard old machine, switch gateway/load balancer so that it points to the new one

With this strategy, we are shielded from virtual machine failures, but we are not safe against volume being unavailable (anxiety is high on this one, since they usually are made redundant, with multiple copies by virtually all cloud providers). If that is not enough, there is a second strategy. 

If being dependent on the external volume availability is still not enough (is it?), we can have another setup. But to use it, we first need to have a tool for backing up SQLite db in a real time (close to it - can be also used just for regular backups). 
There are a couple ways to do that:
1. [SQLite Backup API](https://www.sqlite.org/backup.html) - can be run on live database, does not block it, and is as simple to use as just issuing `backup to /backup.db` command on the db connection.
  It is the slowest option, because it always backs db up from scratch. For a few gigabytes db, backing it up under load can take up anywhere from 10 to 30 seconds, so it is rather limited to small dbs
2. [sqlite3_rsync tool](https://www.sqlite.org/rsync.html) - that is new, promising tool coming directly from SQLite developers. It treats being copied database as primary and copy as a replica.
  As names suggest, only difference are sent, so it tends to be much more efficient than option 1.
3.  [Litestream](https://litestream.io/how-it-works/) - external tool to continuously stream SQLite changes to AWS S3, Azure Blob Storage, Google Cloud Storage, SFTP, or NFS. 
  I did not test it, but many people like it and theory it is the most efficient ones, since it sends only changes, not the whole db.
  The nice thing about it is that it runs as a seperate process and sends changes close to real time - every 1 second.


Assuming that we are able to have almost identical replica of our primary SQLite db/dbs (probably sqlite3_rsync or Litestream are the best options for this), we can came up with high-redundancy setup.
Here is an example idea:
* Run three machines - primary, secondary and gateway. As previously, 
  gateway is our availability bottleneck - our availability cannot be higher than it. 
  We must have the best possible setup for it we are probably better of using some kind of managed service for this component - like [Cloudflare gateway](https://www.cloudflare.com/zero-trust/products/gateway) or [DigitalOcean Load Balancer](https://docs.digitalocean.com/products/networking/load-balancers/details/)
* Primary and secondary have the same application/applications deployed to them
* During usual operations, gateway is pointing only to the primary instance; secondary receives no traffic
* On the secondary, we have live backup/backups of the primary databases as described above
* Because of the former, on the secondary we have all SQLite databases replicated, with a possible data delay of about few seconds to a few minutes,
  depending on the usd tools
* Gateway is constantly monitoring, whether primary machine is alive or not - issuing simple healthchecks every few seconds
* If primary is down for anything between 10 seconds to a few minutes (depending on our setup and requirements) - gateway is triggering failover procedure
* Failover procedure means:
    * secondary becomes new primary - all traffic goes to it
    * old primary is killed discarded
    * new secondary is created and it immediately starts replicating data from new primary

\
As we can see, this setup is significantly more complex, but all high-availability and redundant setups are like that. 
In most cases, we do not need it, but if we have a case for it, it is probably worth the complexity.
Also, if we ensist on ultra high-availability and redundancy, it is also worth considering whether we should run our primary and secondary machine in the different geographical regions.
After all, it possible that the whole data center of our cloud provider might go down in one region, but work in another one.
Some people would even suggest to have secondary hosted by a different cloud provider; there is really no end how far you can you with complex setups like that!

Summing it up, in most cases *99.9%/99.99%* availability coming from the cloud provider + simple client retry strategy is good enough. 
Should we want/need more, there are tools to still reap the benefits of a single machine + SQLite architecture simplicity while having ultra high redundancy and availability - *more than 99.99%*.

## Features: is it enough?

SQLite supports all the features we would expect from the regular relational database server and more:
* [Indexes (B-tree)](https://www.sqlite.org/lang_createindex.html) - regular, composite, [partial](https://www.sqlite.org/partialindex.html), [expressions](https://www.sqlite.org/expridx.html)
* [Foreign Keys](https://www.sqlite.org/foreignkeys.html)
* [JSON](https://www.sqlite.org/json1.html)
* [Full-text search](https://www.sqlite.org/fts5.html)
* [Common Table Expressions (CTE)](https://www.sqlite.org/lang_with.html)
* [Query Planner](https://www.sqlite.org/eqp.html)
* [Great CLI](https://www.sqlite.org/cli.html) - really helps with analyzing data and playing with various features
* [Extensions](https://www.sqlite.org/loadext.html) - API that allows to add arbtrary functionality to SQLite
* TODO: backups & tests!

As we can see, the list is rather long and comprehensive. JSON support is impresive, which comes-in handy many times, when we want to have semi-structured data. Altough there are no [GIN Indexes](https://www.postgresql.org/docs/current/gin.html) like in Postgres that allows for example to index arbitrary JSON fields, this functionality can be easily emulated by the use of [generated colums](https://www.sqlite.org/gencol.html) and index on it. Let's consider a table:
```
CREATE TABLE event (
  timestamp INTEGER NOT NULL,
  data JSON
);
CREATE INDEX event_timestamp ON event(timestamp);

INSERT INTO event (timestamp, data) 
  VALUES (
    CAST(unixepoch('subsec') * 1000 AS INTEGER), 
   json_object('device', 'a', 'reading', 22));
INSERT INTO event (timestamp, data) 
  VALUES (
    CAST(unixepoch('subsec') * 1000 AS INTEGER), 
    json_object('device', 'b', 'reading', 44));
```
We would like to query events by device field. To make it fast, we can create virtual column and index it:
```
ALTER TABLE event 
ADD COLUMN device TEXT
AS (data->>'device');

CREATE INDEX event_device ON event(device);
```
To see the difference and explore some of the SQLite CLI features, let's insert some random data to this table and compare query plans with and without the index. Inserting random million rows using recursive common table expression:
```
# turn on query time
sqlite> .timer on
sqlite> 
WITH RECURSIVE random_events(idx, timestamp, data) AS (
  VALUES (1, CAST(unixepoch('subsec') * 1000 AS INTEGER), 
    json_object(
      'device', hex(randomblob(2)), 
      'reading', abs(random() % 100)))
  UNION ALL
  SELECT idx + 1, CAST(unixepoch('subsec') * 1000 AS INTEGER), 
    json_object(
      'device', hex(randomblob(2)), 
      'reading', abs(random() % 100))
  FROM random_events 
  WHERE idx <= 1000000
)
INSERT INTO event (timestamp, data)
SELECT timestamp, data FROM random_events;
Run Time: real 4.815 user 3.428142 sys 1.341373

# better results display format
sqlite> .mode box
sqlite> 
SELECT 
  datetime(timestamp / 1000.0, 'unixepoch', 'subsec') AS timestamp, 
  data 
FROM event limit 10;
┌─────────────────────────┬────────────────────────────────┐
│        timestamp        │              data              │
├─────────────────────────┼────────────────────────────────┤
│ 2024-12-20 10:54:27.494 │ {"device":"a","reading":22}    │
│ 2024-12-20 10:54:27.505 │ {"device":"b","reading":44}    │
│ 2024-12-20 10:55:02.932 │ {"device":"B44E","reading":4}  │
│ 2024-12-20 10:55:02.932 │ {"device":"5C66","reading":27} │
│ 2024-12-20 10:55:02.932 │ {"device":"39A2","reading":83} │
│ 2024-12-20 10:55:02.932 │ {"device":"70D0","reading":21} │
│ 2024-12-20 10:55:02.932 │ {"device":"C4BF","reading":63} │
│ 2024-12-20 10:55:02.932 │ {"device":"1AB3","reading":77} │
│ 2024-12-20 10:55:02.932 │ {"device":"5E7E","reading":22} │
│ 2024-12-20 10:55:02.932 │ {"device":"B0A2","reading":99} │
└─────────────────────────┴────────────────────────────────┘
Run Time: real 0.000 user 0.000398 sys 0.000000
```
We can see a few interesting things at play here: TODO. 
Now, let's compare query plans and times with/without device index:
```
# turning explain query plan on
sqlite> .eqp on
# json operator, no index usage
sqlite> 
SELECT 
  datetime(timestamp / 1000.0, 'unixepoch', 'subsec') AS timestamp, 
  data
FROM event
WHERE data->>'device' = 'a';

QUERY PLAN
`--SCAN event

┌─────────────────────────┬─────────────────────────────┐
│        timestamp        │            data             │
├─────────────────────────┼─────────────────────────────┤
│ 2024-12-20 10:54:27.494 │ {"device":"a","reading":22} │
└─────────────────────────┴─────────────────────────────┘
Run Time: real 0.507 user 0.494763 sys 0.012364

# using indexed, virtual colum
sqlite> 
SELECT 
  datetime(timestamp / 1000.0, 'unixepoch', 'subsec') AS timestamp, 
  data 
FROM event
WHERE device = 'a';

QUERY PLAN
`--SEARCH event USING INDEX event_device (device=?)

┌─────────────────────────┬─────────────────────────────┐
│        timestamp        │            data             │
├─────────────────────────┼─────────────────────────────┤
│ 2024-12-20 10:54:27.494 │ {"device":"a","reading":22} │
└─────────────────────────┴─────────────────────────────┘
Run Time: real 0.001 user 0.000000 sys 0.000385
```
We went from 500 ms to 1 ms and query plan neatly displayed everything that we need to know.

## Limitations and Quirks

* [PRIMARY KEY does not imply NOT NULL](https://www.sqlite.org/lang_createtable.html#the_primary_key) - in many cases, we should add `NOT NULL` clause to the primary key declaration which is not needed in other databases
* Foreign Keys are not are not enabled by default and we need to run `PRAGMA foreign_keys = ON` on every db connection to enforce them!
* [Write-Ahead Logging (WAL) mode](https://www.sqlite.org/wal.html) is not enabled by default, even though it offers better performance and allows for more concurrency - writer does not block readers.
  It can be enabled by running `PRAGMA journal_mode=WAL` command
* All writes are serialized, executed sequentially, because there can be only on writer at a time. 
  To avoid [SQLITE_BUSY](https://www.sqlite.org/rescode.html#busy) errors, it is often a good idea to increase busy timeout to a few seconds by issuing `PRAGMA busy_timeout=5000` command
* TODO: locks & isolation levels! https://www.sqlite.org/isolation.html
* Limited `ALTER TABLE` support can sometimes make schema migrations more difficult
* [Limited datatypes](https://www.sqlite.org/datatype3.html) - most notably, there is no native types for storing date and/or time - we must use INTEGER/REAL as unix timestamp or TEXT for storing formatted date/time strings. Fortunately, there are [many useful date and time functions](https://www.sqlite.org/lang_datefunc.html). Same goes for UUIDs - we need to use TEXT
* [Flexible Typing](https://www.sqlite.org/flextypegood.html) - it can be strange at the beginning (compared to other databases), but there are no significant disadvantages to it. In a nutshell, types defined in the table schema are only suggestions - it is possible to insert TEXT into INTEGER field for example. What is more, type declarations in the table schema are totally optional
* `TRUNCATE` command is not supported - `DELETE` must be used
* To optimize query plans for frequently changing tables, it is a good idea to periodically run [ANALYZE commad](https://www.sqlite.org/lang_analyze.html) - it should probably be run by SQLite itself, by default
* sqlite multiple statements in one query not supported by the driver
* More quirks (respect that it comes from SQLite authors themselves!) can be found [here](https://www.sqlite.org/omitted.html) and [here](https://www.sqlite.org/quirks.html)

## Final thoughts

Some interesting thoughts:
* Availability - how many infrastructures have truly redundant setups?
* availability can be make high, but still streaming cababilities of dbs like postgres might be superior in this case
* if this availability is enough - probably is enough for most apps/systems - go for it!
* remember quirks
* still a way to scale it up
* faster to deliver and it is SQL after all, so migration can be done rather easily
* Great docs!

---

Random things/notes:
* PRAGMA table_info(account);
* PRAGMA index_list(account);
* WAL vs DELETE journal mode
* performance tests
* what about redundancy and multiple machines? There are ways; redundant droplet, backup and restore, publish changes...
* DO droplets availability
* SQLite - WAL and indexes? Whole pages are in the WAL!
* availability note - retries?
* pragma wal_checkpoint(truncate)
* backups?
* simplicity?
* PRAGMA temp_store = memory;PRAGMA cache_size = 1000000
* https://github.com/asg017/sqlite-vec
* https://sqlite.org/json1.html
* https://sqlite.org/fts5.html
* https://blog.cloudflare.com/part1-coreless-purge/
* https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
* https://www.sqlite.org/lang_transaction.html
* ToC?

---

<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources
* https://news.ycombinator.com/item?id=26816954
* https://www.sqlite.org/fasterthanfs.html
* https://www.sqlite.org/wal.html
* https://www.sqlite.org/appfileformat.html
* https://www.sqlite.org/lockingv3.html#rollback
* https://www.sqlite.org/withoutrowid.html
* https://www.sqlite.org/eqp.html
* https://litestream.io/
* https://www.youtube.com/watch?v=ZSKLA81tBis
* https://bryce.fisher-fleig.org/quick-notes-on-sqlite-capabilities/
* https://www.sqlite.org/whentouse.html
* https://sqlite.org/draft/rsync.html
* https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/
* https://www.sqlite.org/eqp.html
* https://www.sqlite.org/backup.html
* https://www.sqlite.org/lang_vacuum.html#vacuuminto
* https://www.epicweb.dev/why-you-should-probably-be-using-sqlite
* https://kerkour.com/distributed-sqlite
* https://kerkour.com/sqlite-for-servers
* https://www.sqlite.org/autoinc.html
* https://www.sqlite.org/fiddle
* https://www.sqlite.org/datatype3.html
* https://www.sqlite.org/queryplanner.html
* https://www.sqlite.org/lang_analyze.html
* https://antonz.org/json-virtual-columns/
* https://antonz.org/sqlite-generated-columns/
* https://www.sqlite.org/queryplanner.html

</div>