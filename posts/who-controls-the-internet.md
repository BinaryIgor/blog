---
{
    "title": "Who controls the Internet? IP addresses, Domain Name System (DNS), Infrastructure and more",
    "slug": "who-controls-the-internet",
    "publishedAt": "2024-08-28",
    "excerpt": "We take internet, as it is, completely for granted. But have you ever wondered: how does it work and who controls it exactly?",
    "researchLog": [ 1 ],
    "writingLog": [ 1 ]
}
---

## What is the Internet?

We take the Internet, as it is, completely for granted. But have you ever wondered: how does it work and who controls it?

At its core, Internet is just a network of various networks, allowing a flow of data between our devices. This is its core functionality: unbounded by physical distance flow of data.

Of course, this unlimited movement of information between cities, countries and continents does not happen on its own and does not come for free; there are many moving pieces that need to work harmoniously together so that the Internet can be and stay what it is right now.

What are these moving pieces and functionalities? 
* Physical Infrastructure - we must be able to efficiently send and receive data to and from any machine in the network
* Addressing/Identity - to send and receive data, devices must be able to identify each other in the network
* Routing - there must be a way of finding a path between networks and machines, so they actually can communicate with each other  
* Domain Names - humans do not want to deal with weird numerical addresses like `31.0.34.99` (IPv4) or `2001:0000:130F:0000:0000:09C0:876A:130B` (IPv6), we want to work with friendly addresses like `google.com` or `youtube.com`. Additionally, having additional address layer gives us flexibility that allows for new functionalities and possibilities

To answer the question of who controls the Internet, let's go over Internet functionalities, see how they work, who is responsible for and provides them. After that, we will be able to understand how it works and as a consequence, who controls it.


## IP addresses

Ip addresses.

## Border Gateway Protocol (BGP)

What if we don't belong to a one provider?

## Domain Name System (DNS)

We want do type names, not raw numbers.

## Internet Corporation for Assigned Names and Numbers (ICANN)

Powerful Entity.

Also IANA, Jon Postel

## Infrastructure

Is it needed?

## Who controls the Internet then?

As we have learned, the Internet is controlled by...

---

## Tweets 

Who controls the Internet I:

When you input domain name in your browser (http://google.com), it needs to be translated into an IP address - for that we need DNS servers;  At the root, these are mostly controlled by the organization called ICANN.

---

Who controls the Internet II:

Another organization called IANA (part of ICANN) is responsible for the core of the problem which is IP addresses allocation; they in turn delegate this task to a few Regional Internet Registries, each responsible for a certain region of the world.

---

Who controls the Internet III:

Regional Internet Registries own large pools of IP addresses;  they in turn can give these addresses to Local Internet Registries, which in 99.9% of cases are your Internet Service Providers - from them you finally get your public IP address.

---

Who controls the Internet IV:

In 99.9% cases, you get your IP address from the Internet Service Provider; they need to have (or rent) their own physical infrastructure - fiber optics/copper cables, lots of routers and switches; they can allow all their clients communicate with each other- that's what in their direct control.

But how can they (ISPs) allow you communicate with machine outside their Infrastructure?

---

Who controls the Internet V:

Internet Service Providers and other big entities (Cloud Providers, Governments, some Institutions) use Border Gateway Protocol to communicate between each other;  it just means that once Internet data is leaving your machine, it goes through your Internet Service Provider Infrastructure, which uses Border Gateway Protocol to communicate with other Autonomous Systems available there (Internet Service Providers, Cloud Providers, Governments and some Institutions).

---

Who controls the Internet VI:

We now know that in order to be available to all Internet members, one must either be an Autonomous System or a part of one; how can it be done?

You need to apply to Regional Internet Registry (there is 5 of them) and justify your need to become an AS, paying fee as well; once approved, you can start building your Infrastructure and relations with other ASes to become globally connected.

---

Who controls the Internet VII:

Once approval is granted from one or a few Regional Internet Registries, you get an IP address space and an Autonomous System Number; then, you're ready to build your connections and relationships with other Autonomous Systems and be globally connected and reachable, thanks to IP and Border Gateway Protocols.

So far, who had control over the whole process?

---

Who controls the Internet VIII:

As we learned, the fundamental part of the Internet, which is IP address allocation is controlled by a few entities:
1. IANA (part of ICANN) allocates IP address spaces to five Regional Internet Registries
2. RIRs have the right to give their IP address spaces to Local Internet Registries, which are mostly Internet Service Providers but also Cloud Providers and other Institutions
3. These big entities have their own Infrastructure and use Border Gateway Protocol to exchange data between each other, thus allowing the flow of data between people and machines all around the word
4. To use Border Gateway Protocol, one needs to be an Autonomous System and have Autonomous System Number;  becoming accepted as one is controlled by RIRs as well

In summary, IP addresses and communication between different Infrastructures is controlled by a few, rather large organizations, which are in turn controlled by a mix of public and private institutions and corporations.

But, who controls the Domain Names?

---

Who controls the Internet IX:

When we interact with the Internet, we hardly ever use IP addresses directly -  we use Domain Names instead. The IP protocol doesn't know anything about this human-friendly names; they must be translated into numerical identifiers - the IP addresses.

When we input Domain Name into our browser, it consults a hierarchy of DNS Servers to get associated IP address. 

But, who controls those servers?

---


Who controls the Internet X:

Domain Name System (DNS) consists of a hierarchy of servers, mainly:
1. Root Name Servers
2. Top Level Domain Servers (TLDs)
3.  Authoritative Name Servers

Every DNS query that translates a domain name to the IP address(es), always starts with one of the Root Name Servers - there are 13 of them.

ICANN (and IANA as its part) coordinates and is responsible for the working of the whole DNS protocol; Root Name Servers on the other hand, are controlled by a few different organizations. Who are they?

---

Who controls the Internet XI:

There are 13 logical DNS Root Name Servers, named from A to M. They are controlled by 12 organizations:
A & J. Verisign, Inc.
B. University of Southern California,
Information Sciences Institute
C. Cogent Communications
D. University of Maryland
E. NASA (Ames Research Center)
F. Internet Systems Consortium, Inc.
G. US Department of Defense (NIC)
H. US Army (Research Lab)
I. Netnod
K. RIPE NCC
L. ICANN
M. WIDE Project

Without these Servers, no DNS query could resolve a domain name to an IP address. Nevertheless, they do not perform this translation; they delegate those requests to Top Level Domain and Authoritative Name Servers. 

So, what happens there and what entities are in control?

---

Who controls the Internet XII:

DNS Root Name Servers delegate DNS queries to Top Level Domain Servers (TLDs); each of them is responsible for single domain extension.

There are two types of TLDs:
1. Generic gTLDs, responsible for domains like .com, .org, .net, .app, .dev or .online
2. Country-code ccTLDs, responsible for country-specific domains like .pl, .us or .uk

Different entities control gTLDs and ccTLDS, each with its own rules and regulations for operation. In both cases, controlling entities need to cooperate and negotiate with our old friend, Internet Corporation for Assigned Names and Numbers (ICANN).

But, who is responsible for specific, widely-used domain extensions, be it .com, .org or those of specific countries?

---

Who controls the Internet XIII:

Generic Top Level Domain Servers (gTLDs) for popular domain extensions are handled by:
- .com & .net: Verisign, Inc.
- .org: Public Interest Registry (PIR)
- .app & .dev: Google Registry

Country-code Top Level Domain Servers (ccTLDs) for some countries' extensions are handled by:
- .pl (Poland): NASK (Research and Academic Computer Network)
- .uk (United Kingdom): Nominet UK
- .us (United States): GoDaddy Registry under a contract with the U.S. Department of Commerce

As we’ve learned, these servers receive DNS queries from Root Name Servers, but they don’t return IP addresses directly; instead, they delegate these queries further to Authoritative Name Servers. How do they work, and who controls them?


---

Who controls the Internet XIV:

Finally, at the end of the DNS query chain we have Authoritative Domain Name Servers: they take a Domain Name and return an IP address. Who manages them?

They are managed mostly by Domain Name Registrars, but also by Cloud Service Providers, Web Hosting Providers and some other, rather large, entities.

However, Domain Name Registrars are the primary entities from which we can buy and own (lease) domain names. It's not an overstatement to say that they control domain name ownership, for most people and companies.

But who controls Domain Name Registrars? Who are they exactly, and who can become one?

---

Who controls the Internet XV:

Domain Name Registrars allow us to own and control Domain Names. Who are they and how hard is to become one?

They are businesses and organizations from all around the world, accredited by ICANN, that can sell (lease) ownership of Domain Names to private individuals, companies and organizations.

They have direct relationships with Top Level Domain Name Servers (TLDs), which control the domain name extensions they sell.

They also need to maintain robust infrastructure, including their own Authoritative Domain Name Servers. On top of that, they should allow owners of the domains to change their Authoritative Domain Name Servers and are responsible for propagating this crucial information throughout the DNS protocol.

We've covered a lot of complex information. Now, we're ready to answer the Question: who controls the Internet?


<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources
1. https://www.cloudflare.com/learning/security/glossary/what-is-bgp/
2. Oficial ICANN website: https://www.icann.org/
3. Jon Postel: https://internethalloffame.org/inductee/jon-postel/
4. https://root-servers.org/
5. https://en.wikipedia.org/wiki/DNS_root_zone
6. https://www.cloudflare.com/learning/network-layer/what-is-routing/

</div>