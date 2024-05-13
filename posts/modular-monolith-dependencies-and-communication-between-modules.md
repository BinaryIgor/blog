---
{
    "title": "Modular Monolith: dependencies and communication between Modules",
    "slug": "modular-monolith-dependencies-and-communication-between-modules",
    "startedAt": "2024-05-14",
    "publishedAt": "2024-05-22",
    "excerpt": "What patterns for communication between modules are out there and how their choice and degree of usage depends on the dependencies between modules, therefore modules design.",
    "researchLog": [ ],
    "writingLog": [ 1 ]
}
---
## Modules design and dependencies
???

## Modules need to have boundaries
???

## Module Clients/APIs
Simplest one, often enough - just api calls of other module methods, for example:
```
interface UserApi {
  Optional<User> ofId(UUID id);
}
```

\
Advantages:
* simplest one - just method calls
* still loosely coupled code - modules can just dependent on interfaces/abstractions, not concrete implementations
* ??

Disadvantages:
* Calls are synchronous - if we decide to move certain module to a different service, separating them (modules) physically, we will introduce synchronous network call, which can be problematic, depending on the context
* For non-read, but write methods - we need to be careful about transactionality assumptions. In most cases, modules should not do transactions that can span more than one module, because it introduces additional dependency, among other things. If we rely on that, it will stop to be true once we need to migrate certain module to a different service

Maybe better with rules like:
* module can not depend on other module when serving external request
* therefore, all communication must happen in the background

## Application Events

Useful and applicable only in some contexts. In general, we just send in-memory event when something that other modules are interested in happens. For example:
```
// user module
void handle(CreateUserCommand command) {
  // some validation
  transaction.execute(() -> {
    userRepository.save(new User(...));
    applicationEventPublisher.publish(new UserCreatedEvent(...));
  });
}

// email module: saving user account activation email, whenever new user is created
void onUserCreatedEvent(UserCreatedEvent event) {
  emailSender.sendUserAccountActivationEmail(event);
}
```

It is very simple, but similarly as with public API calls, we introduce undesired dependency between modules.
Here, we assume that both user and email modules share a database, because we create a transaction that spans two modules. That might or might not be true, but in any case it does introduce additional dependency - with this approach we *require* modules to share a database, because otherwise this communication would not be reliable. That dependency cause us problems down the road, when we decide to have separate databases or move one module to a separate application, also with another database. If we know that, that this is not something that we will need for a long time - simplicity of this approach might be an acceptable tradeoff. Additionally, it is quite straightforward to migrate to *The Outbox Pattern* later on, when we need to, so at the begining it might as well be good enough.

## Outbox Pattern

In the last approach, we the major disadvantage was the fact that there is an implicit assumption about having single, shared database between modules. We can fix that by using *The Outbox Pattern*. How is it different?

Instead of sending in-memory event after doing somethig, we would save this event, together with current change or just in the same transaction. We then can have a separate, independent process, that takes those events from the database and sends them to the interested clients; events are then deleted from the database only after being succesfully handled by the clients. Changing the previous example to use this pattern:
```
// user module
void handle(CreateUserCommand command) {
  // some validation
  transaction.execute(() -> {
    userRepository.save(new User(...));
    outboxRepository.save(new UserCreatedEvent(...));
  });
}

// user or some shared/common module
class OutboxProcessor {

  // scheduled process, running every few seconds
  void process() {
    var maxEvents = 100;
    var events = outboxRepository.allEvents(maxEvents);
    var successfulEvents = new ArrayList<Event>();
    var failedEvents = new ArrayList<Event>();
    for (var e : events) {
      try {
        // sends to all consumers synchronously, fails if any of them fails
        applicationEventPublisher.publish(e);
        successfulEvents.add(e);
      } catch(Exception e) {
        failedEvents.add(e);
      }
    }
    
    // delete successful events
    // log failed ones
  }
}

// email module: saving user account activation email, whenever new user is created
void onUserCreatedEvent(UserCreatedEvent event) {
  emailSender.sendUserAccountActivationEmail(event);
}
```

As we can see, we introduce another layer of indirection, but event handling is basically the same. The main difference is that we do not make any assumptions about the databases of different modules. The flow is always:
* module A creates/updates/deletes something and saves event to be saved later in the same transaction or in the same document/object for non-transactional databases
* we then have a scheduled process, can in shared/common module or in repeated in every module - does not matter that much, that takes all saved messages and send them to interested listeners/consumers
* we remove successfuly published messages
* we retry to send failed messages in the next schedule

Sending process is apparently more complicated than in the plain *Application Event* case, but it brings many advantages. We can easily change database of modules, because there is no dependency there. Also, whenever we decide to move one of the modules to a separate application, it is relatively easy to just add another *outbox message publisher*. Instead of publishing given event in memory, we can send them to some kind of message broker like Kafka or Rabbitmq, or just make simple http request to an interested service; it is really flexible. 

There is one import consequence of this pattern: event/message consumers need to *idempotent*. Sending events and then removing them from a database are two completely indepedent process that can fail for different reasons, completely independently. Therefore, our consumers/listeners have to be ready to handle duplicated messages.

## Remote Events

Have not we covered it already in the previous two sections?

## Background data synchronization

This pattern an extension of the first one: **Module Clients/APIs**. The main problems with this approach were:
* synchronicity - whenever we need to separate particular modules physically, we will need to introduce something like http call, which adds latency and decrease reliability - service needs to be available
* the first drawback is often acceptable as long as we deal only with *reads* - once *writes* are involved, *transactionality* also welcomes us with new set of problems


To avoid this problems, while still benefit from the simplicty of **Module Clients/APIs** approach we can introduce a simple, yet consequential principle: 
> while serving external requests, a module can not call another module.


This simple idea have significant consequences. To abide it, every module needs to have all the data it needs to serve all requests it needs to served; because of that, modules are less coupled, more resilient and flexible (what does it mean in this context?).
```

```

## Closing thoughts
??