---
{
    "title": "Unit, Integration, E2E, Contract... X tests: what should we focus on?",
    "slug": "unit-integration-e2e-contract-x-what-should-we-focus-on",
    "publishedAt": "2023-11-03",
    "timeToRead": "14 minutes",
    "wordsCount": 1983,
    "excerpt": "What about those tests?",
    "researchLog": [1, 3, 2],
    "writingLog": [ 1 ]
}
---

## Why do we even test

When we write software we intend it to be used in some, usually predefined way. Another way of saying is that software should work correctly according to its specification (explicitly described or implicitly assumed). If the software is small, we can test it manually, by hand.

Unfortunately, this approach starts to break down pretty fast in practice. One, even if our software is small, we need to go through all test cases, manually, after every small change. If we change our software fairly often, this becomes a significant waste of our (the team) time and energy. Secondly, as our software grows beyond having a few features this becomes harder and harder to do, sometimes to the point of practical impossibility (it can be done, but it would take so much times, that nobody would even try). Additionaly, sometimes we just do not even have access to the same/similar environment where our software will be run. This problem only amplifies if our software is only created to be used by other software, not humans (various libraries and tools). 

Therefore, testing software that we write seems to be a wise idea. We increase its quality, decrease possible defects and save our own (team) time along the way. But is it really that straightforward and simple?

## Ideal tests

We established that writing tests to verify that our code works is a good idea. While discussing that we have touched on an important point:  **our tests should resemble, as much as possibile, the way our software is used**. The more this is true, the more confidence we can have that, when deployed to a production, our system/app will work as intended. Unfortunately, reality is not that simple and we do need to make some tradeoffs. Ideally, our tests would be:

* fast and easy to write
* simple to read and understand
* easy to maintain and change
* fast to run, so we have an efficient feedback loop
* promote good design of our code and do not hamper its evolution, but actually support it
* should use the same environment and dependencies as in the production (databases, webservers, browsers, mobile devices, pub-sub/queues systems, files, external API's and so on)
* be reliable and controlable (they should not yield false-positives or false-negatives)
* should resemble they way our software will be used by the end users (be it humans or machines)

Unfortunately, all of these features are almost never achieved in practice, that is why we have a various test types and each of them gives a different set of tradeoffs, that also differs depends on the type of software that we write. Tradeoffs can be completely different depending whether we write server-render web app with one component (monolith), single-page-application consuming REST API, single REST API, microservices-based REST API or a software library that does something very specific and is intended to be used by machines, not humans.


## Basic definitions and classification

Let's define basic tests tyoes and then discuss tradeoffs that they represent based on the type of a software that we write (and possibly other things).

### Unit tests

These are the most basic tests that check whether a single unit works in isolation. Unit being mostly a function or an object/class (we could argue that everything can be reduced to a single function). The most basic example would we:
```
...
function sum(a, b) {
  return a + b;
}
...
test('should sum two numbers', () => {
  assert.equal(sum(2, 2), 4);
});
```
We don't have any dependencies here, but if a unit has them, they are usually mocked or faked (either by using a library or creating our own, test-focused implementation of a needed dependency).

The purpose of them is to check whether a function/object works, ignoring dependencies (as much as possible).
Because of that, they are fast to write and run, bo they do require additional effort to maintain.

### Integration tests

Tests that check whether a few components work together. Components might be functions or objects/classes.
Key difference between them vs unit tests is that we don't mock/fake dependencies, but try to use real ones.
Our dependencies might make real http requests and use talk with real database.

The purpose of them is to check whether a few components work together.
Because of that, they can be slower to write and run, but they require less maintenance and give higher degree of
confidence,
because we test not only single units of work (functions, objects), but also whether and how they work together.

### End to End (E2E) tests

Tests that check whether our application/system work according to its specification.

The purpose of them is to check whether an application/system work as whole.
They can be similar to integration tests, but they test all layers of application.

We check the highest input to our system here and compare them with user expectations.
Example here can be UI tests written in Playwright/Cypress where we interact with application in the browser
or making HTTP request to a REST API to check its behavior.


## ? Contract tests ?

Pact - consumer driven tool. Consumer defines a contract, some files are generated and it verifies it with the provider (what about sharing this file, taking it from the single source of truth?).

API - just publish the clients? For each language? How to make it more abstract?


## When and what?
?

## It depends...
?

## Closing thoughts
?

<div class="article-delimiter">---</div>


## Ideas
* main point the more tests ressemble real software usage the better
* would we event unit tests if e2e tests are easy to control and always fast?
* test for value, not for stats/coverage

### Notes and resources
* https://sizovs.net/boring/
* https://sizovs.net/books/
* https://www.youtube.com/watch?v=QFCHSEHgqFE
* https://kentcdodds.com/blog/write-tests
* https://testing-library.com/docs/dom-testing-library/example-intro
* https://grugbrain.dev/#grug-on-testing
* https://medium.com/adidoescode/api-contract-testing-tools-and-impressions-1eaa18bc2bda - contract tests
* https://www.baeldung.com/spring-cloud-contract
* https://testing-library.com/docs/guiding-principles/
* https://github.com/jsdom/jsdom
* https://github.com/stoplightio/prism
* https://www.mock-server.com/mock_server/using_openapi.html
* https://shahbhat.medium.com/contract-testing-for-rest-apis-31680ed6bbf3
* https://www.ludeknovy.tech/blog/playwright-contract-testing-openapi-specification
* https://blog.developer.atlassian.com/the-power-of-git-subtree/?_ga=2-71978451-1385799339-1568044055-1068396449-1567112770
* https://pactflow.io/blog/proving-e2e-tests-are-a-scam/?utm_source=ossdocs&utm_campaign=convince_me
* https://github.com/karatelabs/karate/tree/master/karate-netty#consumer-provider-example
* https://microsoft.github.io/code-with-engineering-playbook/automated-testing/cdc-testing/
* https://blog.thecodewhisperer.com/permalink/integrated-tests-are-a-scam
* https://docs.pact.io/
* https://specmatic.in/
* https://trunkbaseddevelopment.com/
* https://playwright.dev/docs/test-components - test components being rendered in the browser!
* https://medium.com/pragmatic-ai-league/not-everything-that-can-be-counted-counts-ed9d6dabe89f