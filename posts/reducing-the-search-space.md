---
{
    "title": "Indexing, Partitioning, Sharding - it is all about reducing the search space",
    "slug": "reducing-the-search-space",
    "publishedAt": "2023-09-09",
    "excerpt": "Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about these problems as search space problems. In other words, how much data need to be scanned/checked in order for my query to be fulfilled?",
    "writingLog": [ 1, 2, 3.5, 4, 1, 1.5 ]
}
---

## Seeking for a small search space

When we work with a set of (usually persisted somewhere) data, we most likely want our queries to be fast. Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about these problems as search space problems. In other words, **how much data need to be scanned/checked in order for my query to be fulfilled?**

Building on that, if our search space is big, large, huge or enormous (we work with tables/collections consisting of 10<sup>6</sup>, 10<sup>9</sup>, 10<sup>12</sup>, 10<sup>15</sup>... rows/documents for example), **we need to find a way to make our search space small again**. There are a couple ways of doing that, so let's explore them.

## Changing schema

Size of our search space is also related to the size of each row that a database needs to scan. We can as well replace *row* with *document*, and *table* with *collection* here, but let's stick with SQL terminology for the sake of simplicity. These rules are quite universal. 

We have the following schema in the SQL database (Postgres syntax): 
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

Now, we will assume that for most of our queries, we only take id and name, and additionally description is pretty long in practice (like 1000+ characters). Our most popular query would be:
```
SELECT id, name FROM account WHERE name = ?;
```
Furthemore (for some arbitrary reason, I know!), we can not index the name column. In that situation, we will need to do full table scan to fulfill this query.

When our table have 5 columns each row size is about 5n, where n is the average size of a column (approximating of course, size of different columns can vary a lot). Having 10<sup>9</sup> rows in a table, we need to scan something like:
```
1 000 000 000 * 5n = 5 000 000 000 n,
where n is the average size of a column
``` 
...units of data.


To optimize this case, we can simply change our schema to contain two tables, instead of one:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE account_details (
  id UUID PRIMARY KEY REFERENCES account(id),
  state TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```
As we have stated, we are interested only in two columns for the most frequently used query (id, name). Our search space is thus reduced to: 
```
1 000 000 000 * 2n = 2 000 000 000 n,
where n is the average size of a column
``` 
...which is ~ 40% of previous size, so our queries need to search through ~ 2.5 less space (5n / 2n = 2.5). 

We will get to the *partitioning* in a while, but we **can also think about splitting a table into multiple tables, by changing the schema, as vertical partitioning**. Vertical, since we slice the table into two (multiple) separate ones, and because all rows are in both tables. We have split previously single row into two, where two columns are in the first table and other three are in the second one.

## Indexing

[Index](https://use-the-index-luke.com/sql/anatomy) is just a separate data structure (B-tree most often) that points to specific rows (documents) of a table (collection), and has a particular structure that makes searching fast.

Using previous example of the account table, we had the query:
```
SELECT id, name FROM account WHERE name = ?;
```
To make it faster, we can create the following B-tree index:
```
CREATE INDEX account_name ON account(name);
```
**B-tree search complexity is equal to O(log<sub>b</sub>n)**. B is the branching factor and in practice its value depends on the particular database implementation. For the sake of analysis, we assume *b=10* but in reality it is often much larger (hundreds or even thousands), making it even more efficient. So now, instead of searching linearly through 5n * 1 000 000 000 rows of data, as we would need with one, five-column table, our search space is reduced to:
```
log(1 000 000 000) = 9
```

Which is a tremendous improvement! We went from 5 * 10<sup>9</sup> to 9, which is over 555 555 555-fold faster (5 * 10<sup>9</sup> / 9). But, as said earlier, index is a separate data structure, so we need to add some constant time to this number, since database needs to:
* read the index and find matching row pointers/addresses
* having matching row pointers/addresses, read the data (actual columns) from the disk

...but still, this is usually the greatest improvement we can make to speed up our queries (~555 555 555 + n improvement in our case). 

Additionally, we can take it even further and create composite index like that: 
```
CREATE INDEX account_name_id ON account(name, id);
```

Now, we have all the data we need in the index (name and id columns), so [it can be retrieved in a single read operation, directly from the index](https://www.postgresql.org/docs/current/indexes-index-only-scans.html).

## Partitioning

Generally, when we refer to *partitioning*, in the database context, we mean table partitioning. It is an optimization strategy, where we take a table and split it into multiple subtables using one, or many, of its fields as a partition key. Additionally, we choose a partition strategy, which describes how column(s) value(s) maps into a specific subtable (partition). Each subtable has exactly the same schema (as opposed to vertical partitoning that we did earlier). Most commonly used strategies (forms) are range, list and hash partitioning. Let's explain them on examples:
```
// Range partitioning
partition_key = (0-10) -> table_0 (partition 0 of a table)
partition_key = (10-20) -> table_1
partition_key = (20-30) -> table_2

// List partitioning
partition_key = a -> table_a
partition_key = b -> table_b
partition_key = c -> table_c

// Hash partitioning
hash(partition_key) % 2 (number of partitions) = 0 -> table_0
hash(partition_key) % 2 = 1 -> table_1
hash(partition_key) % 2 = 2 -> table_2
```

Using our account table, but changing it a little:
```
ALTER TABLE account
ADD COLUMN country_code INTEGER NOT NULL;
```

I will assume that we still have approximately 10<sup>9</sup> of rows, but we are now almost always interested in accounts from a given country_code. Our queries look like:
```
SELECT (...) FROM account
WHERE country_code = ? (AND ...);
```
We always (almost) attach country_code to the where clause. That is a pretty good case to partition this table by list(country_code):
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  -- new column --
  country_code INTEGER NOT NULL
) PARTITION BY LIST(country_code);
```

Now, each country_code will have associated with it subtable, which has the same schema as its parent table, in the following manner:
```
rows with country_code = 0 -> account_0 
rows with country_code = 1 -> account_1
rows with country_code = 2 -> account_2
...
rows with country_code = n -> account_n
```

Our next assumptions are that we have 10 country codes in the account table, they are more or less equally distributed, and we attach *WHERE country_code = ?* to most queries. In that case, only one of the 10 partitions needs to be checked. Instead of scanning 10<sup>9</sup> rows, we will search through:
```
1 000 000 000 * 0.1 (10%) = 1 00 000 000
```
...which is 10-fold improvement. Of course, improvement is directly proportional to the number of partitions that we decide to have:
```
10 partitions: 
  ~ 10% of data in each partition, 
  10 times smaller search space

100 partitions: 
  ~ 1% of data in each partition, 
  100 times smaller search space

1000 partitions:
  ~ 0.1% of data in each partition,
  1000 times smaller search space
```

\
Finally, each partition (subtable) maitains its own, separate indexes. If we combine partitoning + indexing (we almost always do), indexes are significantly smaller, again proportionally to the number of partitions, which makes them even faster to use (once more, we have reduced our search space).


## Sharding

Yet another, last to be used, strategy to reduce the search space is *sharding*. **It is similar to *partitioning*, but there is a crucial difference**. We spread out table(s) data over multiple physical shards/nodes. In partitioning, we split table into multiple subtables, but they all live in a single, physical database. Here (sharding), it is not the case. **We use the same strategies to divide our data into multiple parts as we do with partitioning, but each part of table's data belongs to a separate physical database (shard)**. 

Similarly to partitioning, we can have as many physical databases (shards) as our performance improvement target is. **Consequently, each shard, a separate physical database, contains only a (small) subset of our data**. Let's suppose that, as previously, our table is:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  country_code INTEGER NOT NULL
);
```
I assume that we will have 5 shards, which simply means 5 databases. We surely can have more country codes than shards, they are independent variables, so we can do:
```
country_code % 5 = 0 -> db_0 (shard_0)
country_code % 5 = 1 -> db_1
country_code % 5 = 2 -> db_2
country_code % 5 = 3 -> db_3
country_code % 5 = 4 -> db_4,
where 5 is the number of shards
```
That constitutes our routing to shards. To get proper results (data), we need to know which shard needs to be queried, because, as have been said already, shards are separate, physical databses. Some databases, [Mongo](https://www.mongodb.com/docs/manual/sharding/) for example, support various sharding strategies out of the box, for others, like PostgreSQL or MySQL, we need to do application-level sharding (there are also some third-party solutions). In that approach, we maintain connections to all databases (shards) in our application and, based on the issued query, decide which one(s) to query. If there is a need to query more than one shard, we also need to assembly the results.

Going back to numbers, with 5 shards we have approximately 5-fold improvement (similarly to partitioning, we need to strive for more or less equal distribution of data). Same as with the number of partitions, the more shards we decide to have, the larger improvement we will get. Likewise, it is true only for the queries that can utilize our partitioning/sharding schema. In our example, they (queries) need to have country_code in the where clause. Assuming that we have 5 shards:
```
SELECT * FROM account
WHERE country_code = 1;
// needs to scan 1 shard, 20% of all data

SELECT * FROM account
WHERE country_code = 1 OR country_code = 2;
// needs to scan two shards so 40% of all data

SELECT * FROM account WHERE name = ?;
// needs to scan all shards, 
// since a particular name reside in any shard!
```

And of course this dependency, between achieved performance improvement and the query specificity, is also true for both partitioning and indexing. What is worth remembering is that with sharding, each shard is an independent database, so even if we need to query a few shards at once, it is still pretty fast, because we can do this in parallel and they have their own, indepedent resources (cpu, memory, storage etc.).

Lastly, sharding is far more complex than all previously described strategies. When we change schema, create indexes or partition a table, we work with a single, simple database, where the entirety of our data is contained. With sharding, that is no longer the case. Even if we use database that does routing and assembling for us, we still have more than one database, we need to deal with a distributed system now, with all the complexity it brings. Needless to say, we should **consider sharding only when all other strategies have failed us and it is absolutely necessary**.

## Practical considerations

In practice, we should start simple. **In 99% cases, optimizing schema for our use-cases + creating proper indexes, and actually using them by writing proper queries, is more than enough**. As we have also shown, indexing (with B-tree in particular) outperforms all optimization strategies, and at the sime time is the simplest one.

Usually (when we deal with large and stil growing data) it will go something like this: we optimize our schema and create proper indexes. Everything works fine, until it does not. Then, we scale our database vertically, just by giving it more cpu, memory and a better/faster storage (disk/drive). Everything works fine again, and again, until it does not. Then, most likely, we keep our optimized schema and indexes, but we partition table(s) to 10 - 100 partitions let's say. It is fast again. We can then probably go even to thousands of partitions. If we have significantly more reads than writes (usually we have), we can also add a few read replicas of our database. In most cases, we can also add a cache, here and there. Let's say that we did all of that, and it is still not enough. Then, and only then, when everything has failed us, we should go and shard our database.

## Closing thoughts

We just went over most commonly used strategies to reduce the search space of our data. Now we know how to have, regardless of how big the data is, a small search space. **And as we know, working with a small set of data is always fast**.

<div id="post-extras">

<div class="post-delimiter">---</div>

### Related videos on my [youtube channel]({{ youtubeChannelUrl }})
1. [Partitioning](https://www.youtube.com/watch?v=xVZsFpYa1Yc)
2. [Sharding](https://www.youtube.com/watch?v=B5aHDQFDiuw)

<div class="post-delimiter">---</div>

### Notes and resources

1. I know that in some databases, MySQL and SQLite for example, there is a notion of primary and secondary indexes. There, only primary index points to a table (collection) and all secondary indexes point to a primary index. I skipped that to simplify analysis, the same rules still apply, we just have additional level/layer of indirection. I also intentionally skipped many, many details about different types of indexes, structure/architecture of the data on the disk (clustered tables for example) and so on.
2. As said, B-tree is the most commonly used data structure to implement indexes, but there are also other ones with different trade-offs. Postgres documentation gives a nice overview of different types available there: https://www.postgresql.org/docs/current/indexes-types.html
3. Anatomy of an index: https://use-the-index-luke.com/sql/anatomy
4. Interesting Postgres indexes implementation details: https://rcoh.me/posts/postgres-indexes-under-the-hood
5. Postgres - index only scans/covering indexes: https://www.postgresql.org/docs/current/indexes-index-only-scans.html
6. Postgres partitioning details: https://www.postgresql.org/docs/current/ddl-partitioning.html
7. Mongo sharding: https://www.mongodb.com/docs/manual/sharding
8. How guys at Notion partitioned their Postgres: https://www.notion.so/blog/sharding-postgres-at-notion
9. Third-party, open-source solution to shard MySQL db: https://vitess.io

</div>