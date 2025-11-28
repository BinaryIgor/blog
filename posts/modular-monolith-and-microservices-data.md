---
{
    "title": "Modular Monolith and Microservices: Data ownership, boundaries, consistency and synchronization",
    "slug": "modular-monolith-and-microservices-data",
    "startedAt": "2025-11-05",
    "publishedAt": "2025-11-14",
    "excerpt": "Virtually every module - folder or versioned package in a modular monolith, separately deployed microservice - must own or at least read some data to provide its functionality. As we shall see, the degree to which module A needs data from module B is often the degree to which it depends on this module; functionality being another important dimension of dependence. This leads us to the following principles...",
    "researchLog": [ 2 ],
    "writingLog": [ 3.5, 4, 3.5, 0.5, 2, 2.5, 4, 1, 5, 3.5 ],
    "tags": ["modularity"]
}
---

## Modularity

**As [we already know](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html), modularity matters more than whether we have one or many deployment units - single monolith or multiple services.** The principles used to decide how many modules a system should have, and what exactly they are, should be based on the functionalities the system provides and the responsibilities it carries. Module design should have little or nothing to do with whether we would like to have one, two, three or ten separate services (deployment units). Systems should be divided into logical, functional modules that are as independent as possible; in an ideal world, every module would not know anything about other modules and contain everything required to provide its functionality and fulfill its responsibilities.

Today, we will not focus on the principles and heuristics by which to decide on the exact module structure. We will not reiterate well-known facts: **[microservices are not a cure for bad design (architecture)](https://www.ufried.com/blog/microservices_fallacy_5_design/) and are [rarely needed for performance reasons](/how-many-http-requests-can-a-single-machine-handle.html); they mostly serve as an organizational tool, allowing many teams to work in parallel more easily**. It is also debatable whether completely separate units of deployment (processes) are required to achieve this; [I will address it in a future post/article](/modular-monolith-and-microservices-work-deployments-scalability.html) (*added 2025-11-28*).

Instead, let's talk about *the Data - its ownership, boundaries, consistency and synchronization*.

## Data

**Virtually every module - folder or versioned package in a modular monolith, separately deployed microservice - must own or at least read some data to provide its functionality.** As we shall see, the degree to which module A needs data from module B is often the degree to which it depends on this module; functionality being another important dimension of dependence. This leads us to the following principles:
> 1\. Every module should own its data. Data should not be accessed or modified by other modules directly - it is an internal implementation detail of the module. 
>
> 2\. Module data might be shared and used by other modules, but only through dedicated public interfaces and types. This should be done to the smallest possible extent.
>
> 3\. A module is a unit of data consistency. Outside the module's boundary, data may be consistent, but only eventually, not immediately.

Following them makes data ownership and management clear; boundaries and dependencies between modules - transparent.

To make these points clear and analyze their various consequences, throughout this post, we will work on a system example. [Expanding on the base article](modular-monolith-and-microservices-modularity-is-what-truly-matters.html), let's say that we have a system called *Curious Notes to the Interesting Quotes and People*. One possible design is to split it into the following modules:
* **users**: responsible for the creation of new users, managing accounts and authentication/authorization
* **quotes**: responsible for the management of quotes by the special, privileged users, as well as sharing and searching them
* **people**: responsible for the management of people by the special, privileged users, as well as sharing and searching them
* **notes**: responsible for adding notes to quotes and people by users, allowing them also to edit, delete, like, share and search for various notes

There are multiple ways to manage modules' *data ownership, boundaries, consistency and synchronization*. Let's explore them to see the tradeoffs and where the best and worst choices might lead us.

## Ownership

**What happens with our system architecture when no module takes ownership of the data strictly related to its functionality and responsibility?**

Let's use the *users* module example - it creates and manages users, as it is responsible for their creation and management. So far, so good. But then the *quotes* module also needs some of the users' data to decide whether the currently signed-in user is allowed to add, edit or delete quotes. The worst approach is when the *users* module does not really own users' data - the *quotes* module connects to the *users* module database and operates on it directly. Let's say that we have:
```
CREATE TABLE user (
  id UUID PRIMARY KEY,
  ...
  -- USER, MODERATOR, ADMIN --
  role TEXT NOT NULL
);
```
*quotes* module reads data from this table by issuing the `SELECT role FROM user WHERE id = ?` query. It then interprets the returned role value and decides whether the user is allowed to execute certain operations on quotes. Something like:
```
// quotes module reads data from the users DB directly - bad idea!
void createQuote(Quote quote, UUID currentUserId) {
  var user = userRepository.findById(currentUserId);
  if (!user.role().equals("ADMIN")) {
    throw new QuoteCreationNotAllowedException("Only ADMIN users can create quotes");
  }
  ...
}
```
Why this is bad?

[**Mainly because of Coupling**](https://en.wikipedia.org/wiki/Coupling_(computer_programming)): the `user` table is an implementation detail of the *users* module. If this module decides to change it, for example by creating a separate `user_role` table for roles - this change cascades to the *quotes* module. **It introduces an implicit dependency that makes our system rigid, harder to extend and maintain.** What is more, depending on whether *users* and *quotes* have their own databases (they should), both modules now need access, when only the *users* module should be aware of such details - credentials, URLs, etc. This ties back to *Coupling*: it is a completely unnecessary dependency introduced by adopting this flawed design. And then, what if the *users* module switches its database completely, from Postgres to [SQLite](/sqlite-db-simple-in-process-reliable-fast.html), for example? The *quotes* module would have to change it as well, since it reads raw users' data directly, not respecting any boundaries.

To make matters even worse, we have *people* and *notes* modules: they likewise need data from the *users* module to provide their functionality. So, the `SELECT role FROM user WHERE id = ?` query is also executed by the *people* module and all the same dependencies and problems described in the *quotes* context apply here as well. The *notes* module, as we might recall, is responsible mainly for allowing users to add and manage notes linked to quotes and people. This module has slightly different dependency on the *users* module - fundamentally the same, but even deeper. Let's add a few details to the `user` table:
```
CREATE TABLE user (
  id UUID PRIMARY KEY,
  ...
  name TEXT NOT NULL,
  -- CREATED, ACTIVATED, VERIFIED --
  state TEXT NOT NULL,
  -- ACTIVE, BANNED, SUSPENDED --
  status TEXT NOT NULL,
  -- USER, MODERATOR, ADMIN --
  role TEXT NOT NULL
);
```
Now, the *notes* module does a couple of things with this new data. To display a user who has added a note, at least the `name` column is needed. What if the *users* module decides to change its schema by introducing a `user_profile` table, where such data is stored? The *notes* module must be aware of that and accommodate. To resolve whether the user is allowed to add a note to quote or person (omitting quotes and people dependency), we would do something like:
```
// notes module reads data from the users DB directly - bad idea!
void addNote(Note note, UUID currentUserId) {
  var user = userRepository.findById(currentUserId);
  if (!user.state().equals("VERIFIED")
    || !user.status().equals("ACTIVE")) {
    throw new NoteAdditionNotAllowedException("Only VERIFIED and ACTIVE users can add notes");
  }
  ...
}
```
Here, the dependency on the current `user` table details is even stronger. What if the *users* module decides to change its schema by introducing a `user_state` and/or `user_status` table, where such data is stored? Completely unnecessarily, the *notes* module has to be aware of that and adapt.

To add insult to injury, let's say that we also have implemented a user verification process in the *notes* module, since it mostly relates to notes - whether the user can be trusted to add and edit publicly available content. This is not a bad design per se, it might make sense; what is bad, is the implementation that follows:
```
// notes module 
void verifyUserAllowedToPublishNotes(UUID currentUserId) {
  var user = userRepository.findById(currentUserId);
  if (meetsNotesPublicationCriteria(user)) {
    var verifiedUser = user.withState("VERIFIED");
    userRepository.save(verifiedUser);
  }
  ...
}
``` 
Not only are we coupled to the users DB schema as before, but we also modify the *users* module's data from another module, making flow of data opaque and hard to follow - users are now not only read, but modified directly by multiple modules as well.

The last thing we want is to work in a mess of this kind - where nobody owns the data, and it is difficult to tell who modifies it or who is affected by changes in its schema, format or source. **Without clear data ownership, dependencies become opaque and hidden; modules are tightly coupled and it is unclear how changes in one module's data may affect others.** What is the solution to this chaos?

{{ .js: newsletterSignUpPostMid() }}

## Boundaries 

**Each module - folder or versioned package in a modular monolith, separately deployed microservice - should own its data and establish boundaries, exposing it to others only through dedicated public interfaces and types, in a controlled and intentional way.**

Let's fix our naive implementation of the *Curious Notes to the Interesting Quotes and People*. To interact with the *users* module, we establish the following boundaries:
```
// shared/common module

interface UsersClient {

  boolean isAdmin(UUID id);

  User getById(UUID id);
}

record User(UUID id, 
            String name,
            UserRole role,
            UserState state,
            UserStatus status) {}

enum UserRole {
  USER, MODERATOR, ADMIN;
}

enum UserState {
  CREATED, ACTIVATED, VERIFIED;
}

enum UserStatus {
  ACTIVE, BANNED, SUSPENDED;
}

interface UsersEventPublisher {
  void publish(UserAllowedToPublishEvent event);
}

record UserAllowedToPublishEvent(UUID userId) {}
```

Naturally, implementations will be different depending on whether we have a modular monolith or multiple services - we will get there later on. The most important thing is:
> Only the users module knows implementation details of its data - where and how it is stored. All other modules interact with it through dedicated interfaces and types, without knowing anything about its internals.

Going back to our broken system - let's fix the *quotes* module. As we might recall, it issued the `SELECT role FROM user WHERE id = ?` query. We sever this fragile dependency by switching to the dedicated interface:
```
// quotes module
void createQuote(Quote quote, UUID currentUserId) {
  if (!usersClient.isAdmin(currentUserId)) {
    throw new QuoteCreationNotAllowedException("Only ADMIN users can create quotes");
  }
  ...
}
```
In the *quotes* module, we are now only aware of the `UsersClient` interface; knowing nothing about its implementation details.

Likewise, let's fix the *notes* module:
```
// notes module

void addNote(Note note, UUID currentUserId) {
  var user = usersClient.getById(currentUserId);
  if (!user.state().equals(UserState.VERIFIED)
    || !user.status().equals(UserStatus.ACTIVE)) {
    throw new NoteAdditionNotAllowedException("Only VERIFIED and ACTIVE users can add notes");
  }
  ...
}

...

void verifyUserAllowedToPublishNotes(UUID currentUserId) {
  var user = usersClient.getById(currentUserId);
  if (meetsNotesPublicationCriteria(user)) {
    var event = new UserAllowedToPublishEvent(currentUserId);
    usersEventPublisher.publish(event);
  }
  ...
}
```

\
**By setting clear boundaries, the *users* module now has absolute ownership of its data** - only this module may modify it; access is limited and controlled by dedicated interfaces and types, making dependencies obvious and transparent. Implementation details - such as the data source and format - are hidden, [keeping coupling loose rather than tight](https://en.wikipedia.org/wiki/Loose_coupling).

## Consistency

**How do the assumptions and implementation details of the dedicated interfaces change in a monolith - compared to multiple services running as separate processes?**

As far as implementation details go:
* **Monolith** - the `UsersClient` is implemented by the *users* module and makes in-memory method calls; underneath the hood, they mostly just issue queries to the users database.
For cases represented by the `UsersEventPublisher` interface, events are most likely published in memory, to some sort of application event bus
* **Services** - the `UsersClient` is either implemented by each module separately or provided as a shared library; in either case, it most likely just makes HTTP calls to the REST API of the *users-service* being a *users* module implementation. For cases represented by the `UsersEventPublisher` interface, events are published either to a Message Broker - Apache Kafka, RabbitMQ, Google Pub/Sub, Amazon SNS, etc. - or simply as HTTP POST calls, executed in the background

The fundamental difference comes down to: 
> Method calls in a monolith, network calls for services.

This difference is not as significant as it seems. Clearly, it makes *services* implementation more complex, from the communication standpoint at least, because [the network is not reliable and might fail at any time](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing). Network failures and unavailability of services must be dealt with, retries handled, timeouts set, cascading failures avoided, and so on. We will not go through the full list here, but this complexity is the main reason as to why we should neither start nor switch to microservices unless there are really compelling reasons to do so.

But if we follow one, crucial constraint:
> Transactions should not cross module boundaries - they must execute completely within a single module.

**Then, it does not matter that much whether modules run in a single process of a monolith or are distributed across multiple processes of different services.** Yes, in the latter case we must still deal with potential network failures, unavailability of services, retries, timeouts and similar issues when reading data, but writing and keeping it consistent between modules is the hardest part. In this context, the above constraint severely limits design choices of our system - we are forced to think carefully and deliberately about the data flow and dependencies between modules, which is exactly what we want! In the vast majority of cases (if not all), it is absolutely possible to design modules in such a way: they are independently operating units, with the data that is immediately consistent only within the boundaries of a single unit (module). **A module is a unit of data consistency. Outside the module's boundary, data may be consistent, but only [*eventually*](https://en.wikipedia.org/wiki/Eventual_consistency).** What does it mean?

## Synchronization

*A module as a data consistency unit* principle limits how our modules are allowed to communicate. Additionally, often modules just want to have their own copy of other modules data, for a variety of valid reasons: redundancy, performance, convenience and so on. Therefore, we must synchronize data between modules *at some point*, making it *eventually consistent*. How can it be achieved?

Let's divide the problem into two cases, using our *Curious Notes to the Interesting Quotes and People* system again, to make it more concrete:
1. **[Transactional data](#synchronization-transactional-data)** - when a quote is created in the *quotes* module, a `QuoteCreated` event must be published as well. This event is then used by other modules to synchronize data with the *quotes* module to keep it consistent between modules; therefore, this operation must be atomic: either a quote is created and an event is published, or a quote is not created and an event is not published. Without this atomicity guarantee, modules will have an inconsistent, differing view of the data
2. **[Non-transactional data](#synchronization-non-transactional-data)** - the *users* module fetches notes that were recently created, modified or interacted with to calculate stats and recommendations for the users. It does so every few hours in the background; it might fail sometimes and it is not a big deal, since stats and recommendations only need to be *more or less recent*

### Transactional data {#synchronization-transactional-data}

What it boils down to:
1. modify state in a module
2. publish related event for other modules

Publishing events means either a method or network call, depending on whether we operate in a monolith or services environment. But even if we are in a monolith and it all happens within the memory of a single process, let's recall the principle: *a module is a unit of data consistency*. We should not assume that modules share the database and it is fine to start a transaction that spans them, asserting that in-memory event handling happens in the same transaction as state modification. 

Instead, we do not publish events right away but with a certain delay. Using our quotes example:
```
// quotes module
void createQuote(Quote quote, UUID currentUserId) {
  if (!usersClient.isAdmin(currentUserId)) {
    throw new QuoteCreationNotAllowedException("Only ADMIN users can create quotes");
  }
  transactions.execute(() -> {
    quotesRepository.save(quote);
    outboxRepository.save(new QuoteCreatedEvent(quote));
  });
}
```
As we can see, using the [Outbox Pattern](/modular-monolith-dependencies-and-communication.html#outbox-pattern), a new quote and its related event are saved transactionally, in the *quotes* module database. Later on, *eventually*, a scheduled task goes through all saved <span class="nowrap">to-be-published</span> events and publishes them; events are deleted from the database only after publishing has succeeded. It always works, but *eventually*; additionally, the same event might be published twice, so our consumers must be *[idempotent](https://en.wikipedia.org/wiki/Idempotence)*. In the period between quote creation and its event publication, other modules do not yet know about its existence. This is fine, since *a module is a unit of data consistency*.

We can imagine more complex processes as well:
1. modify state in module A and publish related event for module B
3. consume event and modify state in module B
4. if success in B:
    1. publish success event
    2. modify state in module A, in response to the success event
    3. if failure in A, retry
5. if failure in B:
    1. publish failure event
    2. rollback or compensate first state change in module A, in response to the failure event
    3. if failure in A, retry

**Here, we have a process that not only spans two modules, but might also need to be rolled back or compensated; it is perfectly doable and we have an established, battle-proven way of doing so: the [Saga Pattern](https://microservices.io/patterns/data/saga.html)**. Essentially, it is a sequence of local (per-module) transactions, the course of which is coordinated by events. I plan to write a dedicated, more detailed post about long running processes and distributed transactions of this kind, so stay tuned (link will follow).

### Non-transactional data {#synchronization-non-transactional-data}

In this simpler case, we just want to have data from another module *at some point* - it is not related to any particular process or change.

Using the *users* module example: we would like to fetch notes to calculate certain stats and recommendations for the users, based on the notes they have recently created, modified or interacted with. To implement it, we might have the following interface:
```
interface NotesClient {
  
  Stream<Note> getNotesCreatedByUser(UUID userId,
                                     Instant afterTimestamp);

  Stream<Note> getNotesLikedByUser(UUID userId,
                                   Instant afterTimestamp);

  Stream<Note> getNotesSharedByUser(UUID userId,
                                    Instant afterTimestamp);
}
```

Then, a simple scheduled task/job in the users module would fetch this data and calculate various kinds of stats and recommendations for the users, based on their recent activity, and save results in its own database.

### Synchronization summary {#synchronization-summary}

1. **Transactional and time-sensitive data** - use the Outbox Pattern to save both the new state and the related event in the module, to be published later; data will always be consistent between modules, but only *eventually*
2. **Non-transactional and time-insensitive data** - use scheduled tasks to synchronize data in the background by periodically fetching it from another module, with the required frequency and within an acceptable delay; in the same vein, data will always be consistent between modules, but only *eventually*

## Conclusion: simple, predictable, scalable and flexible Systems

As we have seen, **lack of clear data ownership and boundaries leads to opaque dependencies, tightly coupled modules and convoluted data flow that is hard - sometimes simply impossible - to follow**. Our systems become rigid, difficult to maintain, change and extend - regardless of whether they are made of a single monolith or multiple services, separated by the network.

**Thankfully, the solution is simple and applies to any architecture** - from a single service, with folders or versioned packages as modules, to multiple services, each treated as a separate module, and all variations in between. It can be distilled down to these core principles:
> 1\. Every module should own its data. Data should not be accessed or modified by other modules directly - it is an internal implementation detail of the module. 
>
> 2\. Module data might be shared and used by other modules, but only through dedicated public interfaces and types. This should be done to the smallest possible extent.
>
> 3\. A module is a unit of data consistency. Outside the module's boundary, data may be consistent, but only eventually, not immediately.

\
As we have also seen, **a couple of constraints and conventions are all that is needed to follow these rules**. As a consequence, dependencies of our modules are transparent. Each module internals are encapsulated; implementation details are hidden, preventing accidental coupling and keeping dependencies loose rather than tight. A module is defined as a data consistency unit, but we also have a clear way to synchronize data between them, accepting that it will be consistent, but *eventually*. This constraint is a crucial design factor in our system's overall module architecture.

**Let's then build modules that own their data and respect the boundaries of others - getting systems that are simple, predictable, scalable and flexible in return!**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}


### Notes and resources

1. [Modularity Posts](/modularity-posts.html)
2. Some of the microservices fallacies:
    1. https://www.ufried.com/blog/microservices_fallacy_2_scalability/
    2. https://www.ufried.com/blog/microservices_fallacy_3_simplicity/
    3. https://www.ufried.com/blog/microservices_fallacy_4_reusability_autonomy/
    4. https://www.ufried.com/blog/microservices_fallacy_5_design/
3. Coupling and Cohesion:
    1. https://codeopinion.com/solid-nope-just-coupling-and-cohesion/
    2. https://en.wikipedia.org/wiki/Coupling_(computer_programming)
    3. https://en.wikipedia.org/wiki/Cohesion_(computer_science)
    4. https://www.hacklewayne.com/accidentally-coupled-the-worst-coupling-by-loose-coupling
    5. https://www.youtube.com/watch?v=plMttQWztRM
4. Fallacies of distributed computing, new programmers believe in: https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing
5. Eventual consistency:
    1. https://en.wikipedia.org/wiki/Eventual_consistency
    2. https://www.ufried.com/blog/eventual_consistency_1/
6. Outbox Pattern: https://microservices.io/patterns/data/transactional-outbox.html
7. Saga Pattern: https://microservices.io/patterns/data/saga.html

</div>