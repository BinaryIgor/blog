---
{
    "title": "SQLite DB: simple, in-process, resilient, fast",
    "slug": "sqlite-db-simple-in-process-resilient-fast",
    "startedAt": "2024-12-12",
    "publishedAt": "2024-12-22",
    "excerpt": "Simplicity is beautiful, and what is simpler than SQLite - a single-file, in-process database? It runs alongside your application, no separate server needed.",
    "researchLog": [ 1, 3, 4.5, 7, 2 ],
    "writingLog": [ 4.5, 1.5 ]
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
3. [Features: is there enough?](#features-is-there-enough)
4. [Limitations and Quirks: how to overcome them?](#limitations-and-quirks-how-to-overcome-them)


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

That is amazing performance as far as SQLite alone goes; but how would it perform in the application, in the real production environment? Well, some time ago, [we have tested limits of a single machine http server](/how-many-http-requests-can-a-single-machine-handle.html). There we have a few machine sizes to test - small, medium and large - and a basic Spring Boot, Java 21 + PostgreSQL app, all running on a single VPS (droplet) provided by the Digital Ocean. It is a setup that you would absolutely use in production (only https support is lacking, easy to add with Nginx + Let's Eencrypt). I decided to rerun these tests, swapping PostgreSQL for SQLite. For an additional context, we have a similar table:
```
-- NOT NULL? --
CREATE TABLE account (
  -- UUID really, no dedicated type for it in SQLite --
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX account_name ON account(name);
```
We also initialize SQLite connections with some additional, non-default settings:
```
PRAGMA journal_mode=WAL;
PRAGMA cache_size=100000;
```
TODO: comment

We also have realistic load characteristics: tests consist primarily of read requests with approximately 20% of writes. They call our REST API which makes use of the SQLite database with a reasonable amount of data (over one million rows).
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


As you can see, performance is amazing; again, how many systems do hundreds of writes per second on the ongoing,not temporary,  basis? How many get to have thousands of read requests?

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

\

---

* `PRAGMA analyze`!
* https://jilles.me/setting-up-spring-jdbc-and-sqlite-with-write-ahead-logging-mode/

```
spring.application.name=spring-sqlite
spring.datasource.url=jdbc:sqlite:db.sqlite
spring.datasource.hikari.connection-init-sql=\
  PRAGMA journal_mode=WAL;\
  PRAGMA synchronous=NORMAL;\
  PRAGMA cache_size=-10000;\
  PRAGMA temp_store=MEMORY;
spring.sql.init.mode=always
```

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

First, let's consider short periods of unavailability - up to a few seconds. These will most likely be the most frequent ones and fortunately, the easiest to fix. If our Virtual Private Servier is not available for just 1 - 5 seconds, it can be fixed purely on the client side by having request retries - retrying every request up to a few seconds, it the server is not available. For the user, certain requests will just be slower - because of possible, short server unavailability - but they will suceeded eventually, unless we are dealing with a longer unavailability. Before going into solution for this case, it is worth pausing and asking - maybe that is enough? Let's remember, that with *99.9%* and *99.99%* availability, we can expect to be daily unavailable for just *86.4 seconds* or *8.64 seconds*. Most likely, these interruptions will be spread throughout the day, so simple retries will take care of most of them, probably users not even noticing it. But, if we really want to have additional redundancy and be able to deal with longer outages, there is a solution for that. 

What can we do shield ourselves from longer periods of availability, possibly outages, of our single Virtual Private Server, running the entirety of our system - app/apps + SQLite db/dbs? To come up with a high-redundancy setup, we first need to have a tool for backing up SQLite db in a real time (close to it). There are a couple ways to do that:
* [SQLite Backup API](https://www.sqlite.org/backup.html) - can be run on live database, does not block it, and is as simple to use as just issuing `backup to /backup.db` command on the db connection
* [sqlite3_rsync tool](https://www.sqlite.org/rsync.html) - comment...
* [Litestream](https://litestream.io/) - external tool to continuously stream SQLite changes to AWS S3, Azure Blob Storage, Google Cloud Storage, SFTP, or NFS


Here is an example idea for high-availablity and redundancy setup:
* Run three machines - primary, secondary and gateway. Gateway should probably run in multiple instances or we can use some kind of managed service for this component
* Primary and secondary have the same application/applications deployed to them
* During usual operations, gateway is pointing only to the primary instance; secondary receives no traffic
* On the secondary, we have a backup/backups of the primary databases. There are a couple of tools to do this:
  * 1: https://litestream.io/getting-started/
  * 2: https://www.sqlite.org/rsync.html
  * 3: https://www.sqlite.org/backup.html
* Because of the former, on the secondary we have all SQLite databases replicated, with a possible data delay of about few seconds to a few minutes, depending on the tools used and our setup
* Gateway is constantly monitoring, whether primary machine is alive or not - issuing simple healthchecks every few seconds
* If primary is down for anything between 30 seconds to a few minutes - gateway is triggering failover procedure
* ....

As we can see, that setup is significantly more complex, but all high-reduntant setups are like that. In most cases, we do not need that, but if we have a business case for it, it is probably worth the complexity (what about regions?).

Summing it up, in most cases *99.9%/99.99%* availability coming from the cloud provider + simple retry strategy is good enough. Should we want/need more there are tools...


## Features: is there enough?
* https://www.sqlite.org/different.html
* https://www.sqlite.org/expridx.html
* https://antonz.org/json-virtual-columns/
* https://antonz.org/sqlite-generated-columns/
* show query plans of type `select name from account order by name desc limit 10;`
* `sqlite3` cli in general - .mode box, .mode qbox

```
CREATE TABLE account (id text primary key not null, name text not null, created_at integer not null);
CREATE TABLE account_details (
  id text primary key not null, 
  description text, 
  status text, 
  foreign key(id) references account(id) on delete cascade);

WITH RECURSIVE acc(idx, id, name, created_at) AS (
  VALUES (1, hex(randomblob(16)), hex(randomblob(8)), cast(unixepoch('subsec') * 1000 as integer))
  UNION ALL
  SELECT idx + 1, hex(randomblob(16)), hex(randomblob(8)), cast(unixepoch('subsec') * 1000 as integer)
  FROM acc 
  WHERE idx <= 100000
)
INSERT INTO account (id, name, created_at) SELECT id, name, created_at FROM acc;

INSERT INTO account_details (id, description, status)
SELECT id, hex(randomblob(32)) as description, hex(randomblob(4)) as status
FROM account;

```

```
WITH RECURSIVE r(a, b) AS (
  VALUES(21, hex(randomblob(16)))
  UNION ALL
  SELECT a+1, hex(randomblob(16)) FROM r WHERE a < 30
)
SELECT * FROM r;
INSERT INTO buffer (id, data) SELECT a AS id, b as data FROM r;
```

SQLite in Docker playground:
```
FROM ubuntu:24.04
RUN apt-get -y update && apt-get -y upgrade &&  apt-get install -y sqlite3
WORKDIR /dbs
CMD ["/bin/bash"]


docker build . -t sqlite-browser
docker rm sqlite-browser
docker run -it -v "/home/igor/sqlite-limits-tests_volume:/dbs" --name sqlite-browser sqlite-browser
```


## Limitations and Quirks: how to overcome them?

* 1 writer, multiple readers ~ Event Sourcing (geo especially)
* `sqlite3_rsync` - only diffs!
* `PRAGMA foreign_keys = boolean`;
* NULLS in primary key?
* limited migrations
* https://www.sqlite.org/omitted.html
* https://www.sqlite.org/limits.html

## Closing thoughts

Some interesting thoughts:
* Availability - how many infrastructures have truly redundant setups?
* ??

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

</div>