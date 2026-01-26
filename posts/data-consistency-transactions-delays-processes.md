---
{
    "title": "Data Consistency: transactions, delays and long-running processes",
    "slug": "data-consistency-transactions-delays-processes",
    "startedAt": "2026-01-19",
    "publishedAt": "2026-01-26",
    "excerpt": "Data Consistency is simply a need to keep data consistent within a particular boundary and time. There are two main scopes ... Local data is immediately consistent - there are no delays, it appears either in its final form or not at all. In the global scope however, things look totally different.",
    "researchLog": [ 1, 1, 0.5 ], 
    "writingLog": [ 1, 4, 1, 4, 2, 2, 7.5, 2.5, 1.5, 2, 1, 1, 3 ],
    "tags": ["deep-dive", "modularity"]
}
---

## Two scopes

Data Consistency is simply a need to keep data consistent within a particular boundary and time. There are two main scopes:
1. **Local** - within one module/service, using one particular data store; it is *immediate* and achieved either by having proper database transactions or keeping related data together in a single table, collection, object or file
2. **Global** - includes all modules/services of the system; they must eventually agree and have the same data, even though multiple different persistence stores and strategies may be employed by them. Because of that, *consistency cannot be immediate and is eventual instead*. If the system consists of just one module, a service that is not modularized or there are a few modules, but they do not exchange any data - `global scope = local scope`

All systems that persist data deal with the first data consistency scope, local to module/service. It might seem obvious, but it is worth stating clearly and openly, as it is the fundamental building block from which global, system-wide data consistency is constructed. And interestingly, **if our system consists of a monolith with just one module, or there are multiple but totally independent modules, not exchanging any data, we deal solely with this simpler, local scope**.

Local data consistency always operates within a single data source of one module or service. Let's say that we use a relational database, creating the task assigned to two human workers as:
```
START TRANSACTION;

INSERT INTO task (id, name, description, started_at, completed_at)
VALUES ('t1-id', 'Walking The Dogs', '4 chihuahuas need 2 humans', 
        '2026-01-21T06:40:51Z', NULL);

INSERT INTO task_worker (task_id, worker_id) 
VALUES ('t1-id', 'w1-id'),
       ('t1-id', 'w2-id');

COMMIT;
```
This operation is fully atomic and immediate; task and its workers are created at once or nothing happens, neither task nor its workers are there. There are no intermediate cases. We can also have a document-based version:
```
db.tasks.insertOne({
  _id: "t1-id",
  name: "Walking The Dogs",
  description: "4 chihuahuas need 2 humans",
  startedAt: "2026-01-21T06:40:51Z",
  completedAt: null,
  workerIds: ["w1-id", "w2-id"]
});
```
Same effect, different technology - atomic creation of a task with assigned workers, since they all live in a single document. **Local data is immediately consistent - there are no delays, it appears either in its final form or not at all.** 

In the global data consistency scope however, things look totally different - *let's see how & why*.

## Distributed problems

To illustrate it better, let's complicate our task and workers flow a bit; adding state and two timestamps to the task-worker association:
```
INSERT INTO task_worker (task_id, worker_id, state,
                         created_at, updated_at); 
VALUES ('t1-id', 'w1-id', 'REQUESTED',
        '2026-01-21T06:40:51Z', '2026-01-21T06:40:51Z'),
       ('t1-id', 'w2-id', 'REQUESTED',
        '2026-01-21T06:40:51Z', '2026-01-21T06:40:51Z');
```

Let's also say that we have two independent services:
* **worker-service** - knows all the details about workers and how to interact with them; there is an associated UI for that and workers must be online to accept tasks
* **task-service** - manages tasks and proposes new ones to currently available workers; tasks must be completed more or less in real time - every `REQUESTED` worker has only *up to 30 seconds* to accept or reject the assigned task. After timeout or rejection, another worker will be requested to complete this particular task until either all required workers are working or the task is completed

Now, after creating the task with initial task-worker associations, *task-service* must somehow synchronize this state with *worker-service*, in a transactional way. Meaning, there cannot be a situation where a task with `REQUESTED` workers was created, but *worker-service* never learned about this fact and did not give workers a chance to respond to such profitable requests. How might this guarantee be provided? What problems lie ahead?

The most important fact to note is that both services are independent processes, separately deployed and split by the network; they have their own, isolated data stores as well. We are about to fail miserably, if our implementation idea is as follows:
```
// task-service
void createTask(Task task) {
  // task-service has its own copy of currently available workers
  var availableWorkers = getAvailableWorkers();
  // assigns workers only if a required number of them is available
  var assignedWorkers = assignWorkers(task, availableWorkers);
  
  transactions.execute(() -> {
    // task-service DB interactions
    var task = createTask(task);
    createTaskWorkers(assignedWorkers);
    // worker-service HTTP request
    var workerResponses = awaitWorkerResponses(assignedWorkers);
    // task-service DB interaction
    updateTaskWorkers(workerResponses);
  });
}
```
What is stored in *task-service* DB is completely independent of the *worker-service* state. Crucially, we could have workers accept or reject a task that does not exist. If suddenly *task-service* goes down, after getting responses from *worker-service* and the transaction fails to commit. It might likewise fail, if there is a temporary problem with the network or database. Especially considering the fact that `awaitWorkerResponses` method makes HTTP requests that could *take up to 30 seconds*; it is not a good idea to execute such blocking calls inside database transactions. 

*What is the solution? Is it really a (distributed) transaction?*

{{ .js: newsletterSignUpPostMid() }}

## Transactions vs Long-running processes

Cases of this kind, at first glance looking like (distributed) transactions,  can often be designed and thought of as long-running processes. What is the difference?

With transactions, we require atomicity and immediate visibility of all or no changes:
```
START TRANSACTION;

-- if failure, we do not go to b & c --
INSERT INTO a;

-- if failure, a did not happen --
UPDATE b;

-- if failure, a & b did not happen --
DELETE c;

-- a, b & c changes still not visible --
COMMIT;
-- if failure, a, b & c did not happen --
-- if success, a, b & c changes visible --
```

It is simple and works beautifully, but only within the scope of a single database instance that stores all data in one place. It breaks down instantly, when we need to synchronize state across multiple modules/services and their independent data stores. Let's redesign our tasks with workers into a long-running process and see how it solves these issues.

A few changes first:
* task worker states: `TO_REQUEST`, `REQUESTED`, `ACCEPTED`, `REJECTED`, `TIMEOUT`, `TASK_NOT_AVAILABLE`
* services communicate solely in an asynchronous way by events: `TaskWorkerRequested`, `WorkerAcceptedTask`, `WorkerRejectedTask`

A new flow:
1. **task-service** - creates tasks with `TO_REQUEST` task workers to be requested via `TaskWorkerRequested` events, published in the background later on (step 2.)
2. **task-service** - scheduled `task-workers-synchronizer` job runs frequently, every *100 - 500 ms* or so, and manages task workers lifecycle: sending `TaskWorkerRequested` events for active ones and updating their state to `TIMEOUT`, if there was no response in the required time window. `TASK_NOT_AVAILABLE` state is assigned to task workers in a situation where the task has finished before they responded. Additionally, if a task is still not done, for every task worker in `TIMEOUT` state, a new one is created with the initial `TO_REQUEST` state; in the next synchronizer job schedule, flow for these *replaced task workers* is exactly the same as for ones created initially in the 1. step
3. **worker-service** - consumes `TaskWorkerRequested` events, sends requests to workers and waits for their responses; if a worker responds within the required time window, through UI & being online, the `WorkerAcceptedTask` or `WorkerRejectedTask` event is sent accordingly
4. **task-service** - consumes `WorkerAcceptedTask` and `WorkerRejectedTask` events; updates task worker states and availability

**The process is now more complex but is resilient and robust - every possible failure scenario is correctly dealt with.** Crucially, it consists of all common patterns & techniques seen in *the long-running processes that deliver eventual data consistency globally*, across various modules/services:
* multiple local to module/service transactions
* *at-least-once delivery* guarantee of events/requests - duplicates are possible
* idempotent consumers - because of the *at-least-once delivery* nature 
* scheduled jobs for retries and resilience

Let's analyze it in more detail; there are many interesting things going on here.

First, there is the *create task + initial task workers assignment* transaction, local to *task-service*. Simple, atomic, always works as expected. Then, we must have a way to trigger assignment of workers in *worker-service*. Scheduled `task-workers-synchronizer` job runs a few times per second and it:
* separately reads `TO_REQUEST` and `REQUESTED` task workers from DB; with some reasonable page size limit (like 200 - 500) and sorted by creation time, taking the oldest ones first 
* reads all tasks associated with fetched task workers
* filters out expired task workers, defined as `clock.now() > (created_at + 30s)` - their state is updated to `TIMEOUT` and they are no longer taken into consideration for this particular task
* filters out task workers assigned to tasks that have been completed in the meantime - their state is updated to `TASK_NOT_AVAILABLE`
* for active task workers in the `TO_REQUEST` state:
  * sends `TaskWorkerRequested` events
  * updates state to `REQUESTED` in DB
  * if sending succeeds but DB update fails, it does not matter that much - the same task workers are reconsidered in the next schedule; *worker-service* must handle these events idempotently anyways, since there could be duplicates

This scheduled job guarantees that for each task -  required number of workers will *eventually* be requested and the late ones will not be considered any longer. To actually assign workers and make them work, *worker-service* must handle it properly. 

In *worker-service*, we mainly consume `TaskWorkerRequested` events and:
* check if the requested worker is online and available (there could also be more business rules around that)
* if not, just acknowledge the event and do nothing more
* if yes, send them notification through WebSockets, HTTP Long Polling or something else
* if there is no response in the required time window, acknowledge the event and do nothing more
* if there is a response in the required time window, send the `WorkerTaskAccepted` or `WorkerTaskRejected` event accordingly

That is what mostly *worker-service* does - knows the details of workers availability and can interact with them, in real time.

Let's go back to *task-service* - it now is about to consume `WorkerTaskAccepted` and `WorkerTaskRejected` events. In both cases:
* get task worker + related task from DB
* if the related task has already been completed, do nothing (acknowledge) - it is handled in the scheduled job
* if the task worker state is different than `REQUESTED`- ignore it, this case is also handled in the scheduled job
* finally, update the task worker state to either `ACCEPTED` or `REJECTED`

**Another important detail worth pointing out in the whole process is concurrency** - there is the scheduled job, that might run in a few instances, and multiple event publishers and consumers often work and modify the same data as well. To make it behave correctly, [we must control concurrency by locking properly](/optimistic-vs-pessimistic-locking.html).

That is a lot of details and changes compared to a single (distributed) transaction; but, **the process is now not only truly resilient and robust, it also is more flexible and extensible**. For example, we could add monitoring of task workers - are they really working on assigned tasks? If not, we can introduce the `ABANDONED` state and set it where & when appropriate. If a task is executed too slowly, more workers might be assigned to it and so on - there is a great deal of flexibility here.

## Delays

As we saw, long-running processes are in many ways different from transactions. **Local transactions, in the scope of a single module/service, guarantee immediate consistency.** All changes either take place and are immediately visible after *commit* or - we *rollback* and nothing changes, data remains in the before transaction state.

**Long-running processes on the other hand, consist of multiple local transactions that take place in different modules/services; they are coordinated through events/requests, sent asynchronously in the background.** Because of that, data is *eventually consistent, not immediately* - it cannot be immediate, since we modify something that lives in various copies and formats, and is owned by different components. Naturally then, there are *unavoidable delays & intermediate states* in these processes we must accept. In our working example, task and `TO_REQUESTED` task workers are created first. After some time (short, but still), the scheduled job runs and publishes related events - this is the first delay. Then, another service must receive and process these events - second delay. And this is how it works, this is **the nature of long-running processes: resilient, transparent and flexible, but some delays and temporary inconsistencies are always there as a feature, not a bug**.

Is there maybe something resembling local transactions more, but providing global data consistency guarantees? **Well, there is the [Two-phase commit (2PC) protocol](https://en.wikipedia.org/wiki/Two-phase_commit_protocol); unfortunately, it has many flaws.** How it works on the high level:
* let's say there are three transaction participants: A, B and C
* there also must be a transaction coordinator (TC)
* TC sends a *prepare transaction* command to all participants - they prepare their transactions and execute them up to the point they would normally commit, but do not it just yet
* once and only if everybody has responded to the TC that they are *ready to commit*, the TC sends a *commit* message to A, B and C
* if any participant fails to commit or there is a timeout, the TC sends a *rollback* command to all

Eventual consistency is still there, it is unavoidable - neither *commit* nor *rollback* message could be received at exactly the same time by all participants; even if only *milliseconds-long, delay is still there*. It is a fundamental network & physics limitation - immediate consistency is possible to achieve only in the single node context. What is more, the *2PC* approach is blocking and requires all participants to be online and responsive throughout the whole process; if any of them goes down, either everything must be stopped and rolled back or - there are significant delays and locking.

**Delays are an inherent and unavoidable aspect of distributed systems nature - we cannot nor should try to escape it.** It is much wiser to embrace this reality and design robust solutions aligned with it - explicitly handling and presenting *intermediate states & eventual consistency*, instead of pretending they do not exist.

## Sagas, Choreography and Orchestration

**The Saga Pattern is just a more sophisticated name for long-running processes of the kind we have worked on, throughout the example.** It is a more standardized way to coordinate a few local transactions between multiple modules/services, taking all possible execution paths and state transitions into consideration. Compared to our example, a couple of things are generalized here.

**The core building block of any Saga (process) is the *modify state & notify others about the change* action - it must be transactional, absolutely.** If it is not, instead of eventual consistency we will have an indeterminate one. The common generalization of what we did in our example - sending events for all task workers in a certain state, created previously in a transaction - is the [Outbox Pattern](/modular-monolith-dependencies-and-communication.html#outbox-pattern). It is not magic, it is just a more universal way of storing events/requests to be sent later on, in the background, and then actually sending them and synchronizing related state with the database. As an alternative, there is the [Change Data Capture (CDC)](https://en.wikipedia.org/wiki/Change_data_capture) approach - listening to changes on the database level and doing something - publishing events, sending requests - with those changes. It is more generic, but also lower level and often tightly coupled to a specific database. Whatever strategy we choose for this crucial action, there must be a hard guarantee that when the state changes, other Saga participants are always notified about this change (eventually).

**Another crucial part of Sagas are *compensations*: they handle state transitions in case of failures, at any possible step of the process.** Opposite to simple database transactions, they are not general but concrete and specific to the process. Why is it so? *Sagas* operate on the higher abstraction level - reversing them means rolling back one or a few already committed database transactions. To make it crystal clear, let's work on another example:
* there is some Order Creation Process (Saga), spanning a few services: *order-service*, *inventory-service*, *payment-service* and *shipment-service*
* it starts in *order-service* - order is created and the associated `OrderCreated` event gets published
* on `OrderCreated` event: *inventory-service* checks if needed products are available; if yes, `InvetoryReservationAccepted` event is published; if not, `InvetoryReservationRejected` event is published
* on `InventoryReservationRejected` event: associated order is soft deleted by being marked with CANCELLED state and INVENTORY_NOT_AVAILABLE status; it is no longer active but possible to read and analyze
* on `InventoryReservationAccepted` event: *order-service* updates related order state and publishes `PaymentRequested` event
* on `PaymentRequested` event: *payment-service* prepares payment request and sends back instructions in `PaymentPrepared` event
* on `PaymentPrepared` event: *order-service* redirects user to the prepared payment page
* *payment-service* handles payment: if everything goes well, `PaymentAccepted` event is published; if not, `PaymentRejected` event goes public
* ...

As we see, pretty elaborate state transitions are coordinated between services purely by publishing and reacting to specific events. **The main idea here: design a process such that its state can be correctly resolved at any stage, irrespective of the outcome.** How and what exactly happens at each state transition is specific to the process, but in the end, it always synchronizes through a [carefully planned sequence of events, commands and requests](/events-over-sql.html).

This brings us to **the last crucial aspect of Sagas - *state coordination* strategies, choreography and orchestration**. We know *choreography* already - that essentially was our example: state coordinated in a decentralized way by the process participants (services) themselves, without any central component. It does not require any additional infrastructure components, other than having some way to exchange data through events; although idempotent HTTP requests, executed in the background, work fine as well. But, **as the Saga gets more complex, with a growing number of states and possible transitions between them, it becomes rather messy and hard to wrap one's head around - this is where *orchestration* comes to the rescue**. In this approach, there is a centralized orchestrator/coordinator. It holds the current *saga state*, listens to all impactful events and issues appropriate commands/requests. Since it is centralized, it requires changing events flow to be more command/request-oriented. Adapting our example to this strategy, on `OrderCreated` event, *Saga Coordinator* creates *saga state*. Then, it publishes something like a `ReserveInventoryCommand`; *inventory-service* listens to it and issues `ReserveInventoryResult` in response. *Saga Coordinator* listens to this event as well and publishes `CancelOrderCommand` or `PreparePaymentCommand`, depending on the previous command result. These commands are then handled by *order-service* or *payment-service* respectively. 

**And so the *orchestration* goes - essentially, every state transition of the process goes through and is coordinated by the *coordinator/orchestrator*.** It consumes all required events and issues commands/requests to synchronize every process participant accordingly; knowing the current, global process state, the coordinator is fully responsible for keeping it coherent as a whole. Since the state is now centralized, it is often easier to reason about and design more complex flows; auditability of the current process stage/step is another benefit - but it all requires having this additional component to manage. Crucially, if the coordinator is down and not available, *Sagas* do not work; it constitutes a single point of failure. But for more complex data flows, it definitely is worth its tradeoffs.

## Transact locally, embrace delays and synchronize globally

As we have seen, immediate data consistency is achievable only locally, in the context of a single module/service, using one particular data store. Once we transition into the realm of multiple modules/services, taking advantage of many various data stores, a different approach must be taken.

As we have also learned, **delays and the resulting eventual consistency lie at the very heart of the distributed systems nature**; it is much wiser to embrace this reality, rather than trying to fight and resist it. That is why *long-running processes (Sagas)* work so well: they encourage us to design our processes as *a sequence of independent and compensable steps*, with clear boundaries and explicitly defined transitions. Delays and eventual consistency are treated as first-class citizens here; we cleanly and openly move between process steps. Each of them may take however long it needs to complete, explicitly informing about its current state.

In summary, **true transactions are possible only locally; globally, we must embrace delays and eventual consistency as fundamental laws of nature**. What follows is designing and building resilient systems, handling this reality openly and gracefully; they might be synchronizing constantly, but always arriving at the same conclusion, eventually. 

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Strongest consistency guarantees provided mostly by SQL databases: https://en.wikipedia.org/wiki/ACID. Many NoSQL databases are designed as distributed systems, usually running on multiple nodes; that is mostly why they have to follow a different data consistency philosophy: https://en.wikipedia.org/wiki/Eventual_consistency. A few solid comparisons of these two approaches:
    1. https://luminousmen.com/post/acid-vs-base-comparison-of-two-design-philosophies/
    2. https://aws.amazon.com/compare/the-difference-between-acid-and-base-database/
    3. https://en.wikipedia.org/wiki/Consistency_(database_systems)
2. In some contexts, I have purposefully used *data store* instead of *database* term to denote that modules/services might use a broader spectrum of data persistence strategies, such as simple files, [object storage](https://en.wikipedia.org/wiki/Object_storage) (like AWS S3, DigitalOcean Spaces, Google Cloud Storage), logs or publishing events to a message broker/queue
3. Data consistency in distributed databases: https://www.pingcap.com/article/ensuring-data-consistency-in-distributed-databases/
4. Interestingly related to our working examples, modeling state vs status: https://masoudbahrami.medium.com/dont-confuse-state-with-status-when-modeling-domain-601bc91f326a
5. Regarding the example with `task-workers-synchronizer` scheduled job. One straightforward way to have it running in multiple instances and not duplicate work but share the load effectively, would be to take advantage of the `SELECT ... FOR UPDATE SKIP LOCKED` SQL mechanism. It basically returns all the matching query rows that are not locked currently, skipping locked ones
6. More about Two-phase commit protocol: https://en.wikipedia.org/wiki/Two-phase_commit_protocol. Postgres implements it: https://www.postgresql.org/docs/current/two-phase.html
7. Modify state & notify others about the change action implementation possibilities:
    1. https://microservices.io/patterns/data/transactional-outbox.html
    2. https://en.wikipedia.org/wiki/Change_data_capture
    3. https://www.cloudamqp.com/blog/change-data-capture-with-rabbitmq-and-debezium-part-1.html
8. More about Sagas:
    1. https://microservices.io/patterns/data/saga.html
    2. https://www.baeldung.com/cs/saga-pattern-microservices
    3. https://temporal.io/blog/to-choreograph-or-orchestrate-your-saga-that-is-the-question

</div>