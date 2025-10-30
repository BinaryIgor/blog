---
{
    "title": "Optimistic vs Pessimistic Locking: conflicts and lost updates, retries and blocking",
    "slug": "optimistic-vs-pessimistic-locking",
    "startedAt": "2025-10-31",
    "publishedAt": "2025-11-03",
    "excerpt": "Locking is everywhere!",
    "researchLog": [ 2.5, 1.5 ],
    "writingLog": [ 2, 2.5 ],
    "tags": [ "dbs" ]
}
---

## Conflicts and Lost Updates

In many application and systems, we face the possibility of concurrent, often conflicting and potentially lost, updates. One such possibility is when we have a *user-facing REST endpoint* of the kind:
```
@PatchMapping("/campaigns/{id}")
void updateCampaign(UUID id, UpdateCampaignRequest request) {
  var campaign = campaignRepository.findById(id);
  var updatedCampaign = campaign.withBudget(request.budget());
  campaignRepository.save(campaign);
}

// campaign = { id: 1, budget: 0 }
// user1 request = id: 1, { budget: 1000 }
// user2 request = id: 1, { budget: 2000 }
```

Well, *user1* sees budget of 0 and decides to update it to 1000; *user2* sees the same and decides to update it to 2000. The update of *user1* was *essentialy lost* - *user2* was not even aware that *user1* was changing anything. Additionally, *user1* might go back to their business thinking that the buget is 1000, not 2000.

The example above involved two human beings, intentionally modifying data as they see fit. Another common situation is when soulless services communicate asynchronously:
```
@Transactional
void onClick(ClickEvent click) {
  var budget = bugetRepository.findById(click.budgetId());
  
  long newAvailableAmount;
  if (click.price() > budget.availableAmount()) {
    newAvailableAmount = 0;
    // triggers some kind of budget deactivation process
  } else {
    newAvailableAmount = budget.availableAmount() - click.price();
  }

  budgetRepository.save(budget.withAvailableAmount(newAvailableAmount));
}

// budget = { id: 1, availableAmount: 100 }
// click1 = { id: 1, budgetId: 1, price: 50 }
// click2 = { id: 2, budgetId: 1, price: 60 }
```

When *click1* and *click2* happen roughly at the same time - both invocations of `onClick` function will get a budget with `availableAmount=100`. When *click1* finishes first, we end up with `availableAmount=40`, since *click2* computation will override that of *click1*; when *click2* invocation is faster, we end up with `availableAmount=50`, since *click1* computation will override that of *click2*. In either case, the final result is not what the code wished for - one update *conflicts* with the other, one of them is *lost*. Implemented correctly, in each case the result should be *budget* with `availableAmount=0` (see if/else clause). Order of events should not be a concern here; whether *click1* happened at *t1* and *click2* at *t2* or vice versa, the result must always be the same.

How might we help those two users not to hurt themselves by overriding each other's work? How to prevent money leak on the lost clicks? 

## Optimistic Locking

This approach is well, optimistic. We assume that an update will not conflict with another; if it does, an exception is thrown and it is then up to the user/client what to do about it, whether to retry or abandon the operation. 

What do we need to detect such conflicts?

There must be a way to determine whether a record was modified in the time we were working on it as well. For that, we add a simple numeric version column/field:
```
CREATE TABLE campaign (
  id UUID PRIMARY KEY,
  ....
  version BIGINT NOT NULL
);

record Campaign(UUID id, ..., long version) {}
```
(*that is an SQL example, but the principle would be the same if use key-value store or a documented-oriented database; version must be saved together with the related data*)

How can we use it?

Previously, our `campaignRepository.save(campaign)` 




## Pessimistic Locking

Remember deadlocks!

## When one should be Optimistic and when Pessimistic

Interesting!

## Isolation levels (??)

1. Serializable
2. Repeatable Read
3. Read Committed
4. Read Uncommitted  

For conflicting writes like:
```
Postgres:
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
update table_single_index set version = version + 1 where id = 1;
ERROR:  could not serialize access due to concurrent update


mysql> set transaction_isolation=SERIALIZABLE;
mysql> begin;
Query OK, 0 rows affected (0.00 sec)
mysql> update table_single_index set version = version + 1 where id = 1;
Query OK, 1 row affected (8.13 sec)
Rows matched: 1  Changed: 1  Warnings: 0

mysql> commit;

```

## Practical considerations: ORMs and SQL builders

Practical implications!


## Conclusion: be resilient to the randomness of time

Nice!


Idempotency? Deadlocks?

Example:
* modify something - two users
* background processes - surprising field modification!
* ORM!

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}


### Notes and resources
* lock, retry or one writer (serialized) - SQLite case
* https://chatgpt.com/c/69034463-b2ec-8327-9591-ef2926014439
* https://chatgpt.com/c/69048518-2b78-8332-b65e-49efb0320a60
* https://sqlite.org/isolation.html
* select * from table_single_index where id = 1 for update;

</div>