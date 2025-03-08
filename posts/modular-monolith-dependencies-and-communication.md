---
{
    "title": "Modular Monolith: dependencies and communication between Modules",
    "slug": "modular-monolith-dependencies-and-communication",
    "startedAt": "2024-05-14",
    "publishedAt": "2024-05-19",
    "excerpt": "Before talking about module communication, it is important to emphasize the consequences of chosen module design. Problems that we will face when communicating between modules, how often and how much of communication there will be, depend mostly on decided modules structure ... Assuming that we have modules that depend very little on each other, but sometimes they do need to talk with each other - how can they and when they should?",
    "researchLog": [ 1 ],
    "writingLog": [ 1, 2, 3.5, 5, 5, 3.5, 1 ],
    "tags": ["modularity"]
}
---

## Module Design and its consequences

Before talking about module communication, it is important to emphasize the consequences of chosen module design. Problems that we will face when communicating between modules, how often and how much of communication there will be, depend mostly on decided modules structure. What should be our guiding principles when designing modules? What should we avoid?

**Modules must be responsible for a specific, clearly defined functionality or a set of closely related functionalities.**
Functionalities should be as completely implemented by a single module as possible - if we often find ourselves changing more than one module to implement one feature or behavior, we have to reconsider our design, something went wrong there.
Modules should be as self-contained and independent as possible. Ideally, every module would not need to talk with any other module; of course, that is rarely possible, but our guiding principle should be: 
> Design modules in such a way that they can serve their functionality with as little dependency on other modules as possible - ideally zero, no dependencies.

\
How can it be achieved? We have to discover and define functionalities and behaviors specific to our system, we should also map relationships and dependencies between them - it then will be clear what types and number of modules it makes sense to have. Assuming that we have modules that depend very little on each other, but sometimes they do need to talk with each other - how can they and when they should?

## Clients/APIs method calls

Simplest approach - just method calls of modules' *Clients/APIs*. Often good enough, especially if we do not plan to migrate to multiple services/applications in the foreseeable future. For example:
```
// shared module, implementation in the user module
interface UserClient {

  Optional<User> ofId(UUID id);

  Map<UUID, User> ofIds(List<UUID> ids);
}
record User(UUID id, String name, String email)

// project module
record ProjectWithUsers(
  UUID id, 
  String name, 
  String description, 
  List<User> users
)
record Project(
  UUID id,
  String name,
  String description,
  List<UUID> userIds
)

class ProjectService {

  ProjectRepository projectRepository;
  UserClient userClient;
  
  List<Project> allOfNamespace(String namespace) {
    var projects = projectRepository.allOfNamespace(namespace);
    
    var userIdsOfProjects = projects.flatMap(p -> p.userIds());

    var usersByIds = userClient.ofIds(userIdsOfProjects);

    var projectsWithUsers = projects.map(p -> {
      var projectUsers = p.userIds().map(uid -> usersByIds.get(uid));
      return new ProjectWithUsers(p.id(), p.name(), p.description(), projectUsers);
    });

    return projectsWithUsers;        
  }
}
```
We have three modules: shared, user and project. We have `UserClient` interface defined in the *shared module*; the *project module* depends only on the code from the *shared module*, it does not know anything about the *user module*. In the *user module*, we have a `UserClient` implementation that is used by the *project module* at runtime; this implementation might be something as simple as fetching users from the user's module database/schema. Then, the *project module* uses `UserClient` interface as a code dependency; thanks to this interface, we have clearly defined module boundaries - `UserClient` is the only allowed way to call user module code from the outside. Thus, the following rules are established:
* **shared module must not depend on any module** - it is completely independent
* **other modules can depend only on the shared module** - *Clients/APIs* of every module are declared in the *shared module*, but are implemented in corresponding modules

\
**This approach has a huge advantage of simplicity**; also, we have a very loose coupling at the code level - in every module, we depend only on shared, independent interfaces and models. What are its main drawbacks?
* Method calls are synchronous - if, at some point, we decide to move a certain module to a different service/application, and thus separating modules physically, we would most likely introduce a synchronous network call. As opposed to a simple in-memory method call, we will need to account for additional latency and reduced reliability, since network calls are never fully reliable and can always fail
* **For not read, but write methods - we need to be especially careful about transactionality assumptions.** Modules should not start transactions that span multiple modules because it introduces additional, undesired and hidden dependency. By doing that, we make an assumption that modules have the same, shared database. Once we need to migrate a certain module to a different service or just to change/isolate its database - this assumption will no longer hold true and our transaction will stop working

**These are relatively minor drawbacks; especially if we avoid cross-module transactions, which is feasible with good module design, this approach offers excellent tradeoffs.** Even if we ever need to migrate some of our modules to a separate application/service, it will be quite easy to do, since dependencies are clearly defined and encapsulated in dedicated abstractions. Besides, let's be realistic: [in the vast majority of cases, we can and should stick with just a single unit of deployment - Modular Monolith](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html).

## Application Events

On their own, useful and applicable only in some cases: when something that other modules might be interested in happens, we just send an in-memory event. For example:
```
// shared module
record UserCreatedEvent(
  UUID id,
  String name,
  String email
)

// user module
class UserService {

  UserRepository userRepository;
  Transactions transactions;
  ApplicationEventPublisher applicationEventPublisher;

  void handle(CreateUserCommand command) {
    // some validation
    transactions.execute(() -> {
      userRepository.save(new User(...));
      applicationEventPublisher.publish(new UserCreatedEvent(...));
    });
  }
}

// email module: 
// saves user account activation email 
// and sends it later on in a separate, scheduled process
class EmailScheduler {

  EmailRepository emailRepository;
  EmailSender emailSender;

  void onUserCreatedEvent(UserCreatedEvent event) {
    emailRepository.save(new UserAccountActivationEmail(event));
  }

  void sendAllScheduled() {
    // later on, sends all scheduled emails that are waiting in the database
  }
}
```
It is very simple, but similarly as with *Client/API* methods calls we *can* introduce undesired dependency between modules. In the example, we assume that both *user* and *email* modules share a database, since a transaction that spans these two modules is created. This might or might not be true, but it does introduce an additional dependency -  we now *require* modules to share a database, because otherwise this communication is not reliable. This dependency will cause us problems down the road, if and when we decide to have separate databases or move one module to a separate service/application. **If this is not something that we plan to do in the foreseeable future or even ever, or we have a case of publishing events without the need for transactional guarantees - simplicity of this approach is alluring.** What is more, it is straightforward to migrate to the *Outbox Pattern* later on, which offers the same delivery guarantees without the coupling at database level. What is the *Outbox Pattern* then?

## Outbox Pattern

In the previous approach/pattern, the major disadvantage is an implicit assumption about having a single, shared database between modules. How can we fix this by using the *Outbox Pattern*?

Instead of sending an in-memory event in or after a database transaction, we save this event together with the current data change or just in the same transaction. We also have a separate, independent process that takes events from the database and sends them to the interested consumers/listeners; events are then deleted from the database, but only after being received and successfully handled by all consumers. Changing the *Application Events* example to use this pattern:
```
// shared module
record UserCreatedEvent(
  UUID id,
  String name,
  String email
)

// user module
class UserService {

  UserRepository userRepository;
  Transactions transactions;
  OutboxRepository outboxRepository;

  void handle(CreateUserCommand command) {
    // some validation
    transactions.execute(() -> {
      userRepository.save(new User(...));
      outboxRepository.save(new UserCreatedEvent(...));
    });
  }
}

class OutboxProcessor {

  OutboxRepository outboxRepository;
  ApplicationEventPublisher applicationEventPublisher;

  // scheduled process, running every one to a few seconds
  void process() {
    var maxEvents = 500;
    var events = outboxRepository.allEvents(maxEvents);
    
    var successfulEvents = new ArrayList<Event>();
    var failedEvents = new ArrayList<Event>();
    
    for (var e : events) {
      try {
        // sends to all consumers synchronously, fails if any of them fails
        applicationEventPublisher.publish(e);
        successfulEvents.add(e);
      } catch (Exception e) {
        failedEvents.add(e);
      }
    }
    
    outboxRepository.delete(successfulEvents);
    if (!failedEvents.isEmpty()) {
      logger.warn("Failed to publish some events. They will be retried in the next round: {}", failedEvents);
    }
  }
}

// email module: sends user account activation email
class EmailScheduler {
  
  EmailSender emailSender;
  
  void onUserCreatedEvent(UserCreatedEvent event) {
    emailSender.send(new UserAccountActivationEmail(event));
  }
}
```
As we can see, we have introduced an additional layer of indirection, but event handling is basically the same. **The main difference is: we do not make any assumptions about the databases of different modules - delivery is guaranteed by relying solely on the database of a single module.** It usually works like this:
1. *module* creates/updates/deletes an entity and creates event/events (to be sent later) in the same database transaction or together with modified document/object, for non-transactional databases
2. there is a scheduled job/process that takes events/messages from the database and sends them to all interested listeners/consumers
3. it then deletes all successfully published events
4. in the next scheduled execution, it retries to send all failed events (it can be a little smarter, as to when to retry)

\
**Sending process is now clearly more complicated than in the plain *Application Events* approach, but there are many benefits.** We can easily exchange databases of modules because there are no related assumptions. Additionally, whenever we decide to move a module to a separate application, it is relatively easy to just add another *outbox message publisher*. Instead of publishing events in memory, we can send them to some kind of *Message Broker/Service* like RabbitMQ or Kafka, or just make simple http requests to all interested services - this pattern is really flexible. 

**There is another important consequence of this pattern: event/message consumers have to be *idempotent***; it is not required in the *Application Events* pattern. Sending events and then deleting them from the database are two completely independent processes, which can fail independently and for different, unrelated reasons. Therefore, our consumers/listeners have to be ready to handle duplicate messages: there is only *at-least-once*, not *exactly-once* delivery guarantee.

## Background Data Synchronization

This method is an extension and refinement of all the previous ones. If we recall the *Clients/APIs method calls* approach, its main, potential issues were:
1. synchronicity - whenever there is a need to separate particular modules physically, we will probably introduce something like http call, which adds latency and decreases reliability - called service needs to be available to handle requests
2. the first drawback is often acceptable as long as we deal only with *reads* - once *writes* are involved, *transactionality* welcomes us with a new set of data integrity and consistency problems

In order to avoid these issues, **we can introduce a simple, yet significant principle:** 
> While handling external requests, a module must not call another module.

Or to borrow a metaphor from a certain smart person:
> If a teacher asks you a question, you must answer it yourself; you cannot ask other students for help.
>
> However, outside of that moment - before and after - you are free to ask and learn from other students.

\
This simple idea has serious consequences. **To meet this constraint, every module needs to have all required data to deliver functionalities it is responsible for; as a consequence, modules are less coupled, more resilient, independent and self-contained.** It again emphasizes the importance of great module design - we need to choose proper modules and assign them correct responsibilities, so that they *can be* as independent as possible when delivering what they are responsible for. Depending on the data size and how often it changes, we have two options:
1. **modules publish *Changed* events** every time a certain entity/data is changed and guarantee delivery of these events - using *Outbox Pattern* for example; other modules are just consuming them and saving new data in their databases
2. **modules expose *Clients/APIs*** (just public methods) to query data that other modules might be interested in having; then all dependent modules have a scheduled process, at needed frequency, to synchronize this data with their copy

With option one, we also have to handle *initial data load*: whenever a new module that needs data from an already working module is introduced, it probably should get data from all events published in the past. It is usually rather straightforward to implement using *Clients/APIs* approach, but we do need to keep this time dependency in mind. Moving on to an example:
```
// shared module, implementation in the user module
interface UserClient {
  Stream<User> allUsers();
}
record User(UUID id, String name, String email)

// published by the user module whenever a user is created or updated using Outbox Pattern;
// we should probably also have UserDeletedEvent, if that is possible
record UserChangedEvent(User user)

// project module: 
// serves data only from its repositories (database) 
// and synchronizes it with the user module in the background
record ProjectWithUsers(
  UUID id, 
  String name, 
  String description, 
  List<User> users
)
record Project(
  UUID id,
  String name, 
  String description, 
  List<UUID> userIds
)

// returns projects with users solely from the project module database
class ProjectService {

  ProjectRepository projectRepository;
  ProjectUserRepository projectUserRepository;
   
  List<Project> allOfNamespace(String namespace) {
    var projects = projectRepository.allOfNamespace(namespace);

    var userIdsOfProjects = projects.flatMap(p -> p.userIds());

    var usersByIds = projectUserRepository.ofIds(userIdsOfProjects);

    var projectsWithUsers = projects.map(p -> {
      var projectUsers = p.userIds().map(uid -> usersByIds.get(uid));
      return new ProjectWithUsers(p.id(), p.name(), p.description(), projectUsers);
    });

    return projectsWithUsers;      
  }
}

// synchronizes users data in the background
class ProjectUsersSync {
  
  ProjectUserRepository projectUserRepository;
  UserClient userClient;

  void onUserChangedEvent(UserChangedEvent event) {
    projectUserRepository.save(event.user());
  }

  void syncAll() {
    userClient.allUsers()
      .forEach(e -> projectUserRepository.save(u));
  }
}
```
In this case, we depend on the `onUserChangedEvent` method for live updates. Initial (full) synchronization implemented as `syncAll` method is needed only at the beginning, when the module is deployed for the first time - we call it once and after that we can rely only on events.

If synchronized data do not change that often or is rather small, and/or we do not need to have it up-to-date immediately and are fine with *eventual consistency* - we might skip events and just synchronize all data once per day, every few hours or every few minutes, depending on our needs, using *Client/API* of the module.

**In this approach, similarly to the *Outbox Pattern* (that we also use here to guarantee delivery), modules are loosely coupled and it is quite easy to move any module to a completely separate application.** Let's say that we decided to move the *user module*, from the example, to the separate `user-service`, while leaving other modules in the `modular-monolith`. What do we have to change? We now cannot publish events in memory and *Clients/APIs* cannot be implemented as simple method calls. We might:
* implement `UserClient` as `HttpUserClient` that makes http requests to the `user-service`, instead of in-memory method calls
* with *Outbox Pattern* in the `user-service` we have two options:
  * we can use a message broker/service like RabbitMQ, Kafka or GCP Pub/Sub to publish and consume messages/events over the network, instead of in memory
  * we can still publish events in memory, but then listen to them in the `user-service` and send `UserChangedEvent` using simple http *POST* request to the `project` module, running in the `modular-monolith`

That is all we have to do to move the *user module* to another, independent service! It is indeed an extremely flexible approach.

## Closing thoughts

As we have seen, there are a few good ways in which modules can communicate with each other. Most notably:
1. **Clients/APIs** - simple, in-memory method calls of dedicated interfaces
2. **Application Events** - in-memory events published between modules, which can introduce coupling at the database level
3. **Outbox Pattern** - in-memory events with more sophisticated sending process that does not introduce coupling at the database level, thus making it easier to separate modules physically
4. **Background Data Synchronization** - does not allow modules to communicate with each other during external requests processing, which forces them to be more self-contained, independent and resilient

\
We have also learned that **the most important thing to focus on is to have great module design**. Therefore, we should focus on properly identifying and defining modules first, and only then start to think about appropriate communication patterns and approaches.

Having great module design and applying communication patterns wisely, will not only simplify our *Modular Monolith*, but also make it more flexible and easier to change. Additionally, when and if the need arises to migrate some or all modules to multiple applications, it can be done with minimal effort.

<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources 

1. My more in-depth article, arguing why modularity is far more important than the number of deployable units (applications): [Modular Monolith and Microservices: Modularity is what truly matters](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html)
2. A strategy to have a *Modular Monolith* with independently deployable modules, on my YouTube channel: https://www.youtube.com/watch?v=onV4449vs1g
3. Regarding the *Outbox Pattern*, it is important to mention that it requires more resources at multiple levels. Every database change that triggers event publishing now requires additional db operation - we have to save the event also. What is more, we must have a scheduled process that also takes resources; then, successfully published events need to be deleted, which of course triggers yet another db operation. That is quite a few additional operations, but this pattern does have significant advantages of decoupling modules and guaranteeing events/messages delivery, so I think it is often worth its price - we just need to use it wisely, it does not fit everywhere
4. *Background Data Synchronization* approach was inspired by the *Microliths* idea, described by Uwe Friedrichsen. Thanks for the inspiration Uwe! https://www.ufried.com/blog/microservices_fallacy_10_microliths/

</div>