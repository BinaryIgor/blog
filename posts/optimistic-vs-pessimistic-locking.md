---
{
    "title": "Optimistic vs Pessimistic Locking: concurrency control, conflicts, lost updates, retries and blocking",
    "slug": "optimistic-vs-pessimistic-locking",
    "startedAt": "2025-10-31",
    "publishedAt": "2025-11-04",
    "excerpt": "In many applications and systems, we must deal with concurrent, often conflicting and possibly lost, updates. This is exactly what the <em>Concurrency Control</em> problem is all about.",
    "researchLog": [ 2.5, 1.5, 0.5 ],
    "writingLog": [ 2, 2.5, 1.5, 2.5, 1, 4.5, 2, 3, 2 ],
    "tags": [ "dbs" ]
}
---

## Conflicts and Lost Updates

In many applications and systems, we must deal with concurrent, often conflicting and possibly lost, updates. This is exactly what the *Concurrency Control* problem is all about. 

One such possibility occurs when we have a *user-facing REST endpoint* of the kind:
```
@PutMapping("/campaigns/{id}")
ResponseEntity<Campaign> updateCampaign(UUID id, UpdateCampaignRequest request) {
  var campaign = campaignRepository.findById(id);
  var toUpdateCampaign = campaign.withBudget(request.budget());
  var updatedCampaign = campaignRepository.save(toUpdateCampaign);
  return ResponseEntity.ok(updatedCampaign);
}

// campaign = { id: 1, budget: 0 }
// user1 request = id: 1, { budget: 1000 }
// user2 request = id: 1, { budget: 2000 }
```

Let's say that *user1* sees a budget of `0` and decides to update it to `1000`; *user2* sees the same and decides to update it to `2000`. The update of *user1* is *essentially lost* - *user1* is not even aware that *user2* is changing anything. What is more, *user1* might go back to their business thinking that the budget is `1000` instead of `2000`. Not good.

The above example involved two human beings, intentionally modifying data as they see fit. Another common case happens when soulless services communicate asynchronously:
```
void onClick(ClickEvent click) {
  transactions.execute(() -> {
    var budget = budgetRepository.findById(click.budgetId());
    long newAvailableAmount;
    if (click.cost() > budget.availableAmount()) {
      newAvailableAmount = 0;
      // triggers some kind of budget deactivation process
    } else {
      newAvailableAmount = budget.availableAmount() - click.cost();
    }
    budgetRepository.save(budget.withAvailableAmount(newAvailableAmount));
  });
}

// budget = { id: 1, availableAmount: 100 }
// click1 = { id: 1, budgetId: 1, cost: 50 }
// click2 = { id: 2, budgetId: 1, cost: 60 }
```

When *click1* and *click2* happen roughly at the same time, both `onClick` function calls receive a budget with `availableAmount=100`. If *click1* finishes first, we end up with `availableAmount=40`, since *click2's* computation overrides *click1's* result. If *click2* finishes first, we end up with `availableAmount=50`, since *click1's* computation overrides *click2's* result. In either case, the final result is not what the code is meant to achieve - one update *conflicts* with the other, one of them is *lost*. In each case, the correct output should be the budget with `availableAmount=0` (see the if/else clause). The order of events should never affect the final result - it must always be the same.

**How can we save those two users from overriding each other's work? How to prevent money leak on the lost clicks?** 

## Optimistic Locking

The first solution to our concurrency problems is, well, optimistic. **We assume that our update will not conflict with another one; if it does, an exception is thrown and handling it is left to the user/client.** It is up to them to decide whether to retry or abandon the operation altogether. 

How can such conflicts be detected?

There must be a way to determine whether a record was modified at the same time we were working on it. For that, we add a simple numeric version column:
```
CREATE TABLE campaign (
  id UUID PRIMARY KEY,
  ...
  version BIGINT NOT NULL
);

record Campaign(UUID id, 
                ... 
                long version) {}
```
*(this is an SQL example, but the principle stays the same for a key-value, object-oriented, document-oriented or any other database; version must be saved together with the related data)*

How can it be used?

Previously, our `campaignRepository.save` method would generate a simple query (for updates):
```
UPDATE campaign 
SET budget = <1000 or 2000>
WHERE id = 1;
```

Now, we are able to take advantage of the `version` column and change this query to:
```
UPDATE campaign 
SET budget = 1000,
    version = version + 1
WHERE id = 1 
  AND version = 1;
```
Each time a campaign entity is modified, its version is incremented as well; furthermore, version value - as known at the beginning of a transaction, fetched before the update statement - is added to the where clause. Most database drivers for most languages support returning the number of affected rows from Data Manipulation Language (DML) statements like `UPDATE`; in our case, we expect to get exactly one affected row. If that is not true, it means that the version was incremented by another query running in parallel - there could be a conflict! In this instance, we simply throw some kind of `OptimisticLockException`:
```
// CampaignRepository
void save(Campaign campaign) {
  int affectedRows = jdbcClient.sql("...").update();
  if (affectedRows != 1) {
    throw new OptimisticLockException("Campaign", campaign.id());
  }
}

...

@PutMapping("/campaigns/{id}")
ResponseEntity<Campaign> updateCampaign(UUID id, UpdateCampaignRequest request) {
  try {
    var campaign = campaignRepository.findById(id);
    var toUpdateCampaign = campaign.withBudget(request.budget());
    var updatedCampaign = campaignRepository.save(toUpdateCampaign);
    return ResponseEntity.ok(updatedCampaign);
  } catch (OptimisticLockException e) {
    return ResponseEntity.status(409)
      .body(new OptimisticLockError("Campaign", id));
  }
}
``` 

\
Summing the solution up:
* **there are no conflicting updates** - if the entity was modified in the meantime, as informed by *unexpectedly changed version value*, operation is aborted
* **user/client decides what to do with the aborted operation** - they might refresh the page, see changes in the data and decide that it is fine now and does not need to be modified; or they might modify it regardless, in the same or different way, but the point is: *not a single update is lost*

## Pessimistic Locking

The second solution to our concurrency problems is, well, pessimistic. **We assume upfront that conflict will occur and lock the modified record for required time.**

For this strategy, there is no need to modify the schema in any way. Using our *losing money clicks* example, without any locking, its SQL would look like this:
```
BEGIN TRANSACTION;

SELECT * FROM budget
WHERE id = 1;

UPDATE budget
SET available_amount = <40 or 50>
WHERE id = 1;

COMMIT;
```

The source of all our problems here: when executed in parallel, for the same *budget* but different *clicks*, these SQL queries will change `available_amount` in a different way, based on the order of execution. If we have:
```
budget = { id: 1, availableAmount: 100 }
click1 = { id: 1, budgetId: 1, cost: 50 }
click2 = { id: 2, budgetId: 1, cost: 60 }
```
the second update sets `available_amount=50` or `available_amount=40` (previousAvailableAmount - cost), depending on whether *click1's* or *click2's* transaction was committed last. 

To fix it, we simply, pessimistically, lock the budget under modification for the transaction duration:
```
-- click1 is first --
BEGIN;

SELECT * FROM budget 
WHERE id = 1 
FOR UPDATE;

UPDATE budget
SET available_amount = 50
WHERE id = 1;

COMMIT;

-- click2 in parallel, but second --
BEGIN;

-- transaction locks here until the end of click1 transaction --
SELECT * FROM budget 
WHERE id = 1 
FOR UPDATE;
-- transaction resumes here after click1 transaction commits/rollbacks, --
-- with always up-to-date budget --

UPDATE budget
-- value properly set to 0, as we always get up-to-date budget --
SET available_amount = 0
WHERE id = 1;

COMMIT;
```
*(this is an SQL example again, but the principle stays the same for a key-value, object-oriented, document-oriented or any other database; unfortunately, most, if not all, NoSQL dbs do not support pessimistic locking - another reason to stick with the Good Old SQL!)*

Summing the solution up:
* **there is only one update executing at any given time** - if another process tries to change the same entity, it is blocked; this process must then wait until the first one ends and releases the lock
* **we always get up-to-date data** - every process locks the entity first (tries to) and only then modifies it 
* **client/user is not aware of parallel, *potentially conflicting*, updates** - every process first acquires the lock on entity, but there is no straightforward way of knowing that a conflicting update has happened in the meantime; we simply wait for our turn

{{ .js: newsletterSignUpPostMid() }}

## Pessimistic emulation of Optimistic Locking

Interestingly, it is possible to emulate some of the optimistic locking functionality with pessimistic locks.
Namely, we can change our `FOR UPDATE` clause slightly to know that someone else has already acquired the lock and is about to modify the same entity.

There are two ways of doing it. 

First:
```
BEGIN;

SELECT ... FOR UPDATE NOWAIT;
-- locks or fails immediately --

UPDATE ...

COMMIT:
```
if another process has already acquired the lock, an error is thrown. We might then simply catch it and inform the user/client that there already was an update in progress and they have to do something about it - in the exact same way as we do in the optimistic locking!

Second, very similar:
```
BEGIN;

SELECT ... FOR UPDATE SKIP LOCKED;
-- not locked entity or empty result --

UPDATE ...

COMMIT;
```
if another process has already acquired the lock, we simply get only not locked entities, which in most cases means zero, no entities. If this is the case, we can again throw a special exception and inform the user/client about the conflict.

**Using this simple trick, we are able to mimic Optimistic Locking without the version column and conditional update.** The slight difference is timing: error is thrown when we are about to lock the entity, before an update, not after it; and also when somebody is about to update the entity, not after the fact. What must be mentioned as well is that `NOWAIT` and `SKIP LOCKED` are not a part of the SQL standard, but have been adopted by many databases independently, so in the future they (or something similar) will most likely become a part of the next SQL specification. For now, the support is:
* `NOWAIT`: PostgreSQL, MySQL, MariaDB, Oracle
* `SKIP LOCKED`: PostgreSQL, MySQL, MariaDB, Oracle


## When to be Optimistic vs Pessimistic

As with almost everything, there are tradeoffs to both approaches and sometimes one makes more sense than the other. 

**Optimistic Locking** is pretty useful when we want to have a straightforward way of letting the client know that the conflict has occurred and make them decide what to do about it (emulating this behavior with pessimistic locks is possible as well). Practically, it does not involve any locking at the database or application level, so for read-heavy workloads where the probability of conflict is low, it is a more performant option. On the flip side, it usually handles write-heavy workloads worse, since most failed updates (due to conflicts) will trigger retries, significantly increasing the number of queries executed against the database. What is more, depending on our application, every retry might also involve repeating non-trivial computations, calling many functions or even external services - retrying is not free, it could represent a significant cost. If our workload is such that retries represent a considerable share of the traffic - it is probably better to use *Pessimistic Locking* instead. On the other hand, **there is an additional advantage of having a numeric version field on our entities, when operating in the distributed system environment, where [asynchronous communication with messages/events](events-over-sql.html) is frequently used**. In this context, we must deal with:
* **idempotency** - the same message/event could be published more than once, but the end result of its processing should always be the same; it is up to the consumer to guarantee that it is the case
* **out-of-order messages** - in many systems there is no strict warranty that the messages/events are received in the exact same order as they have happened; it is again up to the consumer to deal with this fact

Thankfully, the version field allows us to deal with both of these problems. As an example:
```
void onAccountCreated(AccountCreated accountCreated) {
  var account = accountRepository.findById(accountCreated.id());
  if (account == null || account.version() < accountCreated.version()) {
    accountRepository.save(accountCreated.toAccount());
  } else {
    log.info("Ignoring older or already processed AccountCreated; got {} version but have {} in db for {} account",
      accountCreated.version(), account.version(), account.id());
  }
}
```
Thanks to this monotonically increasing version number, we can easily ignore outdated (out-of-order) and duplicated messages/events.

**Pessimistic Locking** shines when the workload is write-heavy and the likelihood of conflicts is high. In such cases, it offers better performance, since resources are not wasted on unnecessary retries. However, it does not detect conflicting updates on its own - it simply locks operations that might conflict. The user/client is not aware that another process may be performing a modification that could affect their changes. **If guaranteeing a single writer at any point in time is not enough, we should switch to Optimistic Locking or [emulate it](#pessimistic-emulation-of-optimistic-locking).**

Summing the comparison up:
* **performance-wise**: *Optimistic Locks* are generally better for *read-heavy workloads* where conflict probability is low; *Pessimistic Locks* are generally better for *write-heavy workloads* where conflict probability is high
* **functionality-wise**: if we want to inform the user/client that another user/client has modified the same entity in the meantime - *Optimistic Locks* win (or its emulation)
* **in distributed systems, we often must version entities anyways**: if this is the case, we might as well follow *the Optimistic Locking path*; unless there are lots and lots of update conflicts - *Pessimistic Locks* are a better choice then

## Practical considerations: ORMs, SQL query builders and libraries

Concurrency control problems we have described so far occur in applications written in specific programming languages, using specific runtimes, and must be solved using tools available there. What is the support for optimistic and pessimistic locking in various ecosystems?

For [ORMs (Object Relational Mappers)](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping):
* In the Java and JVM ecosystem, there is the JPA (Java Persistence API) standard with its most popular implementation - [Hibernate](https://hibernate.org/). It supports both types of locks out of the box through [@Version](https://docs.hibernate.org/orm/7.0/introduction/html_single/#version-attributes) annotation specified on entities and pessimistic locks by various [LockMode](https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/LockMode.html) types. Additionally, we often use Spring Boot framework together with [Spring Data JPA](https://spring.io/projects/spring-data-jpa) that generates repositories with the support for both kinds of locking
* In the JavaScript ecosystem, [Sequelize](https://sequelize.org) implements both [optimistic](https://sequelize.org/docs/v6/other-topics/optimistic-locking) and [pessimistic locking](https://sequelize.org/docs/v6/other-topics/transactions/#locks). The same is true for [MikroORM](https://mikro-orm.io/docs/transactions#locking-support) as well as [optimistic](https://typeorm.io/docs/help/decorator-reference/#versioncolumn) and [pessimistic locks](https://typeorm.io/docs/query-builder/select-query-builder/#set-locking) in [TypeORM](https://typeorm.io/)
* For Python, [SQLAlchemy](https://www.sqlalchemy.org/) supports both [optimistic locks](https://docs.sqlalchemy.org/orm/versioning.html) through the [version id column](https://docs.sqlalchemy.org/en/20/glossary.html#term-version-id-column) and [pessimistic locks through with_for_update() construct](https://docs.sqlalchemy.org/en/20/core/selectable.html#sqlalchemy.sql.expression.CompoundSelect.with_for_update). [Django](https://www.djangoproject.com/) implements [pessimistic locks](https://docs.djangoproject.com/en/5.2/ref/models/querysets/#django.db.models.query.QuerySet.select_for_update); optimistic locks we must handle on our own, but it is pretty easy to add them. [Peewee](https://docs.peewee-orm.com/) also supports both [optimistic](https://docs.peewee-orm.com/en/latest/peewee/hacks.html#optimistic-locking) and [pessimistic locking](https://docs.peewee-orm.com/en/latest/peewee/api.html#Select.for_update)
* In Go/Golang, we have [GORM](https://gorm.io/) with support for [pessimistic locking](https://gorm.io/docs/advanced_query.html#Locking) out of the box and [optimistic locks through the official plugin](https://github.com/go-gorm/optimisticlock)

If we do not use ORMs but simple SQL query builders or libraries to write raw SQL (my preference usually), it is quite straightforward to implement any type of locking on our own, as was illustrated in the SQL examples. All we have to do is to pick our SQL query builder - [jOOQ](https://www.jooq.org/), [Knex.js](https://knexjs.org/), [SQLAlchemy](https://docs.sqlalchemy.org/core/) and so on - or use DB driver/library directly to write raw SQL statements. Then we implement:
* **Pessimistic Locks** - just do `SELECT ... FOR UPDATE` in a transaction when modifying entities; many SQL query builders have ready-to-use methods to append this clause to select statements ([jOOQ](https://www.jooq.org/doc/latest/manual/sql-building/sql-statements/select-statement/for-update-clause/), [Knex.js](https://knexjs.org/guide/query-builder.html#transacting))
* **Optimistic Locks** - add `AND version = ?` to the `WHERE` clause of `UPDATE` statements, set `version = version + 1` and check the number of affected rows; if it is not what is expected (usually just one), throw some kind of *OptimisticLockError/Exception*


## Conclusion: lock properly and be resilient to the randomness of time

As we have seen, the lack of appropriate locking strategy can lead to *conflicting and lost updates*, which means *many bugs, confused users and lost money*. It is definitely better to avoid all of these things.

Whether to lock *Optimistically* or *Pessimistically* depends on the functional requirements and what our traffic is - mostly writes or reads? In many systems, it makes sense to combine both strategies, applying each where it fits best based on the entity type, how it is modified, when and by whom.

That being said, **let's keep our concurrency control in check: lock entities properly and be resilient to the randomness of time!**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}


### Notes and resources

1. Concurrency Control problem:
    1. https://en.wikipedia.org/wiki/Concurrency_control
    2. https://www.baeldung.com/cs/concurrency-control-lost-update-problem
2. It might seem odd that NoSQL databases (MongoDB, Apache Cassandra, DynamoDB, Redis, etc.) usually do not support pessimistic locking, but they are built on a different set of principles. Most of them are designed to support tremendous workloads and encourage us to run them in multiple physical instances, as a cluster, from the very  start. If we follow this [unnecessary for most systems advice](/how-many-http-requests-can-a-single-machine-handle.html), then worse performance of optimistic locking for write-heavy workloads with many conflicts is not an issue, since there is much more resources available by having multiple physical db instances (nodes) in the cluster.
3. Interestingly, in SQLite there is at most one writer and `SELECT FOR UPDATE` is not supported. We might emulate its behavior by starting transactions as `BEGIN IMMEDIATE` which immediately blocks other potential writers: https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions
4. `SELECT FOR UPDATE` support:
    1. https://www.postgresql.org/docs/current/sql-select.html
    2. https://dev.mysql.com/doc/refman/en/innodb-locking-reads.html
    3. https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/selecting-data/for-update
5. Mentioned ORMs and libraries + some more:
    1. https://hibernate.org/
    2. https://spring.io/projects/spring-data-jpa
    3. https://spring.io/projects/spring-data-jdbc
    4. https://www.jooq.org/
    5. https://sequelize.org/
    6. https://typeorm.io/
    7. https://mikro-orm.io/
    8. https://knexjs.org/
    9. https://docs.nestjs.com/techniques/database
    10. https://www.sqlalchemy.org/
    11. https://docs.djangoproject.com/en/5.2/ref/databases/
    12. https://docs.peewee-orm.com/
    13.  https://gorm.io/
6. Locking in the Java ecosystem:
    1. https://www.baeldung.com/jpa-optimistic-locking
    2. https://www.baeldung.com/jpa-pessimistic-locking
    3. https://www.baeldung.com/java-jpa-transaction-locks
    4. https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html
    5. https://vladmihalcea.com/jpa-entity-version-property-hibernate/
    6. https://vladmihalcea.com/optimistic-vs-pessimistic-locking/
7. Locking in the JavaScript ecosystem: https://medium.com/@DanielAlvesOmnes/concurrency-in-databases-optimistic-and-pessimistic-locking-with-sequelize-8776b0f4b081
8. Locking in the Python ecosystem:
    1. https://hevalhazalkurt.com/blog/optimistic-vs-pessimistic-locking-in-orms/
    2. https://hakibenita.com/how-to-manage-concurrency-in-django-models
    3. https://leapcell.io/blog/implementing-concurrent-control-with-orm-a-deep-dive-into-pessimistic-and-optimistic-locking

</div>