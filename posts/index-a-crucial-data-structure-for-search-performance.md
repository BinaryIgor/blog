---
{
    "title": "Index: a crucial data structure for search performance",
    "slug": "index-a-crucial-data-structure-for-search-performance",
    "publishedAt": "2023-10-08",
    "startedAt": "2023-09-26",
    "timeToRead": "23 minutes",
    "wordsCount": 2909,
    "excerpt": "There are many variations and types of it, depending on the underlying database/search engine and its purpose, but the core concept is always the same: <em>let's have an additional data structure that points to/references the original data and makes searching fast.</em>",
    "writingLog": [ 2, 1.5, 3.5, 2.5, 1.5, 3.5, 1, 4, 4.5, 3, 3 ]
}
---

## Additional data structure

What is an index? It is a simple idea of having additional data structure that helps to search for some piece of data in our dataset. There are many variations and types of it, depending on the underlying database/search engine and its purpose, but the core concept is always the same:
> Let's have an additional data structure that points to/references the original data and makes searching fast.

## Index types by structure

Using <a href="https://www.postgresql.org/docs/current/indexes-types.html" >PostgreSQL</a> as our reference for various index types.

### B-tree 

**Most databases (PostgreSQL, MySQL, MongoDB, SQLite) support <a href="https://en.wikipedia.org/wiki/B-tree" >B-tree</a> index and it is by far the most commonly used data structure for indexing.** That is because of its good performance characteristics - *O(log<sub>n</sub>)* - for both equality and range search operations. The ability to use range operations means that data needs to be comparable and sortable, which in turn means that this index can be used to support and speed up sorting operations as well. B-tree is a <span class="nowrap">self-balancing</span> tree data structure, with a variable number of children per node (as opposed to 2 children per node <a href="https://en.wikipedia.org/wiki/Binary_tree" >binary tree</a>). <a href="https://use-the-index-luke.com/sql/anatomy/the-tree" >It looks something like this</a>:
```
             (10|22)
             /     \
    (1|2|9|10)     (22|23|30)
    /        \     /        \
(...)        (10) (...)     (30|32)   
 |||          |              |  |
 rid          rid          rid  rid

Note: 
rid stands for row ids. 
These are pointers/references that allow a database
to find rows data on the disk.
```

B-tree keeps itself balanced, depth/height is kept low and the number of children per node grows as needed. Searching for a specific value is really fast, because with each comparison we can eliminate a huge range of options. Let's try to get 32 for example:
1. start at (10|22), 32 is greater, so go to the right
2. (22|23|30), 32 is greater, so go the right again
3. (30|32) - we have it, take associated row ids and read data from the disk

Usually, each value is repeated in the child nodes until the leaf nodes. For example, 10 is in the root, but also in the first node to the left, and then right to the left (leaf node). To optimize certain operations (like range queries) leaf nodes are all connected by a doubly linked list (<a href="https://use-the-index-luke.com/sql/anatomy" >for details of the anatomy, check out amazing "Use the Index, Luke!" blog</a>). Then leaf nodes have row ids, which are references (addresses) to the table rows data. 

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

Hash index is quite useful when we look to support only equality operations. Underneath the hood, as the name suggests, it uses a <a href="https://en.wikipedia.org/wiki/Hash_table" >hash map/table</a>. With good implementation, in theory, hash map search complexity is *O(1)*. Sometimes, a hash map needs to be rebalanced, so in practice it is *O(1) + C* (some amortized constant). But still, for equality only operations it is the fastest option. Hence also there are key-value only databases/stores, like Redis or <a href="https://etcd.io" >Etcd</a>, which are using this data structure.

### GIN

GIN stands for <a href="https://www.postgresql.org/docs/current/gin-intro.html" >Generalized Inverted Index</a>. Why inverted? It comes from the full-text search terminology. There, we work on documents and a *Forward Index* is something like:
```
Documents:
document1: "Let's say something special" 
document2: "Shorter one" 

Forward Index:
document1 -> "let's", "say", "something", "special"
document2 -> "shorter", "one"
```

Which basically is a mapping between documents and words (terms) that they contain. The *Inverted Index* is then... inverted. So a list of words (terms) and documents containing them:
```
one -> document1, document2
second -> document1
xyz -> document2, document3, document4
```

\
In Postgres, it means that **we have a data structure, also B-tree in fact, where each row can appear multiple times and we can index complex/composite types like arrays, json or text documents**. Its structure is similar to the B-tree from the description above, but leaf nodes have a key (word/term from the document for example) and a list of matching tuples (<a href="https://www.crunchydata.com/blog/challenging-postgres-terminology" >tuple and record are just other names for a table row</a>). The main difference between *GIN* and a standard B-tree index is that each tuple (row) can appear many times in this index, being associated with a different key, plus, it defines <a href="https://www.postgresql.org/docs/current/gin-builtin-opclasses.html" >its own operators for querying</a> that each data type (like array or json/jsonb) needs to support. Let's say that we have the table:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL
);

CREATE INDEX account_attributes
  ON account USING GIN (attributes);
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

<a href="https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING" >Field names need to be combined with values before inserting them in the B-tree nodes.</a> For example, we might have the following entries in the B-tree:
```
(value:name)

CREATED:state -> tuple1
ACTIVATED:state -> tuple2, tuple3
22:country_code -> tuple1
101:country_code -> tuple2, tuple3
```
...thanks to that approach, we can use B-tree structure to search through custom, complex types (with more than one value). 

### GIST

Generalized Search Tree. In Postgres, **it is just a template for a balanced, search tree based index on top of which we can build our own implementation**. One of its most commonly used instances is <a href="https://en.wikipedia.org/wiki/R-tree" ><span class="nowrap">R-tree</span></a> used for searching through multidimensional data, such as rectangles or geographic coordinates. Why is it useful in this context? We can define our own comparison and equality operators (and others, custom ones) to query our data appropriately. Using coordinates, is (0, 1) greater than (1, 0)? Do questions like that even have a place with this data type? We can define these operators as we wish, which allows for new usages of tree-based indexes, like mentioned above R-tree. There is an implementation of it in <a href="https://www.postgresql.org/docs/current/gist-builtin-opclasses.html" >PostgreSQL itself</a> and there is also the <a href="https://postgis.net/workshops/postgis-intro/indexing.html" >PostGIS project</a> with its own implementation of R-Tree.

### BRIN

Its name stands for Block Range INdex. **The more *orderly* our inserts are, the more useful this index is. The more naturally incremental/decremental the indexed field is, the more efficient this index becomes.** It is then helpful for fields that have some natural correlation with their physical location within the table. By natural correlation I mean something like date/timestamp/version fields where we always/almost always insert new records (according to this field), thus they are sorted on the disk  according to the insertion order. Let's say that we have the table:
```
CREATE TABLE event (
  id UUID PRIMARY KEY,
  name TEXT,
  timestamp TIMESTAMP
);

CREATE INDEX event_timestamp 
  ON event USING BRIN (timestamp);
```

We assume that this table is append-only and we insert new data with larger and larger timestamps (as events occur). The more this is the case, the more *BRIN* index is beneficial, because its structure on the disk is:
```
Note:
page ranges are pages on the disk, where table data is located.

page range 1: 1 - 10
values: 2023-10-05T00:00:00 - 2023-10-05T05:00:00 

page range 2: 10 - 20 
values: 2023-10-05T05:00:00 - 2023-10-05T08:22:22 

page range 3: 20 - 30 
values: 2023-10-05T08:22:22 - 2023-10-05T11:00:10 

...
```
...it is a map where page ranges are keys and range of values are values that we can find there, on the disk pages. If we have the query:
```
SELECT * FROM event
WHERE timestamp = '2023-10-05T01:00:00';
```
...we load the index into memory and check in which page ranges this value can be located. We check if *page range 1* contains rows with *timestamp=<span class="nowrap">2023-10-05T01:00:00</span>* - yes, it does. We also check *page range 2* and *page range 3* - they do not contain rows with this particular timestamp value. We now know that rows with *timestamp=<span class="nowrap">2023-10-05T01:00:00</span>* can be found only on pages 1 to 10. We then read these pages from the disk and take rows that we are interested in.

However, if our inserts/modifications are random, table layout on the disk will also be random - in that case *BRIN* index will not give us much. Why? In many page ranges there will be overlapping values, so we will need to read significantly more data to satisfy a given query. With random inserts order, our index can look something like this:
```
page range 1: 1 - 10
values: 2023-10-05T00:00:00 - 2023-10-05T05:00:00 

page range 2: 10 - 20 
values: 2023-10-05T01:00:00 - 2023-10-05T06:25:00 

page range 3: 20 - 30 
values: 2023-10-05T01:30:00 - 2023-10-05T10:11:00 

...
```
If we search for rows with *timestamp=<span class="nowrap">2023-10-05T01:33:00</span>*, they can be anywhere in the page range 1, 2 or 3. We need to scan lots of data to satisfiy our query, because our table does not have an orderly layout. 

**<a href="https://www.postgresql.org/docs/current/storage-page-layout.html" >If our table is sorted on the disk, is stored on 100 pages</a> and we have 10 page ranges in the index, for any single value we will only need to check a single page range, which is just 10% of the whole table**. Sounds familiar? It is because the mechanism and performance benefits are quite similar to a *table partitioning*, where the table is divided into smaller, more manageable sections (subtables) for improved query performance. 

## Clustered, Primary and Secondary Indexes

There is also a distinction between index types depending on how a particular database decides to store data on the disk.

**<a href="https://dev.mysql.com/doc/refman/8.0/en/innodb-introduction.html" >In some databases, like MySQL with the default InnoDB engine, we use something called a *Clustered Index* </a>** (Oracle database calls this concept Index Organized Table). In that model, each table is required to have a primary key/index. Then, table data is stored together with its primary key/index, sorted on the disk, because the B-tree index is sorted. **Primary Index does not point to table data, which is somewhere else on the disk, but it contains it directly.** What is a Secondary Index? Because Primary, Clustered Index is the table in fact, other indexes do not point to a table row ids, but to the Primary Index. In the *Secondary Index*, the key is indexed field(s) and the value is a value of associated row Primary Index. It looks something like this:
```
CREATE TABLE user (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX user_name ON user (name);

Primary, clustered index/key (id):
1: (id, name, created_at data - not address to the data, but the data itself) 
2: (id, name, created_at data)
3: (id, name, created at data) 

Secondary index on the name field:
'Igor': 1 (id value)
'Olek': 2 (id value)
'Anonymous': 3 (id value)
```

The major advantage of this approach is that queries by the primary key are faster, because we can read data directly from the index (index is the table). We also save some space, because data is stored once, in the *Primary/Clustered Index*. Moreover, range queries by the primary index (only by it, not the secondary ones!) are always more efficient, since related data on the disk is not scattered, it is kept close to each other. The main drawback is that all Secondary Index queries are slower. When we search by the Secondary Index value(s), we first need to gather Primary Index values from the Secondary Index and then go again to the Primary Index for table data. Additionally, Primary Index is the table, it is sorted on the disk, so there is additional work involved during writes to keep it that way (sorted on the disk).

**In Postgres, there is no primary versus secondary index differentiation**. In that model, there is a clear distinction between index and the table data. Heap table (called that because it is not ordered) is stored on the disk in the insertion/update order, which can be either random or ordered, and it can move on the disk sometimes (due to processes like <a href="https://www.postgresql.org/docs/current/sql-vacuum.html" >vacuum</a> for example). All indexes, without the primary/secondary distinction, are simply data structures (mostly B-trees as described above) which point to row ids/addresses. They do not hold table data, besides the data defined as a part of the index. We there have:
```
index1: -> table rows references (addresses on the disk)
index2: -> table rows references (addresses on the disk)
index3: -> table rows references (addresses on the disk)

table data:
page1, page2, page3, ...pageN
``` 
...indexes are uniformly pointing to the table data on the disk, which is stored independently, in a separate space.

**Second model, heap table + indexes, offers a more balanced approach.** 
In the first approach, where we have a Clustered Index and the table is the index, queries by Primary (Clustered) Index are faster, but all searches that make use of Secondary Index(es) are slower. That is because, when we query by Primary Index we only need to search through that data structure (index is the table), but if we use Secondary Index(es) we need to search through their structure to find Primary Index values, which we have to find again in the Primary Index structure to get the actual table data. Also, if our Primary Index is not a naturally increasing value (like auto incrementing id) and/or we have lots of deletes, there is additional work involved during writes to keep Primary Index structure balanced. What is better? As always, it depends on our use case, but often we do need to query a table by various columns and have some kind of secondary index (other than just a primary key) and this is where the heap table + indexes model offers slightly better performance tradeoffs.

## Composite and Covering Indexes, Index-Only Scan and the selectivity

Can we index more than one field with a single index? Sure we can. Working on the example:
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
Now, if we issue the query:
```
SELECT * FROM event
WHERE timestamp >= ? AND type = ?;
```
We can decide based solely on the data in the index which rows satisfy our query condition. If we have an index only on the timestamp field, with this query, we would need to read all matching rows by timestamp field from the index, but then we would need to read table data and check the type field to filter out not-matching rows. *Composite Index*, like this one, can make it significantly faster, since we can filter out more rows by reading data from the index itself, without a need to fetch unnecessary table rows. Additionally, if we have the query:
```
SELECT timestamp, type FROM event
WHERE timestamp >= ? AND type = ?;
```
...all data we need is in the index. Thus, **our index becomes a *Covering Index* (because it covers all our data needs). Query can be satisfied by making *index-only scan*, we do not need to read table data at all.**

What is worth pointing out is that the order of columns does matter a lot here. For the query:
```
SELECT * FROM event WHERE timestamp >= ?;
```
...our composite index can absolutely be used, because it is sorted (in the B-tree) by timestamp first, then type.
If we change our query to:
```
SELECT * FROM event WHERE type = ?;
```
Our index will not be used, since type comes after timestamp in the B-tree. In the index, our key is: timestamp, type - sorted in that order. Not knowing the timestamp value, this particular index is of no help here, because to find any possible type value, we would need to check all B-tree index nodes.

In Postgres, **there is also an option to *INCLUDE* additional data in the index**, which is different from a *Composite Index*. Let's modify our previous example:
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
The difference here is that only the timestamp field is a key in our index, but leaf nodes of the B-tree also contain type field data. Consequently, we can not speed up where clauses with the condition on *type* field, but the query:
```
SELECT timestamp, type
FROM event
WHERE timestamp >= ?;
```
...can be handled completely by reading data from the index, there is no need to read the table.

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
Let's say that successful tests (*success=true*) constitute a minority of all tests (high selectivity) and we are interested in various data of only successful tests. We can create a *partial (conditional) index* like this one:
```
CREATE INDEX test_successful ON test (success)
  WHERE success = 'true';
```
It has a few benefits:
* Index is smaller, since we index only a subset of the table
* <a href="https://www.postgresql.org/docs/current/storage-hot.html" >In more cases</a>, index does not need to be updated when a related row is updated (when we update only not indexed fields) - smaller insert/update/delete penalty
* We can express more elaborate constraints on the table. In our example, we can require the test name to be unique only if *success=true* for instance

Additionally, computed expressions are also possible to index - hence the *Expression Index* name. Using previous *test* table, let's say that we have the index:
```
CREATE INDEX test_name ON test (name);
```
and we often do:
```
SELECT * FROM test WHERE lower(name) = ?;
```
Unfortunately, in this case the index will not be used. Why? Because *lower(name)* is a function call. We have only indexed its argument (name) not the result. To benefit from indexing, we can create an *expression index* like this:
```
CREATE INDEX test_name_lower ON test (lower(name));
```
The drawback to this approach is an additional overhead during every insert or modification, as the index value needs to be recomputed. Other than that, its performance is the same as for regular index on constant values.

## Full-Text Search, finding substrings and the Index

Index is also relevant when it comes to searching for arbitrary terms in text documents. **There is no magic here - we still need to have a data structure that can make our searches fast.** There are many details to the *full-text search* and it is quite a complex subject in itself, but on the high-level, the problem comes down to:
1. we have a document
2. we analyze and process the document (lowercase it, remove punctuation, remove stop words etc.), and extract terms (arbitrarily defined) from it
3. we store the *terms -> documents* mapping in the *Inverse Index* to make searching fast

\
As mentioned above (<a href="#gin">describing GIN index</a>), Inverse Index name comes from full-text search terminology, where Forward Index is just a mapping between documents and their terms. Repeating myself a little, for the noble sake of clarity, let's say that we have the following documents:
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
After basic analysis and processing (removing some redundant words and symbols, changing others by following specific language rules or custom ones), we would build the Inverse Index like this:
```
some -> doc1, doc2
title -> doc1, doc2
1 -> doc1
2 -> doc2
long -> doc1, doc2
contain -> doc1, doc2 (on purpose without -ing)

...
```
Afterward, this structure can be sorted on the disk, organized as a B-tree (similar to the PostgreSQL GIN index), or stored in any other format that optimizes query performance and enables answering questions such as:
```
Find all documents containing 'some' or 'title'
Find all documents containing 'long'
Find all documents containing 'another' and 'word
```
Without going into too much detail, to search for substrings (parts of words) like 'tit' or 'itle' for title, **we need to build <span class="nowrap">N-grams</span>** (Postgres has a great extension for it, called <a href="https://www.postgresql.org/docs/current/pgtrgm.html" >pg_trgm</a>). <span class="nowrap">N-grams</span> are essentially all n-length variations of a given word. For the word 'title', all 3-grams are (adding prefix and postfix variations in " " for better search accuracy):
```
"  t", " ti", tit, itl, tle, "le ", "e  "
```
We would then update our inverted index to contain these <span class="nowrap">3-grams</span>:
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
...returning doc1 and doc2, both having these phrases thanks to <span class="nowrap">3-grams</span> of the 'title' word. Needless to say, to respond to queries containing longer than three-word parts of words, we need to create and store <span class="nowrap">4-grams</span>, <span class="nowrap">5-grams</span>, and so on. This enhances our search capabilities but also increases the index size and storage costs.

## Tradeoffs - is it all for free?

As I have mentioned many times, nothing (including indexing) is for free. Indexes can speed up our searches tremendously, but they do have a cost.

First and the most important drawback - **majority of data manipulation statements also need to create/modify index entries**. How costly that is depends on the particular database, index type and their implementation. Let's take Postgres as an example (as you might have noticed, I quite like it). There, we have table and index data stored separately. If we have a table without index, each insert needs just to save data in the table space. If we have one index, we need to store table data in the table data space + add a new entry to the index (exact cost of this operation depends on the index type and its implementation). So inserts look like:
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

3 indexes:
insert table data
insert index1 data
insert index2 data
insert index3 data

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

3 indexes:
delete table data
delete index1 data
delete index2 data
delete index3 data

...
```
Update, in Postgres, is really a delete + insert so it is even worse (in some circumstances, optimizations like <a href="https://www.postgresql.org/docs/current/storage-hot.html" >Heap-Only Tuples</a> can be used, but for most cases it is not true). Summing it up, **the more indexes we have, the costlier our data manipulation operations are**.

Secondly, **indexes do take space**. How much - it depends on the type. In most cases, an index on a single field takes less space than the table itself, but if we have a few indexes, some also on more than one field, it does add up. Our table can easily take 2 - 3 times more space than without them.

Lastly, having too many indexes can make our queries slower. **When we issue a query, the database needs to decide: in the current situation, what is the most efficient way of handling this query?** Is using a particular index faster than doing full table scan? When we have many indexes, sometimes it makes these decisions harder, adding unnecessary ambiguity and complexity for a database to make optimal decisions. As a rule of thumb: do not add indexes that you are not sure you need. Sometimes, it is also possible to modify an existing index a little, by adding a column or include additional data there, and achieve desired performance improvement without creating a new one.

## Closing thoughts

As we saw, **Index is a crucial data structure for search performance**. Simple idea of having a separate, optimized strictly for searching data structure allows us to fulfill pretty much any type of query in a timely manner, <a href="/reducing-the-search-space.html" >almost irrespectively of our data size</a>. It does have its tradeoffs, mainly when it comes to write performance and additional storage needs, but when used wisely, it can make our queries wonderfully performant.

<div class="article-delimiter">---</div>

### Related videos on my <a  href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a  href="https://www.youtube.com/watch?v=edAvauoS3L0">Index vs Inverted Index performance in Postgres</a>

<div class="article-delimiter">---</div>

### Notes and resources

1. PostgreSQL indexes
    1. Docs: https://www.postgresql.org/docs/current/indexes-types.html
    2. Interesting article: https://devcenter.heroku.com/articles/postgresql-indexes
    3. About Postgres B-tree implementation: https://www.postgresql.org/docs/current/btree-implementation.html
2. MySQL indexes
    1. Docs: https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html 
    2. Interesting article: https://orangematter.solarwinds.com/2022/10/26/mysql-indexes-tutorial
3. PostgreSQL vs MySQL indexing: https://www.youtube.com/watch?v=T9n_-_oLrbM
4. MongoDB (non-relational db) indexes: https://www.mongodb.com/docs/manual/indexes
5. Mentioned many times, amazing blog about SQL indexing and performance in general: https://use-the-index-luke.com
6. Clustering
    1. Clustered collections in MongoDB: https://www.mongodb.com/docs/manual/core/clustered-collections
    2. *CLUSTER* keyword in Postgres: https://www.postgresql.org/docs/current/sql-cluster.html
    3. Clustering tradeoffs: https://use-the-index-luke.com/sql/clustering/index-organized-clustered-index
7. Postgres GIN index
    1. Docs: https://www.postgresql.org/docs/current/gin-intro.html
    2. In-depth analysis 1: https://pganalyze.com/blog/gin-index
    3. In-depth analysis 2: https://www.cybertec-postgresql.com/en/gin-just-an-index-type
8. Different Postgres (applicable also to other databases) query handling strategies, based on available indexes and other criteria: https://www.cybertec-postgresql.com/en/postgresql-indexing-index-scan-vs-bitmap-scan-vs-sequential-scan-basics/
9. Table layout on the disk and its performance: https://www.cybertec-postgresql.com/en/cluster-improving-postgresql-performance/
10. More details about BRIN index: https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win
11. Full-text search in Postgres: https://www.postgresql.org/docs/current/textsearch-indexes.html
12. Inverted Index in <a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/elasticsearch-intro.html">Elasticsearch</a>: https://www.elastic.co/blog/found-elasticsearch-from-the-bottom-up