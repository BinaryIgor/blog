---
{
    "title": "Modular Monolith and Microservices: parallel work, independent deployments and organization scalability",
    "slug": "modular-monolith-and-microservices-work-deployments-scalability",
    "startedAt": "2025-11-16",
    "publishedAt": "2025-11-28",
    "excerpt": "One of the most useful traits of <em>Modularity done properly</em> is Autonomy: modules - folders or versioned packages in a modular monolith, separately deployed microservices - are as independent from and as unaware of each other as possible. It has at least three important implications.",
    "researchLog": [ 1 ],
    "writingLog": [ 1.5, 4, 2, 4.5, 2.5, 2.5, 1.5, 1.5, 3, 3.5, 2, 2, 1],
    "tags": ["modularity"]
}
---

## Autonomy

One of the most useful traits of *Modularity done properly* is Autonomy: modules - folders or versioned packages in a modular monolith, separately deployed microservices - are as independent from and as unaware of each other as possible. It has at least three important implications:
* **Modules are independently developed** - by different people, teams or even organizations
* **Modules are independently tested** - once dedicated interfaces for communication between modules are established, they can be fully tested using mocked and test-specific implementations of these contracts
* **Modules are independently deployed** -  since they are loosely coupled, exchanging data and functionality through dedicated interfaces, it is possible to deploy each module without its dependencies being completely available. Naturally, modules cannot provide all their functionality if it depends on other modules which are not available yet, but it should not hold deployments back; dependent functionality and data should self-heal, once all dependencies are up and running

When this ideal is achieved, we can have multiple people and teams working in parallel and independently, on various parts of the system. Different people and teams might be given responsibility for various modules and develop, test, deploy, maintain and extend them on their own, autonomously - with minimum to no input from other module owners. It then has tremendous implications on both productivity - as multiple streams of work are undertaken at once, in parallel - as well as maintainability and adaptability of our systems, since smaller, independent parts are easier to develop, test, understand, debug, modify, deploy and scale. Clearly then, it is something well-worth focusing  on and striving towards.

**Implementation details of this *Modularity ideal* differ depending on whether we have a single unit of deployment (monolith) or multiple ones (services).** In both cases though, it still mostly is about *the universal Modularity principles*. We will now explore how, when done properly, this approach enables [parallel work](#parallel-work), [independent deployments](#independent-deployments) and [organization scalability](#organization-scalability), touching on various implementation details along the way. It also is the best moment to pose an essential in this context question:
> Are multiple deployment units (services) required to have parallel work, independent deployments and organization scalability?

Let's find out.

## Parallel Work

A properly modularized system allows many people and teams to work on its different parts in parallel, with little to no conflict. **As we recall, one of the key features of a good module is being as independent as possible: having no or only a handful of dependencies, which are shallow and loose, not deep and tight**. Only when this requirement is met, each person/team is able to work on different modules of a system without getting in the way of others. Occasionally, when to implement certain features or behaviors modules must exchange data or functionality, negotiations will be involved. [But since this exchange is done properly through dedicated interfaces and types](/modular-monolith-and-microservices-data.html#boundaries), it is fairly low effort to agree on a contract and then start implementation in a module A, knowing that module B will implement the established contract *at some point*. It might be mocked, faked or hardcoded at the beginning, not blocking module's A development.

**From a parallel work perspective, does it matter whether a module constitutes a folder or versioned package in a modular monolith or is a separately deployed microservice?** Not really - assuming a simple approach where every person/team works on a single module, it is a secondary concern, how exactly modules are implemented. Their proper design - dependencies and data flow between modules - is the bottleneck for parallel work, not an implementation strategy (isolated files or processes). If modules have many opaque and tight dependencies - work is hard or even impossible to parallelize, no matter how many deployment units (services) there is.

As we are not fond of talking in vacuum here, we are going to illustrate these points with the help of an example. [Expanding on the *Curious Notes to the Interesting Quotes and People* system from the previous post](/modular-monolith-and-microservices-data.html), let's consider the following cases:
1. Support for a new authentication method - magic links, sent by email
2. Allowing users to upload profile images
3. Displaying these images in various places of the application

As a reminder, in this system we have four modules: *users, quotes, people and notes*.

**Support for a new authentication method** - as the *users* module is responsible for users, managing their accounts and authentication/authorization, this is the only module where work needs to be done. Especially that in the `UsersClient` we had:
```
// shared/common module
interface UsersClient {
  ...
  UUID currentUserId();
}
```
returning `id` of the currently signed-in (authenticated) user - it does not concern us how they got there. In this particular change case then, we have to:
* Implement the new authentication method in the *users* module - changes take place in this module alone. Most likely, it requires changing the UI (frontend) as well, but since module structure should be similar across the whole system, in the UI app the *users* module with similiar responsibilities should likewise exist
* Make sure that `UsersClient.currentUserId()` behaves as previously - if we issue [JSON Web Tokens](https://en.wikipedia.org/wiki/JSON_Web_Token), it will not require any changes. In the same way as this token is generated after presenting a correct `username:password` combination, here it is issued after receiving expected `email:magic_link`. As JSON Web Tokens are stateless and might be validated offline, `currentUserId()` implementation will be very similar for both the monolith and services approaches
* Other modules use `UsersClient.currentUserId()` - they are completely oblivious to this change!

**Allowing users to upload profile images** - resembles supporting a new authentication method case. Changes required for this functionality are introduced in the *users* module alone. One thing that we should keep in mind is that other modules must be able to load and display these images. Fortunately, they are publicly available so it is really easy. The `profileImageUrl` field added to our public `User` type is all that is needed. It points to some kind of public (at least for profile images) media server. But even if the requirement was to not have it publicly available but private, we could just have something like this:
```
// shared/common module
interface UsersClient {
  ...
  byte[] getProfileImageById(UUID id);
}
```
allowing only signed-in (authenticated) users to get content of such images. But for the purpose of this example, we just go with the `profileImageUrl` field, containing publicly available URLs. 

**Displaying these images in various places of the application** - requires changing the *users'* module contract slightly:
```
// shared/common module
record User(UUID id, 
            String name,
            ...
            String profileImageUrl,
            ...
            UserRole role,
            UserState state,
            UserStatus status) {}
```

The `profileImageUrl` field is added to the `User` type that is defined in some *shared/common* module. Then, without waiting for the final implementation in the *users* module, other modules might temporarily hardcode this field value so that it points to the same image for all users or the *users* module might provide fixed-value implementation first, before starting the real one. In either case, people/teams responsible for different modules can collaborate in this minimalistic way to work fully in parallel - even when their work is highly dependent.

Summing it up, **a properly modularized system allows many people and teams to modify and develop its different parts in parallel, with little to no conflict and minimal coordination - irrespective of whether modules are folders, versioned packages or separately deployed services**. Clearly then, multiple deployment units (services) are not required for people and teams to work autonomously and in parallel. Are they needed to support independent deployments?

{{ .js: newsletterSignUpPostMid() }}

## Independent Deployments

As a properly modularized system has modules with the minimum and loose dependencies on other modules, it should follow that it is easy to deploy each of its modules independently. Is it?

### Microservices {#independent-deployments-microservices}

In the microservices approach, each module is a separate service. As each module is more or less autonomous, only loosely coupled with other modules (services) and running in its own process piece of software, we have independent deployments out of the box - *as long as each module dependencies adhere to the proper Modularity rules*. Somebody (or some team) can work on a module and then just deploy their changes independently, not waiting for others and without breaking other modules. Of course, **there still are possible problems that might emerge only at runtime. For example, forgetting or failing to respect API Contracts & Compatibility or producing Poison Messages**: messages/requests that repeatedly fail to be processed by a consumer, leading to continuous retries and potentially blocking the processing of other messages/requests or even taking down the consumer and possibly the producer as well, if implemented incorrectly. But by and large, modules are mostly well isolated  when they represent separate processes with their own runtimes.

### Modular Monolith {#independent-deployments-modular-monolith}

In the modular monolith (modulith) approach, the main difference is that we have a single deployment unit and each module is a folder or versioned package, not a standalone process with its own runtime. In terms of development, it basically is the same - each module might be developed by a different person or a team. What mainly sets these approaches apart is how modules are combined into a system and deployed to the target environment. Let's follow the usual modulith development & deployment flow with the crucial assumptions reiterated.
* **Assumptions:**
    * there are modules - folders or versioned packages
    * there is a single deployment unit - modulith, a separate folder or package that depends on all other modules
    * this modulith - combines all modules together and potentially applies some global config to them: thus, our single deployment system is born into existence
* **Development & Deployment flow:**
    * somebody works on a module, on their git branch
    * after work is done, a pull request and code review follow
    * modified module is merged into the master/main branch
    * *if modules are folders* - there is no module versioning and the modulith is always built from the latest master/main git branch, usually after each merge
    * *if modules are versioned packages* - each module is versioned and released separately, giving us additional flexibility; we might automate bumping versions in the modulith dependencies or do it manually, by opening a dedicated pull request when we are ready - in either case, the modulith is built only when version of at least one module has changed
    * after build, deployment to the dev/test environment happens
    * after deployed to dev/test changes are tested and confirmed that they work as expected - deployment to the production follows

As we can see, the details differ - single deployment unit (modulith) that glues together folders or versioned packages vs many deployment units (microservices) - but the process is fundamentally the same: different people/teams modify various modules simultaneously and then deploy them independently. In both cases, changes are deployed to an environment after `git merge`; in case of a failure or other unforeseen issues, changes are reverted using `git revert`.

**With a modular monolith, deployments by default are sequential: there is only one deployment unit and when changes are merged into a single master/main branch, the following deployments are queued and block each other.** We also have a single process risk - one, shared runtime means that there is a non-zero chance that change in module A may introduce *a global bug* that slows down, impedes or even kills the modulith process, blocking deployments of all other modules and making the whole system unavailable. With the right discipline and practices like solid code reviews, static analysis and automated tests it can be *reduced to almost zero, but it will never be zero, it will always be there*. But let's not forget that multiple services exchanging data over the network are not without their own set of *runtime problems* - mainly around API Contracts & Compatibility and Poison Messages. With multiple services there are multiple runtimes and that makes them by default more isolated; but taking all factors into consideration, it is not entirely so.

**If we have not a few but hundreds of people and dozens of teams working on the modulith, sequential deployments will become problematic - it might then take hours to deploy changes.** Especially considering the fact that some deployments (of modules) will be rolled back, if they prove to be problematic or contain not caught previously bugs. Above all, we should start with optimizing the build process itself, making it as fast as possible: caching dependencies, rebuilding only modules that have changed and so on. But once these optimizations are in place and *the resulting build & deploy times are still not enough*, there is at least one simple improvement to be made here.

**We can simply batch deployments.** Instead of building and deploying our modular monolith after every merge to the master/main branch, it is postponed a bit. We might for example build the modulith at most once every one to three minutes. In this way, multiple changes are batched into one build & deployment, reducing their frequency by a wide margin. Time-wise, it most likely is enough for very frequent changes - in the multiple merges into master/main per minute ballpark; it is extremely rare to witness a system doing more than few thousand merges per day - `1 merge per minute = 60 * 60 = 1440 daily`. The tradeoffs are definitely that any given change must wait slightly more (delay) for its deployment and it distorts visibility into potential post-deployment problems a bit, since multiple changes are deployed at once (with microservices we are doing the same thing, but as separate processes). But to be fair, every change author should be vigilant and available during the deployment process, ready to test and rollback their change in case of any issues. It can easily be done independently, on the per module basis, by either `git revert` the change of a problematic module or downgrading its version in the modulith - depending on whether we have modules as folders or versioned packages.

### Deployments summary {#independent-deployments-summary}

**As we have seen, multiple deployment units (services) are not required for independent deployments as well.** It is true that they are given by default with many deployment units (services); in a single deployment unit (modulith) approach, they require more discipline and work to set up. But it is likewise possible to have them running smoothly in the modulith - mainly a few conventions and [the right CI/CD setup](https://en.wikipedia.org/wiki/CI/CD) are needed - and it can scale to hundreds of people and dozens of teams, working on a single modular monolith.

## Organization Scalability

As we have established, pretty much the same level of parallel work and independent deployments could be achieved in both cases - single unit of deployment (monolith) or multiple ones (services). **How do both approaches scale organizationally, as systems grow in complexity and the number of modules, developers and teams working on them?**

With microservices, we might have as many deployment units (processes) as we want - there virtually are no limits. The only limiting factor is how much we are willing to spend on the infrastructure setup and maintenance. **We can run *5, 10, 100, 1000 and more services*  - each representing just a single module. There is no ceiling when it comes to scalability here - from this simple perspective alone, microservices are the most scalable approach.**

With a modular monolith, all modules live in a single, shared runtime and memory - there is a fundamental limit of how many of them there could be. The exact number depends on the used programming language and its runtime efficiency, average module size and its CPU & Memory requirements - the more resource-hungry modules are, the less of them there could be, since they all run in a single process; keeping in mind that [most cloud providers offer machines with more than 100 GiB of Memory and 32 CPUs](https://www.digitalocean.com/pricing/droplets#general-purpose). **Still, the fundamental limitation remains: once we have *about a few hundred modules*, it probably is the time to split things up into a few deployment units - not necessarily microservices, a few modular services will suffice.** Granted, that it is rather rare to work on a system that even begins to approach *a hundred modules* and a similar number of teams working on it!

Some people would add build times as another limitation of the modular monolith approach; I skipped it intentionally. Why? Because having modules as separately versioned packages allows to optimize it a lot - each module is built and released independently and it should not take long to create a single deployment unit out of ready-to-be-used packages. It takes more time when a modular monolith is built from scratch, for the first time - compiling/preparing each module directly from sources, but it rarely needs to be done. For the local development, we mostly operate on a single or a few modules and might just download already built versions. It is not going to be an issue unless we have something truly extreme - thousands or tens of thousands of modules.

Summing it up, **if we have up to *about a few hundred modules*, it does not really matter - both approaches scale equally well and arguably, most systems will never reach this scale**. Objectively speaking though, after reaching a certain number of modules, we have to split things up a bit - there is no need for full-blown microservices but switching to a few modular services will be required, once this level of complexity is achieved.

## Frontend/UI - is it any different?

It may seem like we have mostly talked about the backend part of a system. Is it any different for the Frontend/UI?

[If we take a standard web-based application today](/htmx-simpler-web-based-app-or-system.html), it is most likely built as SPA - single page application. We develop it in JavaScript or TypeScript, probably using a framework of React, Vue, Svelte or Angular type. In this context, *all Modularity principles apply* - we should likewise work on modules that are as autonomous and as loosely coupled as possible, exchanging data and functionality only through dedicated interfaces and types. **In the same vein, modules might be just folders or separately versioned packages; likewise, when done correctly, they allow for parallel work, independent deployments and organization scalability.** 

**There is [the Micro Frontends idea](https://micro-frontends.org/), extending microservices approach to the Frontend/UI world**: each module being an independent application. To be honest, I think it is rarely justified - even less often than microservices - and it introduces a great deal of avoidable complexity. In most cases, comparable levels of parallel work, independent deployments and organization scalability might be achieved simply by modularizing a single application, with independently deployable modules, as effectively as possible.

## Conclusion: parallelism, independence and scalability if...

As we have seen, *as long as we adhere to the proper Modularity rules*, we enjoy a high degree of:
* parallel work
* independent deployments
* organization scalability: handling structural complexity smoothly, as our system and the number of people/teams working on it grows.

Irrespective of whether our chosen architecture is modular monolith, microservices or something in between.

*If we do not adhere to the proper Modularity rules*, we suffer from:
* delayed work
* blocked teams and people
* deployments that are interdependent and require constant coordination
* no organization scalability: our system simply breaks down, after reaching a certain scale and the number of people/teams working on it.

Irrespective of whether our chosen architecture is modular monolith, microservices or something in between.

\
**Let's then choose *the proper Modularity path* and enjoy the benefits of parallel work, independent deployments and organization scalability!**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. [Modularity Posts](/modularity-posts.html)
2. **Expanding a bit on the similarities and differences of a single, shared runtime (monolith) vs multiple runtimes (services)** - there are as many runtimes as there are services, in the microservices approach; each of them could use different programming language, frameworks, libraries and so on. In theory, it is harder and less probable to introduce a bug or behavior in service A that negatively affects other services as well. But if we consider our system as a working whole, things start to look less favourable; services A and B might still be developed and deployed in a way that a bug in one of them slows or takes down one, both or maybe even a few others at once. The most common examples are overwhelming service B with too many (possibly faulty) messages/requests or not respecting API contracts in a way that might cause service B to slow down or simply crash. Yes, service B can be written defensively to apply [back pressure](https://en.wikipedia.org/wiki/Back_pressure), have proper error handling, validation and so on - but the same could be said about modules in the modular monolith; in both cases, it requires knowledge, discipline and vigilance. On the other hand, because there is a single, shared memory in a monolith - if there is a memory leak or just very high general use of this resource in module A, it will affect other modules. Microservices usually share infrastructure, so the increased use of resources by one microservice will affect others to some degree, but it is much easier to limit resources (per process) in such an environment compared to constraining modules in a single process of a modulith.
3. **Single, shared runtime in a modular monolith does introduce technology choice limitation** - all modules must be written in the same programming language and to large extent share libraries and dependencies. In a single runtime, multiple versions of the same library usually cannot coexist and if multiple frameworks are used, they might introduce various runtime challenges, such as each of them depending on a different version of the same library. But from a system perspective, it might be an advantage: there is a price to be paid for using too many programming languages, libraries, frameworks and tools. It is easier to onboard new developers and collaborate when the tech stack is simple and more unified. However, we could arrive at problems where a different tech stack is better suited to solve them; *as always, tradeoffs, there is no free lunch*. If this is the case, [we might deviate a bit from the Pure Modulith into the Modulith++ approach](/modular-monolith-and-microservices-modularity-is-what-truly-matters.html#implementations-of-modularity-modular-monolith-with-helper-services).
4. Virtual Machines for a modular monolith: 
    1. https://docs.digitalocean.com/products/droplets/concepts/choosing-a-plan/
    2. https://docs.aws.amazon.com/ec2/latest/instancetypes/gp.html
    3. https://docs.cloud.google.com/compute/docs/general-purpose-machines

</div>