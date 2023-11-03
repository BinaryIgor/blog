---
{
    "title": "Unit, Integration, E2E, Contract, X tests: what should we focus on?",
    "slug": "unit-integration-e2e-contract-x-tests-what-should-we-focus-on",
    "publishedAt": "2023-11-04",
    "timeToRead": "19 minutes",
    "wordsCount": 2909,
    "excerpt": "When we write software we intend it to be used in some, usually predefined and desirable, way. All software has some specification, either explicitly described or implicitly assumed. How do we know that it (software) works? We can test it manually, using all of its features and functionalities. Unfortunately, this approach breaks down pretty fast.",
    "researchLog": [1, 3, 2],
    "writingLog": [ 1, 3, 5, 3.5, 1.5, 2 ]
}
---

## Why do we even test?

When we write software we intend it to be used in some, usually predefined and desirable, way. All software has some specification, either explicitly described or implicitly assumed. How do we know that it (software) works?

We can test it manually, using all of its features and functionalities.

Unfortunately, this approach breaks down pretty fast. One, even if our software is small and simple, we need to go through all its use cases, manually, after every, even the smallest, change. If we do not, we risk a regression of previously working features and functionalities.If we change our software fairly often, this becomes a significant waste of our/other people's time and energy. Second, as our software grows beyond two or three features, checking it manually becomes harder and harder to do, sometimes to the point of practical impossibility. It can be done, but it would take so much time and energy, that nobody even dares to try.

Moreover, where will our software even run? This can also get quite tricky and complex - multiple environments, many browsers and various devices. Sometimes, we just do not even have access to the same/similar enough environment to the one where our software runs. How then we are going to test it manually, if we can not even run it? This problem only amplifies if our software is created to be used by other software or machines, not humans (various libraries, tools and scripts).

Therefore, **automating software testing seems to be a wise idea**. We can increase its quality, test all edge cases, decrease possible defects, be sure that it will still work as we continue to change it, and save our own/other people time along the way. But is it really that simple?

## Ideal Tests

As we agreed that test automation done by writing tests to verify that our code works is a good idea, we have touched on an important point: **tests should resemble, as much as possible, the way our software is used**. This should hold true both for the testing environment (where and how we run our tests) and for the way we write test cases. The more this is true, the more confidence we can have that, when deployed to a production, our system/application will work as intended. 

Ideally, our tests should:
* be fast and simple to write
* be easy to read and understand
* be simple to change and maintain
* be fast to run, so we have an efficient feedback loop when changing code
* promote good design of our code and support its evolution, instead hampering it
* use identical/as similar as possible environment and external dependencies as in a production (databases, servers, browsers, mobile devices, pub-sub/queue/messaging systems, files, external APIs and so on)
* be reliable, controllable and deterministic - they should not fail for random reasons and they should not yield false-positives
* resemble the way our software will be used by the end clients (be it humans or machines)

\
**Sadly, all of these characteristics are almost never achieved in practice.** That is why we have various test types and each of them gives us a different set of tradeoffs, which also differ depending on the type of software that we work on. The tradeoffs could be completely different depending on whether we write server-rendered web app, a single page application consuming REST API, monolithic REST API with multiple clients, microservices-based REST API or a software library/tool that does something very specific, and is intended to be used by other machines/software, not humans. Let's then explore different test types and see what exactly they bring to the table.

## Unit Tests

These are the most basic tests that check whether a single unit works in isolation. What is a unit? It is a function or an object/class. 

The most basic example:
```
function sum(a, b) {
  return a + b;
}

test('should sum two numbers', () => {
  var a = 2;
  var b = 2;
  
  var c = 4;

  assert.equal(sum(a, b), c);
});
```
We do not have any dependencies here, but if a unit has them, they are usually mocked or faked. It is done either by using a library or creating test-focused implementation of a needed dependency.

Their main goal is to check whether a function/an object works in isolation, ignoring its dependencies (as much as possible). They are fast to write and run, and because we are focused on a small, insulated piece of code - easy to understand. Also because of that, they can promote good design of functions and objects. If our design is bad, it becomes quite obvious when we try to write a test and see that we can not really, or that it is terribly complicated. **Unit tests keep our code in check - it needs to be testable, which means simple and focused on one, specific thing.**

Unfortunately, they do require additional effort to maintain, because they are tightly coupled to the code they test. In unit tests, we test functions or methods of an object directly assuming that it has/should have a specific behavior and we rely on the implementation details. When we refactor this code, we also need to refactor its tests. This might not be that bad, but the problem gets worse if we have an object that is a dependency of other object/objects, and we unit test these dependent objects as well. Let's say that we have an object A and we have tested it thoroughly. Also, objects *B*, *C* and *D* use object *A* as dependency. We have written units tests for all of these objects: *B*, *C* and *D*, where we use fake version of the object *A*. Now, if we refactor object *A*, we not only need to refactor, or possibly completely rewrite its tests, but we also need to update tests of all dependent objects: *B*, *C* and *D*. In that context, pure unit testing, where we fake/mock all dependencies and directly control how they should behave, can actually hamper refactoring and code evolution, because even the simplest change of an object might mean lots of changes in many other places, tests especially.

Finally, even though they are fast to run, write and easy to understand they only test a function/an object in isolation. We can only be sure that this particular unit under test works. If it is used in a collaboration with other functions/methods (which is almost always the case), we do not know whether it will work with them or not. **Because of that, I would argue that the usefulness of unit tests is limited to pieces of code that are reusable and/or complex and focused on one, specific thing.** These can be library functions, reusable components, public clients of certain protocols, file parsers, algorithms and so on.

## Integration Tests

Tests that check whether a few components (units) work together. Components might be functions or objects/classes.
**The key difference between integration and unit tests: we do not mock/fake dependencies, but try to use real ones, and we test multiple units together, not in isolation.**

The dependencies/components may make real http requests to a fake server/API, controlled by us, and talk with a real database, which also runs locally and is controlled by us. We do want to test a few components at once, but we should also be able to run all tests locally and have total control over all variables. If there are external dependencies, like other servers or databases, we want to run them in a way as similar as possible to our production, but locally, and control their behavior and state to make our tests deterministic, reliable and robust, not flaky.

The main purpose of *Integration Tests* is to check whether a few components, be it functions or objects/classes, work together.
Because of that, they can be slower to write and run, but they require less maintenance and give higher degree of
confidence, because we test not only single units of work (functions, objects), but also whether and how they work together. This resembles much more the way our software is used in the target environment, in real life.

Why could it be slower to write them? We test the behavior of our code at the higher level, together with various dependencies, and we need to take them into account when designing and writing those tests. Let's say that we test REST API, that uses a relational database for example. There, we might have a code (Java 21 + Spring Boot 3 example):
```
...

@RestController
@RequestMapping("/clients")
class ClientController {

...

@PostMapping
@ResponseStatus(HttpStatus.CREATED)
CreateClientResponse create(@RequestBody CreateOrUpdateClientRequest request) {
  var newClient = request.toClient();

  service.create(newClient);

  return new CreateClientResponse(newClient.id());
}

...
}
```
We have an endpoint to create a client, which uses a service and the service uses a repository which communicates with a relational database (Postgres for example). In the service, we have some validation and business rules that check whether a new client is valid and can be created or not. The most optimal and efficient way of testing this code, using integration tests, would be to create tests where we:
* spin up whole application locally 
* application needs a database, so we start it in a docker container (we can use <a href="https://testcontainers.com/" target="blank">Testcontainers</a> for example)
* in the integration tests, we make http requests to ourselves (localhost), check http responses and the expected state change (whether a client was created or not)
* controller (exposed by http server) is an entry point to our application, so if we test it, we effectively have tested all layers of the application (controller, service and repository in that case)

If we want to make it a little simpler, we can test only the service methods, but still with a repository that uses a real database - then we test one layer less - the controller stays untested. The key point here is that we test a few components at once and with as close to real dependencies as possible. Exactly because of that they are slower to write - we need to take more variables into consideration when designing and writing them. 

Why they give us a higher degree of confidence is quite obvious - the way we write and run them resembles how our software is used much more than the unit tests. Outside the libraries or reusable components/tools, where our client is another software/machine, our functions/objects are not used in isolation, they almost always cooperate with each other. Additionally, we usually do depend on databases, queue/messaging systems or other servers with which we communicate over the network. We should test this communication, and we do this in the integration tests.

Why do they require less maintenance? In our example from the above, we have tested all layers of the application: controller, service and repository, but we were aware only of the controller. Moreover, we made http requests to it, so we did not even call its code directly in the tests. This means that they are loosely coupled, they do not depend on the implementation details of the code that they test. This also means that as long as the <span class="nowrap">*POST: /clients*</span> endpoint stays the same, we do not need to change anything in our tests. We can refactor the service, we can throw it away, we might even be able to change the database and still our tests might not need to be changed at all (we just may need to spin up a different database locally). Because we write tests at the higher level of abstraction, they are not tightly coupled to the implementation details of the code. Thanks to that, we have less obstacles to refactor our code, because in many cases we will not need to change tests, but we will still have the code being covered by the previously written tests.

**Sadly, they are slower to run and harder to set up.** In most cases, we need to start the whole application, or at least create more objects than in the unit tests, and if we have external dependencies, we also need to start them and it does take additional time. We have better and better tools to do that (<a href="https://testcontainers.com" target="_blank">Testcontainers</a>, <a href="https://wiremock.org" target="_blank">Wiremock</a>, <a href="https://www.mocks-server.org" target="_blank">Mocks Server</a> to name a few), but still, they do need an additional setup and can take anything between a few to a several dozen seconds to run, where as unit tests usually take milliseconds to a few seconds.

## End to End (E2E) Tests

These are the tests that check whether our application/system works as a whole. **They can be similar to integration tests, but they test all layers of application/system.**

We start these tests with the highest input to our system and compare the outputs with user expectations. An example here can be UI tests written in <a href="https://playwright.dev/" target="_blank">Playwright</a>/<a href="https://www.cypress.io/" target="_blank">Cypress</a> where we interact with an application in the browser, mimicking user interactions, or making HTTP requests to a REST API to check its responses.

Sometimes they can quite similar or even identical to the integration tests. It really depends what we consider as *the complete system/application* in this context. In our example from the integration tests section, we have tested REST API by making http requests to it. If we do not have anything else, we just expose REST API for various clients, and this is what we define as our complete system, we can say that these are really E2E tests, not integration tests. But let's say that we have one important frontend client, thus our whole system is a REST API + this SPA (Single Page Application). In that case, to claim that we really have E2E tests we would need to:
* start our backend with exactly the same/as similar as possible config as we use in the production, and as it is used by the real users
* start our frontend with exactly the same/as similar as possible config as we use in the production, and as it is used by the real users
* run E2E tests in the browser (using tools like Playwright or Cypress), where we mimick the behavior of a real user on as close to the real system as possible setup (making real network calls and saving data in the real db for example)

\
**The biggest benefit of these tests? They are as close as to the real usage of our software as possible, we can not get any closer.** Unfortunately, they have a significant cost: they are slow to write, complex to set up, often brittle (depends how you run them) and hard to troubleshoot. 

**Complexity of a setup depends on the complexity of our system.** If we have a simple modular monolith (stay with that as long as possible!) with the relational/other runnable locally database, it is easy to run and control our system locally. In that case, setup is not that complex, but still more complex compared to the integration tests setup. If we have a few microservices that also use external dependencies, sometimes it is just not possible to run them together locally or in the CI (Continous Integration) pipeline and we need to have a special environment, where we can run our E2E tests, with the required setup. This introduces yet another level of complexity - we now need to think about the state of this environment, keeping it in sync with the real one and so forth. Additionaly, environments like these are often not cheap, and could be used for different purposes by different people and teams, which may cause our tests to fail for various random reasons. If this happens too often, we may conclude that our tests are not reliable and start to ignore their failed results, because they can no longer be trusted. **If we arrive at this place, we basically have lost all the benefits of testing and the reasons why we wrote them in the first place - for the ability to change our software with confidence, knowing that tests have our back covered.**

Moreover, E2E tests are often hard to understand. There are just so many variables at play here. Let's say that we write them against our UI and one test case has failed. There are a slew of possible reasons for that:
* Is it something in our frontend code?
* Is it something in our backend code?
* Is it something related to the state of our backend?
* Is it something wrong with out database?
* ...and so on, so forth

\
For these reasons, in most cases, I advise not to write true E2E tests. Unless we have a reasonable, not too hard to understand and maintain, setup and all variables under our control (mostly backend and its state), it is better to focus on integration tests with the combination of a contract tests.

## Contract Tests - reasonable E2E Tests alternative

**These are the tests where we check whether the external dependencies of our application adhere to the communication contract that we have established with them.** That is it - we do not test whether these dependencies work correctly, we just check if they follow the agreed upon contract. What are these dependencies? REST APIs, queues, topics and channels where events are published or the database schemas. Contract? Custom file/files correctness of which can be checked by both sides, preferably in one of the commonly used open-source formats like <a href="https://www.openapis.org" target="_blank">OpenAPI</a> or <a href="https://www.asyncapi.com" target="_blank">AsyncAPI</a>, but they can also be something custom and proprietary. 

One example could be a frontend app that uses a REST API. As stated in the definition, we do not need to check whether our real API works, from the perspective of the frontend tests, we just need to make sure that we use its API according to the established contract. The contract is the source of truth and correctness here. How can we do that? We can write E2E tests in the browser for our frontend, using not real, but mocked API. **The most important thing: we do not mock this API ourselves, by hand, but use some sort of tool that can generate it based on the API contract/specification that we have established with our backend** (<a href="https://specmatic.in" target="_blank">Specmatic</a> and <a href="https://stoplight.io/open-source/prism" target="_blank">Prism</a> can do this based on the OpenAPI spec, there is also a <a href="https://docs.pact.io">Pact</a> which uses its own format and take a slightly different approach). Following this approach, as long as API specification is correct and true, we know that we use an API in the same way as it is implemented, thus we can rest assured that it will work in the production also.

Another example - a few microservices that communicate via http. In that case, E2E tests would mean starting them all together and creating test cases that would span over multiple services. Each of them can fail because of host of reasons, and because of that they are hard to write and understand, similarly as true E2E tests of frontend + backend system (what even to say about the complexity of a frontend + microservices-based backend system E2E tests!). What we can do instead is to have each service tested independently using *Integration Tests*, as described above. Additionally, where they depend on another microservice by calling them over the network - we can generate mock servers based on the contract that we have established. In that way, each microservice is verifying that it adheres to the contract that it has agreed on with other microservices. **There is no longer a need for E2E tests - we can have the same level of confidence, but the complexity (which is our <a href="https://grugbrain.dev/#grug-on-complexity" target="_blank">eternal enemy</a>) has been reduced dramatically.** We no longer need to have a shared between microservices E2E test cases and a separate environment to run them, which we might not fully control and have available for us. Each microservice can be tested and verified independently and, as long as each of them uses this approach and the agreed upon API contract is correct, we can be certain that our system works as expected.

In conclusion, each time we have two or more pieces of software communicating over the network, we can create a contract that describes this communication. We can then use tools that verify whether each side is following the agreed upon contract. If we are able to guarantee that this contract is correct, we can be certain that our services/components will also work properly together, when deployed to a production. **If done correctly, contract tests can give us the same level of confidence that E2E tests try to deliver, but without all the complexity and fragility of the latter.**

## What to focus on?

Given all of those factors and tradeoffs, what should we focus on? As always, it depends. 

In most cases, I would say that *Integration Tests* (also nicely called <a href="https://grugbrain.dev/#grug-on-testing">in-between tests</a>) give us the best set of tradeoffs. They verify that a few layers/components of our system/application work together, and at the same time they are relatively easy to write, read, understand, maintain and change. They do not take that long to run too. Especially considering the fact that we can combine integration tests with contract tests and get the same level of confidence that E2E tests bring, without their complexity and often (not always) fragility and brittleness. For backends, it means that we can write integration + contract tests of both our APIs and topics/queues. For frontend apps, we can write in-browser tests using tools like Playwright or Cypress with mocked backend, but generated based on its API specification (contract). These are both our integration tests, we do real http requests and render UI in the browser, and contract tests - backend is mocked, but its schema is generated based on the real and correct specification.

Sometimes, we do have a complex piece of code that does one, isolated, specialized thing. It can also have many edge cases worth testing. **If it is so, we might just test a happy path and a few basic cases in our integration test, but write extensive unit tests of that isolated function/object to patch our integration tests.** That is also another wise thing to do. We can patch our integration tests with unit tests. Every time something gets too complicated to test thoroughly in integration tests, it becomes too slow to write or run, we might write a few unit tests to close this gap.

When we write specialized tools or libraries it might make more sense to focus on unit tests. It depends exactly on what we create, but if we expose a specialized set of functions similar to those in standard libraries like:
```
function quickSort(elements: number[]): number[];

function mergeSort(elements: number[]): number[];

function capitalize(string: string): string;
```
If they are used in isolation mostly, it makes tremendous sense to unit test them thoroughly. We might just add a few integration tests, where we test a few repeated cases of objects/functions collaborating with each other and that is all we need.

## Conclusion

As we have learned, tests are a crucial component of the software development process. They secure the present and future correctness of our software, help us to understand it, promote good design of the codebase and support its evolution as the requirements constantly change, if done correctly. If done badly, they give us a false impression of correctness and hamper future changes and evolution. Let's then do them correctly, by focusing on how our software is used in reality, and not on vanity metrics like 90%+ code coverage. Then, as we continue to change and work on it, we can rest assured that it works right now and will work in the future.

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a target="_blank" href="https://www.youtube.com/watch?v=rBoZfQ3z3gU">Integration tests of REST API in Java 21</a>
2. <a target="_blank" href="https://www.youtube.com/watch?v=o9vj0dLf3f4">E2E tests of the UI in Playwright</a>

<div class="article-delimiter">---</div>

### Notes and resources

1. Maybe E2E tests are not a good idea:
    1. https://www.youtube.com/watch?v=QFCHSEHgqFE
    2. https://pactflow.io/blog/proving-e2e-tests-are-a-scam/
2. Maybe we do not need to write so many unit tests: 
    1. https://kentcdodds.com/blog/write-tests
    2. https://tyrrrz.me/blog/unit-testing-is-overrated
3. Grug on testing: https://grugbrain.dev/#grug-on-testing
4. Contract testing:
    1. Specmatic: https://specmatic.in
    2. Pact: https://docs.pact.io
    3. Prism: https://stoplight.io/open-source/prism
    4. Spring Cloud Contract: https://www.baeldung.com/spring-cloud-contract
    5. About contract testing for microservices: https://www.youtube.com/watch?v=Fh8CqZtghQw