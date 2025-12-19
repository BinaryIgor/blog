---
{
    "title": "SQLite DB: simple, in-process, reliable, fast",
    "slug": "sqlite-db-simple-in-process-reliable-fast",
    "startedAt": "2024-12-12",
    "publishedAt": "2024-12-24",
    "updatedAt": "2025-02-05",
    "excerpt": "I love simplicity. Complexity is our eternal enemy and Simplicity is beautiful; rarely something is as simple as SQLite: a single-file, in-process database. It runs inside our application, there is no need for a separate database server.",
    "researchLog": [ 1, 3, 4.5, 7, 2, 2.5 ],
    "writingLog": [ 4.5, 1.5, 8, 3, 2, 1, 3, 1.5, 3 ],
    "tags": ["dbs", "performance"]
}
---

## Simplicity and Reliability

As you can tell from my writing on [HTMX](htmx-simpler-web-based-app-or-system.html), [Modularity](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html) or [Infrastructure](/kubernetes-maybe-a-few-bash-python-scripts-is-enough.html), 
I love simplicity. [Complexity is our eternal enemy](https://grugbrain.dev/#grug-on-complexity) and Simplicity is beautiful; rarely something is as simple as SQLite: a single-file, in-process database. 
**It runs inside our application, there is no need for a separate database server.**

In the more traditional setup, there usually is a separate database server: PostgreSQL, MySQL, MariaDB, Microsoft SQL Server, Oracle Database and so on. 
It gives flexibility, when it comes to scaling or multi-application/process access for example, but it also brings complexity.
This independent database server/process needs to be maintained and monitored, since failure is always possible, and together with it our application might fail as well. 
We also tend to forget that the [network is not reliable](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing).
Network might fail at any time as well, so can our application together with it, and do we always account for this failure? 
Additionally, how often a single logical (not physical) database needs to be accessed by multiple processes and applications that live on different machines?
Usually, the database is just a dedicated storage of data/state tailored to our application or its modules. 
Do we really need to share this data/state over the network, directly?

SQLite is an embedded SQL database engine that lives as a library, inside the process and runs together with it; it writes and reads from a single database file (almost).
**Because of this Simplicity, we get Reliability - network cannot fail us, since we operate on simple, local files.** 
In many cases, we will also gain performance because latency of local file operations is much lower than network access.

**Is it all roses? Of course not, nothing is - there are just better and worse tradeoffs, depending on the context and use case.**
To examine whether and when SQLite can be treated as a replacement for relational database management system (RDBMS), we will go through the following:
1. [Performance and Scalability: how far can it go?](#performance-and-scalability-how-far-can-it-go)
2. [Availability: is it really a problem?](#availability-is-it-really-a-problem)
3. [Features: is it enough?](#features-is-it-enough)
4. [Limitations and Quirks: how to work around them?](#limitations-and-quirks-how-to-work-around-them)
5. [Final thoughts](#final-thoughts)


## Performance and Scalability: how far can it go?

Recently, [I have run some performance/load tests against SQLite on my YouTube channel](https://www.youtube.com/watch?v=s1ODKXTg2Yo). 
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

*All tests were run with resources limited to 1GB of RAM and 2 CPUs in Docker, on a machine with 32 GB of RAM, Intel® Core™ i7-9750HF CPU @ 2.60GHz × 12 and Ubuntu 22 OS.
Test table had ~ 1 million records; every write modified one record, every read used an index.*

As we can see, writes are the limiting factor here - in SQLite, all writes to a single database are serialized (sequential), there is only one writer at any given time. But still, it managed to perform close to 1000 writes per second - how many applications need to handle this type of load continuously, not temporarily?
**Most applications do mostly reads and sometimes writes; looking at the *Writes 10%, Reads 90%* case - SQLite can handle more than 7000 queries per second!**

This is excellent performance as far as SQLite alone goes, but how would it perform in an application, in the real production environment? 
Well, some time ago, [we tested limits and performance of a single machine HTTP server/REST API](/how-many-http-requests-can-a-single-machine-handle.html). 
There were a few machines to test - small, medium and large - and a basic Spring Boot, Java 21 + PostgreSQL app, all running on a single virtual machine (Droplet) provided by DigitalOcean. 
It is a setup that we can absolutely use in production (only https support is lacking and is easy to add with Nginx + Let's Encrypt). 
I decided to run very similar tests, swapping Postgres for SQLite basically. For the context, we have a similar table:
```
CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX account_name ON account(name);
```
SQLite is initialized with some additional, non-default settings by issuing the following SQL commands:
```
PRAGMA cache_size=100000;
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```
Increased cache size allows to cache more data pages in memory; it is a page multiplier and page has 4096 bytes by default (~ 400 MB of cache here). [Write-Ahead-Logging (WAL)](https://www.sqlite.org/wal.html) journal mode increases concurrency - writer does not block readers, they can work together in parallel (in the default mode, writer blocks readers and vice versa).
We also increase `busy_timeout` to 5 seconds so that potentially queued up writes have a chance to finish.

Test requests resemble reality: they consist primarily of reads (90%) with approximately 10% of writes. 
Tests call our REST API which has a SQLite database with a reasonable amount of data - over one million rows.
[Here are the results](https://github.com/BinaryIgor/code-examples/tree/master/single-machine-tests-sqlite/load-test-results):

1. **Small machine - 1 CPU, 1 GB of memory**
    * 12 000 requests with 400 requests/second rate handled in 30.3 s
    * Min: 0.001 s, Max: 0.12 s, Mean: 0.005 s
    * Percentile 50 (Median): 0.003 s, Percentile 90: 0.01 s
    * Percentile 99: 0.025 s, Percentile 99.9: 0.057 s
2. **Medium machine - 2 CPUs, 2 GB of memory**
    * 60 000 requests with 2000 requests/second rate handled in 30.3 s
    * Min: 0.0 s (less than 1 ms), Max: 0.194 s, Mean: 0.014 s 
    * Percentile 50 (Median): 0.005 s, Percentile 90: 0.041 s
    * Percentile 99: 0.074 s, Percentile 99.9: 0.107 s
3. **Large machine - 4 CPUs, 8 GB of memory**
    * 90 000 requests with 3000 requests/second rate handled in 32.6 s
    * Min: 0.0 s (less than 1 ms), Max: 2.776 s, Mean: 0.207 s
    * Percentile 50 (Median): 0.143 s, Percentile 90: 0.569 s
    * Percentile 99: 0.618 s, Percentile 99.9: 0.649 s
    
*Executed requests were ~ 10% writes, 90% reads. Test table had ~ 1.25 million records; every write modified one record, every read used an index.*

Performance is amazing again: **on a machine with 2 - 4 CPUs, we can handle 2000 - 3000 HTTP requests per second, continuously, without any issues.**
Once more, how many systems do hundreds of writes per second on a constant, not temporary, basis? How many have thousands of read requests?

What is more, there is a straightforward way to scale it even further by using multiple SQLite databases:
* database per module -  [in a modular monolith, there should not be cross-module transactions](/modular-monolith-dependencies-and-communication.html) anyways, so it does not complicate anything and gives us additional, per module, scalability
* N shards (databases) based on user/account id, country code or anything else that matches application data access patterns - route requests/queries to one of these shards (databases) based on a sharding key

**With this simple trick, it is safe to say that SQLite performance can be increased at least five to ten times by sharding it on a single machine** - at some point we will be limited by the underlying OS and hardware I/O operations, not the SQLite db itself. 
Based on these assumptions and above tests, it comes down to:
```
15 000 - 30 000 RPS:
 1500 - 3000 writes (10%) 
 13 500 - 27 000 reads (90%)
```

\
As we can see, the performance of SQLite is more than enough for the vast majority of applications/systems out there. 
But what about the availability of a single machine system?

{{ .js: newsletterSignUpPostMid() }}

## Availability: is it really a problem?

Virtual Private Server (VPS) is not really a single physical machine - it is a single logical machine, with many levels of redundancy, both hardware and software, implemented by cloud providers to deliver high availability. 
Most cloud providers have at least *99.9% availability*, stated in their service-level agreements (SLA), and some - [DigitalOcean](https://docs.digitalocean.com/products/droplets/details/sla/) and [AWS](https://aws.amazon.com/compute/sla/) for example - offer *99.99% availability*. 
This comes down to:
```
24 * 60 = 1440 minutes in a day
30 * 1440 = 43 200 minutes in a month
60 * 1440 = 86 400 seconds in a day

99.9% availability:
86 400 - 86 400 * 0.999 = 86.4 seconds of downtime per day
43 200 - 43 200 * 0.999 = 43.2 minutes of downtime per month

99.99% availability:
86 400 - 86 400 * 0.9999 = 8.64 seconds of downtime per day
43 200 - 43 200 * 0.9999 = 4.32 minutes of downtime per month
```

**Depending on the chosen cloud provider, this is availability we can expect from the simplest possible system, running on a single virtual server.** 
What if that is not enough for us? Or maybe we simply do not trust these claims and want to have more redundancy, but still enjoy the benefits of SQLite simplicity? Can it be improved upon?

**First, let's consider short periods of unavailability - up to a few seconds.** 
These will most likely be the most frequent ones and fortunately, the easiest to fix. 
If our VPS is not available for just 1 to 5 seconds, it can be handled purely on the client side by having retries - retrying every request up to a few seconds, if the server is not available.
For the user, certain operations will just be slower - because of possible, short server unavailability - but they will succeed eventually, unless the issue is more severe and the server is down for longer.
Before considering possible solutions for this longer case, it is worth pausing and asking - *maybe that is enough?*
Let's remember that with *99.9% and 99.99% availability* we expect to be daily unavailable for at most *86.4 or 8.64 seconds*. 
Most likely, these interruptions will be spread throughout the day, so simple retries can handle most of them without users even noticing. 
**Let's also remember that complexity is often the enemy of reliability. Moreover, our system is as reliable as its weakest link.**
But, if we really want to have additional redundancy and be able to deal with potentially longer periods of unavailability, there are at least two ways of going about it.

**For the first solution, we can write to external volume - Block Storage.** 
These are flexible network-based devices that provide additional storage for virtual machines; most cloud providers offer them as a service - there is [DigitalOcean Volumes Block Storage](https://docs.digitalocean.com/products/volumes/), [Google Cloud Block Storage](https://cloud.google.com/products/block-storage) or [Amazon Elastic Block Store](https://aws.amazon.com/ebs/) for example. 
In this setup, there is a virtual machine with attached external volume, where SQLite data lives. These volumes can have higher availability than virtual machines and are independent from them. 
We then might have the following setup:
* Virtual machine needs to be proxied by some kind of gateway/load balancer with a static IP address.
  This gateway will be our availability bottleneck - we should have the best possible setup for it. 
  Using some kind of managed service for this component is probably the best idea here; something like [Cloudflare Gateway](https://www.cloudflare.com/zero-trust/products/gateway) or [DigitalOcean Load Balancer](https://docs.digitalocean.com/products/networking/load-balancers/details/)
* If our machine becomes unavailable for some time, create new virtual machine
* Detach volume from old machine, attach it to new one
* Deploy application/applications to new machine
* Discard old machine, switch gateway/load balancer so that it points to the new one
* If we want to minimize possible downtime, always running two machines - primary and secondary, to make switching faster - is a good idea

**With this strategy in place, we are shielded from virtual machine failures, but we are not protected against volume unavailability.** Anxiety/paranoia is high on this one, since these volumes are made ultra redundant with multiple copies being replaced live all the time. But if that is still not enough, there is a second strategy.

**To be independent from external volume unavailability, we first need to have a tool for backing up SQLite db in a close to real time manner.** There are a couple ways to do that:
* [SQLite Backup API](https://www.sqlite.org/backup.html) - can be run on a live database, does not block it and is as simple to use as issuing `backup to /backup.db` command on the db connection. It is the slowest option because it always backs up the whole db from scratch. For a few gigabytes db, it can take anywhere from 10 to 30 seconds (under load), so it is limited to rather small databases (or to be used as a regular backup tool)
* [sqlite3_rsync tool](https://www.sqlite.org/rsync.html) - new, promising tool coming directly from SQLite developers. It treats the original database as primary and copy as replica. As names suggest, only differences between origin and replica are sent (almost, page hashes are compared) so it is a much more efficient option
* [Litestream](https://litestream.io/how-it-works/) - external tool to continuously stream SQLite changes to AWS S3, Azure Blob Storage, Google Cloud Storage, SFTP or just a regular file. I did not test it, but many people like it and in theory it is the most efficient option, since only incremental changes are sent continuously, making a great use of the WAL mechanism

Assuming that we have an identical-enough replica of our primary SQLite db/dbs (sqlite3_rsync or Litestream are the best options for this), we can come up with a high-redundancy setup. Here is an example idea:
* Run three machines/components - primary, secondary and gateway. As previously, gateway is our availability bottleneck - overall availability cannot be higher than its 
* Primary and secondary have the same application/applications deployed to them
* During regular operations, gateway points only to primary; secondary receives no traffic
* On the secondary, we have live backup/backups of the primary db/dbs as described above
* Thanks to that, on the secondary we have all SQLite databases replicated, with a possible data delay of a few seconds to minutes depending on the used tools
* Gateway constantly monitors whether primary is alive or not by regularly issuing healthchecks
* If primary is down for anything between a few seconds to minutes (depending on our setup and requirements) - gateway triggers a failover procedure:
  * secondary becomes new primary and all traffic goes to it
  * old primary is discarded
  * new secondary is created and it immediately starts replicating data from new primary (previous secondary)

\
**As we can see, both of these setups are significantly more complex - that is the price to be paid for ultra high availability and redundancy.** In most cases, we do not need it and it is best avoided. Also, if we insist on having ultra high availability and redundancy, it might be worth considering whether we should run our primary and secondary machines in different geographical regions. After all, it is possible that the whole data center of our cloud provider might go down in one region but work in another one; some people would even suggest having secondary hosted by a different cloud provider. There is really no end as to how far we can take complex setups like that, but at every step it is highly recommended to ask the question: *is it worth it? Does additional complexity justify potential benefits?*

**Summing it up, in most cases, *99.9% - 99.99% availability* delivered by the cloud provider + simple client retry strategy, handling most short interruptions, is good enough.** Should we want/need more, there are tools to still reap the benefits of a single machine + SQLite architecture simplicity while having ultra high redundancy and availability.

## Features: is it enough?

SQLite supports all the features we would expect from a regular relational database server and more:
* [Indexes (B-tree)](https://www.sqlite.org/lang_createindex.html) - single-column, composite, [partial](https://www.sqlite.org/partialindex.html), [expressions](https://www.sqlite.org/expridx.html)
* [Foreign Keys](https://www.sqlite.org/foreignkeys.html)
* [Query Planner](https://www.sqlite.org/eqp.html)
* Great [CLI](https://www.sqlite.org/cli.html) - helps with analyzing data and playing with various features
* [JSON support](https://www.sqlite.org/json1.html)
* [Common Table Expressions (CTEs)](https://www.sqlite.org/lang_with.html)
* [Full-text search](https://www.sqlite.org/fts5.html)
* [Extensions](https://www.sqlite.org/loadext.html) - API that allows adding arbitrary functionality to SQLite
* Excellent [backup techniques](https://www.sqlite.org/backup.html)
* [Concurrency and multi-process access](https://www.sqlite.org/faq.html#q5)
* **Integration/E2E Tests** - since SQLite db is just a file, tests of any application using it are as simple as it gets; just create and delete a file in tests
* It really is not granted but very useful - [great documentation](https://www.sqlite.org/)

\
As we can see, the list is long and comprehensive. JSON support is quite impressive, which comes in handy when we want to have semi-structured data. Although there is nothing similar to [Postgres GIN Indexes](https://www.postgresql.org/docs/current/gin.html) that allow, for example, to index arbitrary JSON fields, this functionality might be emulated by the use of [generated columns](https://www.sqlite.org/gencol.html). Let's consider a table:
```
CREATE TABLE event (
  timestamp INTEGER NOT NULL,
  data JSON
);
CREATE INDEX event_timestamp ON event(timestamp);

INSERT INTO event (timestamp, data) 
VALUES (
  CAST(unixepoch('subsec') * 1000 AS INTEGER), 
  json_object('device', 'a', 'reading', 22)
);
INSERT INTO event (timestamp, data) 
VALUES (
  CAST(unixepoch('subsec') * 1000 AS INTEGER), 
  json_object('device', 'b', 'reading', 44)
);
```
We would like to query events by the device field. To make it fast, we can create virtual (generated) column and index it:
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
We have a few interesting things at play here. First, both limited support for storing date and/or time and a set of date and time functions - `unixepoch('subsec')` returns current unix timestamp as floating point number, that is why we multiply it to have millisecond precision timestamp. Second, there are other useful functions - `json_object()` makes it easier to construct json objects; generating random data is quite straightforward with random bytes created by the `randomblob()` and then converting it into a hex string - especially when combined with recursive common table expressions. Now, let's compare query plans and execution times with/without device index:
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

# using indexed, virtual column
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
We went from *500 ms to 1 ms* and query plan neatly displayed everything we need to know.

## Limitations and Quirks: how to work around them?

* [PRIMARY KEY does not imply NOT NULL](https://www.sqlite.org/lang_createtable.html#the_primary_key) - in many cases, we should add NOT NULL clause to the primary key declaration which is not needed in other databases. According to the SQL standard, PRIMARY KEY should always imply NOT NULL
* Foreign Keys are not are not enabled by default - running `PRAGMA foreign_keys = ON` on every db connection is required to enforce them
* [Write-Ahead Logging (WAL)](https://www.sqlite.org/wal.html) mode is not enabled by default - it offers better performance and allows for more concurrency; single writer does not block readers. It can be turned on by executing `PRAGMA journal_mode=WAL` command
* All writes are serialized, executed sequentially - there can be only one writer at a time. 
  To avoid [SQLITE_BUSY](https://www.sqlite.org/rescode.html#busy) errors, it is usually a good idea to increase busy timeout to a few seconds by issuing `PRAGMA busy_timeout=5000` command
* Because all writes are sequential, there is [only one supported isolation level - Serializable](https://www.sqlite.org/isolation.html). It both simplifies some things - `SELECT ... FOR UPDATE` and explicit locking is often not needed for example - but also limits writes concurrency 
* [Odd rule for read/write transactions](https://www.sqlite.org/lang_transaction.html#read_transactions_versus_write_transactions) - transactions that start with a select statement are marked as read transactions. If a read transaction then performs a write statement, it is upgraded to a write transaction, if possible. Sadly, this upgrade might fail with SQLITE_BUSY error, ignoring `busy_timeout` - if another connection has already modified the database or is in the process of modifying it. To solve this quirk, we should mark transactions as write transactions from the start, either by reordering statements (write first) or starting transaction with `BEGIN IMMEDIATE` command <br>(*added 2025-02-05*)
* [Poor ALTER TABLE support](https://www.sqlite.org/lang_altertable.html) - makes schema migrations more difficult to manage
* [Limited data types](https://www.sqlite.org/datatype3.html) - most notably, there is no native types for storing date and/or time - we must use INTEGER/REAL as unix timestamp or TEXT for storing formatted date and/or time strings. Fortunately, there are [many useful date and time functions](https://www.sqlite.org/lang_datefunc.html). Same goes for UUIDs - we have to store them as TEXT or BLOB
* [Flexible Typing](https://www.sqlite.org/flextypegood.html) - it can be strange at the beginning (compared to other databases) but there are no significant disadvantages to it, it is just different. In a nutshell, types defined in the table schema are only suggestions; it is still possible to insert TEXT into an INTEGER column for example. What is more, type declarations in the table schema are totally optional. But, if we really do not like it, there are [STRICT Tables](https://www.sqlite.org/stricttables.html)
* TRUNCATE is not supported - DELETE must be used
* Query plans are not optimized based on changing table and index statistics - to adjust them for frequently changing tables, it is better to periodically run the [ANALYZE](https://www.sqlite.org/lang_analyze.html) command. It should be run by SQLite automatically, by default
* Executing multi-statement queries is not implemented by many SQLite drivers - if we need to execute multiple queries separated by `;` in a single SQL string, we have to find some workarounds
* More quirks - huge respect to the SQLite authors that it comes directly from them - can be found [here](https://www.sqlite.org/omitted.html) and [here](https://www.sqlite.org/quirks.html)

This list is also quite long and some of the quirks and limitations are rather annoying. Nevertheless, we can tweak a few things to work around them; they are absolutely manageable, especially given the much longer list of SQLite features and advantages.

## Final thoughts

As we have seen, SQLite is a simple, reliable and surprisingly performant database.
It has its own quirks and limitations, but if we account for them by making a few adjustments, we get:
* **The simplest, single file database** - ideal for a single virtual machine system
* **Zero configuration and setup database** - there is nothing to monitor and check, since it is just an in-process library
* **Reliability** - database is a local file, network cannot fail us because we do not use it
* **Lower query latency** - data is in a local file, not over the network. Execution times of many queries can be reduced from *milli to microseconds* 
* **Performance** - [as we saw in the performance tests](#performance-and-scalability-how-far-can-it-go), with the real application setup, a single virtual machine can easily handle thousands of requests per second

\
To sum it up, for virtually every Minimum Viable Product (MVP), Proof of Concept (PoC) or a system/application where:
* *99.9% - 99.99% availability* is enough (can be increased, at the expense of setup complexity)
* no more than several thousand requests per second is expected, at least at the start
* which is to say, for the vast majority of systems

I highly recommend SQLite - it is more than enough; and when we outgrow it, it is fairly straightforward to switch to a full relational database management system (RDBMS), like Postgres. **In the meantime, let's enjoy the benefits of having everything on a single, beefy machine and forget about network problems and all the operational complexity!**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. As said, SQLite has one the best documentations that are out there: https://www.sqlite.org. A few pages that I found particularly interesting and useful:
    1. How it works: https://www.sqlite.org/howitworks.html
    2. Query planner and engine: https://www.sqlite.org/queryplanner.html
    3. Explain query plan: https://www.sqlite.org/eqp.html
    4. Analyze command: https://www.sqlite.org/lang_analyze.html
    5. Write-Ahead Logging (WAL): https://www.sqlite.org/wal.html
    6. Primary keys and rowids: https://www.sqlite.org/lang_createtable.html#primkeyconst, https://www.sqlite.org/rowidtable.html
    7. Use cases: https://www.sqlite.org/whentouse.html
    8. Backup strategies: https://www.sqlite.org/backup.html
    9. Virtual tables: https://www.sqlite.org/vtab.html
    10. Quirks: https://www.sqlite.org/quirks.html
2. SQLite performance tests, on my YouTube channel: https://www.youtube.com/watch?v=s1ODKXTg2Yo
3. Code repo with performance tests: https://github.com/BinaryIgor/code-examples/tree/master/single-machine-tests-sqlite
4. Interesting, in-depth lecture about SQLite, given by its author: https://www.youtube.com/watch?v=ZSKLA81tBis
5. On the (often unnecessary) complexity of modern systems and why Litestream was created: https://litestream.io/blog/why-i-built-litestream/
5. Other valuable reads about SQLite:
    1. https://unixdigest.com/articles/sqlite-the-only-database-you-will-ever-need-in-most-cases.html
    2. https://blog.wesleyac.com/posts/consider-sqlite
    3. https://bryce.fisher-fleig.org/quick-notes-on-sqlite-capabilities/
    4. https://www.epicweb.dev/why-you-should-probably-be-using-sqlite
    5. https://kerkour.com/sqlite-for-servers
    6. https://oldmoe.blog/2024/04/30/backup-strategies-for-sqlite-in-production/

</div>