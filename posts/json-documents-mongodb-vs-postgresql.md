---
{
    "title": "JSON Documents Performance, Storage and Search: MongoDB vs PostgreSQL",
    "slug": "json-documents-mongodb-vs-postgresql",
    "startedAt": "2026-01-29",
    "publishedAt": "2026-03-01",
    "excerpt": "Do we really need a dedicated and specialized JSON db? Funny because too short",
    "researchLog": [ 1, 1.5, 2.5, 1, 2.5, 1.5, 2.5, 1.5, 2.5, 2, 2.5, 1.5, 2.5, 0.45, 0.5, 1.5, 1.5, 0.5, 1 ],
    "writingLog": [ 2.5, 2, 1, 0.5, 2, 0.5, 1, 1.5, 3, 3, 2, 1.5, 1, 1, 1.5, 2.5, 2, 2.5 ],
    "tags": [ "dbs", "performance" ]
}
---

## Collections of Documents vs Tables of Rows

*Collections of Documents* is an alternative approach of organizing data in databases. The most widespread and battle-proven way is the relational, SQL way - *Tables of Rows*. What is the difference?

In SQL, we have tables containing individual rows. Tables have strict schemas that every row must obey; there are columns with types and other possible constraints: *unique, not null, value checks or references to rows of other tables*. Referential integrity lies at the heart of this data approach - guarantee that if row B1 of table B references row A1 of table A, referred row (A1) must exist; orphan rows are not allowed. If we want to delete A1 row, there are two options:
* delete B1 first so that A1 is not referenced anywhere
* have A1 delete *cascade* to B1, automatically deleting it as well

*Tables of Rows* in SQL are therefore focused on explicit schema, enforced types, constraints, validation and relationships between tables - openly defined and carefully guarded.

*Collections of Documents* on the other hand, offer a much more relaxed approach. *Collections* are just namespaces where we insert *documents*. Documents are objects of any schema and format; but in practice, it almost always is JSON. There are no enforced types, no constraints, no guarded references between documents in different collections. In the same collection, we might have documents of completely different schema - flexibility and openness to any data and column types rules here. *In tables*, rows have columns of simple, scalar types (mostly) - numbers, ids, strings, dates, timestamps and so on. *In collections*, documents have fields comprising both simple and composite types like arrays and other documents, nested inside. Same field in different documents, but still of the same collection, might have different types as well - almost anything is allowed here.

Why all this context, when our main goal is simply to compare the level of JSON documents support in Mongo, the Documenter, to Postgres, the Elephant?

Well, **MongoDB was designed and created as a document database first and foremost**, not an SQL one (NoSQL). It is focused and optimized for this particular use case and a way of storing and accessing data. **PostgreSQL on the other hand, is a relational, SQL database that later on added support for composite column types like JSON/JSONB, ARRAY and others.** Over the years, it has extended and optimized storing JSON documents in its own binary JSONB format, as well as added more ways to index, query and modify data of this type.

Let's then dive in and see for *JSON Documents Performance, Storage and Search:*
> Does MongoDB still have an edge as a document-oriented database for JSON in particular? Or is Postgres better? Or at least good-enough to stick with it, since it is a more universal database, offering a richer feature set and wider applicability?

## Performance

*For numbers-first audience, [the summarized results are here](#performance-results-summary).*

### Setup {#performance-setup}

[The whole tests setup can be found in the GitHub repository.](https://github.com/BinaryIgor/code-examples/tree/mongodb-vs-postgres/mongodb-vs-postgresql)

To test performance from multiple angles, we will operate on two different collections with the following schema:
```
record Account(UUID id,
               String name,
               String type,
               List<String> owners,
               Instant createdAt,
               Instant updatedAt,
               long version) {}

record Product(UUID id,
               String name,
               String description,
               List<String> categories,
               List<String> tags,
               List<Variation> variations,
               List<UUID> relatedProducts,
               Instant createdAt,
               Instant updatedAt,
               long version) {
  
  record Variation(String type, String value) {}
}
```

They are defined in both databases as:
```
// MongoDB

db.createCollection("accounts");
// _id field is always indexed by default;
// 1 means ascending order
db.accounts.createIndex(
  { createdAt: 1 },
  { name: "accounts_created_at_idx"}
);
db.accounts.createIndex(
  { owners: 1 },
  { name: "accounts_owners_idx"}
);

db.createCollection("products");
db.products.createIndex(
  { name: 1 },
  { 
    name: "products_name_unique_idx",
    unique: true
  }
);
db.products.createIndex(
  { categories: 1 },
  { name: "products_categories_idx" }
);
db.products.createIndex(
  { tags: 1 },
  { name: "products_tags_idx" }  
);
db.products.createIndex(
  { createdAt: 1 },
  { name: "products_created_at_idx" }
);


// PostgreSQL

CREATE TABLE accounts (data JSONB NOT NULL);
CREATE UNIQUE INDEX accounts_id
  ON accounts ((data->>'id'));
CREATE INDEX accounts_created_at_idx
  ON accounts ((data->>'createdAt'));
CREATE INDEX accounts_owners_idx
  ON accounts USING GIN ((data->'owners'));

CREATE TABLE products (data JSONB NOT NULL);
CREATE UNIQUE INDEX products_id 
  ON products ((data->>'id'));
CREATE UNIQUE INDEX products_name_unique_idx
  ON products ((data->>'name'));
CREATE INDEX products_categories_idx
  ON products USING GIN ((data->'categories'));
CREATE INDEX products_tags_idx
  ON products USING GIN ((data->'tags'));
CREATE INDEX products_created_at_idx
  ON products ((data->>'createdAt'));
```

Documents of *products* collection are intentionally designed to be more complex and larger than *accounts* - I want to see what happens, what is the performance penalty mainly, once individual documents are stored on multiple database pages. [In Postgres, page size is 8 KB](https://www.postgresql.org/docs/current/storage-page-layout.html) by default - in practice, [the goal is to have at least 4 rows stored on a single page](https://www.postgresql.org/docs/current/storage-toast.html#STORAGE-TOAST-ONDISK), so every record that is larger than 2 KB is put on two or more disk pages. It obviously reduces performance for both writes & reads - more disk pages to be read from and write to. In Mongo it works slightly differently in details, but essentially in the same vein - larger documents are stored on more than one page, degrading performance for all operations. In both cases we are about to see - how much exactly.

Other than that, there are a few indexes we are going to utilize in the test queries. We could also see some of the Postgres JSON access operators in the index definitions:
* `ON products ((data->>'id'))` - extracts value by 'id' key as text; classic B-tree index on a single column is created here
* `ON products USING GIN ((data->'tags'))` - extracts value by 'tags' key as JSON(B) and uses [GIN](https://www.postgresql.org/docs/current/gin.html) to index it, since it is a composite type; it allows using various containment and existence operators for this particular part of the JSON document

Since Mongo is schemaless, there is no need to specify schema, only collections must be created. Same for indexes - these are just classic (B-tree) indexes that work on any field type.

For results to be reproducible and to have better control over resource utilization, both databases and tests run in Docker. [MongoDB, version 7.0.29, has the following config:](https://github.com/BinaryIgor/code-examples/blob/mongodb-vs-postgres/mongodb-vs-postgresql/build_and_run_mongodb.bash)
```
docker run -d --network host -v "${volume_dir}:/data/db" \
  -e "MONGO_INITDB_DATABASE=json" \
  -e "MONGO_INITDB_ROOT_USERNAME=json" \
  -e "MONGO_INITDB_ROOT_PASSWORD=json" \
  --memory "16G" --cpus "8" \
  --name $container_name $container_name \
  --wiredTigerCacheSizeGB 12
```
Two important customizations:
* memory and cpus - capped at 16G and 8 respectively
* `wiredTigerCacheSizeGB` - larger than default value to have higher cache use

[PosgreSQL, version 18.1, has the following config:](https://github.com/BinaryIgor/code-examples/blob/mongodb-vs-postgres/mongodb-vs-postgresql/build_and_run_postgresql.bash)
```
docker run -d --network host -v "${volume_dir}:/var/lib/postgresql" \
  -e "POSTGRES_DB=json" \
  -e "POSTGRES_USER=json" \
  -e "POSTGRES_PASSWORD=json" \
  --memory "16G" --cpus "8" --shm-size="1G" \
  --name $container_name $container_name \
  -c shared_buffers=4GB \
  -c work_mem=128MB \
  -c effective_cache_size=12GB
```
Likewise, a few important tweaks:
* `shared_buffers` - very similar to Mongo `wiredTigerCacheSizeGB`; smaller value since Postgres makes heavy use of the OS page cache
* `work_mem` - increased maximum memory used (per query operation) for internal sort operations and hash tables, which are used internally for some joins and aggregations
* `effective_cache_size` - increased parameter used by the query planner to estimate the total amount of memory available for caching data

Simarly as we did in the [MySQL vs PostgreSQL Performance](mysql-vs-postgresql-performance.html) comparison, the goal of these customizations is not to have the absolute best configuration possible, but to optimize DBs a bit; getting the most of their performance, not chasing the last few percent bits.

Likewise in the linked above article, there is the [JsonDbsPerformanceTests.java](https://github.com/BinaryIgor/code-examples/blob/mongodb-vs-postgres/mongodb-vs-postgresql/tests/src/main/java/JsonDbsPerformanceTests.java) tests runner - executing various tests on two databases and outputting detailed stats. For simpler management, it is built and runs in Docker as well (Java 25 & Maven). Configuring it and choosing from multiple available test cases (17) is made easier by the simple [run_test.py](https://github.com/BinaryIgor/code-examples/blob/mongodb-vs-postgres/mongodb-vs-postgresql/run_test.py) python script.

Since DBs have 8 CPUs available, connection pool sizes are: `8 * 32 = 256` for Mongo and `8 * 8 = 64` for Postgres. Empirically, MongoDB benefits from having much more connections, yielding better results; especially for write-heavy workloads.

The test cases are designed to run in a few rounds - executing set `QUERIES_RATE` per second (QPS) for the configured `QUERIES_TO_EXECUTE` in total. Depending on the specific scenario, these numbers range from a few hundreds per second to tens (& hundreds) of thousands; in most cases, `QUERIES_TO_EXECUTE = 10 * QUERIES_RATE`.

To run tests (locally), there are a few scripts that spin up MongoDB and PostgreSQL instances in Docker and build and run `JsonDbsPerformanceTests.java` in Docker as well, with the chosen test case & DB. It all comes down to executing:
```
# builds and runs MongoDB in Docker
./build_and_run_mongodb.bash

# builds and runs PostgreSQL in Docker
./build_and_run_postgresql.bash

# builds, without running just yet, performance tests in Docker
./build_performance_tests.bash

# runs performance tests in Docker, with the chosen test case & DB
./run_test.py
```

### Environment {#performance-environment}

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

### Results {#performance-results}

[All test results are also available in the GitHub repository.](https://github.com/BinaryIgor/code-examples/tree/mongodb-vs-postgres/mongodb-vs-postgresql/results/local)

We start with both DBs running in Docker and being empty here - only tables, collections and related indexes are created initially. In some results, we are going to see:
```
Total test duration: PT12.252S
Queries duration: PT11.424S
```
These times might sometimes differ substantially - it is because for some test cases, there is a need to fetch existing data from DB in order to construct test queries. Duration of these additional queries is subtracted from the total test duration: `Queries duration = Total test duration - Additional queries duration`. Otherwise they would skew results, adding time where it should not be counted. 

As said, we will run lots of cases, testing all kinds of queries and workloads. When executing `python3 run_test.py`, the following options are available:
1. [INSERT ACCOUNTS](#performance-results-inserts)
2. INSERT PRODUCTS
3. BATCH INSERT ACCOUNTS
4. BATCH INSERT PRODUCTS
5. [UPDATE ACCOUNTS](#performance-results-updates)
6. UPDATE PRODUCTS
7. [FIND ACCOUNTS BY ID](#performance-results-finds)
8. FIND PRODUCTS BY ID 
9. FIND SORTED BY CREATED AT ACCOUNTS PAGES
10. FIND ACCOUNTS BY OWNERS
11. FIND PRODUCTS BY TAGS
12. FIND ACCOUNTS STATS BY IDS
13. FIND PRODUCTS STATS BY IDS
14. [INSERT_UPDATE_DELETE_FIND_ACCOUNTS](#performance-results-inserts-updates-deletes-and-finds)
15. [DELETE ACCOUNTS](#performance-results-deletes)
16. DELETE PRODUCTS
17. BATCH DELETE ACCOUNTS

Let's then finally run the tests and inspect results!

{{ .js: newsletterSignUpPostMid() }}

### Inserts {#performance-results-inserts}

**INSERT ACCOUNTS** - inserts `200 000` accounts with `20 000 QPS` (queries per second) rate wanted, one by one:
```
MongoDB | PostgreSQL

Total test duration: PT11.326S | PT11.512S

Executed queries: 200000

Wanted queries rate: 20000/s 
Actual queries rate: 17658/s | 17373/s

Min: 1.206 ms | 1.018 ms
Max: 1620.545 ms | 1924.37 ms
Mean: 64.099 ms | 86.265 ms

Percentile 50 (Median): 10.307 ms | 2.525 ms
Percentile 90: 73.587 ms | 43.005 ms
Percentile 99: 974.379 ms | 976.375 ms
Percentile 99.9: 1272.245 ms | 1661.927 ms
```
Interestingly, very similar results; also, both databases have a significant slow down at around 99th percentile.

**INSERT PRODUCTS** - inserts `25 000` products - larger documents of a few KB each - with `2500 QPS` rate target:
```
MongoDB | PostgreSQL

Total test duration: PT11.515S | PT11.296S

Executed queries: 25000

Wanted queries rate: 2500/s
Actual queries rate: 2171/s | 2213/s

Min: 1.453 ms | 1.038 ms
Max: 93.472 ms | 112.32 ms
Mean: 8.979 ms | 2.822 ms

Percentile 50 (Median): 8.429 ms | 2.167 ms
Percentile 90: 10.675 ms | 2.773 ms
Percentile 99: 32.724 ms | 26.417 ms
Percentile 99.9: 48.212 ms | 42.731 ms
```
Expectedly, two DBs are significantly worse at inserting larger documents, but performance is again very close - slight edge for Postgres with *2213 inserts per second* vs *2171* for Mongo.

**BATCH INSERT ACCOUNTS** - inserts `1 500 000` accounts in batches of `1000`, with the goal of reaching `150 QPS` (yes, trying to insert *150 000* docs/rows per second!):
```
MongoDB | PostgreSQL

Total test duration: PT13.008S | PT18.453S

Executed queries: 1500

Wanted queries rate: 150/s
Actual queries rate: 115/s | 81/s

Min: 26.118 ms | 18.808 ms
Max: 200.74 ms | 2191.205 ms
Mean: 46.766 ms | 123.828 ms

Percentile 50 (Median): 37.443 ms | 32.68 ms
Percentile 90: 85.936 ms | 613.625 ms
Percentile 99: 127.184 ms | 821.431 ms
Percentile 99.9: 170.928 ms | 1182.59 ms
```
That was too much, but they still managed to handle over/close to *100 000 docs/rows inserts per second* in a batch mode. MongoDB decisively wins here with *115 batch inserts/s* vs *81 batch inserts/s* for PostgreSQL; latency (queries duration) difference is even more pronounced - *46.766 ms* vs *23.828 ms* by mean and *127.184 ms* vs *821.431 ms* by 99th percentile (the lower the better).

**BATCH INSERT PRODUCTS** - inserts `100 000` products (larger documents) in batches of `100`, wanting to reach `100 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT45.815S | PT47.12S

Executed queries: 1000

Wanted queries rate: 100/s
Actual queries rate: 22/s | 21/s

Min: 9.568 ms | 6.841 ms
Max: 69.446 ms | 104.581 ms
Mean: 13.832 ms | 11.001 ms

Percentile 50 (Median): 12.683 ms | 9.785 ms
Percentile 90: 18.307 ms | 11.829 ms
Percentile 99: 29.752 ms | 24.3 ms
Percentile 99.9: 69.446 ms | 104.581 ms
```
Too much for both databases again; *22 QPS* vs *21 QPS* throughput win for the Documenter, but lower latency by mean and by 99th percentile for the Elephant, so overall, I would classify it as a draw. 

**Summing inserts up, excluding one batch insert case for smaller documents, where MongoDB clearly wins, both data engines deliver very similar performance.**

I have run some inserts multiple times, so each database is now storing:
* `3 400 000` accounts
* `150 000` products

### Updates {#performance-results-updates}

**UPDATE ACCOUNTS** - updates accounts by id, with the wanted rate of `20 000 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT11.142S | PT13.541S
Queries duration: PT10.633S | PT13.186S

Executed queries: 200000

Wanted queries rate: 20000/s
Actual queries rate: 18809/s | 15168/s

Min: 1.448 ms | 1.158 ms
Max: 1238.686 ms | 1790.966 ms
Mean: 48.649 ms | 151.819 ms

Percentile 50 (Median): 14.928 ms | 96.272 ms
Percentile 90: 124.824 ms | 196.064 ms
Percentile 99: 463.375 ms | 927.956 ms
Percentile 99.9: 799.631 ms | 1386.049 ms
```
Right at the edge of both contenders' capabilities. Mongo wins here with *18 809 QPS* vs *15 168 QPS* throughput (1.24x better) and significantly lower latency.

**UPDATE PRODUCTS** - updates products (larger documents) by id, with `2500 QPS` target:
```
MongoDB | PostgreSQL

Total test duration: PT11.474S | PT11.313S
Queries duration: PT11.105S | PT10.788S

Executed queries: 25000

Wanted queries rate: 2500/s
Actual queries rate: 2251/s | 2317/s

Min: 1.6 ms | 1.084 ms
Max: 97.723 ms | 107.6 ms
Mean: 8.637 ms | 2.761 ms

Percentile 50 (Median): 8.598 ms | 2.308 ms
Percentile 90: 10.753 ms | 3.007 ms
Percentile 99: 12.624 ms | 7.164 ms
Percentile 99.9: 18.32 ms | 86.801 ms
```
Similar to the previous case, pushing both DBs to their limits, but now Postgres wins slightly - *2196 QPS* vs *2162 QPS* throughput and lower latency (mean, 99th percentile).

**For updates, both contestants perform at nearly identical levels, with Mongo holding a small advantage.**

### Finds {#performance-results-finds}

*Finds in Mongo, Selects in Postgres - Finds sounds like a more universal name; that is why I use it here.*

**FIND ACCOUNTS BY ID** - finds accounts by id at wanted `40 000 QPS` rate:
```
MongoDB | PostgreSQL

Total test duration: PT11.626S | PT11.937S
Queries duration: PT10.553S | PT11.097S

Executed queries: 400000

Wanted queries rate: 40000/s
Actual queries rate: 37904/s | 36046/s

Min: 0.082 ms | 0.056 ms
Max: 860.803 ms | 668.009 ms
Mean: 18.897 ms | 6.376 ms

Percentile 50 (Median): 0.16 ms | 0.108 ms
Percentile 90: 2.552 ms | 1.056 ms
Percentile 99: 539.072 ms | 160.208 ms
Percentile 99.9: 698.61 ms | 287.825 ms
```
Looking at latency, I think they both might operate below their true limits; let's then push both fellows further with `60 000 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT10.588S | PT9.616S
Queries duration: PT9.64S | PT9.135S

Executed queries: 400000

Wanted queries rate: 60000/s
Actual queries rate: 41494/s | 43788/s

Min: 0.079 ms | 0.058 ms
Max: 1584.393 ms | 1208.767 ms
Mean: 61.555 ms | 29.407 ms

Percentile 50 (Median): 0.317 ms | 0.164 ms
Percentile 90: 12.242 ms | 58.533 ms
Percentile 99: 1130.482 ms | 470.449 ms
Percentile 99.9: 1300.104 ms | 764.411 ms
```
The Elephant wins with *43 788 QPS* vs *41 494 QPS* throughput and with lower latency: *2.09x by mean and 2.4x by 99th percentile*.

**FIND PRODUCTS BY ID** - finds products (larger documents) by id, likewise with `40 000 QPS` goal:
```
MongoDB | PostgreSQL

Total test duration: PT12.107S | PT12.116S
Queries duration: PT10.817S | PT10.55S

Executed queries: 400000

Wanted queries rate: 40000/s
Actual queries rate: 36979/s | 37915/s

Min: 0.083 ms | 0.07 ms
Max: 1751.734 ms | 639.942 ms
Mean: 57.321 ms | 5.551 ms

Percentile 50 (Median): 0.164 ms | 0.135 ms
Percentile 90: 3.903 ms | 1.709 ms
Percentile 99: 1189.905 ms | 166.951 ms
Percentile 99.9: 1436.982 ms | 244.864 ms
```
Definitely a victory for Postgres, especially latency-wise. But, both DBs might have something left in the tank; rerunning the case with `60 000 QPS` rate wanted:
```
MongoDB | PostgreSQL

Total test duration: PT11.115S | PT10.106S
Queries duration: PT10.442S | PT9.061S

Executed queries: 400000

Wanted queries rate: 60000/s
Actual queries rate: 38307/s | 44145/s

Min: 0.079 ms | 0.069 ms
Max: 2886.389 ms | 1521.541 ms
Mean: 184.456 ms | 65.316 ms

Percentile 50 (Median): 0.908 ms | 0.281 ms
Percentile 90: 763.217 ms | 255.702 ms
Percentile 99: 2245.056 ms | 734.9 ms
Percentile 99.9: 2579.633 ms | 1028.803 ms
```
*38 307 QPS* for MongoDB vs *44 145 QPS* for PostgreSQL - the clear winner here.

**FIND SORTED BY CREATED AT ACCOUNTS PAGES** - with the target of `3000 QPS`, finds accounts sorted by created at sometimes with ascending, sometimes with the descending order (randomly); results are limited to a random number from 10 to 100:
```
MongoDB | PostgreSQL

Total test duration: PT10.071S | PT10.596S
Queries duration: PT7.63S | PT10.537S

Executed queries: 30000

Wanted queries rate: 3000/s
Actual queries rate: 3932/s | 2847/s

Min: 0.151 ms | 0.146 ms
Max: 116.564 ms | 1401.385 ms
Mean: 1.035 ms | 57.895 ms

Percentile 50 (Median): 0.597 ms | 2.13 ms
Percentile 90: 0.923 ms | 32.678 ms
Percentile 99: 6.051 ms | 605.256 ms
Percentile 99.9: 82.968 ms | 1124.971 ms
```
Surprisingly, an apparent win for Mongo, but let's give a second chance to both. Running the case again with `24 000 QPS` for the Documenter and `6000 QPS` for the Elephant:
```
MongoDB | PostgreSQL

Total test duration: PT14.209S | PT12.378S
Queries duration: PT11.904S | PT12.327S

Executed queries: 240000 | 60000

Wanted queries rate: 24000/s | 6000/s
Actual queries rate: 20161/s | 4867/s

Min: 0.192 ms | 0.365 ms
Max: 1070.532 ms | 1899.2 ms
Mean: 123.516 ms | 134.477 ms

Percentile 50 (Median): 93.149 ms | 53.954 ms
Percentile 90: 274.824 ms | 313.341 ms
Percentile 99: 553.026 ms | 928.217 ms
Percentile 99.9: 849.926 ms | 1549.755 ms
```
In this particular case, a complete victory for MongoDB - *20 161 QPS* vs *4867 QPS*, 4.14x better; latency is lower as well.

**FIND ACCOUNTS BY OWNERS** - finds accounts, limited to 25 results, of 1 to 5 owners, with the goal of `30 000 QPS`:
```
MongoDB | PostgreSQL 

Total test duration: PT13.026S | PT11.179S

Executed queries: 300000

Wanted queries rate: 30000/s
Actual queries rate: 23031/s | 26836/s

Min: 0.126 ms | 0.07 ms
Max: 1505.946 ms | 681.393 ms
Mean: 20.122 ms | 7.626 ms

Percentile 50 (Median): 0.741 ms | 0.116 ms
Percentile 90: 65.087 ms | 0.434 ms
Percentile 99: 228.76 ms | 123.967 ms
Percentile 99.9: 877.204 ms | 257.54 ms
```
We have a clear favorite here, but let's repeat the case with `40 000 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT13.559S | PT9.994S

Executed queries: 300000

Wanted queries rate: 40000/s
Actual queries rate: 22126/s | 30018/s

Min: 0.128 ms | 0.069 ms
Max: 1386.063 ms | 1216.229 ms
Mean: 160.924 ms | 31.348 ms

Percentile 50 (Median): 75.571 ms | 0.138 ms
Percentile 90: 413.054 ms | 112.331 ms
Percentile 99: 740.514 ms | 491.419 ms
Percentile 99.9: 1063.343 ms | 758.211 ms
```
A decisive victory for the Elephant - *30 018 QPS* vs *22 126 QPS* throughput, 1.36x better; it also delivers significantly lower latency.

**FIND PRODUCTS BY TAGS** - finds products, limited to 50 results, of 1 to 5 tags, with `1000 QPS` rate wanted:
```
MongoDB | PostgreSQL

Total test duration: PT10.066S | PT10.077S

Executed queries: 10000

Wanted queries rate: 1000/s
Actual queries rate: 993/s | 992/s

Min: 0.319 ms | 0.885 ms
Max: 437.609 ms | 763.869 ms
Mean: 5.525 ms | 24.63 ms

Percentile 50 (Median): 1.012 ms | 1.879 ms
Percentile 90: 1.92 ms | 8.907 ms
Percentile 99: 181.826 ms | 323.391 ms
Percentile 99.9: 365.82 ms | 571.294 ms
```
Both contenders seem to operate below their true limits, but looking at latency, the Documenter has more steam left. Let's rerun the case with `8000 QPS` for it and `4000 QPS` for Postgres:
```
MongoDB | PostgreSQL

Total test duration: PT11.158S | PT11.039S

Executed queries: 80000 | 40000

Wanted queries rate: 8000/s | 4000/s
Actual queries rate: 7170/s | 3624/s

Min: 0.268 ms | 1.082 ms
Max: 1921.263 ms | 1575.999 ms
Mean: 75.814 ms | 72.144 ms

Percentile 50 (Median): 0.528 ms | 3.713 ms
Percentile 90: 10.157 ms | 117.396 ms
Percentile 99: 1327.46 ms | 729.601 ms
Percentile 99.9: 1656.59 ms | 1242.524 ms
```
Interesting! *FIND ACCOUNTS BY OWNERS* case is pretty much the same and the Elephant has won there - except the fact that documents of *accounts* are much smaller than of *products*. The delivered throghput performance difference is substantial - *7170 QPS* vs only *3624 QPS*, 1.98x win for MongoDB, but with lower latency for Postgres.

**FIND ACCOUNTS STATS BY ID** - finds accounts by ids, in batches of `100`, computing various stats per account type: their number, min/max `createdAt` and min/max `owners` array size. The target rate is `7500 QPS`: 
```
MongoDB | PostgreSQL

Total test duration: PT13.064S | PT10.93S
Queries duration: PT12.038S | PT10.096S

Executed queries: 75000

Wanted queries rate: 7500/s
Actual queries rate: 6230/s | 7429/s

Min: 0.859 ms | 0.649 ms
Max: 965.623 ms | 1095.93 ms
Mean: 152.475 ms | 40.914 ms

Percentile 50 (Median): 139.692 ms | 0.974 ms
Percentile 90: 294.892 ms | 196.099 ms
Percentile 99: 533.831 ms | 394.55 ms
Percentile 99.9: 714.487 ms | 645.512 ms
```
The Elephant is the clear winner here - *7429 QPS* vs *6230 QPS*, lower latency as well.

**FIND PRODUCTS STATS BY IDS** - finds products by ids, in batches of `100`, computing various stats per each product tag: number of products, min/max `createdAt` and min/max `variations` array size. With the wanted rate of `1000 QPS`: 
```
MongoDB | PostgreSQL

Total test duration: PT10.049S | PT10.437S
Queries duration: PT9.334S | PT9.262S

Executed queries: 10000

Wanted queries rate: 1000/s
Actual queries rate: 1071/s | 1080/s

Min: 0.85 ms | 3.628 ms
Max: 35.354 ms | 356.408 ms
Mean: 1.61 ms | 25.621 ms

Percentile 50 (Median): 1.422 ms | 6.238 ms
Percentile 90: 2.169 ms | 94.701 ms
Percentile 99: 4.68 ms | 199.918 ms
Percentile 99.9: 24.515 ms | 281.499 ms
```
Looking at latency, MongoDB is most likely operating below its full capacity; running this case again for it with `4000 QPS`:
```
MongoDB

Total test duration: PT10.156S
Queries duration: PT9.509S

Executed queries: 40000

Wanted queries rate: 4000/s
Actual queries rate: 4207/s

Min: 0.846 ms
Max: 296.623 ms
Mean: 5.653 ms

Percentile 50 (Median): 1.228 ms
Percentile 90: 6.088 ms
Percentile 99: 96.754 ms
Percentile 99.9: 215.831 ms
```
A complete victory for the Documenter - *4207 QPS* vs *1080 QPS*, 3.9x better.

**Summing finds up:**
* Postgres is better at single-document finds by id
* Mongo dominates in sorted finds of multiple documents (paging case)
* likewise, the Documenter is superior for finding multiple large documents by an array field; in an analogous case but with smaller documents, the Elephant wins, interestingly
* for calculating various collection stats by batches of ids, Mongo outcompetes Postgres on larger documents, but loses on smaller ones

### Inserts, Updates, Deletes and Finds {#performance-results-inserts-updates-deletes-and-finds}

**INSERT UPDATE DELETE FIND ACCOUNTS** - inserts, updates, deletes and finds accounts in 1:1 reads:writes proportion. What it means is that for every 3 finds by id, there is 1 account insert, 1 account update and 1 account delete by id executed, on average. We are testing mixed workloads here, simultaneous reads & writes; running it with the wanted rate of `30 000 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT11.683S | PT12.252S
Queries duration: PT10.524S | PT11.424S

Executed queries: 300000
  insert-account: 49803 | 50228
  update-account: 50151 | 49836
  delete-account: 50133 | 49791
  find-account-by-id: 149913 | 150145

Wanted queries rate: 30000/s
Actual queries rate: 28506/s | 26261/s

Min: 0.089 ms | 0.04 ms
Max: 906.325 ms | 2070.305 ms
Mean: 29.913 ms | 88.601 ms

Percentile 50 (Median): 8.495 ms | 2.036 ms
Percentile 90: 66.095 ms | 413.058 ms
Percentile 99: 512.646 ms | 935.301 ms
Percentile 99.9: 771.401 ms | 1463.363 ms
```
Mongo takes the lead, but both contestants might have some steam left; rerunning the case with `40 000 QPS` this time:
```
MongoDB | PostgreSQL

Total test duration: PT10.711S | PT10.229S
Queries duration: PT9.35S | PT9.399S

Executed queries: 300000
  insert-account: 49910 | 49998
  update-account: 50210 | 50437
  delete-account: 50255 | 50275
  find-account-by-id: 149625 | 149290

Wanted queries rate: 40000/s
Actual queries rate: 32086/s | 31918/s

Min: 0.09 ms | 0.044 ms
Max: 1414.122 ms | 1962.967 ms
Mean: 125.283 ms | 130.354 ms

Percentile 50 (Median): 35.636 ms | 3.827 ms
Percentile 90: 354.192 ms | 585.563 ms
Percentile 99: 938.663 ms | 1040.725 ms
Percentile 99.9: 1272.867 ms | 1668.685 ms
``` 
In the end, **pretty much identical throughput - *32 086 QPS* vs *31 918 QPS* - but lower latency at higher percentiles for the Documenter**.

### Deletes {#performance-results-deletes}

**DELETE ACCOUNTS** - deletes accounts by id with the wanted rate of `25 000 QPS`:
```
MongoDB | PostgreSQL

Total test duration: PT12.919S | PT11.678S
Queries duration: PT11.764S | PT10.797S

Executed queries: 250000

Wanted queries rate: 25000/s
Actual queries rate: 21251/s | 23155/s

Min: 2.179 ms | 1.11 ms
Max: 1510.269 ms | 1265.217 ms
Mean: 136.414 ms | 65.286 ms

Percentile 50 (Median): 96.998 ms | 26.398 ms
Percentile 90: 340.282 ms | 110.817 ms
Percentile 99: 767.814 ms | 542.013 ms
Percentile 99.9: 1116.276 ms | 942.41 ms
```
A slight win for the Elephant - *23 155 QPS* vs *21 251 QPS* and lower latency.

**DELETE PRODUCTS** - deletes products (larger documents) by id with `15 000 QPS` target:
```
MongoDB | PostgreSQL

Total test duration: PT10.518S | PT10.638S
Queries duration: PT9.944S | PT9.268S

Executed queries: 150000

Wanted queries rate: 15000/s
Actual queries rate: 15084/s | 16185/s

Min: 1.208 ms | 0.122 ms
Max: 1078.079 ms | 290.874 ms
Mean: 32.692 ms | 10.984 ms

Percentile 50 (Median): 9.945 ms | 2.899 ms
Percentile 90: 55.189 ms | 30.358 ms
Percentile 99: 399.247 ms | 110.746 ms
Percentile 99.9: 750.858 ms | 179.065 ms
```
Another win for Postgres! *16 185 QPS* vs *15 084 QPS* and significantly lower latency.

**BATCH DELETE ACCOUNTS** - deletes accounts by id in batches of `1000`, with the target rate of `300 QPS` (yes, trying to delete 300 000 docs/rows per second!):
```
MongoDB | PostgreSQL

Total test duration: PT15.741S | PT13.984S
Queries duration: PT10.406S | PT9.176S

Executed queries: 3000

Wanted queries rate: 300/s
Actual queries rate: 288/s | 327/s

Min: 28.378 ms | 7.942 ms
Max: 1104.706 ms | 843.966 ms
Mean: 290.426 ms | 297.152 ms

Percentile 50 (Median): 220.576 ms | 287.901 ms
Percentile 90: 665.305 ms | 561.086 ms
Percentile 99: 948.124 ms | 741.473 ms
Percentile 99.9: 1093.575 ms | 811.092 ms
```
The Elephant wins here as well with *327 deletes/s of 1000 records* vs *288* for the Documenter.

**Postgres wins all delete cases.**

### Results summary {#performance-results-summary}

That was a fierce competition! **For the 17 executed test cases in total, Mongo won in 7, Postgres in 9 and there was 1 draw.** So looking solely through this lens, the Elephant has won 9 to 7. Using *QPS (queries per second)* to measure throughput (the higher the better), *mean & 99th percentile* for latency (the lower the better), here is a summary of the results:

1. **Inserts - single documents into the accounts collection**
    * Mongo - `17 658 QPS`; Mean: 64.099 ms, Percentile 99: 974.379 ms
    * Postgres - `17 373 QPS`; Mean: 86.265 ms, Percentile 99: 976.375 ms
    * *Mongo wins with 1.016x (1.6%) higher throughput, latency lower 1.35x by mean and 1.002x (barely anything) by 99th percentile*
2. **Inserts - single documents into the products collection**
    * Mongo - `2171 QPS`; Mean: 8.979 ms, Percentile 99: 32.724 ms
    * Postgres - `2213 QPS`; Mean: 2.822 ms, Percentile 99: 26.417 ms
    * *Postgres wins with 1.019x (1.9%) higher throughput, latency lower 3.18x by mean and 1.24x by 99th percentile*
3.  **Inserts - batches of 1000 documents into the accounts collection**
    * Mongo - `115 QPS`; Mean: 46.766 ms, Percentile 99: 127.184 ms
    * Postgres - `81 QPS`; Mean: 123.828 ms, Percentile 99: 821.431 ms
    * *Mongo wins with 1.42x (42%) higher throughput, latency lower 2.65x by mean and 6.46x by 99th percentile*
4. **Inserts - batches of 100 documents into the products collection**
    * Mongo - `22 QPS`; Mean: 13.832 ms, Percentile 99: 29.752 ms
    * Postgres - `21 QPS`; Mean: 11.001 ms, Percentile 99: 24.3 ms
    * *Mongo wins on throughput, 1.048x (4.8%) higher, but loses on latency, which is lower 1.26x by mean and 1.22x by 99th percentile for Postgres - it is therefore a draw*
5. **Updates - accounts by id**
    * Mongo - `18 809 QPS`; Mean: 48.649 ms, Percentile 99: 463.375 ms
    * Postgres - `15 168 QPS`; Mean: 151.819 ms, Percentile 99: 927.956 ms
    * *Mongo wins with 1.24x (24%) higher throughput, latency lower 3.12x by mean and 2x by 99th percentile*
6. **Updates - products by id**
    * Mongo - `2251 QPS`; Mean: 8.637 ms, Percentile 99: 12.624 ms
    * Postgres - `2317 QPS`; Mean: 2.761 ms, Percentile 99: 7.164 ms
    * *Postgres wins with 1.029x (1.29%) higher throughput, latency lower 3.13x by mean and 1.76x by 99th percentile*
7. **Finds - accounts by id**
    * Mongo - `41 494 QPS`; Mean: 61.555 ms, Percentile 99: 1130.482 ms
    * Postgres - `43 788 QPS`; Mean: 29.407 ms, Percentile 99: 470.449 ms
    * *Postgres wins with 1.055x (5.5%) higher throughput, latency lower 2.09x by mean and 2.4x by 99th percentile*
8. **Finds - products by id**
    * Mongo - `38 307 QPS`; Mean: 184.456 ms, Percentile 99: 2245.056 ms
    * Postgres - `44 145 QPS`; Mean: 65.316 ms, Percentile 99: 734.9 ms
    * *Postgres wins with 1.15x (15%) higher throughput, latency lower 2.82x by mean and 3.05x by 99th percentile*
9. **Finds - sorted by createdAt pages of accounts, 10 to 100 in size**
    * Mongo - `20 161 QPS`; Mean: 123.516 ms, Percentile 99: 553.026 ms
    * Postgres - `4867 QPS`; Mean: 134.477 ms, Percentile 99: 928.217 ms
    * *Mongo wins with **4.14x (414%) higher throughput**, latency lower 1.09x by mean and 1.68x by 99th percentile*
10. **Finds - accounts by owners**
    * Mongo - `22 126 QPS`; Mean: 160.924 ms, Percentile 99: 740.514 ms
    * Postgres - `30 018 QPS`; Mean: 31.348 ms, Percentile 99: 491.419 ms
    * *Postgres wins with 1.36x (36%) higher throughput, latency lower 5.13x by mean and 1.5x by 99th percentile*
11. **Finds - products by tags**
    * Mongo - `7170 QPS`; Mean: 75.814 ms, Percentile 99: 1327.46 ms
    * Postgres - `3624 QPS`; Mean: 72.144 ms, Percentile 99: 729.601 ms
    * *Mongo wins with **1.97x (197%) higher throughput**, but latency is lower 1.05x by mean and 1.82x by 99th percentile for Postgres*
12. **Finds - stats of accounts by ids**
    * Mongo - `6230 QPS`; Mean: 152.475 ms, Percentile 99: 533.831 ms
    * Postgres - `7429 QPS`; Mean: 40.914 ms, Percentile 99: 394.55 ms
    * *Postgres wins with 1.19x (19%) higher throughput, latency lower 3.73x by mean and 1.35x by 99th percentile*
13. **Finds - stats of products by ids**
    * Mongo - `4207 QPS`; Mean: 5.653 ms, Percentile 99: 96.754 ms
    * Postgres - `1080 QPS`; Mean: 25.621 ms, Percentile 99: 199.918 ms
    * *Mongo wins with **3.9x (390%) higher throughput**, latency lower 4.53x by mean and 2.07x by 99th percentile*
14. **Inserts, Updates, Deletes and Finds - accounts by id, mixed in 1:1 writes:reads proportion**
    * Mongo - `32 086 QPS`; Mean: 125.283 ms, Percentile 99: 938.663 ms
    * Postgres - `31 918 QPS`; Mean: 130.354 ms, Percentile 99: 1040.725 ms
    * *Mongo wins with 1.005x (0.5%, barely anything) higher throughput, latency lower 1.04x by mean and 1.11 by 99th percentile*
15. **Deletes - accounts by ids**
    * Mongo - `21 251 QPS`; Mean: 136.414 ms, Percentile 99: 767.814 ms
    * Postgres - `23 155 QPS`; Mean: 65.286 ms, Percentile 99: 542.013 ms
    * *Postgres wins with 1.09x (9%) higher throughput, latency lower 2.089x by mean and 1.42x by 99th percentile*
16. **Deletes - products by ids**
    * Mongo - `15 084 QPS`; Mean: 32.692 ms, Percentile 99: 399.247 ms
    * Postgres - `16 185 QPS`; Mean: 10.984 ms, Percentile 99: 110.746 ms
    * *Postgres wins with 1.07x (7%) higher throughput, latency lower 2.98x by mean and 3.6x by 99th percentile*
17. **Deletes - accounts by ids in batches of 1000 documents**
    * Mongo - `288 QPS`; Mean: 290.426 ms, Percentile 99: 948.124 ms
    * Postgres - `327 QPS`; Mean: 297.152 ms, Percentile 99: 741.473 ms
    * *Postgres wins with 1.14x (14%) higher throughput, latency lower 1.02x by mean and 1.28x by 99th percentile*


## Storage and Search

Let's start with storage. How much space does the data take on each DB? *accounts*:
```
db.accounts.countDocuments();
3400000

SELECT COUNT(*) FROM accounts;
3400000

// MB
const stats = db.accounts.stats({
  scale: 1024 * 1024 
});

`${Math.round(stats.totalSize)} MB`;
710 MB

SELECT pg_size_pretty(
  pg_total_relation_size('accounts')
);
1584 MB

`${Math.round(stats.storageSize)} MB`;
383 MB

SELECT pg_size_pretty(
  pg_table_size('accounts')
);
1013 MB

`${Math.round(stats.totalIndexSize)} MB`;
327 MB

SELECT pg_size_pretty(
  pg_indexes_size('accounts')
);
571 MB
```
**Interestingly, total table/collection size - including indexes - is over 2x smaller on Mongo:** `1584 / 710 = 2.23`. Indexes are likewise smaller - not surprising, since [MongoDB compresses data of both collections and indexes by default](https://www.mongodb.com/docs/manual/core/wiredtiger/#compression). Let's take a peek at *products* as well:
```
db.products.countDocuments();
150000

SELECT COUNT(*) FROM products;
150000

// MB
const stats = db.products.stats({
  scale: 1024 * 1024
});

`${Math.round(stats.totalSize)} MB`;
494 MB

SELECT pg_size_pretty(
  pg_total_relation_size('products')
);
691 MB

`${Math.round(stats.storageSize)} MB`;
471 MB

SELECT pg_size_pretty(
  pg_table_size('products')
);
647 MB

`${Math.round(stats.totalIndexSize)} MB`;
23 MB

SELECT pg_size_pretty(
  pg_indexes_size('products')
);
44 MB
```
Smaller difference here, but still a notable one: `691 / 494 = 1.4` for table/collection and almost 2x for indexes.

**What about searching, queries and data manipulation in general?**

Since Mongo is a NoSQL database, it has its own JavaScript-like query language to work with data. As Postgres is an SQL database, it needed to adopt SQL to allow for working with JSON data - [it has its own rich set of JSON functions and operators](https://www.postgresql.org/docs/current/functions-json.html). Let's compare two contenders by going through lots of practical examples.

Basic searching:
```
// all data from accounts

db.accounts.find();

SELECT data FROM accounts;


// single result from accounts by id (_id in Mongo)
  
db.accounts.find({
  _id: UUID('6de08995-22c4-4455-9a7f-a225337247b0')
});

SELECT data FROM accounts
WHERE data->>'id' = '6de08995-22c4-4455-9a7f-a225337247b0';


// paging, with the ascending order

db.accounts
  .find()
  .sort({ createdAt: 1 })
  .limit(10)
  .skip(20);

SELECT data FROM accounts 
ORDER BY data->>'createdAt' 
LIMIT 10 OFFSET 20;


// all products containing any of given tags

db.products.find({ 
  tags: { 
    $in: ["new-arrival", "durable"] 
  } 
});

SELECT data FROM products
WHERE data->'tags' 
?| array['new-arrival', 'durable'];
```
Different syntax, same results. For somebody familiar with SQL, Postgres variation is probably easier to grasp, but Mongo's query language is quite intuitive as well - it is JavaScript-like afer all.

A few more advanced searches:
```
// all products containing "type": "SIZE" entry in variations

db.products.find({
  variations: {
    $elemMatch: { 
      type: "SIZE" 
    } 
  }
});

SELECT data FROM products
WHERE data->'variations' 
@> '[{ "type": "SIZE "}]';


// products with more than 2 variations

db.products.find({
  $expr: { 
    $gt: [ { $size: "$variations" }, 2 ] 
  }
});

SELECT data FROM products
WHERE jsonb_array_length(data->'variations') > 2;


// all accounts having 'ownersDetails' field

db.accounts.find({
  ownersDetails: {
    $exists: true
  }
});

SELECT data
FROM accounts
WHERE data ? 'operatorsDetails';
```

\
**What about indexes?**

In the Documenter, we might index both top and nested fields in the same vein:
```
db.products.createIndex(
  { createdAt: 1 },
  { name: "products_created_at_idx" }
);
db.products.createIndex(
  { 
    "variations.type": 1,
    "variations.value": 1 
  },
  { "name": "products_variations_type_value_idx"}
);
```
And it works for all types of queries: *equality, containment, range and so on*.

**For the Elephant, it is a bit more nuanced.**

Using [GIN Indexes](/index-a-crucial-data-structure-for-search-performance.html#index-types-by-structure-gin), it is possible to index the whole JSON document or some of its subtrees as:
```
CREATE INDEX products_data_idx
ON products USING GIN (data);

CREATE INDEX products_variations_idx
ON products USING GIN ((data->'variations'));
```
This kind of index supports equality and containment queries like:
```
// product of the name
SELECT * FROM products
WHERE data @> '{"name": "some product"}';

// products containing "type": "SIZE" variation
SELECT data FROM products
WHERE data->'variations' @> '[{ "type": "SIZE"}]';

// products having 'variationsDetails' field
SELECT data FROM products
WHERE data ? 'variationsDetails';
```
But, **range queries are not supported by GIN index; asking for all products with the SIZE variations having value in certain number range *will not* utilize the index**. In cases like this, it is necessary to move some fields out of JSON documents to seperate columns/tables and index them traditionally, using old and proven B-trees. In these instances, Mongo is more forgiving and flexible. It allows for strategies of the kind:
```
db.products.createIndex(
  {
    "variations.type": 1,
    "variations.value": 1 
  },
  { "name": "products_variations_type_value_idx" }
);

// all products with "SIZE" variations,
// with at least one value in the range of 4 - 8
db.products.find({
  variations: {
    $elemMatch: {
      type: "SIZE",
      value: { $gte: '4', $lte: '8' }
    }
  }
});
```
To get comparable, indexed performance out of Postgres, we would basically need to create & manage something like this:
```
CREATE TABLE products_variations (
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (type, value, product_id)
);

SELECT data FROM products
WHERE data->>'id' IN (
  SELECT product_id
  FROM products_variations 
  WHERE type = 'SIZE'
    AND value >= '4'
    AND value <= '8'
);
```
...or hack around storing min/max for variation value of type size + modify query accordingly.

So, it is definitely doable for the Elephant as well; but, we must partially leave document-oriented paradigm and step into the relational data model. The Documenter is more flexible here.

**What about modyfing data - inserts, updates and deletes?**

Inserts are just inserts; nothing particularly interesting:
```
// Parsing JSON, but JavaScript objects work as well
db.accounts.insertOne(JSON.parse(`{
  "_id": "7b0c3a06-7de7-4f44-963e-656a050fbff8",
  "name": "zhPvPpeEImVPiMrshbOHMH4egqaLIwVh5BxevT",
  "type": "PLATINUM",
  "owners": [
    "user-433327",
    "user-481845",
    "user-465036",
    "user-372160"
  ],
  "version": 1,
  "createdAt": "2026-02-21T03:19:41.810Z",
  "updatedAt": null
}`));

INSERT INTO accounts (data) VALUES ('{
  "id": "7b0c3a06-7de7-4f44-963e-656a050fbff8",
  "name": "zhPvPpeEImVPiMrshbOHMH4egqaLIwVh5BxevT",
  "type": "PLATINUM",
  "owners": [
    "user-433327",
    "user-481845",
    "user-465036",
    "user-372160"
  ],
  "version": 1,
  "createdAt": "2026-02-21T03:19:41.810Z",
  "updatedAt": null
}');
```
Same with deletes:
```
db.accounts.deleteOne({
  _id: '7b0c3a06-7de7-4f44-963e-656a050fbff8'
});

DELETE FROM accounts 
WHERE data->>'id' = '7b0c3a06-7de7-4f44-963e-656a050fbff8';
```

With updates, we may override the whole document content in the similar way as presented for inserts - **what about partial modifications of documents?**
```
db.accounts.updateOne(
  { _id: "7b0c3a06-7de7-4f44-963e-656a050fbff8" },
  { $set: { 
    "type": "GOLD",
    "updatedAt": "2026-02-24T19:46:41.810Z",
     "version": 2
  }}
);

UPDATE accounts
SET data = data || '{
  "type": "GOLD",
  "updatedAt": "2026-02-24T19:46:41.810Z",
  "version": 2
}'
WHERE data->>'id' = '7b0c3a06-7de7-4f44-963e-656a050fbff8';
```
This is of course *a logical illusion*; under the hood, no matter the database, no matter the update scope, the whole document/row is physically rewritten on the disk.

Summing it up, **both databases support robust querying, indexing and manipulating documents data, but the Documenter, as a document-first database, has an edge when it comes to flexibility**. If the data size is a concern, it also takes significantly less space - *up to 2.23 in our examples*.

## Conclusion

As we have seen, Postgres is more than able to rival Mongo when it comes to handling data of the JSON documents type.

[As far as performance is concerned](#performance-results-summary), the Elephant has won 9 to 7 with the Documenter, in our 17 test cases (there was 1 draw).

Yes, MongoDB is more flexible in some searches and in one particular indexing scenario - Postgres does not provide an index supporting range queries for arrays. But, it is not a common case by any means and there are workarounds.

**What is worth emphasizing on the other hand, is that PostgreSQL is a more generic database** - it is an SQL one, after all. It is [transactions- and ACID-native](/mysql-and-postgresql-different-approaches.html#acid): allowing us to flexibly mix document-oriented approach with a proven, relational model and SQL reliability.

Given these performance results, SQL universality and comprehensive support for JSON in Postgres, I would conclude by asking:
> Do we really need yet another query language and a dedicated, specialized database only for storing JSON documents?

I do not think so.

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Setup and tests source code, so you can experiment, run tests on your own and compare the results: https://github.com/BinaryIgor/code-examples/tree/mongodb-vs-postgres/mongodb-vs-postgresql
2. It is interesting to note, how a disctinction between Mongo's NoSQL and traditional SQL approach is becoming fuzzier and fuzzier. MongoDB has added [support for ACID transactions](https://www.mongodb.com/products/capabilities/transactions) and [schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/); Postgres support for composite types like [JSON/JSONB](https://www.postgresql.org/docs/current/datatype-json.html) and [ARRAY](https://www.postgresql.org/docs/current/arrays.html) is becoming better and better over time
3. JSON support in other SQL DBs:
    1. SQLite: https://sqlite.org/json1.html
    2. MySQL: https://dev.mysql.com/doc/refman/9.6/en/json.html
    3. MariaDB: https://mariadb.com/resources/blog/using-json-in-mariadb/
    4. MSSQL: https://learn.microsoft.com/en-us/sql/relational-databases/json/store-json-documents-in-sql-tables
    5. Oracle: https://docs.oracle.com/en/database/oracle/oracle-database/21/adjsn/json-in-oracle-database.html
4. JSON databases: https://www.mongodb.com/resources/basics/databases/json-database
5. Document-oriented databases: https://en.wikipedia.org/wiki/Document-oriented_database
6. Related benchmark: [MySQL vs PostgreSQL Performance](/mysql-vs-postgresql-performance.html)
7. Other Mongo vs Postgres comparisons:
    1. https://portavita.github.io/2018-10-31-blog_A_JSON_use_case_comparison_between_PostgreSQL_and_MongoDB/
    2. https://documentdatabase.org/blog/json-performance-postgres-vs-mongodb/
    3. https://www.bytebase.com/blog/postgres-vs-mongodb/
    4. https://www.youtube.com/watch?v=IYHeiQxwCVc
8. Mongo *write and read concerns*, akin to SQL transaction isolation levels: https://www.mongodb.com/docs/manual/core/causal-consistency-read-write-concerns/
9. In Mongo, when using w: 1 in a write concern, the write operation is acknowledged after it has been successfully applied to the primary's memory. However, w: 1 alone does not guarantee durability unless combined with j: true (journalling). Running standalone Mongo, as we did in tests, defaults to j: false. [I have explicitly set it to true in the testing script](https://github.com/BinaryIgor/code-examples/blob/646e65d397f4852cb358ea4c78fd7b89b5fa8b56/mongodb-vs-postgresql/tests/src/main/java/JsonDbsPerformanceTests.java#L268), to make write comparison to Postgres objective . You can dive deeper into this here: https://www.mongodb.com/docs/manual/reference/write-concern/#acknowledgment-behavior and here: https://www.mongodb.com/docs/manual/core/journaling/. Unfortunately, docs are a bit convoluted about it
10. MultiVersion Concurrency Control (MVCC) in Mongo: https://www.mongodb.com/docs/manual/core/wiredtiger/#snapshots-and-checkpoints
11. TOAST (The Oversized-Attribute Storage Technique) and storing larger columns and rows in Postgres:
    1. https://www.tigerdata.com/learn/handling-large-objects-in-postgres
    2. https://www.tigerdata.com/blog/what-is-toast-and-why-it-isnt-enough-for-data-compression-in-postgres
    3. https://www.crunchydata.com/blog/postgres-toast-the-greatest-thing-since-sliced-bread
    4. https://www.postgresql.org/docs/current/storage-toast.html
12. Postgres async commit that can be used in a similar way to Mongos' j: false. Significantly speeding up writes, at the risk of loosing most recent data modifications: https://www.postgresql.org/docs/current/wal-async-commit.html. There are Unlogged Tables as well, not written to the WAL: https://www.crunchydata.com/blog/postgresl-unlogged-tables
13. Deep dive into indexes: [Index: a crucial data structure for search performance](/index-a-crucial-data-structure-for-search-performance.html)
14. Data compression in Mongo, enabled by default: https://www.mongodb.com/docs/manual/core/wiredtiger/#compression

</div>