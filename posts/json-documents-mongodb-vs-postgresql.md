---
{
    "title": "JSON Documents Storage and Search: MongoDB vs PostgreSQL",
    "slug": "json-documents-mongodb-vs-postgresql",
    "startedAt": "2026-01-29",
    "publishedAt": "2026-02-12",
    "excerpt": "Do we really need a dedicated and specialized JSON db? Funny because too short",
    "researchLog": [ 1, 1.5, 2.5, 1, 2.5, 1.5, 2.5, 1.5, 2.5 ],
    "writingLog": [ 2.5 ],
    "tags": [ "dbs" ]
}
---

## Collections of Documents vs Tables of Rows

*Collections of Documents* are an alternative approach of organizing data in the databases. The most widespread and battle-proven way is the SQL way, *Tables of Rows*. What is the difference?

In SQL, we have tables containing individual rows. Each table has a defined schema that every row must obey; there are columns, each has a type and other possible constraints: unique, not null, value checks or references to rows of other tables. Referential integrity lies at the heart of this data approach - guarantee that if row B1 of table B references row A1 of table A, referred row (A1) must exist; orphan rows are not allowed. If we want to delete A1 row, there are two options:
* delete B1 first so that A1 is not referenced anywhere
* have A1 delete *cascade* to B1, automatically deleting it as well

*Tables of Rows* in SQL are therefore focused on explicit schema, enforced types, constraints, validation and relationships between tables, openly defined and carefully guarded.

*Collections of Documents* on the other hand, offer a much more relaxed approach. *Collections* are just namespaces where we insert *documents*. Documents are objects of any schema and format (JSON mostly). There are no enforced types, no constraints, no guarded references between documents in different collections. In the same collection, we might have documents of completely different schema - flexibility and openess to any data and column types rules here. In tables, rows have columns of simple, scalar types (mostly) - numbers, ids, strings, dates and so on. In collections, documents have fields comprising of both simple and composite types - like arrays and other documents, nested inside. The same field in different documents beloning to the same collection might have different types as well - almost anything is allowed here.

Why this context, when our main goal is to simply compare JSON documents storage & search support in Mongo vs Postgres?

Well, **MongoDB was designed and created as a document database first and foremost**, not an SQL one (NoSQL). It is focused on optimized on this particular use case and a way of storing and accessing data. **PostgreSQL on the other hand, is a relational, SQL database that later on provided support to composite column types like ARRAY, JSON/JSONB and others.** Over the years, it has extended and optimized support for storing JSON documents in its own binary JSONB format, as well as added more ways to index and query data of this type.

Let's then dive in and see for *JSON Documents Storage and Search:*
> Does MongoDB still have an edge as a document-oriented database? Is Postgres better or at least good-enough to stick with it, since it is a more universal database?

## Performance

To test performance from multiple angles, we operate on two different collections with the following schema:
```
record Account(UUID id,
               String name,
               String type,
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
db.accounts.createIndex({ createdAt: 1 });

db.createCollection("products");
db.products.createIndex({ name: 1 }, { unique: true });
db.products.createIndex({ categories: 1 });
db.products.createIndex({ tags: 1 });
db.products.createIndex({ createdAt: 1 });

// PostgreSQL

CREATE TABLE accounts (data JSONB NOT NULL);
CREATE INDEX idx_accounts_id
  ON accounts ((data->>'id'));
CREATE INDEX idx_accounts_created_at
  ON accounts ((data->>'created_at'));

CREATE TABLE products (data JSONB NOT NULL);
CREATE INDEX idx_products_id
  ON products ((data->>'id'));
CREATE UNIQUE INDEX unique_idx_products_name
  ON products ((data->>'name'));
CREATE INDEX idx_products_categories 
  ON products USING GIN ((data->'categories'));
CREATE INDEX idx_products_tags 
  ON products USING GIN ((data->'tags'));
CREATE INDEX idx_products_created_at
  ON products ((data->>'created_at'));
```

## Storage and Search

Examples, api, operators


## Ponderings

Do we really need a dedicated and specialized JSON db?

Benchmarks:
1. Light-weight, small documents like a user/account
2. Heavy-weight, large objects that do not fit into a single page - Post{id, content, authorId, createdAt, updatedAt, tags}


What to compare:
1. Performance
2. Size of the disk
3. Querying flexibility - indexes tradeoffs & keeps in mind
4. Other factors? Tools? Easy of use? Another applications & (?) these tools use cases & possibilities? JSON vs JSONB?
5. VACUUM tradeoffs for big docs?
6. GIN indexes do not support range queries directly on JSONB values. They are optimized for equality, containment, and existence checks (e.g., @>, ?, @?, @@) 
7. Same as above is true for sorting!
8. Remember to emphasize going beyond the page size & consequences in the examples

Queries:
1. Syntax
2. Equality, existence, nested, ranges

Two data shapes. Small documents - accounts:
```
{
  "id": UUID,
  "name": String (5 to 50 chars),
  "type": Enum
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "version": Long    
}
```
Bigger documents - products:
```
{
  "id": UUID,
  "name": String, 5 to 50 chars,
  "description": String, 1000 - 5000 chars,
  "categories": String[],
  "tags": String[],
  "variations": [
    {
      "type": Enum,
      "value": String    
    }
  ]
  "relatedProducts": UUID[],
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "version": Long
}
```

Think of it this way:

B-tree: “I know exactly what value I’m looking for.”

GIN: “I want to search inside documents for structural patterns.”

MongoDB hides this distinction. Postgres makes you choose, and rewards you for choosing well.

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Note on the increasing fuziness of collections vs tables distinction with Mongo validators and Postgres ARRAY/JSON
1. https://rxdb.info/articles/json-database.html
2. https://learn.microsoft.com/en-us/sql/relational-databases/json/store-json-documents-in-sql-tables?view=sql-server-ver17
3. https://www.mongodb.com/resources/basics/databases/json-database
4. https://portavita.github.io/2018-10-31-blog_A_JSON_use_case_comparison_between_PostgreSQL_and_MongoDB/
5. https://documentdatabase.org/blog/json-performance-postgres-vs-mongodb/
6. https://chatgpt.com/c/697868e0-75ac-8329-a91c-b281d38bd4ed
7. When using w: 1 in a write concern, the write operation is acknowledged after it has been successfully applied to the primary's memory. However, w: 1 alone does not guarantee durability unless combined with j: true. "Starting in MongoDB 6.1, journaling is always enabled. As a result, MongoDB removes the storage.journal.enabled option and the corresponding --journal and --nojournal command-line options.": https://www.mongodb.com/docs/manual/core/journaling/
8. https://en.wikipedia.org/wiki/Document-oriented_database
9. Interestingly, for MVCC, MongoDB stores previous (up to a needed one) document versions in memory, overriding current location on the disk immediately: https://www.mongodb.com/docs/manual/core/wiredtiger/#snapshots-and-checkpoints
10. `db.serverStatus().connections`
11. "The universe likes systems that evolve rather than declare certainty too soon — databases included."
12. https://www.bytebase.com/blog/postgres-vs-mongodb/
13. https://www.postgresql.org/message-id/CA%2BTgmoagjFfJst%3D9kSu4rZatCE8SRuOQCH_h-_YW%3D4_c687GTA%40mail.gmail.com
14. https://www.tigerdata.com/learn/handling-large-objects-in-postgres - "This means that when the combined size of all fields in a tuple exceeds approximately 2 kB, Postgres automatically offloads the excess data using TOAST (The Oversized-Attribute Storage Technique)."
15. https://www.tigerdata.com/blog/what-is-toast-and-why-it-isnt-enough-for-data-compression-in-postgres
16. https://chatgpt.com/c/69806083-cdfc-8333-9d8d-e57d2f20c472
17. https://www.postgresql.org/docs/current/wal-async-commit.html
18. Types in Mongo? Do we need to care about them at all?
19. https://www.crunchydata.com/blog/postgresl-unlogged-tables
20. https://chatgpt.com/c/698711b9-64d4-8331-a9b5-925f43e7c3a3 - Mongo Durability Tradeoffs { w: "majority" }

</div>