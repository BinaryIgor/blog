---
{
    "title": "Modular Monolith: can we have independent deployments?",
    "slug": "modular-monolith-can-we-have-independent-deployments",
    "publishedAt": "2023-11-20",
    "startedAt": "2023-11-12",
    "timeToRead": "23 minutes",
    "wordsCount": 2909,
    "excerpt": "Modular Monolith is soo nice.",
    "researchLog": [0.5, 2],
    "writingLog": []
}
---

## Monolith and Microservices battle

That battle is so intense!

### Some notes
1. Everybody makes rigid assumptions about what module is
2. Everybody makes out of the blue assumptions like "in microservices we have separate databses", "modular monolith has one database", "we can't independently deploy mondular monolith" etc.
3. Maybe internal architecture is more important? What does it even mean? More and more things delegated to DevOps (who pays them) the less we need to care about architecture (that also depends)? Doesn't it then mean basically platform/infra/services centralization?
4. n-tier architecture: avoid, there are better ways:  System complexity (Shallow vs Deep)
    Shallow – all CRUD-type systems without or with a negligible amount of business logic
    Deep – high complexity (business/technology). Complexity can be determined by such characteristics as:
    Communicability
    Business rules
    Algorithms
    Coordination
    Time perspective
    What’s going to change
    Likely/Impossible changes
    Separation of responsibility – is there a need for independent teams to work on the solution?
5. Big Ball of Mud - often the result of coupling on the database level?


### Some resources
* https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer
* https://pretius.com/blog/modular-software-architecture/
* https://www.nfsmith.ca/articles/monolith_by_default/