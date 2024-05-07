---
{
    "title": "Modular Monolith and Microservices: Modularity is what truly matters",
    "slug": "modular-monolith-and-microservices-modularity-is-what-truly-matters",
    "publishedAt": "2023-11-26",
    "startedAt": "2023-11-12",
    "excerpt": "Modularity is a crucial concept when designing and creating software. Independent of whether our chosen architecture style is to have a single unit of deployment - <em>Monolith</em> or multiple units of deployment - <em>Microservices/Services</em>. It is a quality that should be treated completely independent of how many deployable units of software we choose to have.",
    "researchLog": [0.5, 2, 1.5 ],
    "writingLog": [ 3.5, 1.5, 1.5, 2, 1.5, 3, 3.5, 3.5, 5, 3.5, 4 ]
}
---

## Modularity

Modularity is a crucial concept when designing and creating software. Independent of whether our chosen architecture style is to have:
1. single unit of deployment - *Monolith*
2. many units of deployment - *Microservices/Services*

**Modularity is a quality that should be treated completely independent of how many deployable units of software we choose to have.** We should aim at splitting our systems into logical, functional modules as independent of each other as possible - in the ideal world, every module should not know anything about any other module and have everything that is needed to serve its functionality. In the real world that is usually not fully possible, but we should have these ideals as our guiding principles and strive for *<a href="https://codeopinion.com/solid-nope-just-coupling-and-cohesion/">high cohesion and low/loose coupling</a>*. But, what is a module in that context?

**Module is a piece of software - be it one object/class/function or set of objects, classes and functions cooperating with each other - that is responsible for delivering specific functionality or set of closely related functionalities.** Those functionalities should be defined from the user perspective - be it human or machine (other software or module for example). Every module needs to have an input, some kind of public *API*, that a human or other software can use in order to benefit from its functionalities. But, why do we even care about modularity in the first place, what benefits does it bring to the table? A couple of reasons:
* Organization - with well-defined modules, it is often very clear/obvious what exactly given system does. It is then also easy to split work and responsibility of people/teams and work on different pieces in parallel, independently of each other
* Comprehension - it is significantly easier to understand five small modules rather than having to deal with one big piece where everything is intertwined
* Resource utilization - some modules may have completely different resource requirements. For example, one might need to be highly available and used by tens of thousands of users and the other might run some tasks in the background, once in a while, and not be exposed to the outside word - modularization allows to take these factors into account which leads to more optimal resource utilization
* Reusability - by giving modules clearly defined responsibilities and public interfaces we can reuse their functionalities
* Testability - it is easier to verify that a small/medium module of software works versus having to deal with a one big piece with lots of unclear dependencies. Also, if modules have well-defined boundaries, we very rarely (if at all) need to test interactions between them. We can just verify modules adherence to the <a href="/unit-integration-e2e-contract-x-tests-what-should-we-focus-on.html#contract-tests-reasonable-e2e-tests-alternative">established contract of interaction</a>

\
Should we always modularize? If our system is tiny, we develop it alone and it is logically just a single module, we most likely will not gain anything from modularity. However, as our system grows, the benefits of modularity become more and more apparent. As soon as we can spot two possible modules emerging in our system - we rather should go and modularize it.

To make all these points clear, let's work on the example and say that we have a system - *Curious Notes to the Interesting Quotes* - where users can add notes to famous quotes and sayings. One possible design is to split it into the following modules:
* *users*: responsible for the creation of new users, managing accounts and authorizing/authenticating them
* *quotes*: responsible for the management of quotes by the special, privileged users
* *notes*: responsible for adding notes to quotes by the users, also allowing them to edit, delete and like them

Modules dependencies:
* *users* - no dependencies
* *quotes* - depends on *users* for asking whether a certain *user* is allowed to add/edit/delete quotes
* *notes* - depends on *users* for asking whether a certain *user* is allowed to add/edit/delete a *note*, depends on *quotes* to know whether a particular *quote* exists

These are our modules and their dependencies. **We should treat this logical division mostly independently of our physical architecture choice.** We can have a *modular monolith* with these three modules as just separate folders or fully isolated and independently versioned packages. We can also go for three *(micro)services* that communicate over the wire, synchronously or asynchronously. This physical division of a system into one or multiple units of deployment should be a secondary, not primary, factor when it comes to system design. The driving factor should be the understanding of our domain and functional requirements, concepts that we have there and the dependencies that occur between them. Only having sorted this out, we should think about non-functional, performance and resource utilization related factors that might change the implementation details of our initial design.

## Software development in the real world

Modularity requirements described above are great in the ideal circumstances, when we have complete knowledge about the software that we build and its functional requirements. Sadly, in practice that is often not the case and our knowledge is partial, incomplete. There are two main reasons responsible for this state of affairs:
1. Often, we do not have access to the client that drives requirements or the client/business person/product owner does not have time, but we need to start the development due to time constraints and deadlines. We do not have full knowledge about the details and required features, we know only a subset of them
2. Sometimes, we model something that is changing all the time, in the startup environment for example, or we consciously experiment a lot and/or not sure about the details of our domain at all yet, because we just started to explore it

\
**The ambiguity level and the number of unknowns are definitely a crucial factor when it comes defining our modules, and especially when it comes to the implementation strategy choice** - modular monolith or (micro)services and their various flavors. The first rule in this situation is to focus on getting all the information that is needed to make good design decisions and reduce the unknown as much as possible. If it is not possible or the amount of information is just too small - we need to adapt our decision-making strategy accordingly. The more ambiguity we have, the more fluid and dynamic our domain is and the less certainty about its final shape we have, the more we should focus on adopting a strategy where it is the least costly to completely redesign and rearrange our modules. In the situation of high ambiguity and many unknowns we should start with the simplest modular monolith strategy possible - it is very cheap to change its structure and we can always migrate to something more sophisticated as our domain starts to get less fluid and more defined. It does not make any sense to go for microservices when we know that we might change their number and responsibilities at any time - just stick with a simple modular monolith in that case. Moreover, we should not fall prey to the trap of stability illusion! Our systems will always change and evolve, so also keep that factor in mind when deciding what parts to isolate, where and to what degree.

## Implementations of modularity

There are many ways and strategies of implementing modularity in practice. To reiterate once again: good design, which is a good module separation, should not depend on the physical architecture - whether we have one or many units of deployments. We need to understand our domain and functional requirements, think about concepts, boundaries and modules that naturally arise there - especially dependencies between them, because the dependencies often make or break a system. Only when we have taken care of that, or are sure that it will not change *that much*, we should evaluate how to structure our system physically, at runtime. It means answering the questions like:
* Should we have one or multiple units of deployment (applications at runtime)? 
* If one - how complex our modular monolith structure needs to be and what type of constraints (if any) we want to impose on it?
* If multiple - what type of constraints (if any) we want to impose on our (micro)services - mainly tech stack, allowed network communication types (synchronous/asynchronous) and timing of this communication (in the foreground/background), how to deal with <a href="https://en.wikipedia.org/wiki/Distributed_transaction">distributed transactions</a> and so forth

Let's then consider different strategies that we can employ based on these and other factors.

### Simple Modular Monolith: modules as folders

This is the simplest and most straightforward way of modularization. **Here, we just treat folders as separate modules, we do not version them independently and do not have any additional boundaries between them, but we must have a contract/convention of how they are allowed to communicate with each other.** Its biggest advantage - simplicity, can also be its biggest disadvantage. We need to take additional precautions so that our modules boundaries are respected and we do not turn our *modular monolith (modulith)* into just a *monolith* - a big pile of mud, hard to understand, test and change. To guard ourselves against such an unfortunate scenario, we should establish and respect some conventions, like:
* Have a *_contracts* folder, where we have all common interfaces, models and application events defined
* Each module can have a specific folder/file where its public interface is defined. Other parts are considered private and are not allowed to be used
* If we have one, shared database - we should use a separate schema for each module or have some reasonable table naming convention. In that way, each module owns its data and is fully responsible for it

\
Let's say that we took the first approach and we have a separate *_contracts* folder ("_" to distinguish it from domain modules). Using our previous example of the *Curious Notes to the Interesting Quotes* system where we have *users*, *quotes*, and *notes* modules, we can imagine the following interfaces in the *_contracts* folder:
```
interface UsersClient {

  boolean canAddQuote(UUID userId);

  boolean canEditQuote(UUID userId, UUID ownerId, UUID quoteId);

  boolean canDeleteQuote(UUID userId, UUID ownerId, UUID quoteId);

  boolean canManageNote(UUID userId, UUID ownerId, UUID noteId);
}

interface QuotesClient {
  boolean quoteExists(UUID quoteId);    
}

record QuoteCreatedEvent(UUID quoteId, UUID ownerId) { }

record QuoteDeletedEvent(UUID quoteId, UUID ownerId) { }
```
As we can recall, the *quotes* module depends on the *users* module. Using this convention, it would only use the *UsersClient* interface to communicate with the *users* module. *Users* module will implement this interface and this implementation will be injected into the *quotes* module at runtime, but the *quotes* module is only aware of the *UsersClient* interface. In this way, it does not know anything about the *users* module implementation details, the coupling between these modules is therefore loose. It will be the same for the *notes* and *quotes* modules - *notes* module communicates with *quotes* only through the *QuotesClient* interface. Additionally, we can use application events, like the *QuoteCreatedEvent* shown above to publish messages to other modules. In the *users* module, we might for example send notifications to users whenever a new quote is created. In the *notes* module, we might have a mechanism to delete all notes of a quote that just has been deleted.

To restate, **this is the simplest and most nimble implementation of modularization**. If we work alone or in a single team, and/or we are not sure about our domain or the module separation, this is probably the most suitable strategy. If we respect a few aforementioned rules, it will be easy to migrate to more elaborate structures later on. The main drawbacks are:
* it is relatively easy to cross modules boundaries and do not respect established conventions
* we can not have independent deployments of different modules from various git branches, because we do not version them independently and everything is built from one source code repository (if we always deploy from a single master branch after merge, it is not an issue)

These drawbacks may be completely acceptable and fine in our specific case. We/our team might be disciplined enough so that established module boundaries are never violated (there are also <a href="https://www.archunit.org/">some tools to guard us from it</a>). Additionally, if we can run and fully test our modular monolith locally - it is probably not needed to have independent deployments of different modules. **If this is the case, choose this strategy and enjoy the not appreciated enough benefits of simplicity!**

### Modular Monolith with Independently Deployable Modules

This strategy is a more rigorous version of the modular monolith architecture. **We still have a single unit of deployment, but every module is an independently versioned package** - be it Java jar, NPM package, Go binary or C# assembly. There are a couple of interesting consequences of that additional isolation:
* every module is versioned independently and can be deployed independently - if we have a private repo of artifacts (packages), where we upload our packages, which is relatively easy to set up
* if a given module depends on another module/modules, we need to add it as the dependency to our module, which makes dependencies more transparent
* because of this additional isolation, it is harder to cross modules boundaries that should not be crossed - that keeps our architecture in check
* to make our modules even more independent we can use different database in each module to decouple them even more (this can be done in *simple modular monolith* approach also)
* if we want to make them even more insulated, we can put every module in a separate git repository

\
When it comes to the first point - independent versioning, one idea could be to use *SNAPSHOT* (in the Java world) versioning. With this approach, we can upload modules with the same version all the time (to the private *artifact repository* like <a href="https://www.sonatype.com/products/sonatype-nexus-repository">Nexus</a>), but with changed source code. Then, we can upload module *A* from the git branch *feature-A*, build and deploy our modular monolith with all modules being the same as previously, except module *A* that we have changed. To do that, **we also need to have some kind of *application/main module* that depends on all domain modules and assembles our modular monolith as a single, executable application**. If we use *SNAPSHOT* versioning as described above (or something that works like it), we do not need to bump the version of the changed module in the *application/main module*. Because every module is uploaded to some kind of artifact repository, we can push different versions of them from separate git branches and still not affect the work of other team members. At the same time, they might change something in different modules and do this on other git branches. Of course, if we place each module in a separate git repository, we have even more isolation and working in parallel is even easier.

As mentioned, if we want to make our modules more decoupled, we can use a different database in each of them. Does it make them more independent than just having separate database schemas or a table naming convention? **Let's say that we share a single database, but have the following rule: it is only allowed to make transactions within one module, it is not allowed to make transactions across modules. If this is the case, we will not gain that much from having separate databases.** With multiple databases, we have no choice because it is technically not possible to have a transaction between different databases. Usually, if we need to have a transaction that spans over more than one module, it means that something in our design is not right. Still, sometimes a transaction of this type (distributed) is necessary evil. In that case, we need to use patterns from the microservices word - mainly *<a href="https://microservices.io/patterns/data/transactional-outbox.html">Transactional Outbox Pattern</a>* to deliver messages reliably and/or *<a href="https://microservices.io/patterns/data/saga.html">Saga Pattern</a>* for (unfortunately) distributed transactions - between multiple independent databases. Fortunately, in many cases, we can avoid the latter, by having a smart data reconciliation mechanism in the background. In this approach, some data might be duplicated between modules (their databases), so that they can serve all needed functionality without relying on other modules. Because distributed transactions are hard, I recommend to focus on designing modules in such a way that we do not need to have transactions that span multiple of them. At the very worst, we might need to copy some data from one module to another by sending application events or by doing simple function calls  - we still have a monolith, one unit of deployment and execution after all. **Copying and synchronizing data between modules is simple, as it can be done in the background, independently of normal requests processing** and we have a guarantee that it will succeed eventually, because in the background, we can retry as many times as needed.

This approach is much more scalable than a *simple modular monolith*. **If we have isolated and independently versioned modules, each one has its own database or we just follow *no transactions across modules* rule, and possibly even have every module in a separate git repository - many people and teams can work on a single modular monolith in parallel, with minimal or no conflicts at all, and with very limited need for synchronization.** The main thing that we need to share and agree on is some basics of the tech stack - programming language, build system, maybe framework (we can use more than one if we want) and some core libraries.

### Microservices - modules as applications

This is the most complex implementation of modularization. **Here, we simply say that each module is, more or less, a separate application, deployed and run independently.** Because of that, the number of our deployment units (applications) is more or less equal to the number of modules. 

**For this level of separation, we need to pay the highest price - <a href="https://renegadeotter.com/2023/09/10/death-by-a-thousand-microservices.html">complexity</a>.** First is infrastructure. With one, two or three units of deployment - we most likely can just build and deploy our application/applications to a virtual private server or some kind of platform as a service, with the help of a few simple bash and/or python scripts and that is it - simplicity. With microservices, we have many separate applications that most likely will need to communicate through remote network calls - we need to set up an infrastructure which allows for it or pay for such a service (<a href="https://kubernetes.io">Kubernetes</a> is not a simple tool that can be learned in a few hours or days). Additionally, observability - mainly logs, metrics and alerts - of our system will also be much harder to set up and maintain because we need to deal with many independent applications. We no longer will work with plain old function/method calls, but events published to message brokers/queue systems that may fail at any time, and/or synchronous network requests, most often HTTP calls, that may fail at any time, for multiple unrelated reasons. In a nutshell, we enter the complex world of network indeterminism. We now have a truly distributed system and the whole shelves of books have been written about the complexities of such systems - it is not something that we should treat lightly. It is worth pointing out that most people and teams do not appreciate this complexity enough. Having said all of that, sometimes it is justified and brings a number of benefits - if we can handle the complexity.

What are the benefits? Because each module is more or less a separate application, we can use multiple programming languages, based on the needs of this particular module (although it is rarely needed in practice and having multiple tech stacks in a system comes with its own set of tradeoffs). What is more important, different modules can have varying resource utilization requirements. Some of them might need to be available all the time, without any interruptions, and be able to handle high load, while some of them might have modest requirements, and some of them might have needs somewhere in between. **Thanks to the fact that every module is now basically a separate application, we can assign different resources to each module and have it in a different, often dynamic, number of replicas, based on its own unique needs.** It naturally leads to more optimal resource utilization. With the modular monolith approach, if one module needs more resources, we need to scale the whole monolith, because we have a single unit of deployment - this is arguably less optimal (there is <a href="#modular-monolith-with-helper-services">Monolith++ approach</a>, discussed below, that addresses this issue).

Another important benefit is that we can scale to more teams. With the *Modular Monolith with Independently Deployable Modules* approach we can definitely scale to a few teams, but probably not to tens or hundreds (but do we need it?). If we expect that type of growth in our organization or already are sitting at this size, we might be justified to use microservices. Because of that, we can arguably also have more independent streams of work at the same time. I would argue that we can achieve a similar level of work parallelism with the modular monolith, it just requires more discipline, but still can be done. What is better, what is justified and whether given tradeoffs are acceptable - depends on the specific case.

To sum it up - **this architecture style should be used only if we really, really need it, as it is the most complex and it can slow us down significantly, if we employ it without valid reasons to do so**. But sometimes, just sometimes, solutions like that are indeed needed.

### Constrained microservices - just Services/Microliths

We can eliminate many, most in fact, problems of microservices by adhering to one, simple rule:
> When serving any external network request, synchronous or asynchronous, service can not make any network calls to other services, synchronous or asynchronous.

Why this constraint is so powerful?
* It forces us to split services in such a way that they have all data needed for their functionality, often simplifying and improving design of our system
* Services are more reliable, because by the virtue of the above constraint they do not depend on any other service to handle external requests
* We do not need to deal with distributed transactions. By the virtue of this constraint, they are not possible
* Systems of this kind are also much easier to understand and debug, compared to microservices architecture. We do not make any network requests when serving external requests, so the only thing that can fail is our service. When we make network requests in the background, other services can not make requests to other services when handling our requests, because of the established constraint, so it is easy to trace what and how exactly has failed

\
Naturally, sometimes we will need to share some data with other modules/services or make use of their functionality. This is allowed, but only in the background. We can have a scheduled process, where we reconcile data or just get it from other services, by sending messages/events or making plain old http requests (this is almost the same problem and solution we had in *<a href="#modular-monolith-with-independently-deployable-modules">Modular Monolith with Independently Deployable Modules</a>*). This is simple and easy to understand, because these requests can only fail if the target service is not available and still does not impact the functionality of our service directly. Moreover, to reiterate, other services can not make network requests when serving our request, so it is trivial to identify failure causes in such a system. Additionally, **this approach will result in less services overall, because the services are incentivized to have everything that is needed to serve their functionality directly available.** It means simpler infrastructure, less moving parts to analyze, understand, observe and maintain.

**An interesting hybrid might arise here: we may end up with just a few bigger services, each of them being a *modular monolith*.** We can then reap the benefits of both strategies - have a few, independently scalable units of deployment, but still without a need to have a complex infrastructure, observability tools and the complexity of network indeterminism that we need to grapple with a pure, unconstrained microservices architecture. 

### Modular Monolith with Helper Services

In this approach, by default, we have a *modulith (modular monolith) core* and by default we add most of the functionality there, focusing on good modules structure. In rare cases, where *some module* has different resource or technology requirements, or for any other reasons it differs significantly from our *modulith core*, we create a separate service out of it, deploy and run it independently. What does it mean? We should mostly apply rules from the *<a href="#constrained-microservices-just-services-microliths">microliths</a>*: network communication is not allowed when serving external requests. In that way, we still have a simple system, but whenever our modular monolith has a distinct module with unique needs, we separate it as a small, independent, single-purpose service to match those needs better. 

## Parallel work and independent deployments

When we work in a team or in a few teams, the ability to have as many independent streams of work as possible is important as it allows for work parallelization. In the context of modularity, **the more modular our system is, the easier it is to split work and responsibilities between different people and teams**. The less coupled, more independent our modules are, the more individuals/teams can modify code of the system in parallel, without conflicts and interruptions. There are two dimensions to consider here:
1. introducing changes to the code base
2. testing those changes locally and on dev/stage/prod environments, which are generally shared by people and teams

\
Let's start with the first one - changing the code base. All approaches that we have presented so far are more or less equal in that regard. **Irrespective of whether we have a simple modular monolith or the most complex microservices setup, the bottleneck of our ability to work in parallel is the quality of our system design - mainly its degree of modularity.** On one hand, if we have *10 separate microservices*, but they depend on each other and are highly coupled - this will significantly impede our ability to work on multiple features in parallel. On the other hand, if we have a *simple modular monolith with 50 loosely coupled modules* - we can work on different parts of the system independently, without blocking each other.

What about concurrent testing of multiple, unrelated changes on different environments? It mostly depends on the details of our environments, there are many possible strategies here. What is worth pointing out however, is that by default, microservices/separate services - having many units of deployment - give us this ability almost for free, if we implement them correctly. When we work on a separate service, we can deploy only it and test our changes without affecting currently deployed and being tested changes of other services - as long as our services are *fairly independent*. It is also possible with the modular monolith: if we have isolated our modules as different packages, versioned independently, and are uploading them to some kind of artifact repository, we can deploy our modular monolith with a new version of the module that we work on, without affecting the other ones. Additionally, if we have a simple modular monolith and a few teams work on it, we can have separate dev and stage environments per team. There are probably many other ways and strategies to allow independent deployments with modular monolith, they just require some additional effort to set up. But as we know, microservices come with unrivaled infrastructure complexity and they are also not ready to be used and to work on by default. What is particularly worth pointing out - **with modular monolith, in most cases, because of the infrastructure simplicity, we can run the whole system locally and test it reliably end-to-end on our own machine, so we might not need to have shared dev and stage environments at all, we can deploy directly to production**.


## What about the Frontend?

Thus far, I focused mostly on the backend or systems without a strict frontend/backend distinction when it comes to units of deployment - like more traditional, server-side rendered applications. If we have old school server-side rendering or use **<a href="/htmx-simpler-web-based-app-or-system.html">promising HTMX technology</a>**, the views are defined in the same modules where our backend is so the problem of modularity is solved (there is no frontend/backend distinction when it comes to the units of deployment). In that approach, our frontend/views are scoped to the modules. Thinking pragmatically though, what about JavaScript focused, Single Page Applications (SPAs) that dominate the market today?

**In the Single Page Application approach, we should follow almost the same rules related to modularity as discussed so far.** We can start with a simple modular monolith, by having modules just as separate folders. Similarly, we can have _contracts folder/module that strictly describes how our modules can communicate with each other and what, if any, state they can share. Additionally, we can limit the usage of global styles (<a href="https://tailwindcss.com/docs/reusing-styles">Tailwind</a> approach mostly fixes this) and components and rely mostly on module-scoped styles and components - sharing only the most generic styles and components. Here, universal rules of coupling and cohesion also apply: the more independent and self-contained modules are, the more independent work we can have. With the simple modular monolith strategy, we will not have the ability to independently deploy different modules. Therefore, if modules as folders are not isolated enough for our needs, we can use <a href="https://webpack.js.org/guides/code-splitting/">code splitting</a> or <a href="https://router.vuejs.org/guide/advanced/lazy-loading.html">dynamic imports approach</a> to have multiple independent entry points to our application. **As the last resort, we can have a separate SPA per a few selected routes, having as many html pages as we have SPAs (multiple SPAs approach), or use the <a href="https://martinfowler.com/articles/micro-frontends.html">Micro Frontends</a>.** Both of them give us complete physical isolation of our modules, similar to microliths/microservices ideas discussed above.


## Closing thoughts

We have delved deep into modularity: its importance, its various consequences on our system and its different implementations. More specifically, we have compared having a single unit of deployment, most often called a *(modular)monolith*, with multiple ones, most often called *(micro)services*. We also shed some light on the details of various modularity implementations and compared their tradeoffs, because, what is always worth reminding: there is no free lunch, nothing is free of consequences. To reiterate, we went through the following strategies, ordered from simplest to the most complex one:
1. Simple Modular Monolith
2. Modular Monolith with Isolated and Independently Deployable Modules
3. Modular Monolith with Helper Services
4. Constrained Microservices  - *<a href="https://www.ufried.com/blog/microservices_fallacy_10_microliths/">Microliths</a>*
5. Microservices

We should thoughtfully consider which strategy meets our particular requirements and only then go for it. We can always transition to a more complex approach, so it is better to err on the side of simplicity. **Design and architecture are art in the end, there are no final and absolute solutions, only tradeoffs, so weigh them and choose wisely!**

<div id="post-extras">

<div class="post-delimiter">---</div>

### Related videos on my [youtube channel]({{ youtubeChannelUrl }})
1. [Modular Monolith with Independently Deployable Modules in Java](https://www.youtube.com/watch?v=onV4449vs1g)

<div class="post-delimiter">---</div>

### Notes and resources
1. Excellent article about the consequences of different cohesion and coupling degrees in software architecture: https://codeopinion.com/solid-nope-just-coupling-and-cohesion/
2. Highly pragmatic take on modularity: https://lorisleiva.com/on-modules-and-separation-of-concerns
3. Why we should split workloads in our glorious, modular monolith: https://incident.io/blog/monolith. I did not touch on this dimension: we can deploy our modular monolith in a few different instances with profiles based on different workloads. For example: http server, scheduled jobs and events consumer.
4. More about modular monoliths:
    1. https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer
    2. https://microservices.io/post/architecture/2023/07/31/how-modular-can-your-monolith-go-part-1.html
    3. https://www.ufried.com/blog/microservices_fallacy_9_moduliths/
    4. https://www.youtube.com/watch?v=5OjqD-ow8GE
5. Shopify still runs on a modular monolith: https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity
6. Interesting approach of having a modular monolith by default, but with the ability to deploy every module as a separate service on demand: https://www.nfsmith.ca/articles/monolith_by_default/
7. More in-depth explanation, advantages and disadvantages of *microliths*: https://www.ufried.com/blog/microservices_fallacy_10_microliths/
8. Why microservices do not improve team autonomy by default: https://www.ufried.com/blog/microservices_fallacy_4_reusability_autonomy/
9. Why microservices do not lead to better design by default: https://www.ufried.com/blog/microservices_fallacy_5_design/
10. A little exaggerated, but currently much needed criticism of microservices architecture and why most companies will never achieve the scale and have other factors in place that justifies using them: https://renegadeotter.com/2023/09/10/death-by-a-thousand-microservices.html
11. More about micro frontends:
    1. https://martinfowler.com/articles/micro-frontends.html
    2. https://frontendmastery.com/posts/understanding-micro-frontends/
    3. https://micro-frontends.org

</div>