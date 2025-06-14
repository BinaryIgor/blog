---
{
    "title": "EventSQL: events over SQL",
    "slug": "events-over-sql",
    "startedAt": "2025-05-15",
    "publishedAt": "2025-06-14",
    "excerpt": "<em>Events</em>, and messages more broadly, are a battle-tested way of component to component, process to process, and/or application to application communication ... What if we were able to just use a type of SQL database already managed on our infrastructure to build a scalable <em>Events Platform</em> on top of it?",
    "researchLog": [ 2, 1, 1 ], 
    "writingLog": [ 1, 1, 2, 1.5, 1, 3, 1.5, 2, 1, 2.5, 1, 4 ],
    "tags": [ "dbs" ]
}
---

## Events

*Events*, and messages more broadly, are a battle-tested way of component to component, process to process, and/or application to application communication. In this approach, when something has happened, we publish an associated event:
```
void createUser(User user) {
  validateUser(user);
  saveUser(user);
  publishUserCreatedEvent(user);
}
```
Then, every process that needs to be aware of user creation, might consume this event and do something with it:
```
// process 1
void onUserCreated(UserCreated userCreated) {
  sendUserAccountActivationEmail(userCreated);
}

// process 2
void onUserCreated(UserCreated userCreated) {
  categorizeUser(userCreated);
}

...

// process N
void onUserCreated(UserCreated userCreated) {
  // yet another processing
}
```

\
In general, events should inform us that something has happened. Related, there are *Commands* that request something more directly from another, not specified, process; they might as well be called a certain type of *Events*, but let's not split hair over semantics here. With *Commands*, it is mostly not that something has happened, but that something should happen as a result of command publication. For example, we could have a command that triggers document generation:
```
void onInvoiceIssued(Invoice invoice) {
  saveInvoice(invoice);
  var command = new GenerateDocumentCommand(invoice);
  publishGenerateDocumentCommand(command);
}
```
Then, some process would listen to the `GenerateDocumentCommand` event (command) and generate an associated document. Additionally, with commands, we pretty much always must have a related event informing us about the command result. In this example, we might have the `GenerateDocumentResult` event:
```
// document generator process
void onGenerateDocumentCommand(GenerateDocumentCommand command) {
  var documentPath = generateDocument(command);
  var result = new GenerateDocumentResult(command.documentId(), documentPath);
  publishGenerateDocumentResult(result);
}

// GenerateDocumentCommand publisher process
void onGenerateDocumentResult(GenerateDocumentResult result) {
  var invoice = findInvoice(result.documentId());
  if (invoice != null && invoice.documentPath() == null) {
    updateInvoiceDocumentPath(invoice, result.documentPath());
  }    
}
```

\
As we could observe, **events are a pretty neat and handy way of having decoupled communication; be it between components, processes or applications**. The problem is that in most cases, if we do not publish them in-memory, inside a single process, there must be an additional component running on our infrastructure that provides this functionality. Most often, this component is called a *Message Broker* or *Event Bus*; their functionality differs a bit in detail, but it is not that important for our analysis and comparison here. There are a slew of them; *Apache Kafka, RabbitMQ, Apache Pulsar, Amazon SQS, Amazon SNS and Google Cloud Pub/Sub* being the most widely used examples. Some of them are self-hosted and then we must have an expertise in hosting, configuring, monitoring and maintaining them, investing additional time and resources into these activities. Others are paid services - we tradeoff money for time and accept additional dependency on chosen service provider. In any case, we must give up on something - money, time or both. 

**What if we were able to just use a type of SQL database already managed on our infrastructure to build a scalable *Events Platform* on top of it?** It is totally possible - let's find out why and how. 


## SQL 

As we most likely already use it in our application/system, we know that there are a ton of benefits to using widely-supported and battle-tested *Structured Query Language (SQL)*. What is most worth pointing out, in the context of choosing it as a backend for *Events Platform*:
* **tons of libraries** for virtually any programming language and platform 
* **tons of tools** to read and visualize data through it - we can rely on them to manipulate and read our events data, there is no need to reinvent the wheel by creating new ones
* it is a universal skill, there is an army of people with expertise in it - you most likely know SQL well already
* **[ACID - Atomicity, Consistency, Isolation and Duration](/mysql-and-postgresql-different-approaches.html#acid)** - gives us very useful characteristics and guarantees for our data
* backup and restore procedures - straightforward and proven
* **most cloud providers offer managed SQL database hosting of all types** - we might use it and not worry about hosting issues at all and at the same time simplifying our infrastructure, since we are able to use the same database, or at least database type, for both our application/system and as a backend for our events platform
* **performance** - newest versions of open source databases - like *PostgreSQL* or *MariaDB* - can be optimized to handle *well over 15 000 writes per second* and much more reads, on a single instance

Having it all in mind, let's see how we are able to leverage those features of SQL to build a simple, performant and highly reliable events platform on top of it.

## Overview 

We just need to have a few tables. Column names should be prefixed because some of the names are reserved keywords in some databases (Postgres syntax, schema is fully managed by EventSQL):
```
CREATE TABLE topic (
  eql_name TEXT PRIMARY KEY,
  eql_partitions SMALLINT NOT NULL,
  eql_created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE consumer (
  eql_topic TEXT NOT NULL,
  eql_name TEXT NOT NULL,
  eql_partition SMALLINT NOT NULL,
  eql_first_event_id BIGINT,
  eql_last_event_id BIGINT,
  eql_last_consumption_at TIMESTAMP,
  eql_consumed_events BIGINT NOT NULL,
  eql_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (eql_topic, eql_name, eql_partition)
);

CREATE TABLE {topic}_event (
  eql_id BIGSERIAL PRIMARY KEY,
  eql_partition SMALLINT NOT NULL,
  eql_key TEXT,
  eql_value BYTEA NOT NULL,
  eql_buffered_at TIMESTAMP NOT NULL,
  eql_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  eql_metadata JSON NOT NULL
);

-- Same schema as event, just not partitioned (by topic). --
-- It is used to handle eventual consistency of auto increment; --
-- there is no guarantee that record of id 2 is visible only after id 1 record. --
-- Events are first inserted to the event_buffer; --
-- they are then moved to the {topic}_event table in bulk, by a single, serialized writer (per topic). --
-- Because there is only one writer, it fixes eventual consistency issue (more on it below) --
CREATE TABLE event_buffer (
  eql_id BIGSERIAL PRIMARY KEY,
  eql_topic TEXT NOT NULL,
  eql_partition SMALLINT NOT NULL,
  eql_key TEXT,
  eql_value BYTEA NOT NULL,
  eql_created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  eql_metadata JSON NOT NULL
);
CREATE INDEX event_buffer_topic_id ON event_buffer (eql_topic, eql_id);
-- Used to lock single (per topic) event_buffer to {topic}_event writer --
CREATE TABLE event_buffer_lock (
  eql_topic TEXT PRIMARY KEY
);
```

\
To consume events, we periodically do (every one to several seconds):
```
BEGIN;

SELECT * FROM consumer 
WHERE eql_topic = :topic 
  AND eql_name = :c_name 
FOR UPDATE SKIP LOCKED;

SELECT * FROM {topic}_event
WHERE (:last_event_id IS NULL OR eql_id > :last_event_id)
ORDER BY eql_id
LIMIT :limit;

(process events)

UPDATE consumer 
SET eql_last_event_id = :id,
    eql_last_consumption_at = :now 
WHERE eql_topic = :topic 
  AND eql_name = :c_name;

COMMIT;
```
Additionally, **to increase throughput and concurrency, we might have partitioned topics and consumers**; *-1 partition* stands for not partitioned topic, consumer or event.

Distribution of partitioned events across partitions is the sole responsibility of a publisher. In the EventSQL library, by default, events with a null key are published to a random partition; if keys are defined, a hash-based partition is used - events with the same key always land in the same partition. 

Consumption of events per partition (0 in the example) looks like this:
```
BEGIN;

SELECT * FROM consumer 
WHERE eql_topic = :topic 
  AND eql_name = :c_name 
  AND eql_partition = 0 
FOR UPDATE SKIP LOCKED;

SELECT * FROM {topic}_event
WHERE (:last_event_id IS NULL OR eql_id > :last_event_id)
  AND eql_partition = 0
ORDER BY eql_id 
LIMIT :limit;

(process events)

UPDATE consumer 
SET eql_last_event_id = :id,
    eql_last_consumption_at = :now
WHERE eql_topic = :topic
  AND eql_name = :c_name 
  AND eql_partition = 0;

COMMIT;
```
Limitation of this simple approach being that if a consumer is partitioned, it must have the exact same number of partitions as the topic definition has. Each consumer partition processes events on a dedicated thread.

To recap, we have:
* **topics** - partitioned or not, distributed across partitions by publishers
* **consumers** - partitioned or not, consumption is ordered within partition or globally, if consumer is not partitioned; if consumer is partitioned, it always has the same number of partitions as its topic
* **events** - with a separate table per topic for better performance and flexibility; even if the topic is partitioned, its events still maintain order across all partitions, by their sequential id
* **event buffer and event lock** - solely to deal with the eventually consistent nature of auto increment columns; more on it below

## Eventual Consistency of Auto Increment Columns

*EventSQL* architecture resembles a lot that of *Apache Kafka*, which is often called an immutable event log. In this approach, we treat data as a sequence of events, stored in an ordered and immutable manner. There is no per event/message state that would inform about their acknowledgment (ACK) or rejection (NACK) by a given consumer/subscriber. In our case, the `consumer` table stores `last_event_id` value. For this reason, **we must have a guarantee that event ids grow sequentially and that the event of id *N* will always be visible after *N-1* event, never before it**.

Unfortunately, for auto increment columns, databases provide only the first guarantee - sequential growth.
For valid performance reasons, there are no assurances when it comes to the visibility order - record of id 2 could be visible before id 1 record. It is possible in the following case:
```
Transaction 1: insert record 1
Transaction 2: insert record 2

In time:
1. T1 start - id 1 assigned
2. T2 start - id 2 assigned
3. T2 end - record of id 2 visible before id 1 record!
4. T1 end - record of id 1 visible after id 2 record! 
```

Now, if we read records between step 3 and 4, our consumer updates its `last_event_id` column to 2. Then, micro or milliseconds later, the record of id 1 becomes visible but our consumer will never see it, since its `last_event_id` column is already at the 2 id.

**There is only one way to solve this problem - writes must be serialized; at any point in time, only one writer is allowed.** But, there are at least two ways of enforcing this constraint.

First, a simpler one: lock the table so that there are no parallel writes (inserts). It works, we have a sequential visibility guarantee, but slowdown is significant. I have tried it and the performance penalty is just not acceptable - insert performance is anywhere from 3 to 5 times worse.

That leads us to the second, more complex, but also highly efficient approach:
* write all events as they occur to the temporal `event_buffer` table, without any concurrency limitations 
* every so often, a few times per second or so, run a transfer job
* this job takes *the oldest N events* from the `event_buffer` table and *inserts them in batch* - that is the key performance differentiator - into the `{topic}_event` table; it then removes those moved records from the `event_buffer` table
* at any time, the transfer job operates on a list of topics; to guarantee sequential visibility, it uses the `event_lock` table to lock transfer operation of a certain topic so that there always is at most one writer per topic
* one writer per topic does not incur a noticeable performance penalty, since we move records between tables in large batches of a few hundred or more at once
* as a result, there must be two additional tables - `event_buffer` to hold buffered events and `event_buffer_lock`, with one record per topic, to ensure that there is only one transfer operation per topic at any given time
* as a result, we must also accept *Eventual Consistency* - there will be some delay, albeit very small in most cases and not noticeable, between event publication and its visibility for consumers

**That is the approach taken by EventSQL; slightly more complex, but highly efficient and scalable, as we shall see when we get to the benchmarks.**

## Partitions and Scalability

When describing events consumption, there was a following example:
```
SELECT * FROM consumer 
WHERE eql_topic = :topic 
  AND eql_name = :c_name 
FOR UPDATE SKIP LOCKED;
```
`FOR UPDATE SKIP LOCKED` clause ensures that only rows that are not locked already are returned. This allows us to safely run as many consumer instances in parallel as we wish - if one particular consumer instance is already processing events, remaining ones will simply skip processing at this time. As this query is repeated periodically, in the next run, other consumer instances will again have a chance of locking this record; there always is only one active events processing at a time per consumer, if it is not partitioned.

**To increase parallelism, we might partition our topics and consumers. Then, there is only one active processing at a time not per consumer, but per consumer partition.** When a consumer is partitioned, each partition is processed independently and in parallel:
```
SELECT * FROM consumer 
WHERE eql_topic = :topic 
  AND eql_name = :c_name 
  AND eql_partition = :partition 
FOR UPDATE SKIP LOCKED;
```
As a consequence, consumer parallelism is increased up to the topic's number of partitions but we lose global ordering; from the consumer perspective, events are now sorted only in the context of a single partition, not across them all.

From the perspective of a consumer, running EventSQL on a single db instance should never be a bottleneck: we can have topics with dozens of partitions. **What is more, EventSQL allows consuming events in batches: in case of a particularly loaded topic, each consumer partition might wait for at least next N events to be available for processing, before attempting to process them.** This gives us plenty of room to optimize the reading side of the equation. What about writing? How does it scale? 

First of all, as already mentioned and as we shall see in the [performance section](#performance), **modern SQL dbs can handle well over *15 000 inserts per second*** - that is quite a lot. But, if that is still not enough:
1. we might publish events in batches - depending on the batch size, that could easily get us into publishing *50 000 - 100 000 events per second*; sometimes batching is not possible though, depending on our application/system nature
2. we might use sharding and run EventSQL on multiple databases - it scales linearly; three db instances more or less triple its performance
3. we might combine these approaches and publish events in batches to multiple db instances (shards)

So, there is plenty of room to optimize writes as well. Having it all in mind, let's run some benchmarks to test EventSQL performance in the wild.

## Performance

To not leave these performance claims unfounded, let's run a few benchmarks. What we are about to do:
* have **account_created topic with 10 partitions** and a simple schema: `UUID id, String name, String email, Instant createdAt`
* run EventSQL on a **single Postgres 16 instance, then three** - 16 GB of memory and 8 CPUs (AMD) each
* [have benchmarks app with a partitioned consumer of this topic](https://github.com/BinaryIgor/EventSQL/blob/master/benchmarks/app/src/main/java/com/binaryigor/eventsql/benchmarks/EventsConsumer.java) - it consumes events in batches, simulating processing them by randomly sleeping for *1 to 100 ms* on each events batch 
* [have benchmarks runner](https://github.com/BinaryIgor/EventSQL/blob/master/benchmarks/runner/src/main/java/com/binaryigor/eventsql/benchmarks/EventSQLBenchmarksRunner.java) - it publishes configured `EVENTS_TO_PUBLISH` number of events with set `EVENTS_RATE`; it then waits for a consumer to finish processing and outputs various stats - benchmark results
* run all these components on [DigitalOcean infrastructure](https://www.digitalocean.com), having a dedicated machine for each database + benchmarks runner instance (one per database) and a separate one for the benchmarks app

Source code, details of the setup and instructions on how to run these benchmarks and reproduce results can be found [here](https://github.com/BinaryIgor/EventSQL/tree/master/benchmarks).

Once we have everything set up, let's run a few cases - all of them should take more or less one minute.

### Single db, 5000 events per second {#performance-single-db-5000-events-per-second}

```
2025-06-13T17:20:20.296, 5000/300000 events were published, waiting 1s before next publications...
2025-06-13T17:20:21.821, 10000/300000 events were published, waiting 1s before next publications...

...

2025-05-02T11:28:43.372, 290000/300000 events were published, waiting 1s before next publications...
2025-05-02T11:28:44.374, 295000/300000 events were published, waiting 1s before next publications...

...

Publishing 300000 events with 5000 per second rate took: PT1M1.159S, which means 4905 per second rate

...

Waiting for consumption....

...

Consuming 300000 events with 5000 per second rate took: PT1M4.218S, which means 4671 per second rate
```

### Single db, 10 000 events per second {#performance-single-db-10000-events-per-second}

```
2025-06-13T17:23:20.129, 10000/600000 events were published, waiting 1s before next publications...
2025-06-13T17:23:22.158, 20000/600000 events were published, waiting 1s before next publications...

...

2025-05-02T11:28:43.372, 290000/300000 events were published, waiting 1s before next publications...
2025-05-02T11:28:44.374, 295000/300000 events were published, waiting 1s before next publications...

...

Publishing 600000 events with 10000 per second rate took: PT1M2.126S, which means 9657 per second rate

...

Waiting for consumption....

...

Consuming 600000 events with 10000 per second rate took: PT1M4.73S, which means 9269 per second rate
```

### Single db, 15 000 events per second {#performance-single-db-15000-events-per-second}

```
2025-06-13T17:26:16.244, 15000/900000 events were published, waiting 1s before next publications...
2025-06-13T17:26:19.232, 30000/900000 events were published, waiting 1s before next publications...

...

2025-06-13T17:27:16.718, 870000/900000 events were published, waiting 1s before next publications...
2025-06-13T17:27:17.754, 885000/900000 events were published, waiting 1s before next publications...

...

Publishing 900000 events with 15000 per second rate took: PT1M3.891S, which means 14086 per second rate

...

Waiting for consumption....

...

Consuming 900000 events with 15000 per second rate took: PT1M7.061S, which means 13420 per second rate
```

### Single db, 20 000 events per second {#performance-single-db-20000-events-per-second}

```
2025-06-13T17:30:46.469, 20000/1200000 events were published, waiting 1s before next publications...
2025-06-13T17:30:49.817, 40000/1200000 events were published, waiting 1s before next publications...

...

2025-06-13T17:31:49.449, 1160000/1200000 events were published, waiting 1s before next publications...
2025-06-13T17:31:50.547, 1180000/1200000 events were published, waiting 1s before next publications...

...

Publishing 1200000 events with 20000 per second rate took: PT1M7.11S, which means 17881 per second rate

...

Waiting for consumption....

...

Consuming 1200000 events with 20000 per second rate took: PT1M14.004S, which means 16215 per second rate
```

### Three dbs, 45 000 events per second {#performance-three-dbs-45000-events-per-second}

```
2025-06-13T17:46:47.486, 15000/900000 events were published, waiting 1s before next publications...
2025-06-13T17:46:50.227, 30000/900000 events were published, waiting 1s before next publications...

...

2025-06-13T17:47:48.132, 870000/900000 events were published, waiting 1s before next publications...
2025-06-13T17:47:49.148, 885000/900000 events were published, waiting 1s before next publications...

...

Publishing 900000 events with 15000 per second rate took: PT1M4.025S, which means 14057 per second rate
3 runner instances were running in parallel, so the real rate was 42171 per second for 2700000 events

...

Waiting for consumption....

...

Consuming 900000 events with 15000 per second rate took: PT1M6.607S, which means 13512 per second rate
3 runner instances were running in parallel, so the real rate was 40536 per second for 2700000 events
```

### Three dbs, 60 000 events per second {#performance-three-dbs-60000-events-per-second}

```
2025-06-13T17:50:16.113, 20000/1200000 events were published, waiting 1s before next publications...
2025-06-13T17:50:19.675, 40000/1200000 events were published, waiting 1s before next publications...

...

2025-06-13T17:51:18.899, 1160000/1200000 events were published, waiting 1s before next publications...
2025-06-13T17:51:19.919, 1180000/1200000 events were published, waiting 1s before next publications...

...

Publishing 1200000 events with 20000 per second rate took: PT1M6.448S, which means 18059 per second rate
3 runner instances were running in parallel, so the real rate was 54177 per second for 3600000 events

...

Waiting for consumption....

...

Consuming 1200000 events with 20000 per second rate took: PT1M18.118S, which means 15361 per second rate
3 runner instances were running in parallel, so the real rate was 46083 per second for 3600000 events
```

### Results summary {#performance-results-summary}

Results speak for themselves: **EventSQL is able to publish and consume well over *15 000 events per second* on a single Postgres instance. What is more, sharding gives us linear scalability.** With *3 shards*, we can handle well over *45 000 events per second*; with *10 shards*, we are able to go over *150 000* and with *100 - over 1 500 000 events per second*.

## Tradeoffs and consequences

Is it all roses? Of course not, nothing really is. Some of the most important tradeoffs and consequences - both positive and negative - of the EventSQL approach are:
* **It is a library, not an independent component to deploy and monitor**; this is both an advantage and disadvantage - infrastructure is simpler as we can make use of the database type we already run, but EventSQL library must be reimplemented in every programming language/ecosystem. Currently, it is only available through Java on JVM
* Even though we can (and should) run EventSQL on the same database type we already use, **it is recommended to have a dedicated physical instance only for EventSQL**. Unless our traffic is low or medium - less than a thousand events per second - we might experience performance issues as single database resources are shared by EventSQL and our application/system  
* `FOR UPDATE SKIP LOCKED` approach allows us to have a single consumer in as many instances as we wish; combined with partitioned consumers and batch processing, this gives us plenty of room to optimize events processing
* When it comes to publishing, **batching and sharding do increase complexity a bit, but provide pretty much infinite scalability**; or at the very least in the *1 000 000 - 10 000 000 events per second* range
* It does not have built-in redundancy - multiple collaborating nodes with the ability to recover from a leader/master failure - like Kafka for example has. If we want to have it, it must be ensured at the database level; fortunately, it is provided by most managed database services available on various cloud platforms
* As of now, topic and consumer redefinition support is fairly limited. For example, topic definitions can only be changed if they do not have any events or consumers. If we want to change them afterwards, it must be done manually. Similarly with consumers; once they have consumed any events, they cannot be redefined: changed from being partitioned to not-partitioned or vice versa
* Luckily, because of how sharding is implemented, **it is fairly easy to add additional shard (db instance) to EventSQL, since each shard is symmetrical - it has the same topics, consumers and partitions**. All we have to do is to update publishers so that they make use of an additional shard and then do the same with consumers (in any order) - it is just a matter of changing EventSQL configuration. On the other hand, removing shards is not possible to do automatically; we must migrate published events and update consumer states manually, if we really have to
* As EventSQL would run on a SQL database type we already operate, **it simplifies local development and integration testing of our apps** - if we have a setup to test our database, it is ready to be used for EventSQL integration testing as well. There is no need to add additional dependencies and configuration to set up Kafka or RabbitMQ instances for local development and testing purposes - we can utilize what we already have
* **For loaded topics, every active consumer partition generates more or less three queries per second** - that puts a a cap on how many active consumer instances we can have and thus, topics. Having our performance results in mind - *over 15 000 published events per second* - we might reasonably assume having a budget of *15 000 db queries per second* purely for consumers. Running EventSQL on a single db, it gives us (for more, just use sharding):
  * 1000 topics with 3 partitions, each consumed by 5 partitioned consumers: `1000 * 3 * 5 = 15 000`
  * 500 topics with 10 partitions, each consumed by 3 partitioned consumers: `500 * 10 * 3 = 15 000`
  * 100 topics with 10 partitions, each consumed by 15 partitioned consumers: `100 * 10 * 15 = 15 000`
  * 100 topics with 3 partitions, each consumed by 50 partitioned consumers: `100 * 3 * 50 = 15 000`
  * 50 topics with 100 partitions, each consumed by 3 partitioned consumers: `50 * 100 * 3 = 15 00` 

## Conclusion

As we have seen, **we can make an even better use of battle-tested SQL databases to run simple, yet highly reliable and scalable *Events Platform* on top of them**. As a consequence, we simplify our infrastructure by optimizing the use of what we already have, without making any compromises when it comes to reliability, performance or scalability. For all these reasons, if you need to publish and consume events, I highly encourage you to give EventSQL a try!

<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources

1. EventSQL source code and how to use it: https://github.com/BinaryIgor/EventSQL
2. Building events/messaging platforms on top of Postgres: https://blog.sequinstream.com/build-your-own-sqs-or-kafka-with-postgres/
3. Gaps and eventually consistent nature of auto increment sequences (columns):
    1. https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/
    2. https://blog.sequinstream.com/postgres-sequences-can-commit-out-of-order/
    3. https://event-driven.io/en/ordering_in_postgres_outbox/
    4. https://www.neilconway.org/docs/sequences/
4. Calculations of active topic and consumer limits are based on the following reasoning:
    1. we can publish at least *15 000 events per second* on a single db - [see performance results](#performance)
    2. each publication means at least one db query - insert
    3. during publication, at least another *15 000 queries per second* are made to consume events: locking consumers, reading events and then updating consumer states
    4. hence, *15 000 queries per second* budget purely for consumers


</div>