---
{
    "title": "MySQL and PostgreSQL: different approaches to solve the same problem",
    "slug": "mysql-and-postgresql-different-approaches",
    "startedAt": "2024-10-26",
    "publishedAt": "2024-11-11",
    "excerpt": "Both databases solve the same problem: <em>how to most effectively store and provide access to data, in an ACID-compliant way?</em> ACID compliance might be implemented in various ways and SQL databases can vary quite substantially how they choose to go about it.",
    "researchLog": [ 4, 1.5, 1.5, 1, 1, 1.5, 2.5, 1.5, 2, 2.5 ],
    "writingLog": [ 1, 1, 2, 2.5, 3, 2, 3, 3, 2.5, 5 ],
    "tags": [ "dbs" ]
}
---
## ACID

Both databases solve the same problem: 
> How to most effectively store and provide access to data, in an ACID-compliant way?

To recap, the ACID acronym describes a set of properties that every transactional SQL database should uphold. That is:
* **Atomicity** - every transaction can be a sequence of multiple operations that must be treated as a single unit.
As an example, we might be inserting *row A,* then updating *row B* and finally deleting *row C*; either all of these operations have to succeed or none can
* **Consistency** - every operation in a transaction must abide by all defined constraints and rules: primary keys, unique or not null constraints, foreign keys references, cascade rules and so on; they must all hold true, before and after every transaction  
* **Isolation** - effects of transactions must be isolated from each other. If *T1*, *T2* and *T3* transactions are running concurrently, only changes that were already committed and persisted in the database should be visible to them. How much isolation they have and what exactly can be seen, should be configured by the various *isolation levels* (starting from the highest, most restrictive): 
    1. Serializable
    2. Repeatable Read
    3. Read Committed
    4. Read Uncommitted  
* **Durability** - guarantees that once a transaction is committed, its effects are persisted on the disk (non-volatile memory) and will be there even in the case of a system failure or crash

**Supporting these properties is by no means an easy task.** One might argue that this is the essence of SQL databases, source of their versatility but also implementation complexity and limitations for massive scale write workloads (10<sup>4</sup>, 10<sup>5</sup> writes per second and more). ACID compliance might be implemented in various ways and SQL databases can vary quite substantially how they choose to go about it. MySQL in particular, with the default InnoDB engine, takes a completely different approach to Postgres. Let's explore some of their most prominent differences and see how they stack up against each other, learning many crucial database fundamentals and concepts along the way!

## Clustered Indexes vs Heap Tables

Before diving into the specifics of these two concepts, let's recall [what the index is](/index-a-crucial-data-structure-for-search-performance.html):
> Index is simply an additional data structure that points to/references the original data and makes searching fast.

\
**In MySQL, with the default InnoDB engine, every table has a Clustered Index.** Oracle calls this concept Index Organized Table (IOT), which probably describes better what it really is. Regardless, having Clustered Index means that **this index is the table**; in leaf nodes of a B-tree index structure we have table data, stored directly, in order. This is how we might visualize it (nodes' keys are id values):
```
             (10|22)
             /     \
      (2|9|10)     (22|23|27|30)
      /      \     /           \
  (1|2)      (10) (...)        (30|32)   
   | |        |                 |  |
 1rd-2rd-----10rd--...-------30rd--32rd


rd stands for row data and it means directly embedded table data like:
id: 1, name: user-a, created_at: 2024-11-10T08:00:00Z
id: 2, name: user-b, created_at: 2024-11-11T09:22:00Z

'-' line symbolizes doubly linked list.
It connects all B-tree leaf nodes,
making sequential traversal faster.
```
This index (table) is also called the Primary Index. Tables can have other indexes as well but they are different; Secondary Indexes hold only a reference to the Primary Index, not table's data. It has major implications for both writes and reads.

**Searching data by Primary (Clustered) Index is as fast as it gets: check an index by traversing B-tree, O(log n) complexity, and read data directly from it.** Secondary Index lookups are costlier; first, we need to find Primary Index value in the Secondary Index structure and only then can we go to the Primary Index for table data - at least two I/O operations and two, not one, B-tree traversals. Traversing B-tree is fast (logarithmic complexity) but still, we do this two times and because every index is a separate structure, stored in a different place on the disk - it means more or less twice as many I/O operations. Granted that index pages can and often are cached in memory for better performance, it still constitutes additional overhead which cannot be ignored; we need to perform twice as many operations at the end of the day.

What is more, we need to remember that the Clustered Index (table) is stored *sorted on the disk*. B-tree structure is a balanced tree; there is a limit of how many children every node might have and height difference between any of the B-tree subtrees must be small, all leaf nodes are at the same or very similar depth. To keep it this way, a B-tree must sometimes be rebalanced, nodes might be split or merged. Random inserts and deletes (some updates too) can cause a lot of harm here. Remember that we store all table data in the leaf nodes so when B-tree needs to be rebalanced, it can take lots of additional I/O operations - leaf node pages, with embedded table data, might be split, merged and/or relocated.

**In Postgres, there is no Primary/Secondary Index distinction.** We just have tables stored on a heap (Heap Tables), in random order, and indexes. All indexes reference a particular row id/address, not its data or primary index value (tuple id to be exact, which is one of the row versions, more on it below). As far as performance goes, they are all equal: we first go to the index, find matching row/rows location in *O(log n)* time and read associated data from a separate space on the disk. This is how we might visualize it:
```
            (10|22)
            /     \
     (2|9|10)     (22|23|27|30)
     /      \     /           \
 (1|2)      (10) (...)        (30|32)   
  | |        |                 |  |
rid-rid-----rid---...--------rid--rid


rid stands for row ids. 
These are addresses that allow the database
to find rows data in the separate space on the disk.

'-' line symbolizes doubly linked list.
It connects all B-tree leaf nodes,
making sequential traversal faster.
```
As a consequence, all index lookups perform exactly the same operations to find relevant data. First, we read the index and perform B-tree traversal to find associated row ids and then go to the disk for their data; at least two I/Os, first for the B-tree read and second to fetch the actual table data. Because *table != index* and table data is located in a different space on the disk, searches will most likely be a little slower than accessing Clustered Table by its Clustered Index. Still, it is faster than the Secondary Index lookup - we are reading only one B-tree index structure, not two, and perform one tree traversal instead of two.

**Additionally, rebalances of B-tree indexes are not an issue for Postgres.** The reason is that in the leaf nodes we do not store table data but small, few bytes long row (tuple) ids, so there is significantly less data to move around. Table data itself is stored on a heap, in random order. Our indexes will be smaller in many cases as well, since row id stored in their leaf nodes tends to be smaller than Primary Index value referenced by all Secondary Indexes in the MySQL model.

Lastly, let's consider how these two approaches differ when it comes to writes. Let's say that we have a table:
```
CREATE TABLE account (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX account_created_at ON account(created_at);
```
When performing an insert, this is what happens:
* **MySQL** - insert of id + table data into primary index, insert (name, id) into secondary name index, insert (created_at, id) into secondary created_at index. *At least 3 I/Os* - but inserting table data into Clustered Index might be more expensive than the other ones
* **Postgres** - insert table data on the heap, insert (id, row_id) into id index, insert (name, row_id) into name index, insert (created_at, row_id) into created_at index - *at least 4 I/Os*

It is at least one I/O operation more for Postgres but as noted, inserting into Clustered Index might be costlier if B-tree has to be rebalanced or leaf node pages move around. Also worth noting, inserting table data on a heap is really cheap for Postgres - it is an appending operation, no movement or sorting is required. For deletes it is similar, because we need to delete data from the same places we have previously inserted it; primary index + two secondary indexes for MySQL, heap table + three indexes referencing it for Postgres. For updates, if we change all columns, behavior of both databases is similar - all indexes must be updated + heap table for Postgres. **Where the MySQL model shines are partial updates.** If we were to update only the name column for example, MySQL needs only to update table data in the Clustered Index + delete and insert one entry into the name index. In Postgres, because of how it approaches *Multiversion Concurrency Control (MVCC)* - allowing concurrent access to the same row possibly existing in multiple versions - every update is really an *insert + delete*. Let's then end by acknowledging that for some write operations MySQL (InnoDB) model has an edge and see how both databases solve the *MVCC* problem.

{{ .js: newsletterSignUpPostMid() }}

## Multiversion Concurrency Control (MVCC): Dead Tuples vs Undo Logs

We mentioned it briefly above but let's fully define what the Multiversion Concurrency Control is:

> Multiversion Concurrency Control (MVCC) is a mechanism in SQL databases that allows multiple transactions to interact with data concurrently while keeping each transaction isolated. Each transaction sees a consistent snapshot of the data as it appeared at its start time, even if other transactions are modifying the data. To enable this, MVCC stores multiple versions of each row in a way that minimizes locking and maximizes concurrent access.

\
**In PostgreSQL, this is achieved by storing two additional columns with every row: *xmin* and *xmax*.** Values of these fields are compared to the *current transaction id (xid)* to determine whether this particular row version (tuple) should or should not be visible in the running transaction. Working on our `account` table, this is how we can get it (ctid is current tuple id - current row version):
```
SELECT txid_current();
 txid_current 
--------------
          767

INSERT INTO account (name, created_at) VALUES ('account-a', NOW());
SELECT ctid, xmin, xmax FROM account;
 ctid  | xmin | xmax 
-------+------+------
 (0,1) |  768 |    0

INSERT INTO account (name, created_at) VALUES ('account-b', NOW());
SELECT ctid, xmin, xmax FROM account;
 ctid  | xmin | xmax 
-------+------+------
 (0,1) |  768 |    0
 (0,2) |  769 |    0

SELECT txid_current();
 txid_current 
--------------
          770
```
If we modify a row, its *xmax* field is updated but data is not modified; a new version of the row is inserted with a new *ctid* - current tuple id (as mentioned, a tuple is just one of the row versions). What are *the Dead Tuples* then? These are tuples, row versions, that are no longer visible to any running transaction. Until they are discarded by *[the VACUUM process](https://www.postgresql.org/docs/current/routine-vacuuming.html)*, they occupy additional space on the disk even though they are no longer needed. **This is the major disadvantage of the Postgres model: every table might have dead tuples that take additional disk space and can slow down reads, since they need to be checked and discarded while handling queries.** The VACUUM process runs periodically and gets rid of this bloat - for both table data and indexes where dead tuples (entries) live as well. This design decision also results in what is known as write amplification for updates in Postgres; almost all row updates require modifying all its indexes as well, even if the updated column/columns is not indexed. This is because *ctid* (current tuple id) changes after an update and that is the information/reference that is stored in all table indexes. Fortunately, there is [Heap-Only Tuples (HOT)](https://www.postgresql.org/docs/current/storage-hot.html) optimization but it applies only when updating not-indexed columns and if there is enough free space on the old row page to contain the new version.

**The key benefit of the Postgres MVCC approach: it does not need to use locks and allows for the highest possible concurrency.** This is the result of storing multiple row versions in the same disk space but treating them differently based on their metadata - mainly *xmin* and *xmax* columns.

**In MySQL, there are Undo Logs.** Every row is modified in-place and in a separate undo tablespace on the disk there is information allowing to rebuild previous versions of rows. As a consequence, the main table space does not grow as in the Postgres model but previously started transactions might need to fetch data from two different disk spaces to reconstruct their view of the data. Additionally, undo logs can still grow and need to be purged. Because every table is the index as well and rows are modified in-place, we need to have some metadata to decide whether the current transaction can read a row as it is or whether it should reconstruct it from undo logs. To make it possible, InnoDB adds these additional columns to every row:
* **DB_TRX_ID** - last transaction id that inserted or updated the row; delete is treated internally as an update with a special bit being set to indicate this fact
* **DB_ROLL_PTR** - pointer to undo log record with the data allowing to reconstruct previous versions of the row
* **DB_ROW_ID** - row id that increases monotonically as new rows are inserted

Finding rows in the Clustered Index (table) and interpreting these fields correctly by using or not using Undo Logs data allows MySQL (InnoDB) to reconstruct a consistent view of data for all active transactions. Secondary Indexes are treated differently; if an index entry is updated, a new one is inserted and the old one is delete-marked. If a transaction finds delete-market entry in the Secondary Index, it searches for an associated row in the Clustered Index and interprets its *DB_TRX_ID* field accordingly. Delete-marked entries are eventually purged from secondary indexes.

**The major advantage of the MySQL MVCC approach: rows are modified in-place so there is less data stored in the main table space.** Additionally, *writes do not amplify as much* as they do in the Postgres model; previous row versions are stored in the separate Undo Tablespaces and secondary indexes refer to primary index value, not ephemeral row id. If we modify a column that is indexed, all we need to do is:
* insert new entry into associated secondary index, mark previous one as deleted
* update row data in the Clustered Index (table)
* insert previous row version data into the Undo Log so that older transactions can recreate it

Even if our table has lots of indexes, if we modify only one column that is all we have to do, since all secondary indexes refer to the rather constant primary index value. If we modify a not-indexed column that is even easier because we need only to modify table data in the Clustered Index and add a new entry to the Undo Log. As previously said, MySQL's model shines for tables with many indexes and which are heavy on partial updates.

**The primary drawback of the MySQL model is that reconstructing previous row versions requires reading data from a separate disk space - the Undo Logs.** For write-heavy tables it can still grow quickly taking additional disk space, plus it does make reading previous versions of rows less efficient - we first need to find them in the Clustered Index only to learn that data from another disk space needs be fetched and combined together to return desired result. What is more, for higher isolation levels like `REPEATABLE_READ` (InnoDB's default) and `SERIALIZABLE`, MySQL uses various locks to deliver a consistent view of data for some queries - range queries most notably. There are [Gap Locks and Next-Key Locks](https://dev.mysql.com/doc/refman/9.1/en/innodb-locking.html) for example, which can significantly decrease concurrency in some cases. It is implemented in this way because it is harder to support isolation for range queries when, in the main table space (Clustered Index), we only store the most recent row version. Postgres does not have this problem, since all row versions are stored in the same disk space, on a heap. 

We now know quite a bit of theory so let's see how it plays out in practice.

## Performance tests

Theory is crucial to understand what happens under the hood but ultimately, we study it to solve real-world problems and deliver results. Let's then see how both databases perform in various scenarios!

We have the following schema (Postgres version):
```
CREATE TABLE table_few_indexes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  version BIGINT NOT NULL
);
CREATE INDEX table_few_indexes_created_at 
  ON table_few_indexes(created_at);
CREATE INDEX table_few_indexes_updated_at
  ON table_few_indexes(updated_at);

CREATE TABLE table_single_index (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  version BIGINT NOT NULL
);
```
What is worth noting here:
* we have two tables with the only difference being that the first has a few indexes (4) and the second has one - primary key
* primary key is a monotonically increasing integer which is an optimal choice for MySQL Clustered Index (table) - inserts will be ordered in the same way as the table (index) is on the disk

**What I expect:**
* MySQL to outcompete Postgres in update cases for `table_few_indexes`, since writes do not cascade to all indexes there; we will update three columns (two indexes) - *name, updated_at and version* - which is fewer I/Os for MySQL, as explained in the previous sections
* inserts and deletes for both tables and databases to be similar; same for updates of `table_single_index`, since there is only one index there
* selects by primary key to be slightly faster for MySQL because the table is the Primary (Clustered) Index; we can search and read data directly from the index, instead of first finding it in the index and then reading from the heap as it is in the Postgres model

For test details, [check out the code repo](https://github.com/BinaryIgor/code-examples/tree/master/mysql-and-postgresql-differences); it is a simple Java + Maven + dbs in Docker tool/app. As far as databases go, we have *PostgreSQL 17 and MySQL 9*, both having 4 GB of RAM and 2 CPUs.

First, let's run a batch insert case for the `table_single_index` to have 2 million rows there. Here are the results (each query inserts 1000 rows):
```
Executed queries: 2000
Queries rate: 10/s

MySQL
 Min: 16.267 ms 
 Max: 232.452 ms
 Mean: 46.885 ms
 Percentile 50 (Median): 46.859 ms
 Percentile 90: 68.881 ms
 Percentile 99: 86.435 ms
 Percentile 99.9: 225.183 ms

PostgreSQL
 Min: 13.545 ms
 Max: 107.643 ms
 Mean: 42.066 ms
 Percentile 50 (Median): 44.186 ms
 Percentile 90: 61.597 ms
 Percentile 99: 79.014 ms
 Percentile 99.9: 103.757 ms
```
Postgres has won slightly - only at 99.9th percentile and max there are significant differences. Let's run the same case for the second table to have 2 million rows as well:
```
Executed queries: 2000
Queries rate: 10/s

MySQL
 Min: 26.506 ms
 Max: 1829.631 ms
 Mean: 212.913 ms
 Percentile 50 (Median): 87.321 ms
 Percentile 90: 540.948 ms
 Percentile 99: 1455.452 ms
 Percentile 99.9: 1789.691 ms

PostgreSQL
 Min: 21.566 ms
 Max: 150.861 ms
 Mean: 53.616 ms
 Percentile 50 (Median): 52.792 ms
 Percentile 90: 78.887 ms
 Percentile 99: 97.792 ms
 Percentile 99.9: 135.136 ms
```
Postgres wins again with even more visible advantage, especially at higher percentiles.

Next, we will compare single row inserts. Running tests for the `table_single_index` first:
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.781 ms
 Max: 51.181 ms
 Mean: 4.091 ms
 Percentile 50 (Median): 3.904 ms
 Percentile 90: 4.857 ms
 Percentile 99: 10.341 ms
 Percentile 99.9: 36.612 ms

PostgreSQL
 Min: 0.559 ms
 Max: 59.813 ms
 Mean: 1.783 ms
 Percentile 50 (Median): 1.762 ms
 Percentile 90: 2.153 ms
 Percentile 99: 3.279 ms
 Percentile 99.9: 12.201 ms
```
Again, Postgres has the upper hand here. How about `table_few_indexes`?
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.778 ms
 Max: 52.916 ms
 Mean: 4.438 ms
 Percentile 50 (Median): 4.288 ms
 Percentile 90: 5.232 ms
 Percentile 99: 9.613 ms
 Percentile 99.9: 43.595 ms

PostgreSQL
 Min: 0.773 ms
 Max: 16.837 ms
 Mean: 1.899 ms
 Percentile 50 (Median): 1.865 ms
 Percentile 90: 2.311 ms
 Percentile 99: 3.629 ms
 Percentile 99.9: 14.119 ms
```
Postgres wins again.

Going further, there are updates to test. `table_single_index` is first, where in theory performance should be similar:
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.605 ms
 Max: 35.680 ms
 Mean: 4.250 ms
 Percentile 50 (Median): 4.224 ms
 Percentile 90: 5.0623 ms
 Percentile 99: 7.929 ms
 Percentile 99.9: 26.021 ms

PostgreSQL
 Min: 0.613 ms
 Max: 59.375 ms
 Mean: 1.990 ms
 Percentile 50 (Median): 1.917 ms
 Percentile 90: 2.319 ms
 Percentile 99: 4.726 ms
 Percentile 99.9: 16.183 ms
```
Postgres emerged victorious yet again! Let's check the same case for the `table_few_indexes`, where MySQL should have an edge:
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.904 ms
 Max: 44.889 ms
 Mean: 4.908 ms
 Percentile 50 (Median): 4.884 ms
 Percentile 90: 5.989 ms
 Percentile 99: 8.576 ms
 Percentile 99.9: 16.976 ms

PostgreSQL
 Min: 0.795 ms
 Max: 45.792 ms
 Mean: 2.087 ms
 Percentile 50 (Median): 1.994 ms
 Percentile 90: 2.491 ms
 Percentile 99: 4.248 ms
 Percentile 99.9: 30.887 ms
```
**Surprisingly, Postgres has also won here, even though it should not.** Maybe 4 indexes is still too few for the MySQL model to shine? But how realistic and reasonable is it to have significantly more? In any case, to make sure that I am objective here, I decided to add two more indexes (6 right now):
```
CREATE INDEX table_few_indexes_status 
  ON table_few_indexes(status);
CREATE INDEX table_few_indexes_version
  ON table_few_indexes(version);
```
And run the test case again:
```
MySQL
 Min: 1.859 ms
 Max: 33.992 ms
 Mean: 5.177 ms
 Percentile 50 (Median): 5.091 ms
 Percentile 90: 6.226 ms
 Percentile 99: 10.615 ms
 Percentile 99.9: 20.453 ms

PostgreSQL
 Min: 0.758 ms
 Max: 19.321 ms
 Mean: 2.008 ms
 Percentile 50 (Median): 2.001 ms
 Percentile 90: 2.420 ms
 Percentile 99: 3.320 ms
 Percentile 99.9: 12.724 ms
```
And still, Postgres outcompetes MySQL with 6 indexes despite its write amplification issue! The only thing that comes to my mind here is simply that MySQL (InnoDB) has a bad implementation.

Next up, there are two delete cases. Let's start with the `table_single_index` again:
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.293 ms
 Max: 34.825 ms
 Mean: 4.122 ms
 Percentile 50 (Median): 4.055 ms
 Percentile 90: 4.856 ms
 Percentile 99: 7.500 ms
 Percentile 99.9: 24.559 ms

PostgreSQL
 Min: 0.666 ms
 Max: 56.144 ms
 Mean: 1.733 ms
 Percentile 50 (Median): 1.696 ms
 Percentile 90: 2.061 ms
 Percentile 99: 2.942 ms
 Percentile 99.9: 12.487 ms
```

And then `table_few_indexes`:
```
Executed queries: 5000
Queries rate: 50/s

MySQL
 Min: 1.915 ms
 Max: 45.568 ms
 Mean: 4.631 ms
 Percentile 50 (Median): 4.601 ms
 Percentile 90: 5.535 ms
 Percentile 99: 7.671 ms
 Percentile 99.9: 25.602 ms

PostgreSQL
 Min: 0.610 ms 
 Max: 10.820 ms
 Mean: 1.720 ms
 Percentile 50 (Median): 1.709 ms
 Percentile 90: 2.062 ms
 Percentile 99: 2.926 ms
 Percentile 99.9: 9.796 ms
```
Postgres is faster in both cases yet again.

Finally, we have selects by the primary key. In theory once more, MySQL has an advantage here; running `table_single_index` first:
```
Executed queries: 10000
Queries rate: 100/s

MySQL
 Min: 0.219 ms
 Max: 15.316 ms
 Mean: 1.320 ms
 Percentile 50 (Median): 1.329 ms
 Percentile 90: 1.803 ms
 Percentile 99: 2.832 ms
 Percentile 99.9: 4.163 ms

PostgreSQL
 Min: 0.252 ms
 Max: 7.476 ms
 Mean: 1.034 ms
 Percentile 50 (Median): 1.027 ms
 Percentile 90: 1.306 ms
 Percentile 99: 1.752 ms
 Percentile 99.9: 2.613 ms
```
Not surprisingly at this point, Postgres is faster here as well, even though it should be slightly slower. Let's also check the `table_few_indexes`:
```
Executed queries: 10000
Queries rate: 100/s

MySQL
 Min: 0.240 ms
 Max: 9.995 ms
 Mean: 1.340 ms
 Percentile 50 (Median): 1.350 ms
 Percentile 90: 1.835 ms
 Percentile 99: 2.844 ms
 Percentile 99.9: 4.373 ms

PostgreSQL
 Min: 0.199 ms
 Max: 7.873 ms
 Mean: 1.023 ms
 Percentile 50 (Median): 1.029 ms
 Percentile 90: 1.342 ms
 Percentile 99: 1.902 ms
 Percentile 99.9: 2.718 ms
```
Same as in the previous case, Postgres is better.

## Conclusion

MySQL and PostgreSQL take two different approaches to solve the same problem, which is:
> How to most effectively store and provide access to data, in an ACID-compliant way?

Both implementations have their own tradeoffs, set of advantages and disadvantages. 

**In theory, the MySQL (InnoDB) approach should have an edge for:**
* partial updates of tables with more indexes -  not all indexes but only of changed columns have to be modified
* querying tables by the Primary Key - index is the table so it should be as fast as it gets, since data is read from a single place
* previous row versions are stored in a separate space on the disk, therefore active transactions are less affected by the potentially large older row versions

**Postgres advantages are:**
* uniform search performance for all indexes - there is no primary/secondary index distinction, performance is the same for all of them
* smaller penalty for random inserts because tables are stored on a heap, in random order, in contrast with sorted MySQL Clustered Index (table)
* previously started transactions have better access to prior row versions, since they are stored in the same disk space
* there is less need for locking (virtually none) to support more demanding isolation levels and concurrent access - previous row versions are stored in the same disk space and can be considered or discarded based on special columns (*xmin*, *xmax* mostly)

\
**In practice however, MySQL disappoints in comparison to Postgres.** In theory, it should outcompete Postgres in some scenarios. In practice, Postgres outcompeted MySQL in every single test case - often being 1.5 to 2.5 times faster in most percentiles. Why is it the case? In tests, I have used official drivers for both databases so the only thing I can blame is just bad implementation of MySQL (InnoDB) database. But, if you have spotted mistakes somewhere in my tests implementation or a critical flaw in assumptions/reasoning, please let me know! I still cannot believe that Postgres outcompeted MySQL in all those scenarios.

Knowing that in theory there are some advantages to the MySQL model but they fail to manifest in practice, other implementations of the Clustered Index model might be worth exploring. **But for now, my recommendation is clear: stick with the robust and high-performance PostgreSQL!**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. ACID: https://en.wikipedia.org/wiki/ACID
2. B-tree index anatomy: https://use-the-index-luke.com/sql/anatomy
3. Amazing B-tree visualizations: https://www.cs.usfca.edu/~galles/visualization/BTree.html
4. More on the Clustered Index approach:
    1. https://dev.mysql.com/doc/refman/9.1/en/innodb-index-types.html
    2. https://use-the-index-luke.com/sql/clustering/index-organized-clustered-index
    3. https://use-the-index-luke.com/blog/2014-01/unreasonable-defaults-primary-key-clustering-key
    4. https://use-the-index-luke.com/blog/2016-07-29/on-ubers-choice-of-databases
5. Postgres Heap-Only Tuples (HOT) optimization:
    1. https://www.postgresql.org/docs/current/storage-hot.html
    2. https://www.cybertec-postgresql.com/en/hot-updates-in-postgresql-for-better-performance/
6. Postgres MVCC:
    1. https://www.postgresql.org/docs/current/mvcc.html
    2. https://devcenter.heroku.com/articles/postgresql-concurrency
    3. https://www.cybertec-postgresql.com/en/killed-index-tuples/
    4. https://www.cybertec-postgresql.com/en/whats-in-an-xmax/
7. MySQL MVCC: 
    1. https://dev.mysql.com/doc/refman/9.1/en/innodb-multi-versioning.html
    2. Because of the Undo Logs, at higher isolation levels, some locking is necessary to make the space after and before selected rows immutable, since it is not feasible to reconstruct this state from undo logs which are not sorted (in theory, implementation of this kind is possible but maybe it is too hard or too slow to be practical). Reference: https://dev.mysql.com/doc/refman/9.1/en/innodb-locking.html
8. https://www.percona.com/blog/innodb-page-merging-and-page-splitting/
9. Code repo with performance tests: https://github.com/BinaryIgor/code-examples/tree/master/mysql-and-postgresql-differences
10. Write-Ahead Logging (WAL): https://www.postgresql.org/docs/current/wal-intro.html
11. Some interesting Postgres internals that combined with a fantastic WAL implementation make it so performant: https://www.postgresql.org/docs/current/runtime-config-resource.html

</div>