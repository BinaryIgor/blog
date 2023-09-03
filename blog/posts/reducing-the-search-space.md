---
{
    "title": "Indexing, Partitioning, Sharding... it's all about reducing the search space!",
    "slug": "reducing-the-search-space",
    "publishedAt": "2023-08-27",
    "timeToRead": "3 minutes",
    "wordsCount": 600,
    "excerpt": "When we work with a set of persisted (somewhere) data, we obviously want our queries to be fast. Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about those problems as a search space problems..."
}
---

## Searching data through space

When we work with a set of (usually persisted somewhere) data, we usually want our queries to be fast. Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about those problems as a search space problems. Basically, how much data needs to be checked in order for our query to be fulfilled?

Building on that, if you search space is huge (you work with 10<sup>6</sup>, 10<sup>9</sup> and more number of rows for example), you need to find a way to make your search space small again. There are a couple ways of doing that, so let's explore them!

## Changing schema

First, seach space also related to the *size* fo each row that we (any given database) needs to scan. So, let's say that we have the following schema of the SQL database: 
```
CREATE TABLE account (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    state TEXT NOT NULL
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```
\
Now, let's say that for 99% of our queries, we only take id and a name, and additionally description is pretty long in practice (like 1000+ characters). Let's say, for the sake of example, that we often do query:
```
SELECT id, name FROM account WHERE name = ?;
```
So, we care only about two fields, additionaly (for some arbitrary reason, I know!) we can't index name field. Let's also assume that we use Postgres database. Now, we will need to do full table scan, to fulfill this query. When our table have 5 columns each row has ~ 5n size (approximating of course, size of columns can vary a lot). Having 10<sup>9</sup> we will need to scan:
```
10 000 000 000 * 5n = 5 000 000 000,
where n is the average size of our columns
``` 

We can simply change the schema to have two tables:
```
CREATE TABLE account (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE account_details (
    id UUID PRIMARY KEY REFERENCES account(id),
    state TEXT NOT NULL
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```
Now, because we are interested only in two columns for our most frequently used query (id, name), our search space is reduced to 
```
10 000 000 000 * 2n = 2 000 000 000,
where n is the average size of our columns
``` 
...which is a ~ 40% of previous size, so our queries need to search through ~ 2.5 less space (5n /2n = 2.5). 

We will get to **partitioning** in a while, but you can also think about it as **vertical partitioning**, since we slice our table into two separate vertical slices. Vertical, because all rows are in both tables, but we have split previous row into two, where 2 columns are in the first table and 3 are in the second one.

## Indexing

Index is just a separate datastructure that:
* have a particular structure that help with searching
* points to a table (collection/document in the case of NoSQL databases) and  

## Partitioning

Partitioning is quite nice.

## Sharding

Sharding is not bad too.

## Conclusion

Some thought-provoking conclusions.
