---
{
    "title": "Modular Monolith, Services and Microservices: Modularity is what truly matters",
    "slug": "modularity-monolith-services-and-microservices-modularity-is-what-truly-matters",
    "publishedAt": "2023-11-26",
    "startedAt": "2023-11-12",
    "timeToRead": "34 minutes",
    "wordsCount": 4300,
    "excerpt": "Modularity is an important concept when designing and creating software. Independent of whether our architecture is:  single unit of deployment - Monolith, many units of deployment - Microservices, Monolith++ - major, core unit of deployment + one/many helper services that additional/specific resource requirements.",
    "researchLog": [0.5, 2, 1.5 ],
    "writingLog": [ 3.5, 1.5, 1.5, 2, 1.5, 3 ]
}
---

## Modularity

Modularity is a crucial concept when designing and creating software. Independent of whether our chosen architecture style is:
1. single unit of deployment - Monolith
2. a few/many units of deployment - Microservices/Services
3. Monolith++ - major, core unit of deployment with the help of one/multiple single-purpose, smaller services that have specific resource/other requirements

**Modularity is a quality that should be treated completely independent of the how many deployable units of software we choose to have.** We should aim at splitting our systems into logical, functional modules as independent of each other as possible - in the ideal world, every module should not know anything about any other module and have everything that is needed to serve its functionality. But, what is a module in that context?

**Module is a piece of software - be it one object/class/function or set of objects, classes and functions cooperating with each other - that is responsible for delivering specific functionality or set of closely related functionalities.** Those functionalities should be defined from the user perspective - be it human or machine (other software or module for example). Every module needs to have an input, some kind of public API, that a human or other software can use in order to benefit from its functionalities. But, why do we even care about modularity in the first place, what benefits does it bring to the table? A couple of reasons:
1. Organization - with good modules separation, it is often very clear/obvious what exactly given software/system does. It is then also easier to work in parallel for a team, on a different pieces, independently
2. Comprehension - it is significantly easier to understand (for humans) five small modules of the software rather than having to deal with one big piece where everything is intertwined
3. Resource utilization - often some modules may have completely different resource requirements. For example, one module might need to be highly available and used by tens of thousands of users and the other might run some tasks in the background and not be exposed to the outside word - modularization allows to take those factor into account
4. Reusability - by giving modules clearly defined responsibilites we can reuse their functionalities
5. Testability - it is easier to verify that a small/medium module of software works versus having to deal with a one big piece
6. ??

To make previous point clear, let's work on a example and say that we have a system where users can add notes to famous quotes and sayings - *Curious Notes*. One possible design is to have the following modules:
* users: responsible for the creation of new users, managing accounts and authorizing/authenticating them
* quotes: responsible for the management of quotes by the users
* notes: responsible for adding notes to quotes by the users

Assuming the following dependencies:
* users - no dependencies
* quotes - depends on *users* for asking whether a certain *user* is allowed to add/edit/delete a quote
* notes - depends on *users* for asking whether a certain user is allowed to add/edit/delete a *note*, depends on *quotes* to know wheter a particular *quote* exists

These are our modules and dependencies. We should treat this division mostly indepently of our physical achitecture choices: we can have a modular monolith with these three modules as separately versioned packages or just isolated folders, but we can also have a three separate services, communicating over the wire. These concerns should be a secondary, not primary, when it comes to modules design: the driving factorus should be the understanding of our domain, concepts that we have there and the dependencies between them. Only having sorted this out we can think about non-functional, performance and resource utilization related factors.

## Business realities of software implementation

TODO:
* be practical here or somewhere else!

Modularity requirements that we described are great ideal circumstances when we have complete knowledge about the software that we build and its requirements. In practice unfortunately that is often not the case and there might be many valid reasons for ambiguity:
*  sometimes we do not have access to the client that drives requirements, but need to start development due to time constraints before being able to know all the details and required features
* sometimes we model something that is changing all the time - think about the startup environment - we experiment a lot and/or not sure about the details of our domain at all

\
That is definitely a crucial factor when it comes defining our modules and especially when it comes to our architectural decisions - modular monolith or microservices. Always try to get all information that is needed to make good design decision, but if it is not possible or the amount of information is just to small - we need adapt our decision-making strategy accordingly. The more ambiguity we have, the more dynamic our domains is, the less certainty about its final shape we have - the more we should think about adopting a strategy where it is easier to change our architecture, where it is less costly. In that situation we should start with the simplest modular monolith strategy possible - it is very cheaply to change its structure and we can always migrate to something more sophisticated as our domain starts to get less fluid and more defined. It does not make sense to create microservices, when we know that we might change their number and responsibilites at any time - stick with a simple modular monolith.

## Modularity implementations

As said, there are many ways to implement modularity in practice. As we have also mentioned, good design, which is a good modules separation, does not depend on our physical architecture - whether we have one or many units of deployments. We need to understand our domain, think about boundaries and modules that naturally arise there - especially dependencies between them, because the dependencies often make or break the system. Only when we have that defined, or are sure that it will not change *that* much, we can evaluate how to structure our system physically, at runtime. It means answering the questions like:
* Should we have one or many units of deployment (runtime units)? 
* If one - how complex our modular monolith structure needs to be and what type of constraints we want to impose on it?
* If many - what type of constraints (if any) we want to impose on our services - mainly tech stack, allowed types and timing of communication (synchronous/asynchronous mainly), distributed transactions and so forth

Let's then consider different strategies that we can employ here.

### Simple Modular Monolith: modules as folders

TODO
* independent deployments - needs to be from the same source code branch

This is the simplest and most straightforward way of modularization. Here we just treat each folder as a separate module, we do not version them independently and do not have any additional boundaries. If we work alone on the project, or in one small, team - that is often enough. Its biggest advatage being simplicty, can also be it biggest disadvantage. We need to take additional precautions so that our modules boundaries are respected and we do not turn our *modular monolith* into just a *monolith* - a big pile of mud. To guard ourselves against such an unfortunate scenario, we should establish and respect some conventions like:
* have a *_contracts* folder/package, where we have all common interfaces and models defined
* each module can have a specific folder/package/file where its public interface is defined and the rest is not allowed to be used (it is private to a module)
* if we use a single database - we should use separate schema for each module or have some reasonable table naming convention - each module should own its data

\
Let's say that we took the first approach and we have a separate *_contracts* folder/package (_ to distinct it from domain modules). Using our previous example of a *Curious Notes* system where we had *users*, *quotes*, and *notes* modules, we can imagine the following interfaces in the *_contracts* package:
```
interface UserClient {
  boolean canAddNote(UUID userId);
}

interface QuoteClient {
  boolean doesQuoteExist(UUID quoteId);    
}

record QuoteCreatedEvent(UUID quoteId) { }
record QuoteDeletedEvent(UUID quoteId) { }
```
As we can remember *quotes* module depends on the *users* module. Using this convention, it would only use *UserClient* interface to communicate with *users* module. *Users* module will implement this interface and it will be injected to the *quotes* module at runtime, but *quotes* module is only aware of the *UserClient*. In that way, it does not anything about the details of *users* modules - it is not coupled to its implementation details. It will be the same for *notes* and *quotes* module, *notes* module communicate with *quotes* only through *QuoteClient* interface. Additionally, we can use application events, like *QuoteCreatedEvent* shown here to publish messages and data across modules, if they are interested in them. In *users* module we might for example send a notification to users whenever new quote was created or in *notes* have a mechanism to delete notes for a quote that was deleted and exists no longer.

This the simplest and most nimble solution to modularization. If we work alone/in a small team or we are not sure about our domain or the modules separation, this is probably the way to go - if we respect a few rules, it is easy to migrate to more elaborate structures later on. The main drawbacks are:
1. it is realtively easy to cross modules boundaries and do not respect establish conventions
2. we can not have independent deployments of different modules code from different git branches, because we do not version them independently (if we deploy from a single branch always it is not an issue)

As said, these drawbacks may be completely fine in your specifc use case. You/your team might be discplined enough so that you do not cross those boundaries. Additionaly, if we can run our monolith locally and we work in a single team - it is probably not needed to have independent deployments of different modules. As always, choose solution that fits into your own unique constraints!


### Modular Monolith with isolated and independently deployable modules

This is more rigorous version of the previous option. We still have a single unit of deployment, but every module is independently versioned package - be it Java jar, NPM package, Go binary or C# assembly. There are a couple of consequences of that additional isolation:
1. every module is independently versioned and can be deployed independently (if we have a private repo of artifacts, where we upload our packages, which is not that hard to set up)
2. if we depend on another module, we need add it as dependency to our module, which makes it much easier to track dependencies
3. because of the previous point, it is harder to cross modules boundaries that should not be crosssed
4. to make our modules even more independent we can use different database in each module to decouple them even more
5. if we want to make them even more insulated, we can put every module in a different git repo

When it comes to the point 1, the idea is to use use SNAPSHOT (in java word) versioning, when we can upload modules with the same version all the time. Then, we can upload module A from the branch feature-A, and redeploy our modular monolith with the same as previous ones modules, but only with the change that we have now introduced. It is possible because we have some kind of *application/main* module that depends on all domain modules and assembles our modular monolith as an executable application. Because every module is uploaded to some kind of private artifacts repository (like Nexus), we can upload different versions of them from different git branches and still not affect the work of other team members, who migh be also changing something in different modules, changed on different git branches. Of course, with the approach number 5, where each module is placed in a separate git repo it is even easier.

As mentioned, if we want to have even more separation we can use different database in every module. Whether it makes our modules more independent that the previous, simplest modular monolith approach - it depends. If in *simple modular monolith* approach we have a rule that we do not make transactions that cross multiple modules, we do not gain anything here. Here, we are forced not to have them, because it is not possible when using multiple databases. Usually, if we need to have a transaction that spans across multiple modules it means that something in our design is not right. Still, sometimes transaction of this type or publishing application event reliably is necessary. In that case, we need to use patterns from the microservices word - mainly outbox pattern to deliver messages or saga for (unfortunately) distibuted transactions. We can usually avoid the latter, by having smart data reconciliation mechanism in the background. Because distributed transactions are hard, I recommend to desing our modules in such a way that we do not need to have transactions that span multiple modules and at the very worst we just need to copy some data from one module to another. This is simple as it can be done in the background, independently of normal requests processing and we have a guarantee that it will always succeed  eventually (if implemented correctly).

This approach is much more scalable. If we have indepedently versioned modules and each one has its own databse, multiple times can work on a single modular monolith split like that in parallel with minimal/no conflicts and contention at all. The one thing that we need to keep in mind is that we still have single runtime and a unit of deployment, so we do have some limitations when it comes to tech stack being used (write more about that).

### Microservices - modules as applications

TODO:
* cascading failures
* coupling - does it depend on the sphere of control?
* indeterminism of network calls
* git limits: what about google monorepo?
* microliths - fewer services (3 - 4) that are modular monoliths (sth similar)
* modularization from the start - create a new, separate unit of deployment later one, when we have an empirical proof that it is indeed needed
* "They decided to strictly modularize their IT systems in a way that IT modules do not cross team borders. IT modules crossing team borders means coordination, means slowing down. Thus, they strictly went for modules not crossing team boundaries." - is it really true?
* non-functional demans - 1000 users + high availability vs 10 users using it sometimes? - single unit of deployment - UNION of these requirements needs to be meet (inventory-manager + inventory-manager-worker ??)
* "This way, e.g., Etsy had more than 50 releases of their deployment monolith to production per day without any special team coordination. Still, this means more effort than most companies usually spend in team independence when setting up a deployment monolith. So, it definitely does not come for free – and if not done, it will result in higher team coordination efforts. But that is not due to the modulith, but due to homework not done."
* microlith - microservices, but major constraint - you can not make a network call when processing an external request!

This is the most complex solution for modularization. Here, we simple say that each module is a separate application, deployed independently, so number of our deployment units is more or less equal to the number of modules. 

We need to pay a significant price for this separation. First is the complexity of our infrastructure. With one - two units of deployment - we most likely can just deploy our application to a virtual private server or some kind of application as a service platform and that is it. Here, we have a few separate applications that most likely will need to communicate through remote network calls - we will need to setup an infrastructure where it is possible. Additionaly, observability of our system will be much harder to do. We will no longer need to deal with just method calls, but events publish to message broker/queue system (we also need to have one in the first place) or synchronous, most often HTTP calls, between services that may or might not be up. We now have a trully distributed system and the whole shelves of books have been written about the complexities of such a system. It is not something that we should treat ligthly. It is worth pointing out, that most people and teams do not appreciate this complexity enough. Having said all of that, sometimes it is justified and brings number of benefits.

What are the benefits? Because each of our module is more or less a separate application, we can use multiple tech stacks, based on the needs of this particular module (altough it is really rarely needed and has its own set of tradeoffs). What is probably more important, various modules can have different resource utilisation requirements. Some of them might not be available all the time and be under high load, while some of them might not and some of them might be something in between. Thanks to the fact that every module is now basically a separate application/unit of deployment we can assign different resources to each of them, have them in a different, often dynamic number of replicas and so forth. With the modular monolith approach, if one module needs more resources we need to scale whe whole monolith, because we have single unit of deployments, which is arguable less optimal (There is laso Monolith++ approach that we discuss below that addresses this issue).

Another benefit is that we can arguably scale to more teams. In *Modular Monolith with Independently Deployable Modules* approach we can definitely scale to a few teams, but probably not to tens or hundreds. If we expect that type of growth in our organization, microservices might be justified. Because of that, we can arguably also have more independent streams of work in parallel, but I would argue that you can basically do the same with the modular monolith, it just requires more discipline, but still can be done.

To sum it up - use this architecture if you really, really need it, as it is the most complex one and it can slow us down significantly, if we employed when not needed. But sometimes, sometimes, solutions like that are indeed needed.

### Constrained Microservices - Services/Microliths

TODO:
* constraint - large consequences - not cascading failures for example!

We can mitigate many (not all) problems with microservices by following one, simple rule:
> When serving any external network request, synchronous or asynchronous, we can not make any network calls to other services, synchronous or asynchronous.


Why this is so powerful?
* It forces us to split our services in such way that they have all data needed for their functionality, often simplifying and improving our design
* Services are more reliable, because by the virtue of the contraint not to depend on any other service to serve external requests
* We do not need to deal with distributed transactions. By the virtue of this constraint they are not possible
* System of this kind is also much easier to understand and debug. We do not make any network requests when serving external requests, so the only thing that can fail there is our service

Obviously, sometimes we will need to share some data/functionality with other modules/services. This is allowed, but only in the background. We can have a scheduled process, where we reconcile data with other services, where needed, through sending messages or by making plain old http requests. This far easier to understand, because it can only fail if the target service is not available and still does not impact the functionality of our service directly. Additionally, this design will probably result in less amount of services overall, because we are incentivized to have everything that is needed to serve the functionality of the service embeded in it directly. 

An interesting hybrid might arise here - we could end up with just a few bigger services like that and each of them can be a simple modular monolith. We can then reap the benefits of both approaches - have a few, independently scalable units of deployment, but still without a need to have a complex infrastructure, observability tools and the network complexity that we need to have with pure microservices approach. 

### Modular Monolith with Helper Services

This is approach is where by default we have a *Modulith (Modular Monolith)* core , be it simple or more elaborate, and we add most of the functionality there, focusing on good modules structure. In rare cases, where some module/modules has/have different resource requirements/requires different tech stack or whatever else that makes it significantly different from our modulith core we create a separate service out of it and keep it independent. What does it mean? We should apply rules from the *microliths*, so no network communication allowed when serving external network request. In that way, we still have a simple system, but whenever our modular monolith has a distinct module, for whatever reason, we separate it as small, independent, single-purpose service to serve these needs better. 

## Work in parallel and independent deployments

When we work in a team or in a few teams it is important to be able to have as many independent streams of work as possible to parallelize the work. In the context of modularity, the more modular our design is, the easier it is to split the work between different persons and teams. The less coupled, more independent our modules are, more people/teams can change code of a given system in parallel without interrupting work of each other. There are two separate dimensions to consider here:
1. introducing changes to the code base
2. testing changes on dev/stage/prod environments, which are shared generally

\
Let's start with the first one - introducing changes to the code base. All approaches that we have presented so far are more or less equal in that regard. Irrespective of whether we have the simplest modular monolith or most complex microservices setup, the bottleneck for our ability to work in parallel is the quality of our design, its degree of modularity. On one hand, if we have 10 separate microservices, but they depend on each other and are highly coupled - this will impede our ability to work independently and in parallel. On the other hand, if we have a simple modular monolith with 50 loosely coupled modules - we can work on different parts of the system without blocking each other.

Second one - testing changes on different environments. That depends on the details of our environments, there are many possible strategies here. What is worth pointing out homever is by default, microservices/separate services - having many units of deployments - give us this ability kind of by default, if we design them correctly of course. If work on a separate service, we can deploy just it and test our changes without affecting currently deployed changes in other services - as long as our services are *fairly* independent. Of course, it is also possible with the modular monolith - if we have separated our modules to different packages and are uploading them to some kind of private artifacts repository (like Nexus) - we can deploy our modular monolith with new version of the module that we work on, without affecting the other ones. It is perfectly possible, it just is not there by default. Additionaly, if we have the simplest modular monolith and we work on in a few teams - we can have separate dev/stage/prod environments per team - there are probably many other ways to allow indepedent deployment with modular monolith, it just requires some additional effort and is not there by default. But as we know, microservices bring many infrastructure complexity that also are not there by default, so there is also a tradeoff there - evaluate accordingly to your specific use case.


## What about The Frontend?

TODO:
 * write about why usually there is less need for it

As it might be sensed, I focused mostly on the backend or systems without a strict frontend/backend distinction when it comes to units of deployments here - like traditional, server-side rendered apps. If we have old-school server rendering or use <a href="index-a-crucial-data-structure-for-search-performance.html">HTMX</a>, we have views defined in the same modules where our backend lives (there is no frontend/backend distinction when it comes to units of deployment), the problem is solved. In that approach, our frontend/views would be scoped to our modules. **Thinking pragmatically though, what about JavaScript focused Single Page Applications that dominate the market today?**

In the SPA approach, we should follow almost the same rules related to modularity as discussed so far. We can start with a simple modular monolith, by having modules defined just as separate folders. Similarly, we can have *_contracts* folder/module that strictly describes how our modules can communicate with each other and what, if any, state they can share. Additionally, we can limit the usage of global styles (<a href="https://tailwindcss.com/docs/reusing-styles">Tailwind</a> approach mostly fixes this) and components and rely mostly on module-scoped styles and components. Here, universal rules when it comes to the degree of modules independence apply - the more independent they are, the more work in independenlty we can change and work on them. With the simple modular monolith approach, we will not have the ability to independently deploy our modules. Therefore, if modules as folder are not isolated enough we can use <a href="https://nextjs.org/learn-pages-router/foundations/how-nextjs-works/code-splitting">code splitting/dynamic imports approach</a> to have mutliple independent entry points to our appliction. As the last resort, we can have separate SPA per every route, having as many html pages as we have SPAs, or use <a href="https://martinfowler.com/articles/micro-frontends.html">microfrontends</a> approach. Both of them gives us completely separation of our modules, similar to microliths/microservices discussed above.


## Closing thoughts

We have delveed deep into modularity, its importance, its various consequences on our system and different modularity implementations. More specifically, we have compared having a single unit of deployment, most often called a (modular) monolith, with multiple ones - (micro)services. We also shed some light on various implementations of each strategy and compared their tradeoffs, because, what is always worth reminding, there is no free lunch, nothing is free of consequences. To reiterate, we went through a few important strategies and their consequences:
* Simple Modular Monolith
* Modular Monolith with Isolated Modules
* Microservices
* Contrainted Microservices (*<a href="https://www.ufried.com/blog/microservices_fallacy_10_microliths/" target="_blank">Microliths</a>*)
* Modular Monolith (core) with Helper Services

\
As always, thoughtfully consider which strategy fits your use case and only then go for it. Also remember, that you can always transition to more complex one, so it is better to err on the side of simplicity. Have a great decision making and I wish you much needed good luck, design and architecture are art in the end, there are only tradeoffs!

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a target="_blank" href="https://www.youtube.com/watch?v=onV4449vs1g">Modular Monolith with Independently Deployable Modules in Java</a>

<div class="article-delimiter">---</div>


### Notes and resources
1. in the example of users -> quotes -> notes: maybe each module could have redundant copy of some of the other modules data  and then be more loosely coupled?
2. https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer
3. https://pretius.com/blog/modular-software-architecture/
4. https://www.nfsmith.ca/articles/monolith_by_default/
5. https://microservices.io/patterns/monolithic.html
6. https://microservices.io/post/architecture/2023/07/31/how-modular-can-your-monolith-go-part-1.html
7. https://www.ufried.com/blog/limits_of_saga_pattern/
8. https://www.ufried.com/blog/microservices_fallacy_10_microliths/
    * The seemingly minor constraint that a service must not call other services while serving an external request, makes a huge difference in practice. The service processing the external request does not need to wait for other services to complete the request processing, does not need to deal with failures that might happen while calling other services, is not confronted wth all the intricacies of distributed systems, but just with the subset that is already known from monolithic application landscapes.
    * The call for infrastructure tooling is but the futile attempt to obtain perfect safety and liveness from the infrastructure while not having to care about it on the application development level.
9. https://microservices.io/post/architecture/2023/08/20/how-modular-can-your-monolith-go-part-2.html
10. https://www.ufried.com/blog/microservices_fallacy_9_moduliths/
11. https://www.ufried.com/blog/microservices_fallacy_4_reusability_autonomy/
12. https://www.ufried.com/blog/microservices_fallacy_5_design/
    * This means: A deployment monolith can be perfectly structured. You do not need microservices to achieve an acceptable (i.e., maintainable) source code structure.
    * "If you do not know how to design a system in a structured and weakly coupled way, you will end up with a “ball of mud”.
If you skip understanding the functional domain of your system, tight coupling is unavoidable and you will end up with a “ball of mud”.
If you do not design clear module interfaces and decouple them from the module implementation, you will end up with a “ball of mud”.
If you decide to bypass the existing module interfaces because it is technically possible and saves you a bit of implementation effort, you will end up with a “ball of mud”.
If you shun to document the relevant design principles of the system and thus make it very hard or even impossible for future engineers to see them, you will end up with a “ball of mud”.
If you do not take the time to understand the design of the existing system and just start coding along in your preferred way, you will end up with a “ball of mud”."
13. https://arnoldgalovics.com/truth-about-microservices/
14. https://renegadeotter.com/2023/09/10/death-by-a-thousand-microservices.html
15. https://martinfowler.com/articles/micro-frontends.html
16. https://frontendmastery.com/posts/understanding-micro-frontends/
17. https://www.thoughtworks.com/en-us/insights/blog/microservices/modular-monolith-better-way-build-software