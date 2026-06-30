---
{
    "title": "The Order of Data: defaults, performance, determinism & paging",
    "slug": "the-order-of-data",
    "startedAt": "2026-06-30",
    "publishedAt": "2026-07-13",
    "excerpt": "How does the database decide on the order, when it is not specified? What about performance? Can returned pages overlap? Meaning: might item from page 1 suddenly appear on page 2, even if the underlying data stays the same?",
    "researchLog": [ 1, 1, 1, 1, 0.5, 1, 1 ],
    "writingLog": [ 1, 1.5, 0.5, 0.5, 2.5, 1.5, 3.5, 2.5 ],
    "tags": [ "dbs" ]
}
---

## Defaults

What result can we expect from:
```
SELECT * FROM some_table
LIMIT N OFFSET K;
```
How does the database decide on the order, when it is not specified? Does it matter and when?

### Postgres {#defaults-postgres}

Using a table:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

Having some data:
```
INSERT INTO account (id, name, created_at) VALUES
('7de14515-4165-4c67-8fa0-f2effa9a812b', 'acc-a', '2026-07-02T16:25:22Z'),
('dd614095-b567-446a-97be-803c17efa25b', 'acc-b', '2026-07-02T16:25:22Z'),
('bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 'acc-c', '2026-07-02T16:25:22Z'),
('445b479f-ecb5-4877-ad52-eb6c8e9ea207', 'acc-d', '2026-07-02T16:25:22Z'),
('68714013-a360-4965-ab87-4c646e0a65cd', 'acc-e', '2026-07-02T16:25:22Z');
```

In the SQL standard, when `ORDER BY` is not given, expected behavior is undefined - it is totally up to the specific database implementation:
```
SELECT * FROM account
LIMIT 3;
                  id                  | name  |     created_at      
--------------------------------------+-------+---------------------
 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22
 dd614095-b567-446a-97be-803c17efa25b | acc-b | 2026-07-02 16:25:22
 bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c | 2026-07-02 16:25:22

SELECT * FROM account 
LIMIT 3 OFFSET 3;
                  id                  | name  |     created_at      
--------------------------------------+-------+---------------------
 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22
 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22

```

For Postgres, the default order seems to be the insertion one. Let's shuffle it a bit by deleting and inserting again some of the rows:
```
DELETE FROM account
WHERE id IN (
  '7de14515-4165-4c67-8fa0-f2effa9a812b',
  'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7'
);

INSERT INTO account (id, name, created_at) VALUES
('7de14515-4165-4c67-8fa0-f2effa9a812b', 'acc-a', '2026-07-02T16:25:22Z'),
('bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 'acc-c', '2026-07-02T16:25:22Z');
```

And running paging queries once more:
```
SELECT * FROM account 
LIMIT 3;
                  id                  | name  |     created_at      
--------------------------------------+-------+---------------------
 dd614095-b567-446a-97be-803c17efa25b | acc-b | 2026-07-02 16:25:22
 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22
 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22

SELECT * FROM account 
LIMIT 3 OFFSET 3;
                  id                  | name  |     created_at      
--------------------------------------+-------+---------------------
 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22
 bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c | 2026-07-02 16:25:22

```
yields different, but still sorted by insertion order results.

What if we update a row?
```
UPDATE account 
SET name = 'acc-bb'
WHERE id = 'dd614095-b567-446a-97be-803c17efa25b';

SELECT * FROM account
LIMIT 3;
                  id                  | name  |     created_at      
--------------------------------------+-------+---------------------
 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22
 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22
 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22

SELECT * FROM account 
LIMIT 3 OFFSET 3;
                  id                  |  name  |     created_at      
--------------------------------------+--------+---------------------
 bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c  | 2026-07-02 16:25:22
 dd614095-b567-446a-97be-803c17efa25b | acc-bb | 2026-07-02 16:25:22

```
Expectedly, it becomes the last one - [in PostgreSQL, UPDATE is just DELETE + INSERT](/mysql-and-postgresql-different-approaches.html) after all.

As we see, relying on the default sorting order is rather fragile. **It seems like the insertion one, but there is no guarantee** - it might change [after running VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html), DELETE + INSERT, UPDATE or even based on utilized indexes and probably a few other things we are not yet aware of.

### MySQL {#defaults-mysql}

Preparing the same schema & data:
```
CREATE TABLE account (
  -- Sadly, still no native UUID type in MySQL! --
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

INSERT INTO account (id, name, created_at) VALUES
('7de14515-4165-4c67-8fa0-f2effa9a812b', 'acc-a', '2026-07-02T16:25:22'),
('dd614095-b567-446a-97be-803c17efa25b', 'acc-b', '2026-07-02T16:25:22'),
('bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 'acc-c', '2026-07-02T16:25:22'),
('445b479f-ecb5-4877-ad52-eb6c8e9ea207', 'acc-d', '2026-07-02T16:25:22'),
('68714013-a360-4965-ab87-4c646e0a65cd', 'acc-e', '2026-07-02T16:25:22');
```

It should work like in Postgres:
```
SELECT * FROM account
LIMIT 3;
+--------------------------------------+-------+---------------------+
| id                                   | name  | created_at          |
+--------------------------------------+-------+---------------------+
| 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22 |
| 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22 |
| 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22 |
+--------------------------------------+-------+---------------------+

SELECT * FROM account
LIMIT 3 OFFSET 3;
+--------------------------------------+-------+---------------------+
| id                                   | name  | created_at          |
+--------------------------------------+-------+---------------------+
| bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c | 2026-07-02 16:25:22 |
| dd614095-b567-446a-97be-803c17efa25b | acc-b | 2026-07-02 16:25:22 |
+--------------------------------------+-------+---------------------+
```
Actually, it does not. What is this order? Rows appear to be sorted by `id` (primary key) - let's validate:
```
SELECT id FROM account
ORDER BY id;
+--------------------------------------+
| id                                   |
+--------------------------------------+
| 445b479f-ecb5-4877-ad52-eb6c8e9ea207 |
| 68714013-a360-4965-ab87-4c646e0a65cd |
| 7de14515-4165-4c67-8fa0-f2effa9a812b |
| bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 |
| dd614095-b567-446a-97be-803c17efa25b |
+--------------------------------------+
```
they indeed are. What happens when, as with Postgres, we delete and reinsert some of the rows?
```
DELETE FROM account
WHERE id IN (
  '7de14515-4165-4c67-8fa0-f2effa9a812b',
  'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7'
);

INSERT INTO account (id, name, created_at) VALUES
('7de14515-4165-4c67-8fa0-f2effa9a812b', 'acc-a', '2026-07-02T16:25:22'),
('bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 'acc-c', '2026-07-02T16:25:22');


SELECT * FROM account
LIMIT 3;
+--------------------------------------+-------+---------------------+
| id                                   | name  | created_at          |
+--------------------------------------+-------+---------------------+
| 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22 |
| 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22 |
| 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22 |
+--------------------------------------+-------+---------------------+

SELECT * FROM account
LIMIT 3 OFFSET 3;
+--------------------------------------+-------+---------------------+
| id                                   | name  | created_at          |
+--------------------------------------+-------+---------------------+
| bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c | 2026-07-02 16:25:22 |
| dd614095-b567-446a-97be-803c17efa25b | acc-b | 2026-07-02 16:25:22 |
+--------------------------------------+-------+---------------------+
```
As expected, the order does not change. So, it should behave likewise with update:
```
UPDATE account 
SET name = 'acc-bb'
WHERE id = 'dd614095-b567-446a-97be-803c17efa25b';

SELECT * FROM account
LIMIT 3;
+--------------------------------------+-------+---------------------+
| id                                   | name  | created_at          |
+--------------------------------------+-------+---------------------+
| 445b479f-ecb5-4877-ad52-eb6c8e9ea207 | acc-d | 2026-07-02 16:25:22 |
| 68714013-a360-4965-ab87-4c646e0a65cd | acc-e | 2026-07-02 16:25:22 |
| 7de14515-4165-4c67-8fa0-f2effa9a812b | acc-a | 2026-07-02 16:25:22 |
+--------------------------------------+-------+---------------------+

SELECT * FROM account
LIMIT 3 OFFSET 3;
+--------------------------------------+--------+---------------------+
| id                                   | name   | created_at          |
+--------------------------------------+--------+---------------------+
| bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7 | acc-c  | 2026-07-02 16:25:22 |
| dd614095-b567-446a-97be-803c17efa25b | acc-bb | 2026-07-02 16:25:22 |
+--------------------------------------+--------+---------------------+
```
and it does.

Summing it up, **MySQL acts differently than Postgres - default sorting order seems to be that of [the primary key](/mysql-and-postgresql-different-approaches.html#clustered-indexes-vs-heap-tables)** (which, knowing how MySQL works under the hood, makes perfect sense). But again, no guarantees!


### MongoDB {#defaults-mongodb}

Working with the same data once more:
```
db.createCollection("account");

db.account.insertMany([
  { 
    _id: '7de14515-4165-4c67-8fa0-f2effa9a812b', 
    name: 'acc-a',
    createdAt: '2026-07-02T16:25:22Z'  
  },
  { 
    _id: 'dd614095-b567-446a-97be-803c17efa25b', 
    name: 'acc-b',
    createdAt: '2026-07-02T16:25:22Z'  
  },
  { 
    _id: 'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 
    name: 'acc-c',
    createdAt: '2026-07-02T16:25:22Z'  
  },
  { 
    _id: '445b479f-ecb5-4877-ad52-eb6c8e9ea207', 
    name: 'acc-d',
    createdAt: '2026-07-02T16:25:22Z'  
  },
  { 
    _id: '68714013-a360-4965-ab87-4c646e0a65cd', 
    name: 'acc-e',
    createdAt: '2026-07-02T16:25:22Z'  
  },
]);
```

Checking what the default ordering is:
```
db.account.find()
  .limit(3);
[
  {
    _id: '7de14515-4165-4c67-8fa0-f2effa9a812b',
    name: 'acc-a',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: 'dd614095-b567-446a-97be-803c17efa25b',
    name: 'acc-b',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: 'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7',
    name: 'acc-c',
    createdAt: '2026-07-02T16:25:22Z'
  }
]

db.account.find()
  .limit(3)
  .skip(3);
[
  {
    _id: '445b479f-ecb5-4877-ad52-eb6c8e9ea207',
    name: 'acc-d',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: '68714013-a360-4965-ab87-4c646e0a65cd',
    name: 'acc-e',
    createdAt: '2026-07-02T16:25:22Z'
  }
]
```

Seems to work as in Postgres; similarly, let's delete and insert a few documents:
```
db.account.deleteMany({ 
  _id: { 
    $in: [
      '7de14515-4165-4c67-8fa0-f2effa9a812b',
      'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7'
    ]
  }
});

db.account.insertMany([
  { 
    _id: '7de14515-4165-4c67-8fa0-f2effa9a812b', 
    name: 'acc-a',
    createdAt: '2026-07-02T16:25:22Z'  
  },
  { 
    _id: 'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7', 
    name: 'acc-c',
    createdAt: '2026-07-02T16:25:22Z'  
  }
]);

```

The result:
```
db.account.find()
  .limit(3);
[
  {
    _id: 'dd614095-b567-446a-97be-803c17efa25b',
    name: 'acc-b',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: '445b479f-ecb5-4877-ad52-eb6c8e9ea207',
    name: 'acc-d',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: '68714013-a360-4965-ab87-4c646e0a65cd',
    name: 'acc-e',
    createdAt: '2026-07-02T16:25:22Z'
  }
]

db.account.find()
  .limit(3)
  .skip(3);
[
  {
    _id: '7de14515-4165-4c67-8fa0-f2effa9a812b',
    name: 'acc-a',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: 'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7',
    name: 'acc-c',
    createdAt: '2026-07-02T16:25:22Z'
  }
]
```
Same as with Postgres again; for completeness, what about update?
```
db.account.updateOne(
  { _id: 'dd614095-b567-446a-97be-803c17efa25b' },
  { $set: { name: 'acc-bb' } }
);

db.account.find()
  .limit(3);
[
  {
    _id: 'dd614095-b567-446a-97be-803c17efa25b',
    name: 'acc-bb',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: '445b479f-ecb5-4877-ad52-eb6c8e9ea207',
    name: 'acc-d',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: '68714013-a360-4965-ab87-4c646e0a65cd',
    name: 'acc-e',
    createdAt: '2026-07-02T16:25:22Z'
  }
]

db.account.find()
  .limit(3)
  .skip(3);
[
  {
    _id: '7de14515-4165-4c67-8fa0-f2effa9a812b',
    name: 'acc-a',
    createdAt: '2026-07-02T16:25:22Z'
  },
  {
    _id: 'bd3ef1b1-6e98-4eb9-ba5a-35188a81d7f7',
    name: 'acc-c',
    createdAt: '2026-07-02T16:25:22Z'
  }
]
```
Well, that is not the same - update does not impact the default sorting order. This most likely is because [MongoDB implements the **Multiversion Concurrency Control (MVCC)** mechanism differently than PostgreSQL does](/mysql-and-postgresql-different-approaches.html#multiversion-concurrency-control-mvcc-dead-tuples-vs-undo-logs).

**In Mongo then, the default order seems to also be the insertion one (no guarantees).**

## Performance

Let's insert more data - `10 000 000` rows - into Postgres (one DB from now on is enough) and measure the performance impact:
```
\timing
Timing is on.

TRUNCATE account;
TRUNCATE TABLE
Time: 11.552 ms

INSERT INTO account (id, name, created_at)
SELECT gen_random_uuid(), concat('acc', '-', n), now()
FROM generate_series(1, 10_000_000) AS n;
INSERT 0 10000000
Time: 53447.537 ms (00:53.448)
```

The default order query:
```
SELECT * FROM account
LIMIT 5;
                  id                  | name  |         created_at         
--------------------------------------+-------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1 | 2026-07-06 16:47:50.142234
 497013a6-cb59-42d3-9773-d894d31b4f1c | acc-2 | 2026-07-06 16:47:50.142234
 14551457-ee7a-436a-95cc-14a70ad53f90 | acc-3 | 2026-07-06 16:47:50.142234
 45fc2c83-3a20-4e94-ac46-08afc48e02d8 | acc-4 | 2026-07-06 16:47:50.142234
 8e610251-a20b-4f50-a69e-88a68d665016 | acc-5 | 2026-07-06 16:47:50.142234

Time: 0.694 ms
```
Really fast - same is true for the primary key (indexed obviously) order:
```
SELECT * FROM account
ORDER BY id 
LIMIT 5;
                  id                  |    name     |         created_at         
--------------------------------------+-------------+----------------------------
 00000230-f6e3-4e6e-8280-9cffe9a619f4 | acc-313672  | 2026-07-06 16:47:50.142234
 0000063f-8dca-402b-988f-c1eaf7d388e4 | acc-4230905 | 2026-07-06 16:47:50.142234
 000007e6-1db1-4338-a605-e33a91de8522 | acc-9824082 | 2026-07-06 16:47:50.142234
 00000b71-f20c-481b-a92d-9911262dd4b8 | acc-8346475 | 2026-07-06 16:47:50.142234
 00000fc5-6bbc-4c04-b55f-12bc55308f1a | acc-187020  | 2026-07-06 16:47:50.142234

Time: 0.457 ms
```

What about unindexed columns?
```
SELECT * FROM account
ORDER BY name
LIMIT 5;
                  id                  |   name    |         created_at         
--------------------------------------+-----------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1     | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10    | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100   | 2026-07-06 16:47:50.142234
 e03187f3-f18e-42d1-b454-2ed545a91411 | acc-1000  | 2026-07-06 16:47:50.142234
 dcbdd86f-e911-4709-a641-45ff476061e5 | acc-10000 | 2026-07-06 16:47:50.142234

Time: 479.251 ms


SELECT * FROM account 
ORDER BY created_at
LIMIT 5;
                  id                  | name  |         created_at         
--------------------------------------+-------+----------------------------
 497013a6-cb59-42d3-9773-d894d31b4f1c | acc-2 | 2026-07-06 16:47:50.142234
 14551457-ee7a-436a-95cc-14a70ad53f90 | acc-3 | 2026-07-06 16:47:50.142234
 45fc2c83-3a20-4e94-ac46-08afc48e02d8 | acc-4 | 2026-07-06 16:47:50.142234
 8e610251-a20b-4f50-a69e-88a68d665016 | acc-5 | 2026-07-06 16:47:50.142234
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1 | 2026-07-06 16:47:50.142234

Time: 296.123 ms
```
Clearly much slower; sorting happens in-memory ([heapsort](https://en.wikipedia.org/wiki/Heapsort)), as we can see investigating the plan:
```
-- do not use shared buffers (RAM cache) --
EXPLAIN (ANALYZE, BUFFERS OFF) 
SELECT * FROM account
ORDER BY name 
LIMIT 5;

 Limit  (cost=195206.24..195206.82 rows=5 width=35) (actual time=634.789..639.723 rows=5.00 loops=1)
   ->  Gather Merge  (cost=195206.24..1359868.00 rows=9999974 width=35) (actual time=633.648..638.581 rows=5.00 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         ->  Sort  (cost=194206.22..204622.86 rows=4166656 width=35) (actual time=620.845..620.846 rows=5.00 loops=3)
               Sort Key: name
               Sort Method: top-N heapsort  Memory: 25kB
               Worker 0:  Sort Method: top-N heapsort  Memory: 25kB
               Worker 1:  Sort Method: top-N heapsort  Memory: 25kB
               ->  Parallel Seq Scan on account  (cost=0.00..124999.56 rows=4166656 width=35) (actual time=0.044..233.342 rows=3333333.33 loops=3)
 Planning Time: 0.111 ms
 JIT:
   Functions: 1
   Options: Inlining false, Optimization false, Expressions true, Deforming true
   Timing: Generation 0.098 ms (Deform 0.000 ms), Inlining 0.000 ms, Optimization 0.131 ms, Emission 1.005 ms, Total 1.235 ms
 Execution Time: 639.888 ms
(16 rows)

Time: 640.317 ms
```

Now, let's create indexes and run queries to see what difference they make:
```
CREATE INDEX account_name_idx ON account(name);
CREATE INDEX
Time: 5494.600 ms (00:05.495)

CREATE INDEX account_created_at_idx ON account(created_at);
CREATE INDEX
Time: 1328.748 ms (00:01.329)


SELECT * FROM account 
ORDER BY name 
LIMIT 5;
                  id                  |   name    |         created_at         
--------------------------------------+-----------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1     | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10    | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100   | 2026-07-06 16:47:50.142234
 e03187f3-f18e-42d1-b454-2ed545a91411 | acc-1000  | 2026-07-06 16:47:50.142234
 dcbdd86f-e911-4709-a641-45ff476061e5 | acc-10000 | 2026-07-06 16:47:50.142234

Time: 0.660 ms


SELECT * FROM account
ORDER BY created_at
LIMIT 5;
                  id                  | name  |         created_at         
--------------------------------------+-------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1 | 2026-07-06 16:47:50.142234
 497013a6-cb59-42d3-9773-d894d31b4f1c | acc-2 | 2026-07-06 16:47:50.142234
 14551457-ee7a-436a-95cc-14a70ad53f90 | acc-3 | 2026-07-06 16:47:50.142234
 45fc2c83-3a20-4e94-ac46-08afc48e02d8 | acc-4 | 2026-07-06 16:47:50.142234
 8e610251-a20b-4f50-a69e-88a68d665016 | acc-5 | 2026-07-06 16:47:50.142234

Time: 0.570 ms
```
We went from *479.251 ms to 0.660 ms* and from *296.123 ms to 0.570 ms* - `726x` and `520x` improvements respectively. Examining the new query plan:
```
EXPLAIN (ANALYZE, BUFFERS OFF) 
SELECT * FROM account
ORDER BY name
LIMIT 5;

 Limit  (cost=0.43..0.67 rows=5 width=35) (actual time=0.022..0.027 rows=5.00 loops=1)
   ->  Index Scan using account_name_idx on account  (cost=0.43..469996.26 rows=10000000 width=35) (actual time=0.020..0.024 rows=5.00 loops=1)
         Index Searches: 1
 Planning Time: 0.194 ms
 Execution Time: 0.044 ms
(5 rows)

Time: 0.488 ms
```
all taken from the index, as it is already sorted in needed order there.

As we can see, **indexing is directly linked to sorting performance:** when there is an index on the `ORDER BY` us column, there is nothing to be sorted; it might be all returned as is, directly from the index.

**What if we sort by indexed column but in the opposite direction?** [Since index is usually a B-tree](/index-a-crucial-data-structure-for-search-performance.html#index-types-by-structure), inverse order performance is very close to regular one:
```
SELECT * FROM account
ORDER by name DESC
LIMIT 5;
                  id                  |    name     |         created_at         
--------------------------------------+-------------+----------------------------
 5f291d15-080e-4e5f-9b11-979462af6efe | acc-9999999 | 2026-07-06 16:47:50.142234
 e28f7269-449c-432a-bf7f-865264acf47e | acc-9999998 | 2026-07-06 16:47:50.142234
 9dc79f05-7e43-42ea-97f7-594b43807a99 | acc-9999997 | 2026-07-06 16:47:50.142234
 deb8546e-f8a4-45ae-8e65-961468a55f1e | acc-9999996 | 2026-07-06 16:47:50.142234
 cbf9ff43-c771-4a4a-91d9-76dbfdb586ba | acc-9999995 | 2026-07-06 16:47:50.142234

Time: 0.760 ms


EXPLAIN (ANALYZE, BUFFERS OFF) 
SELECT * FROM account
ORDER BY name DESC
LIMIT 5;

 Limit  (cost=0.43..0.67 rows=5 width=35) (actual time=0.037..0.040 rows=5.00 loops=1)
   ->  Index Scan Backward using account_name_idx on account  (cost=0.43..469996.26 rows=10000000 width=35) (actual time=0.034..0.037 rows=5.00 loops=1)
         Index Searches: 1
 Planning Time: 0.236 ms
 Execution Time: 0.061 ms
(5 rows)

Time: 0.742 ms
```

\
**What about yet another case: sorting by two columns - leading indexed, following not?** Well, index should do most of the heavy lifting:
```
SELECT * FROM account
ORDER BY name, id
LIMIT 5;
                  id                  |   name    |         created_at         
--------------------------------------+-----------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1     | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10    | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100   | 2026-07-06 16:47:50.142234
 e03187f3-f18e-42d1-b454-2ed545a91411 | acc-1000  | 2026-07-06 16:47:50.142234
 dcbdd86f-e911-4709-a641-45ff476061e5 | acc-10000 | 2026-07-06 16:47:50.142234

Time: 0.775 ms


EXPLAIN (ANALYZE, BUFFERS OFF)
SELECT * FROM account
ORDER BY name, id
LIMIT 5;

 Limit  (cost=0.49..0.95 rows=5 width=35) (actual time=0.075..0.077 rows=5.00 loops=1)
   ->  Incremental Sort  (cost=0.49..919996.26 rows=10000000 width=35) (actual time=0.072..0.073 rows=5.00 loops=1)
         Sort Key: name, id
         Presorted Key: name
         Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 25kB  Peak Memory: 25kB
         ->  Index Scan using account_name_idx on account  (cost=0.43..469996.26 rows=10000000 width=35) (actual time=0.039..0.048 rows=6.00 loops=1)
               Index Searches: 1
 Planning Time: 0.163 ms
 Execution Time: 0.100 ms
(9 rows)

Time: 0.770 ms
```
and it does.

**In conclusion: indexes are the key to sorting performance.**

## Determinism & Paging {#determinism-and-paging}

When executing paging queries of the type:
```
SELECT * FROM account
ORDER BY id
LIMIT 3;

SELECT * FROM account
ORDER BY id
LIMIT 3 OFFSET 3;
```
Can these pages overlap? Meaning: might item from page 1 suddenly appear on page 2, even if the underlying data stays the same? Well, it depends:
* if we `ORDER BY` a unique column or combination thereof - paging queries are deterministic, granted that data does not change
* if we `ORDER BY` a non-unique column - let's see!

Inserting a few name duplicates:
```
INSERT INTO account (id, name, created_at) VALUES
('998a5fac-2bb0-4b3a-a364-9d72c9c4aea7', 'acc-100', '2026-07-02T16:25:22'),
('f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993', 'acc-100', '2026-07-02T16:25:22'),
('71e3a8b2-2851-4e54-b49f-a76614c48a30', 'acc-100', '2026-07-02T16:25:22');
```

Some paging queries:
```
SELECT * FROM account 
ORDER BY name
LIMIT 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1   | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10  | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234

SELECT * FROM account 
ORDER BY name
LIMIT 3 OFFSET 3;
                  id                  |  name   |     created_at      
--------------------------------------+---------+---------------------
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22
 f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993 | acc-100 | 2026-07-02 16:25:22
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
```
By running them multiple times, we always get the same results - so far, so good.

Let's update the `name` column - back and forth - of the first `acc-100` row with id `5065bb28-74de-4cca-b0b4-85835ecd49d1`:
```
UPDATE account
SET name = 'acc-100-tmp' 
WHERE id = '5065bb28-74de-4cca-b0b4-85835ecd49d1';

UPDATE account
SET name = 'acc-100' 
WHERE id = '5065bb28-74de-4cca-b0b4-85835ecd49d1';
```

Can you guess what we will see? Well, it is going to be different:
```
SELECT * FROM account
ORDER BY name
LIMIT 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1   | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10  | 2026-07-06 16:47:50.142234
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22

SELECT * FROM account 
ORDER BY name
LIMIT 3 OFFSET 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993 | acc-100 | 2026-07-02 16:25:22
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234
```
Suddenly, the first `acc-100` became the last one! Which means that this situation is possible:
```
Page 1 with accounts:
92fea9d0-90c8-4ad1-9a54-e7d2704e5d00
60d799ed-ecd5-4e65-a4a1-07de717034ee
5065bb28-74de-4cca-b0b4-85835ecd49d1: first acc-100

Update of 5065bb28-74de-4cca-b0b4-85835ecd49d1 account

Page 2 with accounts:
f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993
71e3a8b2-2851-4e54-b49f-a76614c48a30
5065bb28-74de-4cca-b0b4-85835ecd49d1: first acc-100 again, now last!
```
Not good. How might we fix it?

**The ORDER BY clause must be deterministic - sorting by unique column or their unique combination.** In our case, this basically solves the issue:
```
SELECT * FROM account
ORDER BY name, id
LIMIT 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1   | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10  | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234

SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 3;
                  id                  |  name   |     created_at      
--------------------------------------+---------+---------------------
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22
 f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993 | acc-100 | 2026-07-02 16:25:22
```
`id` is unique and not changing. We may update other columns of the `account` table, run `VACUUM` and whatever else that could potentially influence database decisions - but the order of rows always stays the same.

**There is one more issue lurking around the corner though.**

If we again deterministically get the first page:
```
SELECT * FROM account 
ORDER BY name, id
LIMIT 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1   | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10  | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234
```
and then, somebody/something inserts another account with the `acc-10` name but different id:
```
INSERT INTO account (id, name, created_at) VALUES 
('c172be26-0d60-4d08-af95-ac033d840f24', 'acc-10', '2026-07-06 16:47:50.142234');
```
What happens when we try to get the second page afterwards?
```
SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22
```
`5065bb28-74de-4cca-b0b4-85835ecd49d1` is with us again! `c172be26-0d60-4d08-af95-ac033d840f24` in this particular order goes before it; *so sadly, the last item from page 1 becomes first on page 2*.

Let's temporarily delete this troublemaker:
```
DELETE FROM account
WHERE id = 'c172be26-0d60-4d08-af95-ac033d840f24';
```
and see how such cases can be avoided.

**To fix it, we should use another paging strategy - Keyset/Seek/Cursor Pagination** (three names for basically the same thing is not my fault!).

In this approach, there is no `OFFSET` but a unique key - column or columns - added to the `WHERE` clause, which allows seeking immediately to items that have not been seen yet. Building on our example, ordering by name then id, this is how it would look:
```
-- page 1 does not need a key --
SELECT * FROM account
ORDER BY name, id
LIMIT 3;
                  id                  |  name   |         created_at         
--------------------------------------+---------+----------------------------
 92fea9d0-90c8-4ad1-9a54-e7d2704e5d00 | acc-1   | 2026-07-06 16:47:50.142234
 60d799ed-ecd5-4e65-a4a1-07de717034ee | acc-10  | 2026-07-06 16:47:50.142234
 5065bb28-74de-4cca-b0b4-85835ecd49d1 | acc-100 | 2026-07-06 16:47:50.142234

-- page 2 builds a key based on the previous page's last entry, --
-- so that all items up to and including it are skipped --
SELECT * FROM account
WHERE name > 'acc-100'
OR (
  name = 'acc-100'
  AND id > '5065bb28-74de-4cca-b0b4-85835ecd49d1'
)
ORDER BY name, id
LIMIT 3;
                  id                  |  name   |     created_at      
--------------------------------------+---------+---------------------
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22
 f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993 | acc-100 | 2026-07-02 16:25:22
```
How does it solve our previous issue?

If we again insert `acc-10` duplicate as:
```
INSERT INTO account (id, name, created_at) VALUES 
('c172be26-0d60-4d08-af95-ac033d840f24', 'acc-10', '2026-07-06 16:47:50.142234');
```
it does not influence what we are about to see on the second page at all, thanks to the where clause:
```
SELECT * FROM account
WHERE name > 'acc-100'
OR (
  name = 'acc-100'
  AND id > '5065bb28-74de-4cca-b0b4-85835ecd49d1'
)
ORDER BY name, id
LIMIT 3;
                  id                  |  name   |     created_at      
--------------------------------------+---------+---------------------
 71e3a8b2-2851-4e54-b49f-a76614c48a30 | acc-100 | 2026-07-02 16:25:22
 998a5fac-2bb0-4b3a-a364-9d72c9c4aea7 | acc-100 | 2026-07-02 16:25:22
 f8ab9dbc-6f85-4c5d-9ab9-bbe26b462993 | acc-100 | 2026-07-02 16:25:2
```
There is no reliance on how many items were requested on previous pages but on *what was the last seen item*. This gives us perfect determinism when it comes to fetching data - no possibility of overlapping pages exists, as it might happen with *Offset Pagination*.

**Another benefit of Keyset/Seek Pagination is performance. Offset Pagination works fine up to about a few thousand records**; after this point, it starts to degrade and causes additional CPU load:
```
SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 5000;
...
Time: 5.125 ms

SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 50000;
...
Time: 27.912 ms

SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 500000;
...
Time: 245.445 ms

SELECT * FROM account
ORDER BY name, id
LIMIT 3 OFFSET 5000000;
...
Time: 1873.995 ms (00:01.874)
```
It is because `OFFSET` must load and sort all `OFFSET + LIMIT` items to decide what should be returned and what might safely be thrown away. Even when sorting by indexed column/columns, it still takes a lot of work if `OFFSET` is large, since many records must be read from the index before getting discarded - `O(N)` complexity essentially.  

**Summing it up:**
* sorting by non-unique column or columns is not deterministic
* even with a unique column or their combination, when *Offset Pagination* is applied, it might still sometimes yield non-deterministic results
* *Keyset/Seek Pagination* solves this issue providing deterministic results when fetching data; not only that, it also delivers much better performance, especially once `OFFSET` becomes larger (over a few thousand)


## Conclusion

As we have seen, **relying on defaults is quite dangerous**. In *The Order of Data* case, there are no guarantees - depending on the circumstances, records/documents could arrive in order A and then in order B.

We have also learned why it is crucial to index columns/fields by which data is sorted regularly - it often allows the database to completely skip sorting and return data as it is ordered in the index.

Finally, we realized that our paging strategy might not be as reliable as initially assumed. Sorting by unique column/field or their combination turns out to be a wise idea. Furthermore, when `OFFSET` gets large, *Keyset/Seek Pagination* becomes our best friend.

**Having it all in mind, we can definitely keep *The Order of Data* under our control!**


<div id="post-extras">
<hr class="post-delimiter">

### Notes and resources

1. Code repo with a setup to run the examples: https://github.com/BinaryIgor/code-examples/tree/master/the-order-of-data
2. I did not get into it, but the SQL standard does not define a default sort order for NULL values. Thankfully, most databases support the standard `NULLS FIRST/LAST` clause
3. Comprehensive `SELECT` statement docs for Postgres: https://www.postgresql.org/docs/current/sql-select.html
4. [My deep dive into Indexes](/index-a-crucial-data-structure-for-search-performance.html)
5. Regarding *Keyset/Seek Pagination* determinism - it is perfect as far as no overlapping pages are concerned. But of course, if in the meantime somebody inserts a row placed after a previously used key - results might be different for the second time. To illustrate:
    1. `SELECT name FROM account WHERE name > 'acc-b' LIMIT 2;` is executed
    2. `acc-d, acc-e` are returned
    3. `acc-c` is inserted
    4. `SELECT name FROM account WHERE name > 'acc-b' LIMIT 2;` is executed again
    5. we now get `acc-c, acc-d` in response, instead of the previous `acc-d, acc-e` (same query)

</div>