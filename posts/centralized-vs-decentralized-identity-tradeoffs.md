---
{
    "title": "Centralized vs Decentralized Identity tradeoffs: Twitter/X, YouTube, Mastodon, ActivityPub and NOSTR",
    "slug": "centralized-vs-decentralized-identity-tradeoffs",
    "startedAt": "2025-06-28",
    "publishedAt": "2025-07-12",
    "excerpt": "Social media and various other online platforms require some sort of identity to provide their services and to customize experience to us. What does it mean exactly and how does it work in practice? Currently most, if not all, of these platforms - Twitter/X, YouTube, Reddit, LinkedIn, Facebook, Instagram, GitHub, Amazon, Spotify and the like - are <em>account-based</em>.",
    "researchLog": [ 2, 1, 1, 1 ], 
    "writingLog": [ 1, 2, 1, 1, 1, 1.5, 1.5, 1.5, 3, 1.5, 2, 3, 2.5, 1.5],
    "tags": ["networks"]
}
---

## Identity

Social media and various other online platforms require some sort of identity to provide their services and to customize experience to us. What does it mean exactly and how does it work in practice?

**Currently most, if not all, of these platforms - Twitter/X, YouTube, Reddit, LinkedIn, Facebook, Instagram, GitHub, Amazon, Spotify and the like - are *account-based*.** We sign up to create an account that is then stored on the service servers and controlled by it. Each time we want to use the service, we sign in with the previously configured credentials and if everything is correct - we are granted access to the service. To control claimed identity, we must prove to the service owner that we are who we say we are.

This is the prevailing identity model that is used by most digital services and networks - **[Centralized](#centralized)**. But, there are other possibilities as well:
* **[Federated](#federated)**  
* **[Decentralized](#decentralized)**
* **[Delegated](#delegated)**

each of them coming with a different set of **[Incentives and Tradeoffs](#incentives-and-tradeoffs)**.

We are about to examine all of them, pondering the following questions:
1. Why do we rarely see and use anything different than the centralized model?
2. What problems do they solve?
3. What problems do they cause? 
4. What use cases do they fit the most? 
5. Is any of them always better, or it depends (on what)?
6. And finally - does the currently dominant identity model must be fixed, or it serves us well and nothing needs to be done?

## Centralized

This is currently prevailing, the simplest and most convenient identity model - **based on trust in and control of the platform/service owner**. It is also the first one we have come up with.

In this approach, we:
1. have an account, stored on the service owner servers; YouTube, GitHub, Twitter/X and so on
2. access to the account (authentication) is usually granted by:
    1. providing username/email/phone number + password credential
    2. using protocol like [OAuth 2.0](https://datatracker.ietf.org/doc/rfc6749/) to sign in/up with the account from a completely different platform; sign up/in with Google, Apple, Facebook, GitHub and so on
    3. providing email/phone number and receiving time-limited magic link or an access code; we then need to click on the link or input the code
3. once signed up/in, we get some sort of session/token that allows us to interact with the service as proven by the provided credential *Identity*
4. once given session/token expires, the whole authentication procedure must be repeated

As we can see, **this model is based on the service owner system state - our *Identity*, and all the ways to claim (prove) it, exists in the service owner database and is controlled by them**. It is extremely convenient, has the best *UX (User Experience)* and is just practical - for the vast majority of cases, we do not care, want or need to have globally unique identity across all platforms and services; identity (account) that allows us to use this particular service does the job more than good enough. For these valid reasons, this model is the most widely spread one.

What are the tradeoffs?

Well, the *Identity* exists only within the *Service* it was created for. It is also fully controlled by the platform/service owner. Additionally, the service owner can impersonate us, if they are malicious - there is no easy, objective way to prove that if we did or say something on the platform it was indeed us, not its owner. For example, on Twitter/X, the current Twitter/X owner might publish a tweet as `A` user. User `A` would have no way of proving that it was not them, other than complaining and criticising the owner of Twitter/X service. In a nutshell, this relationship relies on trust - we assume that the platform owner will act decently, because it is in their best interest (usually) to do so.   

Additionally, **if for whatever reason the platform owner does not like us anymore - they can ban or make our life on the platform harder in a multitude of ways; it is their platform after all**. Of course, they have their reputation at stake, so if too many people are targeted unjustly there most likely will be a public outrage against such abuses. But, it might happen with a significant delay, at the point when it does not matter to us at all. What is more, the government of a certain country can decide to make the platform illegal within its borders or force it to employ certain policies or outright censorship of a particular kind. Since the platform is owned and operated by a single entity, it is easy to target and force them to do things like that.

**Summing it up, we tradeoff convenience and great user experience for higher risk of getting banned, deplatformed or for the service/platform itself becoming banned or taken off in a given country, region or even the whole world.** To be honest, most services do not need to be censorship-resistant and platforms do have their reputation at stake and if they go too far with their policies, there are natural market forces to make them behave better; if they do not, a competitor will arrive, eventually. So, in many cases that is the tradeoff well-worth taking. It is quite different for social media and networks though; network effects make it much, much harder to bootstrap an alternative and compete. Moreover, whether we like it or not, public digital squares play an increasingly more important role in the society as a whole than many other platforms do; because of that, it is probably not a good idea to build them in the centralized model, where a single powerful entity is in total control.

## Federated

This model tries to solve centralization issues of the former by federating accounts. What does it mean?

It basically means that there is a service that has a few or many servers; they are independent, owned and controlled by multiple people/entities, but they all provide more or less the same set of functionalities and usually interact with each other. **Currently, the most prominent example of this model is the [ActivityPub protocol](https://activitypub.rocks/) and its popular implementation - [Mastodon](https://joinmastodon.org/): federated Twitter/X alternative.**

In this model, we also have an account stored in the service owner database. But, there are some differences:
* Service - Mastodon in the example - is federated; it means that we are able to create accounts on multiple servers which provide more or less the same functionality and allow for interactions between each other
* As an example, let's say that there are two Mastodon service servers - `S1` and `S2`. There are also two users - `U1S1` and `U2S2`; first one has an account on the `S1` server, second on the `S2`. What federated model allows:
    * `U1S1` publishes to `S1`
    * `U2S2` follows `U1S1`, even though their accounts are on different servers - servers can and do interact with each other
    * `U2S2` might also comment and like `U1S1` posts; again, even though they come from different servers
    * content is primarily stored on the server to which it was originally published, but once `U2S2` starts following `U1S1` - `S2` will have a local copy of the `U1S1` content

As a result, **accounts are still scoped to a single server instance, but there is a large degree of possible interactions between accounts hosted on different servers**. 
 
Analyzing the consequences, we are still at the mercy of the service owner - it is just more spread, if we are using multiple servers. If only one is used - there basically is no difference between this and the centralized model. What is more, because servers might for whatever reason not like each other - we are at the mercy of their owners after all - they can simply refuse to exchange data, not allowing us to interact with their users. On top of that, **virtually all the drawbacks of the centralized model apply here as well, but the federated model is significantly more complex**. I do not see a compelling use case for it.

{{ .js: newsletterSignUpPostMid() }}

## Decentralized

This model differs substantially from centralized, account-based approach. **Here, there are no accounts; there is [public key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) instead.**

In a nutshell, there are two mathematically related keys: public and private. The public key is the *Identity* and must be known to all interested parties - it is used to encrypt messages and to verify signatures created by the private key. The private key on the other hand, must be kept secret; it allows decrypting messages encrypted with the public key and creating signatures. Being in control of the private key proves that one owns associated *Identity*.

Given the above, let's use an example of one of the most popular protocols that takes this approach - **[NOSTR, Notes and Other Stuff Transmitted by Relays](https://nostr.com)**. How it works:
* [we use one of the NOSTR clients (UI)](https://nostr.how/en/clients) - [Damus](https://damus.io), [Amethyst](https://amethyst.social), [Primal](https://primal.net), [Coracle](https://coracle.social), [Iris](https://iris.to) and so on
* if we do not yet have one, the client generates a key pair for us: public *npub10elfcs4...* and private *nsec1vl029mg...*
* if we already have a public-private key pair, we simply configure our client of choice to use it
* *npub* - public key - is our *Identity*
* *nsec* - private key - controls (proves) access to the *Identity*, associated with the public key
* **every action we take and every event we publish is signed by our *nsec* - private key - resulting in an unforgeable *signature***
* because of how public key cryptography works, everybody who knows our *public key* can verify that the data - action, message, event - was signed by our *private key*, checking the validity of the associated *signature*
* the only thing verifying our *Identity* is the private key; if somebody steals it, they are able to impersonate us and we cannot do anything about it - they might act exactly like us, proving it by producing valid signatures
* since keys are in essence enormous and randomly generated numbers (`2^256` or `~ 10^77`), this approach gives us globally unique *Identity* that does not depend on any state of a centralized service
* **we publish data to multiple relays** - dumb servers with the singular task of accepting, storing and returning data back; if any or all of them block us, we can always switch to different ones or or even run our own - it is all quite simple by design

\
As we can see, this is completely different from the centralized model and has a number of consequences. First and foremost:
> He who controls the Key, controls the Identity.

No centralized party is able to do anything about - *Identity* relies solely on cryptography; it is complete and valid on its own.

**As usual, it results in both advantages and disadvantages.** It is true that no central party controls our identity and cannot impersonate us. It is also true that because there are many servers (relays), **we will always find at least one server (relay) willing to accept and store our messages and even if not - nobody can stop us from running our own; this is censorship-resistance at its fullest.** At the same time, if we lose access to our private key - it is over, there is no `I forgot my password` procedure (at least nothing similar exists yet). What is more, as already stated, if somebody gets access to our private key, they can impersonate us for as long as they have the key and we cannot do anything about it. If this is the case, we have to generate a new key and somehow inform our previous followers and friends what has happened and that *this is our new identity*. There is no simple and automatic way of rotating keys (at least as of now), since `Key = Identity` in this model. If the *Key* is lost, the underlying *Identity* is lost as well.

This is a big and unsolved problem in the NOSTR ecosystem right now. There are some proposals floating around to make it better but nothing is standardized yet. Maybe the cost of this simplicity - `Key = Identity` - means that there could be no easy way of recovering access to the *Identity* in any meaningful way? **Lots of smart people are thinking hard about the problem, so if it is possible to solve, it will be.**

## Delegated

This is a concept where we have some sorts of *Identity Providers* - not necessarily centralized, they might be completely in the user custody and control. It basically boils down to:
> Every time (or periodically) we want to use any kind of service - centralized, federated or decentralized - it delegates identity authentication to the configured Identity Provider.

This *Identity Provider* could be a centralized service but might be our own service as well, hosted by us under our own domain. 

Let's say that we own the `https://personal-site.com` domain and regularly use GitHub and Twitter/X under `@DelegatedUser` handle. On our website, under `https://personal-site.com/.well-known/identity.json` path for example, we would host a json document of more or less this structure:
```
{
  "GitHub": {
    "DelegatedUser": {
      "pubKey": "<hex-encoded public key>",
      "signature": {
        "input": "DelegatedUser@personal-site.com on GitHub",
        "output":"<signature(input) produced by the private key>"
      }    
    }
  },
  "Twitter/X": {
    ...
  }    
}
```
If GitHub and Twitter/X supported this format, we would configure our accounts there to be additionally authenticated by the `https://personal-site.com/.well-known/identity.json` endpoint. Having a convention/standard like that allows us to do many useful things:
* every time we publish something on Twitter/X, Twitter/X might go to `https://personal-site.com/.well-known/identity.json` and check whether the *signature* found there is the same as we have configured it to be on their platform; if it does not match, they would not allow us (or our impersonator) to publish and/or show warning to others, informing that this event is not verified and thus it might not be us
* for the additional verification of our profile, we would link it publicly to the *Identity Endpoint* to show other people that we are the same person and to allow them to verify our signatures as well
* for particularly (do we really need it for all messages?) sensitive or important messages/posts, we could attach associated with their data *signature* as we are the only ones controlling our private keys
* it is even possible to have a standard for API to sign messages of any kind, similar as we have [OAuth 2.0](https://oauth.net/2/) flow for authorization; for example:
    * endpoint `POST:/signatures/{pub-key}`, accepting raw message bytes in the body and returning the signature
    * it might require as simple or as complex auth flow as needed; username:password, separate account with multi-factor authentication, magic links - whatever we want
    * this endpoint - managed and hosted by us or used as an external service - enables us to sign any message with our private key of choice
* what is more, keys here are contextual and scoped per service; they might be revoked at any time, since the ultimate source of truth is our *Identity Endpoint*
* if we are even more paranoid, we could have some sort of *Master Key* and sign a DNS record with it to additionally prove that we are indeed  in control of the *Identity Endpoint*

\
**Let's say that somebody has stolen our key for one or even all services.** All we would have to do is to generate new private keys for each compromised service and publish a new json document on our website, with updated signatures. Then, we just sign in to the associated platforms - GitHub, Twitter/X and so on - and verify our new signatures. **Ultimately, the *Identity Provider* is the source of truth.**

What is more, we are not necessarily required to own a domain. Most likely, a whole network of independent *Identity Providers* would develop. They would have their own reputation system ensuring that they can be trusted with the sensitive task of identity delegation.

**And even if centralized services do not want to implement these ideas - nothing stops us from starting to use these concepts right now**, following simple conventions and practices:
* we can add public keys, signatures and links to our *Identity Endpoint* to all our social media profiles
* once our public key is known inside the platform, we might continue to manually add signatures to each (or some) messages we publish there, for additional verification and credibility
* people who care about having an additional layer of cryptographic verification, could verify signatures of published messages and decide to neglect or discard those which are not valid or do not have the signature at all

Can we then greatly increase the level of control we have over our *Identity*, while still reaping the multitude of benefits coming from using centralized services?

**We can, but this does not solve the issue of deplatforming - any centralized service linked to our delegated identity can still block us.** This concept just allows us to link and additionally prove our identity across some or all services we use. Also unfortunately, centralized services do not really have an incentive to implement a protocol/convention of this kind. But maybe, it is enough to have users adopt them instead and then the platforms will naturally follow? Something to consider.

## Incentives and Tradeoffs

We touched on this a bit already - each of these models represent a different set of incentives and tradeoffs. 

**For the currently dominant, centralized model** - it is obviously the most convenient and easy to use. Also, that is the first we have come up with - there was no alternative; as a result, we stuck with what we had by default. As said, it also works more than good-enough for most use cases - internal systems, platforms that do not rely mainly on public interactions between users and/or public content, services where identity is needed just to use their specific functionality (and pay for it) and so on. Invoicing systems designed only for internal purposes or [image generation AIs](https://www.midjourney.com/), do not need or should be censorship-resistant, open to all and and support globally unique identities - that is simply not their use case, it does not make any sense in this specific context. 

**Social media and networks, places where people share ideas and/or work together on something important are a different story.** Here, the risks of getting deplatformed, banned partially or completely are real; these risks materialize all the time and are often hard or impossible to mitigate. Network effects of the platforms like these take years to develop and it is simply not feasible to build an alternative within a reasonable timeframe, keeping potential malicious tendencies of their current owners at bay.

**That is the biggest risk of having social networks operated in the centralized identity model** - platform owners have total control over their users' identities and because of how painfully slow beforementioned networks effect develop, there often simply is no way to keep these entities reasonably in check. Moreover, these big players are regularly approached and significantly influenced by governments to take down certain content coming from certain people, views or to throttle their reach. And as many examples of Twitter/X, YouTube and others show, they often must or are willing to comply to keep operating in various countries. The problem here is not even an individual company, although there definitely is a room for improvement here, the problem lies in the mode of operation and incentives. **It simply should not be possible for a single entity to have this kind of power; to decide what globally people are allowed to see, criticize and respond to.**  An additional angle of pressure is represented by large advertisers - most centralized social media platforms are free but operate on ads revenue. These customers might refuse to pay for ads on these platforms if certain people or views are being published there. Again, that would be fine, if it was easy to bootstrap an alternative and if we were talking about a platform of limited impact and scope. **But, what we are really talking about are new public squares of the 21st century, not some random and ephemeral products or services.** And as we saw, incentives in this context are often not aligned to maximize freedom and diversity of thoughts, the healthy competition of ideas, but rather to tune them in a certain way; to comply with arbitrary whims of politicians or the ideology and subjective preferences of the current service owner and/or their shareholders. For all these reasons, I think, we have to abandon the centralized identity model in the context of social media and social networks. For other kinds of systems, the majority of them in fact, it still is and will probably remain, the best model to create software that requires some kind of identity for its functionality.

**The federated model has basically the same sorts of incentives and tradeoffs as the centralized model does but it is a little more distributed (federated).** Instead of one service/platform owner we have a few and there are some possibilities of interaction between servers. Our identity is still not portable - it is tied to one server and fully controlled by it - but people on different servers can also follow our content and interact with it. As long as servers are willing to collaborate with each other, which many times proved not to be the case. To be honest, I do not see a winning use case for it. It does not solve any problems that we are currently faced with when it comes to social media and networks; we are still at the mercy of the platform owner here - the only difference is that there are a few of them instead of one but **incentives are as problematic as they are in the centralized model**. What is more, servers often refuse to exchange data with each other, for whatever arbitrary reason, which puts us, the user, at their mercy even more. When it comes to other services, it simply does not add any value but introduces unnecessary complexity. I think we should completely abandon the idea - there are better ones out there, suited for their respective use cases.

**The decentralized model on the other hand, with NOSTR being the primary example, introduces a whole new world of possibilities.** Based on cryptographic proofs, not centralized service state - it gives the user power and control, but also high responsibility. As our identity here is represented by a public-private key pair - huge random number generated and controlled by us - as long as we secure it properly, nobody can take it away. It is possible for individual relays (servers) to block us and discard our content and data but because the network is decentralized, there will always be at least one happy to take it. And even if not - we could always run and operate our own relay (server) or pay somebody to do so. **This censorship-resistance property makes the decentralized model ideal for social media and social networks use cases.** Additionally, because NOSTR is a protocol, there are many client implementations and healthy competition ensues. What is more, there are interesting incentives at play here; clients and apps built on top of NOSTR do compete with each other but if somebody develops something that brings new users and use cases, the whole network benefits as well. **It is open and decentralized and in a certain sense, the user base is shared across all apps which choose to support this protocol.** There mostly are [no walled gardens](https://en.wikipedia.org/wiki/Closed_platform) here - as there are in the centralized approach - protocol is open and apps interoperable, innovations and ideas build upon each other. It makes it both more competitive, since it is easy for users to change their client of choice or set of relays to which they publish and from which they read content, but at the same time, if one of the clients or relays brings more users to the network, everybody benefits.

**The major drawback of the decentralized model is increased responsibility and inconvenience of managing the Keys - Identity.** We have total control over our identity but also total responsibility for it - if our keys are lost or stolen, that is it for the identity as well - there is no `I forgot my password` procedure, it is all on us. Most likely, more and more tools will be developed to address this issue, but to some extent, it will always be harder and more responsible than the comfort of letting it all be managed by the centralized party.

**The delegated approach tries to bridge the gap between centralized and decentralized worlds, giving us another layer of identity.** It allows linking an identity across various services and gives additional cryptographic assurances, but it does not shield us from the major flaw of the centralized model - it cannot help us with deplatforming, getting partially or fully banned. In some contexts it might prove to be useful - verifying additionally our identity on some platforms - but for creating censorship-resistant and global public squares, it might not be enough. The decentralized model seems to be the best fit for this and related social media/networks use cases.

## Closing thoughts

We have gone through all possible *Identity Models* used when building digital platforms and services:
* **[Centralized](#centralized)** - account stored and controlled by the platform/service owner
* **[Federated](#federated)** - accounts stored and controlled by a few platform/service owners with some ability for interaction between their servers. Users from different servers might see content from other instances and interact with it, but accounts are still scoped and exist only on one server and are totally controlled by its owner
* **[Decentralized](#decentralized)** - identity based on cryptography, not any particular service state; there is a public-private key pair, owned and controlled by the user. It is globally unique and responsibility for handling and securing it correctly is totally on the owner - user
* **[Delegated](#delegated)** - allows linking together various identities used across multiple services by delegating authentication to a single *Identity Provider*, which might be controlled by the user or third party

\
**As we have learned, each approach represents a various set of incentives and tradeoffs and is better suited for different use cases.** The centralized approach was first and is still the best for the vast majority of software systems and platforms. For creating digital public squares, social media and networks though - systems that by definition should be neutral and open to a variety of different opinions and point of views - the centralized model has proven to be problematic time and time again. **Here, decentralized and delegated approaches represent a promising alternative.**

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. The practices of shadow banning, deplatforming and censorship, repeated time and time again on the centralized platforms: 
    1. https://en.wikipedia.org/wiki/Shadow_banning
    2. https://en.wikipedia.org/wiki/Deplatforming
    3. https://en.wikipedia.org/wiki/Censorship_by_Google
2. Twitter/X suspensions of various accounts: https://en.wikipedia.org/wiki/Twitter_suspensions
3. Censorship of centralized platforms by various governments:
    1. https://en.wikipedia.org/wiki/Censorship_of_Twitter
    2. https://en.wikipedia.org/wiki/Censorship_of_YouTube
    3. https://en.wikipedia.org/wiki/Censorship_of_GitHub
4. ActivityPub protocol:
    1. https://activitypub.rocks
    2. Mastodon, the most popular implementation: https://joinmastodon.org
5. Public key cryptography:
    1. https://en.wikipedia.org/wiki/Public-key_cryptography
    2. https://en.wikipedia.org/wiki/Digital_signature
    3. https://www.youtube.com/watch?v=GSIDS_lvRv4
6. Various NOSTR resources:
    1. https://nostr.com
    2. https://nostr.org
    3. https://nostr.how
    4. https://river.com/learn/what-is-nostr
    5. https://github.com/nostr-protocol/nips
6. On NOSTR, by the protocol author:
    1. https://fiatjaf.com/nostr.html
    2. https://fiatjaf.com/3f106d31.html
    3. https://fiatjaf.com/87a208d9.html
    4. https://fiatjaf.com/bc63c348b.html
7. https://www.hivemind.vc/writings/nostr
8. https://www.hivemind.vc/identity
9. NOSTR key management issues:
    1. https://bitcoinmagazine.com/technical/solving-nostr-key-management-issues
    2. https://bitcoinmagazine.com/business/no-password-reset-how-frostr-saves-your-nostr-identity
    3. https://www.frostr.org
10. The Power of Open Source: https://www.youtube.com/watch?v=MaZyXEU5XAg

</div>