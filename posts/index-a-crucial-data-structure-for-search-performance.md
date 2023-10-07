---
{
    "title": "Index: a crucial data structure for search performance",
    "slug": "index-a-crucial-data-structure-for-search-performance",
    "publishedAt": "2023-10-07",
    "startedAt": "2023-09-26",
    "timeToRead": "19 minutes",
    "wordsCount": 2809,
    "excerpt": "There are many variations and types of it, depending on the underlying database/search engine and its purpose, but the core concept is always the same: <em>let's have an additional data structure that points to/references the original data and makes searching fast.</em>",
    "writingLog": [ 2, 1.5, 3.5, 2.5, 1.5, 3.5, 1, 4, 4.5, 3.5 ],
    "draft": true
}
---

## Additional data structure

What is an index? It is a simple idea of having additional data structure that helps to search for some piece of data in our dataset. There are many variations and types of it, depending on the underlying database/search engine and its purpose, but the core concept is always the same:
> Let's have an additional data structure that points to/references the original data and makes searching fast.

## Index types by structure

We will use <a href="https://www.postgresql.org/docs/current/indexes-types.html" target="_blank">PostgreSQL</a> as our reference for various index types. Some of the most commonly used/interesting types there are:
1. B-tree
2. Hash
3. GIN (Generalized Inverted Index)
4. GIST (Generalized Search Tree)
5. BRIN (Block Range INdexes)

### B-tree 

**Most databases (PostgreSQL, MySQL, MongoDB, SQLite) support <a href="https://en.wikipedia.org/wiki/B-tree" target="_blank">B-tree</a> index and it is by far the most commonly used data structure to be used as an index.** That is because of its good performance characteristics - *O(log<sub>n</sub>)* - for both equality and range search operations. Supporting range operations means that data needs to be comparable, sortable, which in turn means that this index can be used to support and speed up sorting operations as well. B-tree is a self-balancing tree-like data structure, with a variable number of children per node (as opposed to 2-children per node <a href="https://en.wikipedia.org/wiki/Binary_tree" target="_blank">binary tree</a>). <a href="https://use-the-index-luke.com/sql/anatomy/the-tree" target="_blank">It looks something like this</a>:
```
             (10|22)
             /     \
    (1|2|9|10)     (22|23|30)
    /        \     /        \
(...)        (10) (...)     (30|32)   
 |||          |              |  |
 rows         rows           rows
```

B-tree keeps itself balanced, depth/height is kept low and the number of children per node grows as needed. Searching for a specific value is really fast, because with each comparison we can eliminate a huge range of options. Let's try to get 32 for example:
1. start at (10|22), 32 is greater, so go to the right
2. (22|23|30), 32 is greater, so go the right again
3. (30|32) - we have it

Usually, each value is repeated in the child nodes until the leaf nodes. For example, 10 is in the root, but also in the first node to the left and then right to the left (leaf node). To optimize certain operations (like range queries) leaf nodes are all connected by a doubly linked list (<a href="https://use-the-index-luke.com/sql/anatomy" target="_blank">for details of the anatomy, checkout amazing "Use the Index, Luke!" blog</a>). Then leaf nodes have references (addresses) to the table rows data or they have data itself (see <a href="#primary-secondary-and-clustered-indexes">Clustered Index</a> below). 

Logarithmic complexity gives us good performance for a very, very long time and for huge datasets. B-tree search complexity is *O(log<sub>b</sub>n)*. Assuming b = 10, which in practice can go up to hundreds or even thousands (making it even faster), the search complexity will be:
```
Table with 10^3 rows:
log(1000) = 3

Table with 10^6 rows:
log(1 000 000) = 6

Table with 10^9 rows:
log(1 000 000 000) = 9

Table with 10^12 rows:
log(1 000 000 000 000) = 12

Table with 10^15 rows,
log(1 000 000 000 000 000) = 15
```
...giving us great performance as our data continues to grow. 

### Hash

Hash index is quite useful when we look to support only equality operations. Underneath the hood, as the name suggests, it uses a <a href="https://en.wikipedia.org/wiki/Hash_table" target="_blank">hash map/table</a>. With good implementation, in theory, hash map search complexity is *O(1)*. Sometimes, a hash map needs to be rebalanced/recreated, so in practice it is *O(1) + C* (some amortized constant). But still, for equality only operations it is the fastest option. Hence also there are key-value only databases/stores, like Redis or <a href="https://etcd.io" target="_blank">Etcd</a>, which are using this data structure.

### GIN

GIN stands for <a href="https://www.postgresql.org/docs/current/gin-intro.html" target="_blank">Generalized Inverted Index</a>. Why inverted? It comes from the full-text search terminology, as far as I know. There, we work on documents and forward/regular/normal index is something like:
```
document1: "let's say something special" 
-> [ let's, say, something, special ]

document2: "Shorter one" 
-> [ shorter, one ]
```

Which basically is a mapping between documents and words (terms) that they contain. The Inverted Index is then, well... inverted. So a list of words (terms), and documents containing them:
```
one -> document1, document2
second -> document1
xyz -> document2, document3, document4
```

\
In Postgres, it means that we have a data structure, also B-tree in fact, where each row (tuple) can appear multiple times and we can index complex/composite types like arrays, text or json documents. Its structure is similar to the B-tree from the description above, but leaf nodes have a key (word/term from the document for example) and a posting list of matching tuples (documents for example). The main difference between *GIN* and a standard B-tree index is that each tuple (row) can appear many times in this index, being associated with a different key, plus, it defines <a href="https://www.postgresql.org/docs/current/gin-builtin-opclasses.html" target="_blank">its own operators for querying</a> that each data-type (like arrays, tsvector or json/jsonb) needs to support. Let's say, that we have a table:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL
);
CREATE INDEX account_attributes
  ON account USING GIN(attributes);
```
Attributes data:
```
{
  "state": "CREATED",
  "country_code": 22
},
{
  "state": "ACTIVATED",
  "country_code": 101
},
{
  "state": "ACTVATED,
  "country_code": 101
}
```

On the disk, keys need to be combined with values before inserting them in the B-tree nodes. For example, we may have the following entries in the B-tree (simplifying):
```
state:CREATED -> tuple1
state:ACTIVATED -> tuple2, tuple3
country_code:22 -> tuple2
country_code:101 -> tuple2, tuple3
```
...or the alternative implementation:
```
CREATED -> tuple1:[state]
ACTIVATED -> tuple2:[state], tuple3:[state]
22 -> tuple2:[country_code]
101 -> tuple3:[country_code]
```

...thanks to that approach, we can use B-tree structure to search through custom, complex types (with more than one value). 

### GIST

Generalized Search Tree. In Postgres, it is just a template for a balanced, search tree based index on top of which we can build our own implementation. One of its most commonly used instances is <a href="https://en.wikipedia.org/wiki/R-tree" target="_blank">R-tree</a> used for searching through multidimensional data, such as rectangles or geographic coordinates. Why is it useful in this context? We can define our own comparison and equality operators (and others, custom ones) to query our data appropriately. Using coordinates, is (0, 1) greater than (1, 0)? Do questions like that even have a place with this data type? We can define these operators as we wish, which allows for new usages of tree-based indexes, like mentioned above R-tree. There is an implementation of it in <a href="https://www.postgresql.org/docs/current/gist-builtin-opclasses.html" target="_blank">PostgreSQL itself</a> and there is also the <a href="https://postgis.net/workshops/postgis-intro/indexing.html" target="_blank">PostGIS project</a> with its own implementation of R-Tree.

### BRIN

Its name stands for Block Range INdex. It is helpful for fields that have some natural correlation with their physical location within the table. What does it mean exactly? It means that the more *orderly* our inserts are, the more useful this index is. The more naturally incremental/decremental the indexed field is, the more efficient this index becomes. By orderly I mean something like date/timestamp/version fields where we always/almost always insert new records (according to this field). Let's say that we have a table:
```
CREATE TABLE event (
  id UUID PRIMARY KEY,
  name TEXT,
  timestamp TIMESTAMP
);
CREATE INDEX event_timestamp 
  ON event USING BRIN (timestamp);
```

We assume that this table is append-only and we insert new data with larger and larger timestamps (as events occur). The more this is the case, the more BRIN index is beneficial, because its structure on the disk is something like:
```
page range: 1 - 10
values: 2023-10-05T00:00:00 - 2023-10-05T05:00:00 

page range: 10 - 20 
values: 2023-10-05T05:00:00 - 2023-10-05T08:22:22 

page range: 20 - 30 
values: 2023-10-05T08:22:22 - 2023-10-05T11:00:10 

...
```
...it is a map where page ranges are keys and range of values are values that we can find there. The more *orderly* layout of the table on the disk, the more beneficial this index becomes. If our inserts/modifications are random, table layout on the disk will also be random - in that case BRIN index will not give us much. But <a href="https://www.postgresql.org/docs/current/storage-page-layout.html" target="_blank">if our table is sorted on the disk and is stored on 100 pages</a> for example, and we have 10 page ranges in the index, for any single value we will only need to check a single page range, which is just 10% of the whole table. Sounds familiar? It is because the mechanism and performance benefits are quite similar to a *table partitioning*, where the table is divided into smaller, more manageable sections (subtables) for improved query performance. 

## Primary, Secondary and Clustered Indexes

There is also a distinction between index types depending on how a particular database decides to store data on the disk.

In Postgres, there is no primary versus secondary index differentiation (we will get to the definition in a while). In that model, there is a clear distinction between index and the table data. Heap table (called that because it is not ordered) is stored on the disk in the insertion/update order, which can be either random or ordered, and it can move on the disk sometimes (due to the <a href="https://www.postgresql.org/docs/current/sql-vacuum.html" target="_blank">vacuum</a> for example). Then, all indexes, without the primary key/others distinction are simply data structures (mostly B-trees as described above) which point to tuples/rows ids/addresses. They do not hold table data, besides the data defined as a part of the index. We there have:
```
index-1: -> table rows references (addresses on the disk)
index-2: -> table rows references (addresses on the disk)
index-3: -> table rows references (addresses on the disk)

table data:
page-1, page-2, page-3, ...page-n
``` 
...indexes are uniformly pointing to the table data on the disk, which is stored independently, in a separate space.

**<a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html" target="_blank">In some databases, like MySQL with the default InnoDB engine, there is a slightly different approach</a>**. We use something called a *Clustered Index* (Oracle database calls this concept Index Organized Table). In that model, each table is required to have a primary key (MySQL will generate one for us, if we do not specify it). Then, table data is stored together with its primary key/index, sorted (because B-tree index is sorted). The main difference here is that the Primary Index does not point to table data somewhere else on the disk, but it contains it directly. What is then the Secondary Index? Because Primary, Clustered Index is the table in fact, other indexes do not point to a table rows ids/addresses, but to the Primary Index. In the Secondary Index, the key is indexed field/fields and the value is a value of associated row Primary Index. On the disk, it is something like:
```
CREATE TABLE user (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX user_name ON user(name);

Primary, clustered index/key (id):
1: (id, name, created_at data - not address to the data, but the data itself) 
2: (id, name, created_at data)
3: (id, name, created at data) 

Secondary index, name:
'Igor': 1 (id value)
'Olek': 2 (id value)
'Anonymous': 3 (id value)
```

This model comes with its own set of advantages and disadvantages. The major advantage is that queries by the primary key are faster, because we can read data directly from the index (index is the table). We also save some space, because data is stored once, in the Primary/Clustered Index. Moreover, range queries by the primary index (only that, not secondary!) are always more efficient, since related data on the disk is not scattered, it is close to each other. The main drawback of this approach is that all Secondary Index queries are slower. In all cases, we first need to gather Primary Index values from Secondary Index(es) and then go again to the Primary Index for table data. Additionally, index is the table, it is sorted on the disk, so there is additional work involved during writes to keep it that way (sorted on the disk).

First model, heap table + indexes, offers a more balanced approach. Most queries, omitting index-only scans (more on that below), require to search tuple (row) addresses in the index structure and then to read data from the disk. Second model, where we have a Clustered Index and the table is the index, makes queries by Primary (Clustered) Index faster, but all searches that make use of Secondary Index(es) are slower. That is because, when we query by Primary Index we only need to search through that data structure (index is the table), but if we use Secondary Index(es) we need to search through their structure to find Primary Index values, which we have to find again in the Primary Index stucture to get the actual table data. What is better? As always, it depends on our use case, but often we do need to have some kind of secondary index (other than just a primary key) and that is where the heap table + indexes model has slightly better performance.

## Composite and Covering Indexes, Index-Only Scan and the selectivity

Can we index more than one field with a single index? Sure, we can. Working on the example:
```
CREATE TABLE event (
  id UUID PRIMARY KEY,
  data JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  type TEXT NOT NULL
);
CREATE INDEX event_timestamp_type 
  ON event USING BTREE (timestamp, type);
```
Now, if we issue a query:
```
SELECT * FROM event
WHERE timestamp >= ? AND type = ?;
```
We can decide based solely on the data in the index which rows satisfy our query condition. If we have an index only on the timestamp field, with this query, we would need to read all matching rows by timestamp field from the index, but then would need to check the type field from read data to filter out not-matching rows. Composite Indexes like this one can make it significantly faster, since we can filter out more rows by reading data from the index itself. Additionally, if we have a query:
```
SELECT timestamp, type FROM event
WHERE timestamp >= ? AND type = ?;
```
...all data we need is in the index. Thus, our index becomes a *Covering Index* (because it covers our data needs). Query can be satisfied by making *index-only scan*, we do not need to read table data at all.

What is worth pointing out is the order of columns does matter a lot here. For query:
```
SELECT * FROM event WHERE timestamp >= ?;
```
...our composite index can absolutely be used, because it is sorted (in the B-tree) by timestamp first, then type.
If we change our query to:
```
SELECT * FROM event WHERE type = ?;
```
Our index will not be used, since type comes after timestamp in the B-tree. Not knowing the timestamp value, this particular index is of no help to us here. Always remember to analyze queries and design indexes accordingly to the real, practical needs.

In Postgres, there is also an option to *INCLUDE* additional data in the index, which is different from the Composite Index. Let's modify our previous example:
```
CREATE TABLE event (
  id UUID PRIMARY KEY,
  data JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  type TEXT NOT NULL
);
CREATE INDEX event_timestamp_type 
 ON event USING BTREE (timestamp)
 INCLUDE (type);
```
The difference there is that only the timestamp field is the key in our index, but leaf nodes of the B-tree also contain type field data. Consequently, we can not speed up where clauses with the condition on *type* field, but query:
```
SELECT timestamp, type
FROM event
WHERE timestamp >= ?;
```
...can be handled completely by data from the index, no need to read the table.

## Partial and Expression Indexes

We can also index only a subset of the table's data, which is called a *Partial Index*. Working with the table:
```
CREATE TABLE test (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NO NULL,
  results TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  success BOOLEAN NOT NULL
);
```
Let's say that successful tests (*success=true*) constitute a minority of all tests (high selectivity) and we are interested in various rows of only successful tests. We can create a *partial (conditional) index* like this one:
```
CREATE INDEX test_successful ON test(success)
  WHERE success = 'true';
```
It has a few benefits:
* Index is smaller, since we index only a subset of the table
* <a href="https://www.postgresql.org/docs/current/storage-hot.html" target="_blank">In some cases</a>, index does not need to be updated when related row is updated (when we update only not indexed fields) - smaller insert/update/delete penalty
* We can express more elaborate constraints on the table. In our example, we can require test name to be unique only if *success=true* for example

Additionally, computed expressions are also possible to index - hence the *Expression Index* name. Using previous *test* table, let's say that we have an index:
```
CREATE INDEX test_name ON test(name);
```
and we often do:
```
SELECT * FROM test WHERE lower(name) = ?;
```
Unfortunately, in that case the index will not be used. Why? Because *lower(name)* is a function call. We have only indexed its argument (name) not the result. To take utilize index in that case, we can create *expression index* like this:
```
CREATE INDEX test_name_lower ON test(lower(name));
```
Drawback of this approach is the additional overhead during every insert/modification, because index value needs to be recomputed. Other than that, its performance is the same as for regular, constant index on values.

## Full-Text Search, finding substrings and the Index

*Index* is also relevant when it comes to searching for arbitrary terms in text documents. There is no magic here - we still need to have a data structure that can make our searches fast. There are many details to the *full-text search* and it is quite complicated subject in itself, but on the high-level, the problem comes down to:
1. we have a document
2. we analyze and process the document (lowercase, remove punctuation, remove stop words etc.) and extract terms (arbitrarily defined) from it
3. we store the *terms -> documents* mapping in the *Inverse Index* to make searching fast

\
As mentioned above (describing GIN index), Inverse Index name comes from full-text search terminology, where Forward Index is just a mapping between documents and their terms. Repeating myself a little, for the noble sake of clarity, let's say that we have the following documents:
```
doc1: {
  "title": "Some title 1",
  "description": "Some long description containing multiple words, and signs?"
},
doc2: {
  "title": Some another title 2",
  "description":" Some another, but also long description containing the word"
}
```
After basic analysis and processing (removing some redundant words and symbols, changing others), we would build the Inverse Index like:
```
some -> doc1, doc2
title -> doc1, doc2
1 -> doc1
2 -> doc2
long -> doc1, doc2
contain -> doc1, doc2 (on purpose without -ing)

...
```
This structure can be then sorted on the disk, built as a B-tree (like PostgreSQL GIN index for example) or stored in whatever other format that makes query fast and allows to answer questions like:
```
Find all documents containing 'some' or 'title'
Find all documents containing 'long'
Find all documents containing 'another' and 'word
```
Without going into too much detail, to search for substrings (parts of words) like 'tit' or 'itle' for title **we need to build a N-grams** (Postgres has a great extension for it, called <a href="https://www.postgresql.org/docs/current/pgtrgm.html" target="_blank">pg_trgm</a>). N-grams are basically all n-length variations of a given word. All 3-grams for the word 'title' are (adding prefix and postfix variations in "" for better search accuracy):
```
"  t", " ti", tit, itl, tle, "le ", "e  "
```
We would then update our inverted index to contain these 3-grams:
```
...
t -> doc1, doc2
ti -> doc1, doc2
tit -> doc1, doc2
itl -> doc1, doc2
tle -> doc1, doc2
le -> doc1, doc2
e -> doc1, doc2
title -> doc1, doc2
...
```
Thanks to that simple trick, we can then respond to queries like:
```
Find all documents containing 'ti'
Find all documents containing 'tle'
```
...responding with doc1 or doc2, both having these phrases thanks to 3-grams for the 'title' word. Needless to say, to respond to longer than 3-word long parts of the words we would need to construct and store 4-grams, 5-grams and so forth, improving our search capability, but increasing index size and storage costs each time.

## Tradeoffs - is it all for free?

As I have mentioned many times, nothing (including indexing) is for free. Indexes can speed up our searches tremendously, but they do have a cost.

First and most important one - most data manipulation statements also need to create/modify index entries. How costly that is depends on the particular database, index type and their implementation. Let's take Postgres (as you might have noticed, I quite like it). There, we have table and index data stored separately.If we have a table without index, each insert needs just to save data in the table space. If we have one index, we need to store both table data in the table data space + add new entry to the index (exact cost of this operation depends on the index type and its implementation). So inserts look like:
```
0 indexes:
insert table data

1 index:
insert table data
insert index1 data

2 indexes:
insert table data
insert index1 data
insert index2 data

...
```
...there is a clear pattern of increasing cost here. The more indexes we have, the costlier our inserts are. Same with deletes:
```
0 indexes:
delete table data

1 index:
delete table data
delete index1 data

2 indexes:
delete table data
delete index1 data
delete index2 data

...
```
Update, in Postgresql, is really a delete + insert so it is even worse (in some circumstances, optimizations like <a href="https://www.postgresql.org/docs/current/storage-hot.html" target="_blank">Heap-Only Tuples</a> can be used, but for most cases it is not true). Summing it up, **the more indexes we have, the costlier our data manipulation operations are**.

Secondly, indexes do take space. How much - it depends on the type. In most cases, an index on a single field takes less space than the table itself, but if we have a few indexes, some also on more than one field, it does add up, and our table can easily take 2 - 3 times more space than without them.

Lastly, having too many indexes can make our queries slower. When we issue a query, **the database needs to decide: in the current situation/context, what is the most efficient way of handling this query?** Is using a particular index faster than doing full table scan? When we have many indexes, sometimes it makes decisions like that harder, adding unnecessary ambiguity and complexity for a database to make a decision. As a rule of thumb: do not add indexes that you are not sure you need. Sometimes, it is also possible to modify an existing index a little, by adding a column or include additional data there, to achieve desired performance improvement without creating a new one.

## Closing thoughts

As we saw, **Index is a crucial data structure for search performance**. Simple idea of having a separate, optimized strictly for searching data structure allows us to fulfill pretty much any type of query in a timely manner, <a href="/reducing-the-search-space.html" target="_blank">almost irrespectively of our data size</a>. It does have its tradeoffs, mainly when it comes to write performance and additional storage needs, but when used wisely, it can make our queries wonderfully performant.

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a target="_blank" href="https://www.youtube.com/watch?v=edAvauoS3L0">Index vs Inverted Index performance in Postgres</a>

<div class="article-delimiter">---</div>

### Notes and resources

1. PostgreSQL indexes
    1. Docs: https://devcenter.heroku.com/articles/postgresql-indexes
    2. Interesting article: https://www.postgresql.org/docs/current/indexes-types.html
    3. About Postgres B-tree implementation: https://www.postgresql.org/docs/current/btree-implementation.html
2. MySQL indexes
    1. Docs: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html 
    2. Interesting article: https://orangematter.solarwinds.com/2022/10/26/mysql-indexes-tutorial
3. PostgreSQL vs MySQL indexing: https://www.youtube.com/watch?v=T9n_-_oLrbM
4. MongoDB (non-relational db) indexes: https://www.mongodb.com/docs/manual/indexes
5. Mentioned many times, amazing blog about SQL indexing in general: https://use-the-index-luke.com
6. Clustering
    1. Clustered collections in MongoDB: https://www.mongodb.com/docs/manual/core/clustered-collections
    2. *CLUSTER* keyword in Postgres: https://www.postgresql.org/docs/current/sql-cluster.html
    3. About clustering tradeoffs: https://use-the-index-luke.com/sql/clustering/index-organized-clustered-index
7. Postgres GIN index
    1. Docs: https://www.postgresql.org/docs/current/gin-intro.html
    2. In-depth analysis 1: https://pganalyze.com/blog/gin-index
    3. In-depth analysis 2: https://www.cybertec-postgresql.com/en/gin-just-an-index-type
8. Different Postgres (applicable also to other databases) query handling strategies, based on available indexes and other criteria: https://www.cybertec-postgresql.com/en/postgresql-indexing-index-scan-vs-bitmap-scan-vs-sequential-scan-basics/
9. Table's layout on the disk and its performance: https://www.cybertec-postgresql.com/en/cluster-improving-postgresql-performance/
10. More details about BRIN index: https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win
11. Full-text search in Postgres: https://www.postgresql.org/docs/current/textsearch-indexes.html
12. Inverted indexes in Elasticsearch: https://www.elastic.co/blog/found-elasticsearch-from-the-bottom-up