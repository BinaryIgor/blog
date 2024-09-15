---
{
    "title": "Programmer in Wonderland",
    "slug": "programmer-in-wonderland",
    "publishedAt": "2024-09-15",
    "excerpt": "There are hundreds and thousands of tools and frameworks out there, often solving the same problems or struggling to explain what the problem they are trying to solve is ... Because of this diversity and how powerful some of these tools are, it often feels like <em>Magic</em>. So many things possible, so fast and seemingly without a cost, without tradeoffs. But is it really the case?",
    "writingLog": [ 1, 1.5, 1, 2.5, 0.5, 1 ]
}
---

## The Wonderland of Software

The ecosystem of software engineering is vast and it seems to be ever-growing, although recently at a slower pace. There are hundreds and thousands of tools and frameworks out there, often solving the same problems or struggling to explain what the problem they are trying to solve is. Sometimes, it can be quite confusing to ascertain whether solving a problem yourself would not be faster than researching and learning all the tools that are available out there. Sometimes, it begs the question:
> Does the ever increasing use of external tools and dependencies really make us more productive and our systems more reliable?

Because of this diversity and how powerful some of these tools are, it often feels like *Magic*. So many things possible, so fast and seemingly without a cost, without tradeoffs. But is it really the case?

There are multiple frontend frameworks and more ways of using them still and all the buzzwords! Should we build *Single Page Application (SPA)*? What about *Global State Management*? *Micro Frontends* anyone? What about *Search Engine Optimization (SEO)*? Shouldn't we use *Server Side Rendering (SRR)* and/or *Static Site Generation (SSG)* for it? What about *Hydration*? (hint: it is not related to water)

In the same vein, there is a multitude of backend frameworks, tools and related buzzwords. Certainly, we like to talk about magical things like *Object Relational Mapping (ORM), Non-blocking IO, Event Sourcing, Command and Query Responsibility Segregation (CQRS), Service Meshes, Observability, Serverless Computing, Containerization or Virtualization* that gets truly too virtual at times.

**In this bottomless ocean of abstractions, how to make sense of it all?** As mentioned briefly, how we arrived at this point of relying on so many tools and abstractions, and whether it remains productive, is a separate topic I do not cover here. Fortunately, there is hope and a solution. Unfortunately, I think that the default reaction to this state of affairs is quite different, strange and rather unproductive.

## The Lost Programmer

There is a certain type of programmer who I would call *The Lost Programmer*, in the Wonderland of Software of course.

These usually are individuals highly specialized in one or two specific areas. They might be able to work exclusively on the frontend and not be willing to do any other work, even to the smallest degree, like writing a few SQL queries, automating something simple with the help of a few Bash/Python or fixing broken CI/CD pipeline. They want to stay in their comfort zone, in the sphere of things that they know, and do not leave it or leave it as rarely as possible.

Quite often, they are not only highly specialized in one specific area but also know how to operate one or two tools they are currently focusing on. Working on the previous example, they might write frontend (it is the same for backend people) in one of the latest and over-engineered frameworks like Nuxt.js or Next.js. They might learn everything they can about how to use their current tool; all the docs, all methods, APIs and CLI commands.

Unfortunately, most often they do this only at the surface level. They know specifics of their tool but they do not know *how* and *why* it works, *what* happens under the hood, how it is all made possible. They would write their UI in the Next.js and say that to build and deploy it to production you just need to do:
```
next build
next start
```
What does it do you ask? It prepares and runs the Next.js app of course! What does it mean? What do you mean, what does it mean? It just builds and starts the Next.js app! And the conversation goes on like this; they seem to have no idea what is really happening there. Is their app one or a bunch of static files? Does it require a server to dynamically render content based on the request data? Where and how communication with the backend happens? On the client side? On the dedicated frontend server side? How can you configure this app differently based on the environment - dev, stage or prod? They have no clue and do not seem to care about these details.

It is no better for backend or ops people. Details change, but the problem and approach is the same.
For backend guys, they would use the Spring Framework with Hibernate and count on magic like this:
```
@Transactional
void createUser(User user) {
  sqlRepository.save(user);
  var userCreatedEvent = new UserCreatedEvent(user);
  kafkaPublisher.publish(userCreatedEvent);
}
```
Then, they think that this `@Transactional` annotation magically makes everything *transactional*, no matter what it is. Despite the fact that a sql database and message broker like Kafka represent two completely independent systems separated by the network and the transactionality between them cannot be achieved. Again, *The Lost Programmer* is not curious about understanding details like this.

**So, why call them *Lost*? Maybe they are just specialized and pragmatic?** Well, this approach and overreliance on tools and frameworks is all sunshine and roses *until*. Until they do not work according to the docs and/or made assumptions, and fixing them requires understanding all or most of the details that the given tool/framework tries to hide behind its abstractions. Then, *The Lost Programmer* is truly lost: 
* when their ORM framework generates SQL queries that take ages to complete and constantly spike database CPU usage to 100% and they do not know the basics of SQL and how the relational databases work
* when they include all `node_modules` in the final Docker image and wonder why it takes over an hour to build and deploy their app
* when their Single Page Application is just a set of public static files (they probably do not know) and they wonder how they can have secrets, with a single build, embedded safely there; preferably with different values depending on the environment as well
* when in their `@Transactional` magic method they make two synchronous network requests to other services and wonder why although the whole thing has failed, the data was indeed partially changed

As we can imagine, **consequences of this approach can be rather dire but not immediately obvious: subtle, hard to trace bugs might be introduced into the system at any point**. When they appear, *The Lost Programmer* is indeed totally lost. They lack understanding, knowledge and probably most importantly - curiosity, to prevent and fix problems of this nature.

They are also lost in the sense of being tied to the tool they now primarily use. If they do not understand how their tools work, they are not in control. They cannot recreate a part of their functionality themselves and if they want to change the tool, it can often feel like starting all over again; with the lack of understanding of fundamentals, they are bound to learn ever-changing and ephemeral abstractions that hide them. Additionally, they can be easily intimidated by all the buzzwords and marketing campaigns of the tools, since they do not know what is under the hood and how it all works. It truly is magic to them.

To sum it up:
> Tools used in the right context are great and makes programmers life easier. What is more, in many cases, without such tools complex software projects would simply not be possible to complete. On the other hand, too many tools and often shallow, superficial understanding of them, especially as to why and when to use them and why and when to avoid them, can lead to some serious issues.

So, we would rather not be *The Lost Programmer*. What is the solution then?

## Wake up and make the Magic go away

It is that simple. **Learn your fundamentals and by all means use various tools and frameworks!** But first, understand *what* they do, *how* they work and *why* you use them, so they are actually your (optional) tools, not masters. This needs to be tailored a bit to your area of computing, but in general, read about operating systems, how CPU and memory works, experiment with various data structures and networking protocols, write a little bit of assembler or machine code even, understand some basic cryptography, study battle-tested open source projects and maybe most importantly - implement some of those lower-level functionalities on your own, from scratch.

**After doing that, you will [make the Magic go away](https://blog.cleancoder.com/uncle-bob/2015/08/06/LetTheMagicDie.html) and be in a position where you *can* go and implement your own HTTP Server, Database Client, Web/SPA framework or Web Components library, if you want to.** Becoming this person, you are much better able to judge the merits and usefulness of tools that are out there, on the market. What is more, they are truly optional for you; if, in some contexts or circumstances, it turns out that it is just better and faster for you to build something totally or partially from scratch, you have all the ability and power to do so. If, on the other hand, a given tool turns out to be of great value to you, you will now appreciate it even more, knowing exactly how it works and what it takes to build one.

In conclusion, be *A Great Programmer*, not *The Lost One*: have your basics and fundamentals covered and study the tools you regularly use deeply and broadly. Then, you know exactly what you and them are doing; **you are in control and they truly are your tools, not masters**.
