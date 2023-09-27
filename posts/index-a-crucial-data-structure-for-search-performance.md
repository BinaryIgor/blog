---
{
    "title": "Index: a crucial data structure for search performance",
    "slug": "index-a-crucial-structure-for-query-performance",
    "publishedAt": "2023-10-01",
    "timeToRead": "10 minutes",
    "wordsCount": 2000,
    "excerpt": "Without index - almost nothing above certain size can be fast",
    "writingLog": [ 2, 1.5 ]
}
---

## Additional datastructure

What is an index? It is a simple idea of having additional data structure that helps to search for arbtrary data in our dataset. There are many variations and types of it, depending on the underlying database and its purpose, but the core concept is always the same:
> let's have an additional data structure that points to the orignal  data and makes searching fast.


## Details

In Postgresql most commonly used index types are:
* B-tree
* Hash
* GIN (Generalized Inverted Index)
* BRIN

?? Not postgres?

First (B-tree) is implemented as B-tree. 
```
    A
   B  C
  DE  FG
  ||
 rows 
```

## Clustered, Primary and Secondary indexes

## Index and the Inversed Index


## Full text search??


## Tradeoffs

## Closing thoughts

<div class="article-delimiter">---</div>

### Notes and resources
1. https://www.citusdata.com/blog/2016/07/14/choosing-nosql-hstore-json-jsonb/
2. https://www.freecodecamp.org/news/postgresql-indexing-strategies/
3. https://www.postgresqltutorial.com/postgresql-indexes/postgresql-index-types/
4. https://devcenter.heroku.com/articles/postgresql-indexes
5. https://blog.devart.com/postgresql-indexes.html
6. https://www.postgresql.org/docs/current/gin-intro.html
7. https://www.cybertec-postgresql.com/en/postgresql-indexing-index-scan-vs-bitmap-scan-vs-sequential-scan-basics/
8. https://pganalyze.com/blog/gin-index
9. https://en.wikipedia.org/wiki/Inverted_index
10. https://www.cybertec-postgresql.com/en/cluster-improving-postgresql-performance/
11. http://www.sai.msu.su/~megera/wiki/Gin
12. http://sigaev.ru/gin/Gin.pdf
13. https://www.cybertec-postgresql.com/en/gin-just-an-index-type/
14. https://www.crunchydata.com/blog/postgres-indexing-when-does-brin-win
15. https://www.mongodb.com/docs/manual/indexes/
16. https://medium.com/@xoor/indexing-mongodb-with-elasticsearch-2c428b676343
17. https://www.postgresql.org/docs/current/textsearch-indexes.html
18. https://www.alibabacloud.com/blog/598966
19. https://dev.mysql.com/doc/refman/8.0/en/innodb-fulltext-index.html
20. https://en.wikipedia.org/wiki/R-tree
21. https://orangematter.solarwinds.com/2022/10/26/mysql-indexes-tutorial/#:~:text=for%20table%20data.-,Secondary%20Indexes,and%20maintained%20in%20sorted%20order.
22. https://medium.com/@sukorenomw/when-to-use-postgresql-full-text-search-and-trigram-indexes-4c7c36223421
23. https://rachbelaid.com/postgres-full-text-search-is-good-enough
24. https://dev.mysql.com/doc/refman/8.0/en/innodb-index-types.html
25. https://dev.mysql.com/doc/refman/8.0/en/mysql-indexes.html