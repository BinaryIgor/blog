---
{
    "title": "MySQL vs PostgreSQL Performance: throughput & latency, writes & reads",
    "slug": "mysql-vs-postgresql-performance",
    "startedAt": "2025-12-19",
    "publishedAt": "2025-12-30",
    "excerpt": "Who is stronger?",
    "researchLog": [ 2, 1, 4.5, 3, 3 ],
    "writingLog": [  ],
    "tags": [ "dbs", "performance" ]
}
---

TODO: deep dive as well?

MySQL and Postgres are the most popular open-source databases. They are often compared across multiple angles: supported features, architecture & internals, resource consumption and - performance. Today we will go into performance as broadly and deeply as possible - running multiple tests, with various configurations. Let's dive in!

## Setup & Approach

We will run all kinds of queries, using a few tables to test various use cases that appear in the real world. As we know, [MySQL and Postgres differ in their implementation quite a bit](/mysql-and-postgresql-different-approaches.html), to capture it, we will work on a few tables:
```
CREATE TABLE user (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  version BIGINT NOT NULL
);

CREATE TABLE order (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  version BIGINT NOT NULL
);
CREATE INDEX order_user_id ON order(user_id);

CREATE TABLE item (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  version BIGINT NOT NULL
);

CREATE TABLE order_item (
  order_id BIGINT NOT NULL REFERENCES order(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  PRIMARY KEY(order_id, item_id)
);
```

TODO: playing with different configs: https://chatgpt.com/c/693e5a97-c9c0-8333-b11b-602e0e67b8c6
```
# MySQL container
docker run -d \
  --name mysql-bench \
  --memory=16g \
  --cpus=8 \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=benchmarkdb \
  -v mysql_data:/var/lib/mysql \
  mysql:9.5

# PostgreSQL container
docker run -d \
  --name postgres-bench \
  --memory=16g \
  --cpus=8 \
  -e POSTGRES_PASSWORD=rootpassword \
  -e POSTGRES_DB=benchmarkdb \
  -v pg_data:/var/lib/postgresql/data \
  postgres:18.1

Check out:
--cpuset-cpus="0-7"   # assign cores 0–7 to the DB container

/etc/mysql/my.cnf:
[mysqld]
innodb_buffer_pool_size = 12G   # leave some RAM for OS & Docker overhead
innodb_log_file_size = 1G
innodb_flush_method = O_DIRECT

postgresql.conf:
shared_buffers = 8GB            # ~50% of Docker RAM
work_mem = 64MB                 # per query 
maintenance_work_mem = 1GB
wal_buffers = 16MB
```

## Inserts

We start with empty dbs here.

`1 000 000` users one by one.

**MySQL:**
```
Test case with MYSQL data source finished! It had queries: [QueryGroup[id=insert-users, tables=[`user`]]]
Tables count after test:
`user`: 1000000

Some stats...

Test duration: PT3M16.645S
Executed queries: 1000000
Wanted queries rate: 25000/s
Actual queries rate: 5085/s

Min: 6.941388 ms
Max: 120.742733 ms
Mean: 27.717986 ms

Percentile 50 (Median): 27.739314 ms
Percentile 75: 29.388251 ms
Percentile 90: 31.183077 ms
Percentile 99: 38.55202 ms
Percentile 99.9: 93.47563 ms

```

**PostgreSQL:**
```
Test case with POSTGRESQL data source finished! It had queries: [QueryGroup[id=insert-users, tables=["user"]]]
Tables count after test:
"user": 1000000

Some stats...

Test duration: PT59.633S
Executed queries: 1000000
Wanted queries rate: 25000/s
Actual queries rate: 16769/s

Min: 1.030308 ms
Max: 48.194711 ms
Mean: 2.527332 ms

Percentile 50 (Median): 2.431622 ms
Percentile 75: 2.54533 ms
Percentile 90: 2.677608 ms
Percentile 99: 4.467533 ms
Percentile 99.9: 29.886641 ms
```

`1 000 000` items, in batches of N (100):
```
TODO
```

`5 000 000` orders together with `20 000 000` order items (a few items per order, 4 on average), one by one:
```
TODO
```
`5 000 000` orders together with `20 000 000` order items (a few items per order, 4 on average), in batches of N (100):
```
TODO
```

Some conclusions.

Ending inserts, our data in each db for the next cases is:
* `1 000 000` users
* `2 000 000` orders
* `100 000` items ??
* `4 000 000` order_item associations

## Updates

order, item and so on

* update user email -> indexed
* order name/amount -> not indexed

## Deletes

Beware of taking cascades into account!
* order item -> just item
* item -> order_item -> order
* user -> order -> order_item

## Selects

* selecting single users by id (one table, primary index)
* selecting single users by email (one table, secondary index)
* sorting users by id, various offsets and limits
* selecting orders with users per id (one table, primary index join)
* selecting orders with items per id (one table, two primary index joins, one to one and many to many)
* selecting users by id with orders stats (count, average, etc)

Aggreggations
More of the former??

## Writes & Reads

Mixed in various proportions

## Final results

Soo...

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources
1. https://planetscale.com/blog/benchmarking-postgres-17-vs-18
2. https://dev.mysql.com/doc/refman/9.0/en/mysql-nutshell.html

</div>