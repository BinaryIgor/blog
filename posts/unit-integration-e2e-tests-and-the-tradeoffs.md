---
{
    "title": "Unit, integration, E2E tests: what and when is worth writing?",
    "slug": "unit-integration-e2e-tests-and-the-tradeoffs",
    "publishedAt": "2023-11-02",
    "timeToRead": "14 minutes",
    "wordsCount": 1983,
    "excerpt": "What about those tests?",
    "writingLog": [ ]
}
---

## Definitions

Some definitions for the sake of clarity.

### Unit tests

Tests that check whether a single unit works in isolation. Unit being mostly a function or an object/class.
If a unit has some dependencies, they are usually mocked or faked.

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

<div class="article-delimiter">---</div>

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