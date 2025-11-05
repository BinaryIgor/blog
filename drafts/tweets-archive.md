Event Sourcing is a pattern of managing system state where every change is saved as a sequence of immutable events instead of simple, direct modifications of entities in the database.

For example, instead of having just one version of UserEntity with e8a5bb59-2e50-45ca-998c-3d4b8112aef1 id, we would have a sequence of UserChanged events that allow to reconstruct UserEntity state at any point in time.

Why we might want to do this:
1. Auditability: we have a knowledge about every change occurred in the system
2. Reproducibility: we can go back to a system state at any point in time, stay there or correct it
3. Flexibility: we are able to create many different views of the same Entity; its changes are published as events which might be consumed by many different consumers and saved in their own way, tailored to their specific needs
4. Scalability: in theory, we can publish lots and frequent changes which can be processed by consumers at their own pace; granted that if the difference is too large, we have to come to terms with the increasing Eventual in Consistency

Why we might not want to do this:
1. Complexity: publishing events and their asynchronous processing is far more complex than simple INSERT/UPDATE/DELETE/SELECT
2. Eventual Consistency: we always have some delay in changes propagation because of the complete separation of read and writes
3. Pragmatism: it is really rare that we need to have a 100% complete view of every possible state change in the system and its Reproducibility at any point in time; this knowledge is rather interesting to us only in some contexts and for some use-cases

As with most Patterns, it is highly useful but only sometimes and in some specific instances. Use it when needed, but avoid over complicating your system without a clear need, because just in case - Keep It Simple Stupid.


---

Recently, on a job interview, I've got an interesting question:
How would you design a system that needs to be available, as fast as possible, in multiple geographical regions, potentially spanning the whole world?

There are so many things that go into this, mainly:
1. Providing static assets - HTML, CSS, JS and so on - from the closest possible location to your users. CDN solves this
2. Having  backend service(s) available in all these regions
3. Backend service(s) should also have access to the database(s) from the same region to minimize latency
4. Local caches, where possible, to minimize latency again - CDN solves this for frontend, for backend we can have it in memory or using per-region Redis instances; but, we do need to make sure that cache is not stale and can be invalidated when the right time comes
5. Having read replicas of the database(s) in multiple regions is not that hard, but having multiple write nodes is much more challenging

For the last point, we can simply start with one write region, where all single-node write databases reside, and accept the fact that writes will be slower when performed from other regions. If we want to have additional redundancy, we can introduce an automatic failover mechanism that promotes read replicas from other regions to write nodes in case of failures. This might be an acceptable tradeoff, since most applications do mostly reads. If that’s not acceptable, we have to get into multi-master/write databases, which is possible, but introduces lots of new Complexity that's best avoided.

---

From:Dr Milan Milanović

𝗟𝗲𝗮𝗿𝗻 𝗳𝘂𝗻𝗱𝗮𝗺𝗲𝗻𝘁𝗮𝗹𝘀 𝗻𝗼𝘁 𝗳𝗿𝗮𝗺𝗲𝘄𝗼𝗿𝗸𝘀

We developers like to learn new stuff and try it ASAP. That stuff consists mainly of new frameworks and tools (such as React, Angular, Spring, Web Forms, etc.). Yet, those frameworks usually have 𝗮 𝘀𝗵𝗼𝗿𝘁 𝗹𝗶𝗳𝗲, 𝟮 𝘁𝗼 𝟱 𝘆𝗲𝗮𝗿𝘀 𝗮𝘁 𝘁𝗵𝗲𝗶𝗿 𝗯𝗲𝘀𝘁. Instead of learning frameworks, which are needed to some extent, we should focus more on learning fundamentals. 

𝗟𝗲𝗮𝗿𝗻𝗶𝗻𝗴 𝘁𝗵𝗲 𝗳𝘂𝗻𝗱𝗮𝗺𝗲𝗻𝘁𝗮𝗹𝘀 𝗼𝗳 𝘀𝗼𝗳𝘁𝘄𝗮𝗿𝗲 𝗱𝗲𝘃𝗲𝗹𝗼𝗽𝗺𝗲𝗻𝘁 allows a developer to understand the underlying principles and concepts common across different frameworks and programming languages. This understanding allows for more flexibility and adaptability when working with new technologies or facing problems that a specific framework may not quickly solve.

Additionally, a strong understanding of the fundamentals can lead to 𝗺𝗼𝗿𝗲 𝗲𝗳𝗳𝗶𝗰𝗶𝗲𝗻𝘁 𝗮𝗻𝗱 𝗲𝗳𝗳𝗲𝗰𝘁𝗶𝘃𝗲 𝘂𝘀𝗲 𝗼𝗳 𝗳𝗿𝗮𝗺𝗲𝘄𝗼𝗿𝗸𝘀, as the developer can better understand how to customize and extend them to meet specific needs.

Take an example of a web application that allows users to upload and share images, e.g., Ruby on Rails, and its functionalities for image processing. If the number of users increases, we could struggle with performance issues if we know only the framework well. Yet, if we understand the fundamentals of web development, we could try to identify bottlenecks and try different solutions, such as using CDN-s, optimizing image sizes, using various storage solutions, etc.

So, which fundamentals to learn:

🔹 𝗔𝗹𝗴𝗼𝗿𝗶𝘁𝗵𝗺𝘀
🔹 𝗗𝗮𝘁𝗮 𝘀𝗼𝘂𝗿𝗰𝗲𝘀
🔹 𝗗𝗲𝘀𝗶𝗴𝗻 𝗽𝗮𝘁𝘁𝗲𝗿𝗻𝘀
🔹 𝗗𝗶𝘀𝘁𝗿𝗶𝗯𝘂𝘁𝗲𝗱 𝗖𝗼𝗺𝗽𝘂𝘁𝗶𝗻𝗴 𝗣𝗮𝘁𝘁𝗲𝗿𝗻𝘀
🔹 𝗧𝗲𝘀𝘁𝗶𝗻𝗴
🔹 𝗦𝘆𝘀𝘁𝗲𝗺 𝗗𝗲𝘀𝗶𝗴𝗻
🔹 𝗖𝗹𝗲𝗮𝗻 𝗰𝗼𝗱𝗲

Try to learn those fundamentals, buy and read these books:

🔸 𝗧𝗵𝗲 𝗣𝗿𝗮𝗴𝗺𝗮𝘁𝗶𝗰 𝗣𝗿𝗼𝗴𝗿𝗮𝗺𝗺𝗲𝗿
🔸 𝗖𝗼𝗱𝗲 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗲
🔸 𝗗𝗲𝘀𝗶𝗴𝗻 𝗣𝗮𝘁𝘁𝗲𝗿𝗻𝘀: 𝗘𝗹𝗲𝗺𝗲𝗻𝘁𝘀 𝗼𝗳 𝗥𝗲𝘂𝘀𝗮𝗯𝗹𝗲 𝗢𝗯𝗷𝗲𝗰𝘁-𝗢𝗿𝗶𝗲𝗻𝘁𝗲𝗱 𝗦𝗼𝗳𝘁𝘄𝗮𝗿𝗲
🔸 𝗜𝗻𝘁𝗿𝗼𝗱𝘂𝗰𝘁𝗶𝗼𝗻 𝘁𝗼 𝗔𝗹𝗴𝗼𝗿𝗶𝘁𝗵𝗺𝘀
🔸 𝗖𝗹𝗲𝗮𝗻 𝗖𝗼𝗱𝗲

--- 

There is no such thing as transactionality between databases and other external systems.

If you try to perform a process of the following kind:
1. start transaction
2. create user account
3. send email with activation link
4. commit transaction

This is fragile because:
- email might be sent but commit transaction call can still fail
- if this is the case, a user will receive an email but their account will not exist, since the transaction has failed

To fix this, use the Outbox Pattern:
1. start transaction
2. create user account
3. save email to be sent later in the database
4. commit transaction

Then, have scheduled, background process that:
1. takes all emails to be sent from the database
2. sends them
3. remove ones that have been successfully sent
4. if some emails failed to be sent - it is not a problem, because this process is scheduled and it will be retried in the next run

In this way, we have decoupled a transaction from its side effects and we have a guarantee that if a user has created an account, they will always receive an activation link by email, eventually.

---


Advisory Locks are a PostgreSQL feature that allows you to create arbitrary locks, not tied to any database row or a table, that might be used in your application for its specific needs. They can be scoped to a session (connection) or transaction.

For example, let's say that we have a process that must run only on one instance of the application at a time, but we have two or three instances. We might want do run it only on a Leader instance and do something like this (lockId is an arbitrary number):

If we are able to receive the lock (locked=true), we run the needed function/process; if not, it means that another instance of our application has acquired this lock and is running the function/process, thus we must not.

It's a pretty useful way of making sure that something happens/runs only once at a given time, which is also not tied to our application state nor any database row or a table.


---


Optimistic Locking assumes that write conflicts are rare and in the case of them - user/application can retry their modifying operation. 
It relies on the additional version column to assess whether conflict has indeed occurred or not - this version column needs to be properly handled by the application code, being read, compared and updated.
When write conflicts are rather rare, it offers better performance - nothing is locked and in the case of a conflict, operation is just retried with fresh data or abandoned all together.
When there are many conflicts on the other hand, many (most) database operations are wasted and performance deteriorates. 

Pessimistic Locking assumes that there always might be a conflict - row/rows is/are locked on the database level and no one can access it until it's released.
We don't need any additional columns to use it and we have a guarantee that only our current process modifies a given row; other processes need to wait.
On the other hand, if not used properly, it can lead to deadlocks: a situation where process A waits for process B to release its lock, and process B waits for process A to release its lock.

What's also worth considering: if we want to detect conflicts from the user perspective, allowing user A to know that user B has modified a resource they've been working on, it's only possible with the Optimistic Locking approach.

What do you guys usually use, when and why?

---


If we store a single, long-lived JWT in the HttpOnly Cookie, what security benefits do we get from having separate access and refresh tokens? 

I don't see any, hence for some time I've been using a single, refreshable JWT with the ability to revoke it, in case of a breach or user-reported hack.

---


Levenshtein (edit) distance is a metric of string similarity that allows search engines like Elasticsearch (Lucene) to implement Fuzzy Search.

What is Fuzzy Search? It's simply a search that can match typos and alternative spelling. Let's say that we wanted to search for a "dog", but we've inputted "dogi" instead - Fuzzy Search fixes this and it will match "dog" as well.

How does the Levenshtein distance work?

For every input I, we generate all its variations V up to a distance of D, expressed in the minimum number of single-character edits: insertions, deletions, substitutions and sometimes transpositions.

For example, let's say that somebody has inputted "dogi". We might generate the following variations with the distance of 1:
- dog (1 deletion)
- dogs (1 substitution)
- dogo (1 substitution)
- dogis (1 addition)
- ..and so forth

It allows handling typos and other minor differences at the expense of increased search space and thus worse performance. That is because instead of trying to find one match for a "dogi" (original input), we need to find matches for all generated variations V - indexes still help here but there simply are much more potential matches.


---


Proof of Work (PoW) is an interesting concept to combat spam. 

How can it work for email?  

As a client, write an email. On the server side, require every email to attach nonce N of at least D difficulty.  What does it all mean?  

It means that as a client, you need to take email message and find a random number N (nonce) that satisfies the equation: 
hash(email + N) = result with less or equal to D leading zeros  

Why does it work?  

To find random nonce N that hashed with an email message gives a result with equal or less than difficulty D zeros, you need to perform computation, spend resources - Proof of Work. For Human Clients, it would be negligible, but for Spammers it would represent prohibitive cost and in most cases - stop them from spamming people.

Of course, many implementation challenges remain to be solved - who would decide on difficulty D? What about less computationally efficient clients? - but in theory it’s completely possible.

---


What are the differences between Full-text Search and Semantic Search?

In Full-text Search, we simply match a query with similar content documents. For example, if our query is "red cats", the following results might match:
- "red cats can be blue as well"
- "there is more to life than red cats"
- "you, red cats, and me"

In Semantic Search, a query is matched by the underlying meaning of the text, taking synonyms and broader context into consideration. For example, if our query is "red cats" again, the following results might match:
- "aggressive cats are often red"
- "blue, red, black and white cats were seen there"
- "small, red mammal, hunting on rodents, was seen there"

Full-text Search  can be implemented using standard programming techniques but rather complex data structures and algorithms are needed. To support Semantic Search, we need to use machine learning techniques and often very sophisticated models -  Vector Embeddings created by LLMs are one of the most popular and best performing options.

---

For real time updates, there essentially are two approaches:
1. Push: server is aware of the clients and maintains direct connections with them; once there is new data, it sends it to them
2. Pull: clients are aware of the server; they periodically ask - is there any new data? If there is - they get it, if there is not - they will ask again anyways

As with everything, there are different tradeoffs to both approaches. Which one do you guys prefer? When? Why?

For Real-time Updates, there are two main ways to do it:
1. Push: the server keeps direct connections with clients and sends new data immediately.
2. Pull: clients ask the server periodically, “Is there anything new?” If yes, they get it; if not, they try again later.

Both have tradeoffs. Most of the time, Pull is enough. It works especially well when combined with long polling, like Kafka does, and can scale surprisingly well.

But if you need truly real-time updates, where delays are simply not acceptable, Push is the only way.


