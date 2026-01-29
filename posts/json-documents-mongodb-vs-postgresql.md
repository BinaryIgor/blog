---
{
    "title": "JSON Documents Storage and Search: MongoDB vs PostgreSQL",
    "slug": "json-documents-mongodb-vs-postgresql",
    "startedAt": "2026-01-29",
    "publishedAt": "2026-02-12",
    "excerpt": "Do we really need a dedicated and specialized JSON db? Funny because too short",
    "researchLog": [ 1, 1.5 ],
    "writingLog": [  ],
    "tags": [ "dbs" ]
}
---

Do we really need a dedicated and specialized JSON db?

Benchmarks:
1. Light-weight, small documents like a user/account
2. Heavy-weight, large objects that do not fit into a single page - Post{id, content, authorId, createdAt, updatedAt, tags}

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

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

</div>