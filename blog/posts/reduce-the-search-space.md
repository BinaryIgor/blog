---
{
    "title": "Reduce the search space",
    "slug": "reduce-the-search-space",
    "publishedAt": "2023-08-27",
    "excerpt": "When we work with a set of persisted (somewhere) data, we obviously want our queries to be fast. Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about those problems as a search space problems..."
}
---

## Searching through space

When we work with a set of persisted (somewhere)  data, we obviously want our queries to be fast. 
Whenever I think about optimizing certain data query, be it SQL (mostly) or NoSQL, I find it useful to think about those problems as a search space problems. What I mean is that, you query will be fast, if your search space is small.
Building on that, if you search space is huge (you work with $10^6$, $10^9$ and more number of rows for example), you need to find a way to make your search space small again. There are a couple ways of doing that, so let's explore them!

..before, that testing image look:
<figure>
    <img src="{{ imagesPath }}/postgres_resized.png" alt="Glorious postgres" title="Glorious postgres">
    <figcaption>Glorious postgres</figcaption>
</figure>

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
So, we care only about two fields, additionaly (for some arbtrary reason, I know!) we can't index name field. Let's assume that we use Postgres database. Now, we will need to do full table scan, to fulfill this query. When our table have 5 columns each row has ~ 5n size (approximating of course, size of columns can vary a lot). Having $10^9$ we will need to scan:
```
10 000 000 000 * 5n = 5 000 000 000,
where n is the averaged size of our columns
``` 

Simply changing schema to something like:
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
where n is the averaged size of our columns
``` 
...which is a 40% of previous size, so our queries need to search through ~ 2.5 less space. 

We will get to **partitioning** later, but you can also think about it as **vertical partitioning**, since we slice our table into two separate vertical slices really. Vertical, because all rows are in both tables, but we have split previous row into two, where 2 columns are in the first table and 3 are in the second one.

## Indexing

Index is just a separate datastructure that:
* have a particular structure that help with searching
points to a table (collection/document in the case of NoSQL databases) and  

## Partitioning

Partitioning is quite nice.

## Sharding

Sharding is not bad too.

## Conclusion

Some thought-provoking conclusions.
