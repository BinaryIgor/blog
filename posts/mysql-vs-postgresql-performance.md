---
{
    "title": "MySQL vs PostgreSQL Performance: throughput & latency, reads & writes",
    "slug": "mysql-vs-postgresql-performance",
    "startedAt": "2025-12-19",
    "publishedAt": "2026-01-05",
    "excerpt": "MySQL, the Dolphin, and Postgres, the Elephant, are one of the best and most widely used open-source databases. They are often compared across multiple angles: supported features, SQL dialect differences, architecture & internals, resource utilization and - <em>performance</em>. Today, we will jump into <em>performance</em> as deeply and broadly as possible - running many (17) test cases with all kinds of queries and workloads.",
    "researchLog": [ 2, 1, 4.5, 3, 3.5, 3, 2.5, 3, 2, 1, 1],
    "writingLog": [ 1, 2.5, 1.5, 2, 1, 1.5, 4, 2.5, 5, 3, 4.5 ],
    "tags": [ "dbs", "performance" ]
}
---

*For numbers-first audience, [the summarized results are here](#summary).*

MySQL, the Dolphin, and Postgres, the Elephant, are one of the best and most widely used open-source databases. They are often compared across multiple angles: supported features, SQL dialect differences, architecture & internals, resource utilization and - *performance*. Today, we will jump into *performance* as deeply and broadly as possible - running many (17) test cases with all kinds of queries and workloads, using a few tables to simulate various scenarios, most often occurring in the real world, and measuring both throughput & latency. Let's then start to get the answer: 
> Which database, MySQL or PostgreSQL, yields better performance?

## Setup

[The whole tests setup can be found in the GitHub repository.](https://github.com/BinaryIgor/code-examples/tree/master/sql-dbs-performance)

**As [we already know](/mysql-and-postgresql-different-approaches.html), MySQL and Postgres differ in their implementation choices quite a lot**; to capture these differences, there are a few tables (Postgres definition):
```
CREATE TABLE "user" (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);

CREATE TABLE "order" (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);
CREATE INDEX order_user_id ON "order"(user_id);

CREATE TABLE "item" (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP
);

CREATE TABLE "order_item" (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES "item"(id) ON DELETE CASCADE
);
CREATE INDEX order_item_order_id ON "order_item"(order_id);
CREATE INDEX order_item_item_id ON "order_item"(item_id);
```
To make results reproducible and to have better control over resource utilization, both databases and tests run in Docker. [MySQL, version 9.5, has the following config:](https://github.com/BinaryIgor/code-examples/blob/master/sql-dbs-performance/build_and_run_mysql.bash)
```
docker run -d -v "${volume_dir}:/var/lib/mysql" --network host \
  -e "MYSQL_ROOT_PASSWORD=performance" \
  -e "MYSQL_DATABASE=performance" \
  --memory "16G" --cpus "8" --shm-size="1G" \
  --name $container_name $container_name \
  --innodb_buffer_pool_size=12G \
  --innodb_redo_log_capacity=2G \
  --transaction-isolation='READ-COMMITTED'
```
A few important customizations:
* memory and cpus - capped at 16G and 8 respectively; shared memory increased from the tragically small 64MB default as well
* `innodb_buffer_pool_size` - increased total memory available for data and indexes cache to reduce I/O and improve performance
* `innodb_redo_log_capacity` - increased the amount of disk space occupied by redo log files to improve write performance; some writes occur less often
* **Read Committed transaction isolation** - the default is *Repeatable Read* for MySQL; setting it to the same (lower) value as Postgres's default (read committed) makes comparison fairer, since higher isolation levels introduce additional performance overhead

[PosgreSQL, version 18.1, has the following config:](https://github.com/BinaryIgor/code-examples/blob/master/sql-dbs-performance/build_and_run_postgresql.bash)
```
docker run -d -v "${volume_dir}:/var/lib/postgresql" --network host \
  -e "POSTGRES_PASSWORD=performance" \
  -e "POSTGRES_DB=performance" \
  --memory "16G" --cpus "8" --shm-size="1G" \
  --name $container_name $container_name \
  -c shared_buffers=4GB \
  -c work_mem=64MB \
  -c effective_cache_size=12GB
```
Likewise, a few important tweaks:
* `shared_buffers` - very similar to MySQL's `innodb_buffer_pool_size`; slightly less since Postgres makes heavy use of the OS page cache
* `work_mem` - increased maximum memory used (per query operation) for internal sort operations and hash tables, which are used internally for some joins and aggregations
* `effective_cache_size` - increased parameter used by the query planner to estimate the total amount of memory available for caching data

The goal of these customizations is not to have the absolute best configuration possible, but to optimize DBs a bit; getting the most of their performance, not chasing the last few percent bits.

Then, there is the [SqlDbPerformanceTests.java](https://github.com/BinaryIgor/code-examples/blob/master/sql-dbs-performance/tests/src/main/java/SqlDbPerformanceTests.java) tests runner - executing various tests on two databases and outputting detailed stats. For simpler management, it is built and runs in Docker as well (Java 25 & Maven). Configuring it and choosing from multiple available test cases (17) is made easier by the simple [run_test.py](https://github.com/BinaryIgor/code-examples/blob/master/sql-dbs-performance/run_test.py) python script.

[Since DBs have 8 CPUs available](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing), connection pool sizes are: `8 * 16 = 128` for MySQL and `8 * 8 = 64` for Postgres. Empirically, MySQL benefits from having more connections, yielding better results; especially for write-heavy workloads.

The test cases are designed to run in a few rounds - executing set `QUERIES_RATE` per second for the configured `QUERIES_TO_EXECUTE` in total. Depending on the specific scenario, these numbers range from a few hundreds per second to tens of thousands; in most cases, `QUERIES_TO_EXECUTE = 10 * QUERIES_RATE`.

To run tests (locally), there are a few scripts that spin up MySQL and PostgreSQL instances in Docker and build and run `SqlDbPerformanceTests.java` in Docker as well, with the chosen test case & DB. It all comes down to executing:
```
# builds and runs MySQL in Docker
./build_and_run_mysql.bash

# builds and runs PostgreSQL in Docker
./build_and_run_postgresql.bash

# builds, without running just yet, performance tests in Docker
./build_performance_tests.bash

# runs performance tests in Docker, with the chosen test case & DB
./run_test.py
```

## Environment

All tests will run on my local machine:
* CPU - *AMD Ryzen 7 PRO 7840U*; 8 cores and 16 threads, base clock speed of 3.3 GHz with a maximum boost of 5.1 GHz 
* Memory - 32 GiB
* OS - Ubuntu 24.04.3 LTS

Disk (1 TB) details:
```
sudo lshw -class disk -class storage

description: NVMe device
product: SAMSUNG MZVL21T0HDLU-00BLL
vendor: Samsung Electronics Co Ltd
bus info: pci@0000:03:00.0
version: 6L2QGXD7
width: 64 bits
clock: 33MHz
capabilities: nvme pm msi pciexpress msix nvm_express bus_master cap_list
configuration: driver=nvme latency=0 nqn=nqn.1994-11.com.samsung:nvme:PM9A1a:M.2:S75YNF0XC05149 state=live
resources: irq:68 memory:78c00000-78c03fff
```

As mentioned, databases run in Docker with memory capped at 16G and CPUs at 8. The test runner does not have any limits imposed. 

## Results

[All test results are also available in the GitHub repository.](https://github.com/BinaryIgor/code-examples/tree/master/sql-dbs-performance/results/local)

We start with both DBs running in Docker and being empty here - only table schemas are initialized. In the results, we are going to see:
```
Total test duration: PT14.471S
Queries duration: PT10.619S
``` 
These times might sometimes differ substantially - it is because for some test cases, there is a need to fetch existing data from DB in order to construct test queries. Duration of these additional queries is subtracted from the total test duration: `Queries duration = Total test duration - Additional queries duration`. Otherwise they would skew results, adding time where it should not be counted. 

As said, we will run lots of cases, testing all kinds of queries and workloads. When executing `python3 run_test.py`, the following options are available:
1. [INSERT USERS](#results-inserts)
2. INSERT ITEMS IN BATCHES
3. INSERT ORDERS IN BATCHES
4. INSERT ORDER ITEMS IN BATCHES
5. [SELECT USERS BY ID](#results-selects)
6. SELECT USERS BY EMAIL
7. SELECT SORTED BY ID USER PAGES
8. SELECT ORDERS JOINED WITH USERS
9. SELECT ORDERS JOINED WITH ITEMS
10. SELECT USERS WITH ORDERS STATS BY ID
11. [UPDATE USER EMAILS BY ID](#results-updates)
12. UPDATE USER UPDATED ATS BY ID
13. UPDATE USER MULTIPLE COLUMNS BY ID
14. [DELETE ORDERS BY ID](#results-deletes)
15. DELETE ORDERS IN BATCHES BY ID
16. [INSERT USERS AND ORDERS WITH ITEMS IN TRANSACTIONS](#results-transactions)
17. [INSERT UPDATE DELETE AND SELECT USERS BY ID](#results-inserts-updates-deletes-and-selects)

After running first 4 insert options, each database is going to store:
* `500 000` users
* `500 000` items
* `2 000 000` orders
* `4 000 000` order item associations

for the upcoming select, update, delete and mixed test cases.

Let's then finally run the tests and inspect results!

{{ .js: newsletterSignUpPostMid() }}

### Inserts {#results-inserts}

**INSERT USERS** - inserts `500 000` users with `10 000 QPS` (queries per second) rate wanted, one by one:
```
MySQL | PostgreSQL

Total test duration: PT1M54.078S | PT51.742S
Queries duration: PT1M54.078S | PT51.742S

Executed queries: 500000

Wanted queries rate: 10000/s
Actual queries rate: 4383/s | 9663/s

Min: 7.362 ms | 1.041 ms
Max: 150.018 ms | 40.748 ms
Mean: 26.801 ms | 2.191 ms

Percentile 50 (Median): 26.498 ms | 2.158 ms
Percentile 90: 31.082 ms | 2.658 ms
Percentile 99: 42.729 ms | 3.84 ms
Percentile 99.9: 114.339 ms | 13.304 ms
```
Postgres is much better here and as we can clearly see - this load was already too much for MySQL, the Dolphin. The Elephant seems to still breathe easily, so let's rerun it with `30 000 QPS`:
```
PostgreSQL

Total test duration: PT23.432S
Queries duration: PT23.432S

Executed queries: 500000

Wanted queries rate: 30000/s
Actual queries rate: 21338/s

Min: 1.159 ms
Max: 37.963 ms
Mean: 2.386 ms

Percentile 50 (Median): 2.367 ms
Percentile 90: 2.578 ms
Percentile 99: 4.009 ms
Percentile 99.9: 12.218 ms
```
*21 338* inserts per second compared to *only 4383* of MySQL - impressive performance and 4.87x throughput win for Postgres!

**INSERT ITEMS IN BATCHES** - inserts `500 000` items in batches of `100`, with the target of `500 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT24.958S | PT23.651S
Queries duration: PT24.958S | PT23.651S

Executed queries: 5000

Wanted queries rate: 500/s
Actual queries rate: 200/s | 211/s

Min: 11.156 ms | 2.424 ms
Max: 232.688 ms | 36.817 ms
Mean: 26.504 ms | 4.1 ms

Percentile 50 (Median): 25.89 ms | 3.909 ms
Percentile 90: 35.57 ms | 5.113 ms
Percentile 99: 45.759 ms | 6.88 ms
Percentile 99.9: 183.714 ms | 30.237 ms
```
A little too much for both DBs; the difference is not large when it comes to throughput - *200 QPS vs 211 QPS*, each query inserting *100 items*. On the other hand, latency (queries duration) is significantly lower (better) for Postgres - *4.1 ms vs 26.504 ms* by mean and *6.88 ms vs 45.759 ms* by 99th percentile.

**INSERT ORDERS IN BATCHES** - inserts `2 000 000` orders in batches of `100`, with the goal of `2000 QPS`:
```
MySQL | PostgreSQL 

Total test duration: PT14.471S | PT11.004S
Queries duration: PT10.619S | PT6.759S 

Executed queries: 20000

Wanted queries rate: 2000/s 
Actual queries rate: 1883/s | 2959/s

Min: 12.355 ms | 2.026 ms 
Max: 268.408 ms | 53.068 ms
Mean: 51.606 ms | 13.786 ms

Percentile 50 (Median): 45.796 ms | 13.701 ms 
Percentile 90: 76.863 ms | 21.716 ms
Percentile 99: 146.497 ms | 38.114 ms
Percentile 99.9: 172.807 ms | 49.143 ms
```
The Elephant clearly exceeds expectations and outperforms the Dolphin here, both throughput & latency wise. Let's repeat it with `4000 QPS`:
```
PostgreSQL

Total test duration: PT10.173S
Queries duration: PT5.658S

Executed queries: 20000

Wanted queries rate: 4000/s
Actual queries rate: 3535/s

Min: 2.487 ms
Max: 90.238 ms
Mean: 14.697 ms

Percentile 50 (Median): 13.997 ms
Percentile 90: 22.082 ms
Percentile 99: 34.779 ms
Percentile 99.9: 75.629 ms
```
So, *3535 inserts/s of 100 records* for Postgres vs *1883 inserts/s* for MySQL.

**INSERT ORDER ITEMS IN BATCHES** - links existing orders with existing items by inserting records into the `order_item` table. Inserting `4 000 000` rows in the batches of `1000`, with the desired `400 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT41.329S | PT23.654S
Queries duration: PT7.365S | PT10.271S

Executed queries: 4000

Wanted queries rate: 400/s
Actual queries rate: 543/s | 389/s

Min: 25.842 ms | 32.322 ms
Max: 505.263 ms| 447.523 ms
Mean: 247.138 ms | 192.304 ms

Percentile 50 (Median): 221.993 ms | 188.728 ms
Percentile 90: 403.34 ms | 288.398 ms
Percentile 99: 482.361 ms | 394.913 ms
Percentile 99.9: 504.069 ms | 430.7 ms
```
Surprisingly, first inserts victory (throughput-wise) for the Dolphin - *543 QPS vs 389 QPS, 1.4x better*. Latency is actually lower (better) for the Elephant, so overall, it is rather a draw. 

**Summing inserts up, apart from one case, Postgres prevails, both throughput & latency wise.**

### Selects {#results-selects}

**SELECT USERS BY ID** - selects users by id at wanted `50 000 QPS` rate:
```
MySQL | PostgreSQL

Total test duration: PT16.428S | PT11.935S
Queries duration: PT14.939S | PT11.282S

Executed queries: 500000

Wanted queries rate: 50000/s
Actual queries rate: 33469/s | 44315/s

Min: 0.09 ms | 0.08 ms
Max: 100.489 ms | 101.967 ms
Mean: 1.579 ms | 0.523 ms

Percentile 50 (Median): 1.064 ms | 0.359 ms
Percentile 90: 2.665 ms | 0.921 ms
Percentile 99: 12.721 ms | 2.59 ms
Percentile 99.9: 25.143 ms | 14.47 m
```
The Elephant seems to have some steam left; rerunning it with `75 000 QPS`:
```
PostgreSQL

Total test duration: PT11.264S
Queries duration: PT9.058S

Executed queries: 500000

Wanted queries rate: 75000/s
Actual queries rate: 55200/s

Min: 0.084 ms
Max: 102.201 ms
Mean: 0.874 ms

Percentile 50 (Median): 0.653 ms
Percentile 90: 1.348 ms
Percentile 99: 5.446 ms
Percentile 99.9: 18.749 m
```
Postgres beats MySQL; advantage is less significant than on single inserts, but it is still a lot - *55 200 QPS vs 33 469 QPS*; mean of *0.874 ms vs 1.579 ms* and *5.446 ms vs 12.721 ms* at the 99th percentile.

**SELECT USERS BY EMAIL** - reads users by email ([secondary index](mysql-and-postgresql-different-approaches.html#clustered-indexes-vs-heap-tables)) with the `50 000 QPS` target:
```
MySQL | PostgreSQL

Total test duration: PT17.139S | PT12.047S
Queries duration: PT15.631S | PT11.280S

Executed queries: 500000

Wanted queries rate: 50000/s
Actual queries rate: 31988/s | 44324/s

Min: 0.106 ms | 0.086 ms
Max: 99.775 ms | 59.287 ms
Mean: 1.772 ms | 0.612 ms

Percentile 50 (Median): 1.234 ms | 0.447 ms
Percentile 90: 2.985 ms | 1.088 ms
Percentile 99: 12.865 ms | 2.812 ms
Percentile 99.9: 26.701 ms | 11.028 ms
```
The Elephant wins already but breathing easily still - let's likewise run this case again with the `75 000 QPS` goal:
```
PostgreSQL

Total test duration: PT10.862S
Queries duration: PT9.348S

Executed queries: 500000

Wanted queries rate: 75000/s
Actual queries rate: 53487/s

Min: 0.084 ms
Max: 82.551 ms
Mean: 0.834 ms

Percentile 50 (Median): 0.618 ms
Percentile 90: 1.288 ms
Percentile 99: 5.358 ms
Percentile 99.9: 16.843 ms
```
Even better win for Postgres - *53 487 QPS vs 31 988 QPS*; lower latency as well.

**SELECT SORTED BY ID USER PAGES** - with the target of `5000 QPS`, selects users sorted by id with the ascending order; results are limited to a random number from *10 to 100*, offset is random as well and in the *0 to 10 000* range:
```
MySQL | PostgreSQL

Total test duration: PT10.968S | PT10.537S
Queries duration: PT10.968S | T10.537S

Executed queries: 50000

Wanted queries rate: 5000/s
Actual queries rate: 4559/s | 4745/s

Min: 0.139 ms | 0.118 ms
Max: 71.472 ms | 51.453 ms
Mean: 3.118 ms | 1.556 ms

Percentile 50 (Median): 1.561 ms | 1.117 ms
Percentile 90: 6.297 ms | 2.362 ms
Percentile 99: 41.294 ms | 9.146 ms
Percentile 99.9: 55.248 ms | 42.884 m
```
Interestingly, the first select case where DBs come pretty close (throughput-wise) - *4559 QPS vs 4745 QPS*. But overall, Postgres still holds an edge.

Now, we will go through some joins.

**SELECT ORDERS JOINED WITH USERS** - reads orders by id at wanted `35 000 QPS` rate, joining them with users on `o.user_id = u.id`. There is a many-to-one relationship between orders and users:
```
MySQL | PostgreSQL

Total test duration: PT14S | PT13.154S
Queries duration: PT11.977S | PT12.414S

Executed queries: 350000

Wanted queries rate: 35000/s
Actual queries rate: 29223/s | 28194/s

Min: 0.105 ms | 0.152 ms
Max: 99.931 ms | 54.302 ms
Mean: 1.739 ms | 1.897 ms

Percentile 50 (Median):  1.177 ms | 1.321 ms
Percentile 90: 2.923 ms | 2.85 ms
Percentile 99: 14.543 ms | 19.823 ms
Percentile 99.9: 27.36 ms | 26.859 ms
```
Finally, MySQL beats Postgres, albeit slightly - *29 223 QPS vs 28 194 QPS*; latency is mostly lower as well.

**SELECT ORDERS JOINED WITH ITEMS** - reads orders by id at wanted `30 000 QPS` rate, joining them with order items on `order_item.order_id` first and then joining them with items on `order_item.item_id`. There is a many-to-many relationship between orders and order items; the same kind of relationship exists between order items and items. This case tests double join with many-to-many relationships on both sides:
```
MySQL | PostgreSQL

Total test duration: PT14.859S | PT15.566S
Queries duration: PT13.263S | PT14.843S

Executed queries: 300000

Wanted queries rate: 30000/s
Actual queries rate: 22619/s | 20211/s

Min: 0.155 ms | 0.199 ms
Max: 77.021 ms | 80.307 ms
Mean: 2.824 ms | 2.799 ms

Percentile 50 (Median): 1.962 ms | 1.866 ms
Percentile 75: 3.219 ms | 2.748 ms
Percentile 90: 5.091 ms | 4.093 ms
Percentile 99: 19.795 ms | 28.604 ms
Percentile 99.9: 29.203 ms | 34.309 ms
```
Another victory for the Dolphin! It seems like it genuinely is better at joins; throughput is *1.12x higher - 22 619 QPS vs 20 211 QPS*, while latency is mixed; some of it is better - higher percentiles, some of it is worse - lower percentiles and mean.

**SELECT USERS WITH ORDERS STATS BY ID** - selects users by id, joining them with orders on `u.id = o.user_id` (one-to-many) and computing various stats per user: `COUNT(*) AS orders`, `MIN(o.created_at) AS oldest_order_created_at` and `MAX(o.created_at) AS latest_order_created_at`. The target rate is `40 000 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT18.485S | PT13.101S
Queries duration: PT17.505S | PT12.621S

Executed queries: 400000

Wanted queries rate: 40000/s
Actual queries rate: 22851/s | 31693/s

Min: 0.151 ms | 0.138 ms
Max: 106.217 ms | 113.18 ms
Mean: 2.759 ms | 1.648 ms

Percentile 50 (Median): 1.77 ms | 1.137 ms
Percentile 90: 5.092 ms | 2.622 ms
Percentile 99: 19.511 ms | 15.651 ms
Percentile 99.9: 34.338 ms | 23.988 ms
```
Unexpectedly, in the last join case the Elephant has an upper hand - *31 693 QPS vs 22 851 QPS, 1.39x better*; lower latency as well.

**Summing selects up:**
* Postgres dominates single-row selects from one table
* performance of sorted selects of multiple rows from a single table is very close for both DBs
* MySQL has a slight edge in joins
* selects with aggregate functions are more performant for the Elephant

### Updates {#results-updates}

**UPDATE USER EMAILS BY ID** - updates user emails (indexed column) by id, with the wanted rate of `5000 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT13.612S | PT10.245S
Queries duration: PT13.29S | PT10.108S

Executed queries: 50000

Wanted queries rate: 5000/s
Actual queries rate: 3762/s | 4946/s

Min: 6.71 ms | 1.101 ms
Max: 61.503 ms | 16.098 ms
Mean: 26.337 ms | 2.506 ms

Percentile 50 (Median): 26.457 ms | 2.423 ms
Percentile 90: 31.342 ms | 2.947 ms
Percentile 99: 36.415 ms | 9.243 ms
Percentile 99.9: 42.76 ms | 13.755 ms
```
Already too much for MySQL - it peaked at *3762 QPS, instead of reaching 5000 QPS*. The Elephant seems to operate well below its limits; let's rerun the case with 4x higher rate - `20 000 QPS`:
```
PostgreSQL

Total test duration: PT11.608S
Queries duration: PT11.057S

Executed queries: 200000

Wanted queries rate: 20000/s
Actual queries rate: 18088/s

Min: 1.141 ms
Max: 17.132 ms
Mean: 2.483 ms

Percentile 50 (Median): 2.458 ms
Percentile 90: 2.897 ms
Percentile 99: 4.827 ms
Percentile 99.9: 10.896 ms
```
Well, the Dolphin loses completely here - *3762 QPS vs 18 088 QPS, 4.8x worse* compared to the Elephant; latency is higher as well.

**UPDATE USER UPDATED ATS BY ID** - modifies user updated ats (unindexed column) by id, with the wanted rate of `5000 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT11.653S | PT10.239S
Queries duration:  PT11.344S | PT9.947S

Executed queries: 50000

Wanted queries rate: 5000/s
Actual queries rate: 4408/s | 5026/s

Min: 0.128 ms | 1.089 ms
Max: 114.719 ms | 12.321 ms
Mean: 15.172 ms | 2.351 ms

Percentile 50 (Median): 17.715 ms | 2.368 ms
Percentile 90: 33.223 ms | 2.891 ms
Percentile 99: 37.726 ms | 3.588 ms
Percentile 99.9: 110.402 ms | 8.559 ms
```
As in the previous case, the Elephant is again superior, although less profoundly. But, running it again with `20 000 QPS`:
```
PostgreSQL

Total test duration: PT11.588S
Queries duration: PT10.802S

Executed queries: 200000

Wanted queries rate: 20000/s
Actual queries rate: 18515/s

Min: 1.115 ms
Max: 16.476 ms
Mean: 2.524 ms

Percentile 50 (Median): 2.52 ms
Percentile 90: 2.966 ms
Percentile 99: 4.977 ms
Percentile 99.9: 11.745 ms
```
Not very different from emails update, the Dolphin loses totally here - *4408 QPS vs 18 515 QPS, 4.2x worse*; latency is higher as well.

Lastly for updates, we have **UPDATE USER MULTIPLE COLUMNS BY ID** - changes both emails (indexed) and updated ats (unindexed) of users by id; likewise with the `5000 QPS` target:
```
MySQL | PostgreSQL

Total test duration: PT13.722S | PT10.228S
Queries duration: PT13.345S | PT9.989S

Executed queries: 50000

Wanted queries rate: 5000/s
Actual queries rate: 3747/s | 5005/s

Min: 6.812 ms | 1.114 ms
Max: 117.566 ms | 14.903 ms
Mean: 26.284 ms | 2.387 ms

Percentile 50 (Median): 26.161 ms | 2.394 ms
Percentile 90: 31.188 ms | 2.906 ms
Percentile 99: 39.774 ms | 4.108 ms
Percentile 99.9: 113.642 ms | 9.15 m
```
Postgres outperforms MySQL again. Since the Elephant once more appears no to be impressed by this load, here is the `20 000 QPS` version:
```
PostgreSQL

Total test duration: PT11.665S
Queries duration: PT11.083S

Executed queries: 200000

Wanted queries rate: 20000/s
Actual queries rate: 18046/s

Min: 1.088 ms
Max: 16.465 ms
Mean: 2.507 ms

Percentile 50 (Median): 2.463 ms
Percentile 90: 2.947 ms
Percentile 99: 4.704 ms
Percentile 99.9: 10.178 ms
```
*18 046 QPS vs 3747 QPS - 4.82x Postgres dominance.*

**For updates, the Elephant is just superior in all cases.**

### Deletes {#results-deletes}

**DELETE ORDERS BY ID** - deletes orders by id with the wanted rate of `10 000 QPS`. Importantly, orders are associated with the `order_item` table (many-to-many); deleting an order cascades to the linked order items:
```
MySQL | PostgreSQL

Total test duration: PT19.589S | PT10.776S
Queries duration: PT17.871S | PT10.35S

Executed queries: 100000

Wanted queries rate: 10000/s
Actual queries rate: 5596/s | 9662/s

Min: 0.139 | 0.085 ms
Max: 119.909 ms | 16.123 ms
Mean: 20.563 ms | 1.953 ms

Percentile 50 (Median): 22.36 ms | 2.191 ms
Percentile 90: 31.335 ms | 2.628 ms
Percentile 99: 43.039 ms | 4.334 ms
Percentile 99.9: 114.248 ms | 13.747 ms
```
As with updates, Postgres wins and still has a room to grow; running the case again with the `20 000 QPS` goal:
```
PostgreSQL

Total test duration: PT11.408S
Queries duration: PT10.938S

Executed queries: 200000

Wanted queries rate: 20000/s
Actual queries rate: 18285/s

Min: 0.084 ms
Max: 18.622 ms
Mean: 2.009 ms

Percentile 50 (Median): 2.285 ms
Percentile 90: 2.917 ms
Percentile 99: 4.661 ms
Percentile 99.9: 13.522 ms
```
*18 285 QPS vs 5596 QPS throughput, 3.27x better*; lower latency as well.

**DELETE ORDERS IN BATCHES BY ID** - deletes orders by id in batches of `100`, with the target rate of `1000 QPS`. As previously, it is important to keep in mind that orders are associated with the `order_item` table; deleting an order cascades to the linked order items:
```
MySQL | PostgreSQL

Total test duration: PT32.555S | PT10.135S
Queries duration: PT16.125S | PT7.445S

Executed queries: 10000

Wanted queries rate: 1000/s
Actual queries rate: 620/s | 1343/s

Min: 16.219 ms | 1.572 ms
Max: 925.516 ms | 117.852 ms
Mean: 181.728 ms | 11.387 ms

Percentile 50 (Median): 144.041 ms | 4.975 ms
Percentile 90: 372.383 ms | 29.104 ms
Percentile 99: 670.586 ms | 60.834 ms
Percentile 99.9: 846.825 ms | 89.203 ms
```
Giving Postgres more space to show its strength with `20 000 QPS`:
```
PostgreSQL

Total test duration: PT11.184S
Queries duration: PT6.943S

Executed queries: 20000

Wanted queries rate: 2000/s
Actual queries rate: 2881/s

Min: 1.868 ms
Max: 143.329 ms
Mean: 16.547 ms

Percentile 50 (Median): 12.604 ms
Percentile 90: 34.174 ms
Percentile 99: 66.48 ms
Percentile 99.9: 102.943 ms
```
Another complete victory for the Elephant - *2881 QPS vs 620 QPS, 4.65x better*.

**As with updates, Postgres is overall superior in deletes.**

### Transactions {#results-transactions}

**INSERT USERS AND ORDERS WITH ITEMS IN TRANSACTIONS** - inserts one user and one order with two items in a single transaction. It requires 4 insert statements: 1 for the `user` table, 1 for the `order` table and 2 for the `order_item` table. The goal is to execute `2500` such transactions per second, which translates to `4 * 2500 = 10 000 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT11.921S | PT10.104S
Queries duration: PT10.522S | PT9.742S

Executed queries: 25000

Wanted queries rate: 2500/s
Actual queries rate: 2376/s | 2566/s

Min: 10.33 ms | 1.289 ms
Max: 118.617 ms | 16.185 ms
Mean: 26.841 ms | 2.821 ms

Percentile 50 (Median): 25.505 ms | 2.672 ms
Percentile 90: 35.535 ms | 3.483 ms
Percentile 99: 62.132 ms | 6.525 ms
Percentile 99.9: 111.082 ms | 10.12 m
```
As single inserts were problematic for the Dolphin, it is not a surprise that the Elephant wins here as well: *2566 QPS vs 2376 QPS*, lower latency as well. Since both of them seem to have something left in the tank, let's rerun the case with `4 * 5000 = 20 000 QPS` for MySQL and with `4 * 10 000 = 40 000 QPS` for Postgres:
```
MySQL | PostgreSQL

Total test duration: PT14.473S | PT6.337S
Queries duration: PT13.62S | PT5.671S

Executed queries: 50000

Wanted queries rate: 5000/s | 10000/s
Actual queries rate: 3671/s | 8816/s

Min: 8.475 ms | 1.35 ms
Max: 128.404 ms | 27.007 ms
Mean: 29.103 ms | 3.587 ms

Percentile 50 (Median): 28.566 ms | 2.891 ms
Percentile 90: 36.64 ms | 6.126 ms
Percentile 99: 53.419 ms | 11.209 ms
Percentile 99.9: 122.303 ms | 18.949 m
```
Almost there! The Elephant is able to handle `8816 TPS` (transactions per second), translating to `4 * 8816 = 35 264 QPS`; the Dolphin peaked at `3671 TPS`, translating to `4 * 3671 = 14 684 QPS` - *2.4 x higher throughput for Postgres*.

**The Elephant is able to handle more transactions and does so with lower latency.**

### Inserts, Updates, Deletes and Selects {#results-inserts-updates-deletes-and-selects}

**INSERT UPDATE DELETE AND SELECT USERS BY ID** - inserts, updates, deletes and selects users by id in 1:1 reads:writes proportion. Meaning, for every 3 user selects by id, there is 1 user insert, 1 user update by id and 1 user delete by id executed. It tests mixed workload, simultaneous reads & writes; wanted rate is `7500 QPS`:
```
MySQL | PostgreSQL

Total test duration: PT12.313S | PT10.299S
Queries duration: PT11.905S | PT10.116S

Executed queries: 75000
  insert-users: 12425 | 12349
  update-user-emails-by-id: 12343 | 12481
  delete-users-by-id: 12582 | 12399
  select-users-by-id: 37650 | 37771

Wanted queries rate: 7500/s
Actual queries rate: 6300/s | 7413/s

Min: 0.092 ms | 0.081 ms
Max: 87.487 ms | 26.09 ms
Mean: 12.813 ms | 1.154 ms

Percentile 50 (Median): 1.174 ms | 0.369 ms
Percentile 90: 30.671 ms | 2.545 ms
Percentile 99: 40.635 ms | 3.068 ms
Percentile 99.9: 63.811 ms | 9.014 ms
```
Postgres wins with higher throughput & lower latency and is far from saying the last word. Running the case again with `25 000 QPS`:
```
PostgreSQL

Total test duration: PT11.506S
Queries duration: PT10.665S

Executed queries: 250000
  insert-users: 41775
  update-user-emails-by-id: 42164
  delete-users-by-id: 41420
  select-users-by-id: 124641

Wanted queries rate: 25000/s
Actual queries rate: 23441/s

Min: 0.087 ms
Max: 19.568 ms
Mean: 1.372 ms

Percentile 50 (Median): 0.997 ms
Percentile 90: 2.805 ms
Percentile 99: 4.634 ms
Percentile 99.9: 11.616 ms
```
So, the Elephant is able to handle *23 441 QPS* of this load as compared to only *6300 QPS* of the Dolphin. **It means *3.72x* Postgres supremacy for mixed workloads.**

## Summary

**Postgres, the Elephant, outperforms MySQL, the Dolphin, in almost all scenarios**: for the 17 executed test cases in total, Postgres won in 14 and there was 1 draw. Using *QPS (queries per second)* to measure throughput (the higher the better), *mean & 99th percentile* for latency (the lower the better), here is a high-level summary of the results where Postgres was superior:

1. **Inserts**
    * 1.05 - 4.87x higher throughput
    * latency lower 3.51 - 11.23x by mean and 4.21 - 10.66x by 99th percentile
    * Postgres delivers `21 338 QPS with 4.009 ms at the 99th percentile` for single-row inserts, compared to *4 383 QPS & 42.729 ms* for MySQL; for batch inserts of `100 rows`, it achieves `3535 QPS with 34.779 ms at the 99th percentile`, compared to *1883 QPS & 146.497 ms* for MySQL
2. **Selects**
    * 1.04 - 1.67x higher throughput
    * latency lower 1.67 - 2x by mean and 1.25 - 4.51x by 99th percentile
    * Postgres delivers `55 200 QPS with 5.446 ms at the 99th percentile` for single-row selects by id, compared to *33 469 QPS & 12.721 ms* for MySQL; for sorted selects of multiple rows, it achieves `4745 QPS with 9.146 ms at the 99th percentile`, compared to *4559 QPS & 41.294 ms* for MySQL
3. **Updates** 
    * 4.2 - 4.82x higher throughput
    * latency lower 6.01 - 10.6x by mean and 7.54 - 8.46x by 99th percentile
    * Postgres delivers `18 046 QPS with 4.704 ms at the 99th percentile` for updates by id of multiple columns, compared to *3747 QPS & 39.774 ms* for MySQL
4. **Deletes**
    * 3.27 - 4.65x higher throughput
    * latency lower 10.24x - 10.98x by mean and 9.23x - 10.09x by 99th percentile
    * Postgres delivers `18 285 QPS with 4.661 ms at the 99th percentile` for deletes by id, compared to *5596 QPS & 43.039 ms* for MySQL
5. **Inserts, Updates, Deletes and Selects mixed**
    * 3.72x higher throughput
    * latency lower 9.34x by mean and 8.77x by 99th percentile
    * Postgres delivers `23 441 QPS with 4.634 ms at the 99th percentile` for this mixed in 1:1 writes:reads proportion workload, compared to *6300 QPS & 40.635 ms* for MySQL

\
And here is a much more detailed summary of all test cases:
1. **Inserts - single rows of the user table**
    * MySQL - `4383 QPS`; Mean: 26.801 ms, Percentile 99: 42.729 ms
    * Postgres - `21 338 QPS`; Mean: 2.386 ms, Percentile 99: 4.009 ms
    * *Postgres wins with 4.87x higher throughput, latency lower 11.23x by mean and 10.66x by 99th percentile*  
2. **Inserts - batches of 100 rows of the item table**
    * MySQL - `200 QPS`; Mean: 26.504 ms, Percentile 99: 45.759 ms
    * Postgres - `211 QPS`; Mean: 4.1 ms, Percentile 99: 6.88 ms
    * *Postgres wins with 1.05x higher throughput, latency lower 6.46x by mean and 6.65x by 99th percentile*
3. **Inserts - batches of 100 rows of the order table**
    * MySQL - `1883 QPS`; Mean: 51.606 ms, Percentile 99: 146.497 ms
    * Postgres - `3535 QPS`; Mean 14.697 ms, Percentile 99: 34.779 ms
    * *Postgres wins with 1.88x higher throughput, latency lower 3.51x by mean and 4.21x by 99th percentile*
4. **Inserts - batches of 1000 rows of the order_item table**
    * MySQL - `543 QPS`; Mean: 247.138 ms, Percentile 99: 482.361 ms
    * Postgres - `389 QPS`; Mean: 192.304 ms, Percentile 99: 394.913 ms
    * *MySQL wins on throughput, 1.4x higher, but loses on latency, which is lower 1.29x by mean and 1.22x by 99th percentile for Postgres - it is therefore a draw*
5. **Selects - user by id**
    * MySQL - `33 469 QPS`; Mean: 1.579 ms, Percentile 99: 12.721 ms
    * Postgres - `55 200 QPS`; Mean: 0.874 ms, Percentile 99: 5.446 ms
    * *Postgres wins with 1.65x higher throughput, latency lower 1.8x by mean and 2.34x by 99th percentile*
6. **Selects - user by email**
    * MySQL - `31 988 QPS`; Mean: 1.772 ms, Percentile 99: 12.865 ms
    * Postgres - `53 487 QPS`; Mean: 0.834 ms, Percentile 99: 5.358 ms
    * *Postgres wins with 1.67x higher throughput, latency lower 2.12x by mean and 2.4x by 99th percentile*
7. **Selects - sorted by id user pages, 10 to 100 in size**
    * MySQL - `4559 QPS`; Mean: 3.118 ms, Percentile 99: 41.294 ms
    * PostgreSQL - `4745 QPS`; Mean: 1.556 ms. Percentile 99: 9.146 ms
    * *Postgres wins with 1.04x higher throughput, latency lower 2x by mean and 4.51x by 99th percentile*
8. **Selects - order by id, joined with many-to-one user**
    * MySQL - `29 223 QPS`; Mean: 1.739 ms, Percentile 99: 14.543 ms
    * Postgres - `28 194 QPS`; Mean: 1.897 ms, Percentile 99: 19.823 ms
    * *MySQL wins with 1.04x higher throughput, latency lower 1.09x by mean and 1.36x by 99th percentile*
9. **Selects - order by id, joined with many-to-many order_item, joined with many-to-many item**
    * MySQL - `22 619 QPS`; Mean: 2.824 ms, Percentile 99: 19.795 ms
    * Postgres - ` 20 211 QPS`; Mean: 2.799 ms, Percentile 99: 28.604 ms
    * *MySQL wins with 1.12x higher throughput, latency higher 1.01x (slightly worse) by mean and lower 1.45x by 99th percentile*
10. **Selects - user by id, joined with one-to-many order and with some aggregate functions computed**
    * MySQL - `22 851 QPS`; Mean: 2.759 ms, Percentile 99: 19.511 ms 
    * Postgres - `31 693 QPS`; Mean: 1.648 ms, Percentile 99: 15.651 ms
    * *Postgres wins with 1.39x higher throughput, latency lower 1.67x by mean and 1.25x by 99th percentile*
11. **Updates - user by id of the indexed email column**
    * MySQL - `3762 QPS`; Mean: 26.337 ms, Percentile 99: 36.415 ms 
    * Postgres - `18 088 QPS`; Mean: 2.483 ms, Percentile 99: 4.827 ms
    * *Postgres wins with  4.8x higher throughput, latency lower 10.6x by mean and 7.54x by 99th percentile*
12. **Updates - user by id of the unindexed updated_at column**
    * MySQL - `4408 QPS`; Mean: 15.172 ms, Percentile 99: 37.726 ms 
    * Postgres - `18 515 QPS`; Mean: 2.524 ms, Percentile 99: 4.977 ms
    * *Postgres wins with 4.2x higher throughput, latency lower 6.01x by mean and 7.58x by 99th percentile*
13. **Updates - user by id of multiple columns, indexed and not**
    * MySQL - `3747 QPS`; Mean: 26.284 ms, Percentile 99: 39.774 ms 
    * Postgres - `18 046 QPS`; Mean: 2.507 ms, Percentile 99: 4.704 ms
    * *Postgres wins with 4.82x higher throughput, latency lower 10.48x by mean and 8.46x by 99th percentile*
14. **Deletes - order by id**
    * MySQL - `5596 QPS`; Mean: 20.563 ms, Percentile 99: 43.039 ms 
    * Postgres - `18 285 QPS`; Mean: 2.009 ms, Percentile 99: 4.661 ms
    * *Postgres wins with 3.27x higher throughput, latency lower 10.24x by mean and 9.23x by 99th percentile*
15. **Deletes - order by id in batches of 100 rows**
    * MySQL - `620 QPS`; Mean: 181.728 ms, Percentile 99: 670.586 ms 
    * Postgres - `2881 QPS`; Mean: 16.547 ms, Percentile 99: 66.48 ms
    * *Postgres wins with 4.65x higher throughput, latency lower 10.98x by mean and 10.09x by 99th percentile*
16. **Transactions - inserts of one user, one order and two order_items**
    * MySQL - `3671 QPS`; Mean: 29.103 ms, Percentile 99: 53.419 ms 
    * Postgres - `8816 QPS`; Mean: 3.587 ms, Percentile 99: 11.209 ms
    * *Postgres wins with 2.4x higher throughput, latency lower 8.11x by mean and 4.77x by 99th percentile*
17. **Inserts, Updates, Deletes and Selects - user by id, mixed in 1:1 writes:reads proportion**
     * MySQL - `6300 QPS`; Mean: 12.813 ms, Percentile 99: 40.635 ms 
    * Postgres - `23 441 QPS`; Mean: 1.372 ms, Percentile 99: 4.634 ms
    * *Postgres wins with 3.72x higher throughput, latency lower 9.34x by mean and 8.77x by 99th percentile*

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Setup and tests source code, so you can experiment, run tests on your own and compare the results  (*MariaDB added on 2026-01-08*): https://github.com/BinaryIgor/code-examples/tree/master/sql-dbs-performance
2. Related video on my YouTube channel - running the same test cases, but with MariaDB added and on remote virtual machines, hosted on the DigitalOcean infrastructure (*added 2026-01-14*). The results were interestingly different: https://www.youtube.com/watch?v=POIC6R9OkIo
3. Deep dive into [MySQL and PostgreSQL differences](/mysql-and-postgresql-different-approaches.html)
4. [Performance Posts](/performance-posts.html)
5. Batch inserts (100 rows) of the `item` table were characterized by significantly lower throughput than of the `order` table, for both DBs - *200 QPS vs 1883 QPS* for MySQL and *211 QPS vs 3535 QPS* for Postgres. It is attributable to the fact that the `item` has the `name VARCHAR(255)` column as well as the `description TEXT` column. Especially the description column, as it stores descriptions of 5 to 1000 in length texts in our case, which significantly impacts inserts  performance (most likely updates too).   
6. Connection Pool Sizing:
    1. https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
    2. https://www.youtube.com/watch?v=_C77sBcAtSQ

</div>