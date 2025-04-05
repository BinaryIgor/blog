---
{
    "title": "Who controls the Internet and How it works?",
    "slug": "who-controls-the-internet-and-how-it-works",
    "publishedAt": "2024-08-31",
    "excerpt": "We take the Internet, as it is, completely for granted. But have you ever wondered: what it is, how it works and who controls it? At its core, the Internet is just a...",
    "researchLog": [ 1 ],
    "writingLog": [ 1, 2, 1.5, 1, 2, 1.5, 2.5, 2.5, 1.25, 2.5 ],
    "tags": ["networks"]
}
---

## What is the Internet?

We take the Internet, as it is, completely for granted. But have you ever wondered: what it is, how it works and who controls it?

At its core, the Internet is **just a network of various networks that allows a flow of data between machines and people**. Unbounded by physical distance, flow of data between various devices is its primary functionality.

Of course, this seemingly unlimited movement of information between rooms, cities, countries and continents does not happen on its own and does not come for free. There are many moving pieces and functionalities that need to work harmoniously with each other, so that the Internet can be and stay what it is.

What are these crucial pieces and functionalities? 
1. **Physical Infrastructure** - we must have a transmission medium to efficiently send and receive data, to and from any machine in the network; most often used mediums are radio waves, copper and fiber-optic cables
2. **Identity** - to send and receive data devices must be able to uniquely identify each other in the network
3. **Routing** - there must be a way of finding a path between networks and machines so they know exactly how, using what path, it is possible to establish communication 
4. **Domain Names** - humans do not want to deal with weird numerical addresses like `31.0.34.99` (IPv4 format) or `2001:0:130f::9c0:876a:130b` (IPv6 format); we prefer to work with friendly, memorable addresses like `google.com` or `youtube.com`. Additionally, having another address layer gives us flexibility that allows for new functionalities and capabilities

\
To answer the question of who controls the Internet, let's go over the Internet's functionalities, see how they work, who provides and is responsible for them. We will then have a solid grasp of how it all works together - as a consequence, understanding who and how controls the Internet will come naturally.

## Identity: IP addresses

IP addresses **are simply unique, numerical identifiers of devices in the Internet**. The main problem and question is: who, and how, assigns them and keeps them unique?

Well, it is quite complicated and a multistep process. Where does it start?

There is an organization called **[Internet Assigned Numbers Authority (IANA)](https://www.iana.org)**, which is a part of the **[Internet Corporation for Assigned Names and Numbers (ICANN)](https://www.icann.org/)**. Both are nonprofit organizations, headquartered in the United States of America, and operate in the multistakeholder model - there are many different groups and organizations who control and have influence over it.

The *Internet Assigned Numbers Authority* is responsible for IP address allocation, among other things. The process is hierarchical:
1. *IANA* allocates large blocks of IP addresses to a few *Regional Internet Registries (RIRs)*
2. *RIRs* allocate some of their IP addresses to the *Local Internet Registries*, which are mostly *Internet Service Providers* but also other organizations - governments, cloud/hosting service providers, data centers, big institutions

To understand this process better, let's go over each step.

### Regional Internet Registries {#identity-ip-addresses-regional-internet-registries}

As of now, there are *five RIRs*, each responsible for a specific region:
1. **ARIN (American Registry for Internet Numbers)** - Canada, USA and some Caribbean Islands
2. **RIPE NCC (Réseaux IP Européens Network Coordination Centre)** - Europe, the Middle East and Central Asia
3. **APNIC (Asia-Pacific Network Information Centre)** - Asia/Pacific Region
4. **LACNIC (Latin American and Caribbean Internet Addresses Registry)** - Latin America and some Caribbean Islands
5. **AFRINIC (African Network Information Centre)** - Africa Region

Every *Regional Internet Registry* is an independent, nonprofit organization managed by multiple stakeholders, including Internet Service Providers (ISPs), governments, academic institutions, data centers and other, internet-related companies and organizations.

As said, **they receive large IP address blocks from IANA but they do not use them directly**. They assign parts of this address space to the *Local Internet Registries*, which do use them directly.

### Local Internet Registries {#identity-ip-addresses-local-internet-registries}

They are *mostly Internet Service Providers (ISPs)* but also Telecom Operators, Cloud Service Providers, Data Centers and other large entities which need to own and manage IP addresses directly. 

**Internet Service Providers give IP addresses to their clients so that they can be uniquely identifiable in the Internet** and thus be able to use it; Telecom Operators do the same in the context of mobile data. Many Data Centers and Cloud Service Providers like Amazon Web Services, Google Cloud Platform, Microsoft Azure, DigitalOcean or Cloudflare also need to own IP addresses to support services they offer, assigning IP addresses to their servers and networks.  

So finally, let's go over **a complete IP address allocation example**:
1. *IANA* assigns a pool of IP addresses to a *Regional Internet Registry*
2. *RIR* gives a subset of this pool to an *Internet Service Provider (Local Internet Registry)*
3. *Internet Service Provider* assigns an IP address to their client (person). They can now be uniquely identified in the Internet and exchange data with other members of this global network

## Routing

We right now know how each member of the Internet gets their unique identifier, an IP address. But, based on this address, how can we find them?

As we have established, the Internet is just a network of networks. These networks must be connected with each other to exchange data between and about each other, so the data can arrive at its destination. How is it possible?

To illustrate it better, let's consider a few examples, operating in the following environment:
1. we have two Internet Service Providers, `A` and `B`
2. we have a Data Center, `DC`; it hosts a website `W`
3. we have four clients (people): `AA` and `AB` - using `ISP A`, `BA` and `BB` - using `ISP B`

\
Examples:
1. `AA` wants to exchange data with `AB` - they both use Internet Service Provider `A`. They are in the same, internal network of the `A` provider so they can be connected directly; there is no need to interact with any other network
2. `AA` wants to access the website `W`, which is hosted and managed by the Data Center `DC`. Here is the problem: `AA` is in the network of the Internet Service Provider `A`, the website `W` is in the network of the Data Center `DC`. We need to find a way to connect these two independent networks `A` and `DC` - more on this below
3. `BA` wants to exchange data with `AB`: they use different Internet Service Providers, `B` and `A` respectively. Again, these are two independent networks; as in the second example, we need to have a way to connect them

In the first example, since `AA` and `AB` are in the same network, the Internet Service Provider (ISP) can find and connect them directly. However, in the next examples we encounter **a routing problem:**
> How can we efficiently locate a device outside our own network and reliably exchange data with it?

### Solution: Border Gateway Protocol (BGP) {#routing-solution-border-gateway-protocol-bgp}

The problem of connecting independent networks is solved by the Border Gateway Protocol. How does it work?

> In BGP, every network is referred to as an Autonomous System (AS) and is assigned a unique Autonomous System Number (ASN). 
>
> While an IP address identifies individual devices, an ASN identifies networks of devices, allowing them to be recognized and routed correctly across the global Internet.

**Autonomous Systems are rather large networks operated by Internet Service Providers, Data Centers, Cloud Service Providers and other large entities.** Every Autonomous System owns a set of IP addresses and interacts with other Autonomous Systems - how is it possible? How hard is it to become an Autonomous System?

Becoming an Autonomous System is not an easy task. An organization that wants to become one, has to negotiate with a *Regional Internet Registry* and prove that it needs and is able to become an Autonomous System. **Regional Internet Registries (RIRs) have large pools of IP addresses, but they manage pools of Autonomous System Numbers as well.** Once an organization is accredited as an Autonomous System, by the appropriate *RIR*, it can start to build connections with other Autonomous Systems, announcing the ownership of its IP addresses to become truly globally connected.
There are basically two ways of doing it:
1. **Private Peering: peer-to-peer, direct connections** with other Autonomous Systems. It is a more expensive and harder way, since if done exclusively, every AS would need to connect and know about all or most other ASes. Still, it is sometimes done for performance reasons, usually between very large networks with high traffic
2. **Public Peering: through Internet Exchange Points (IXPs)**, shared by multiple entities. Connecting there allows one to be connected to all Autonomous Systems that also use this particular *IXP*, without any specific knowledge about them. Obviously, this is much more scalable and used for the majority of connections

In practice, **many Autonomous Systems use a hybrid approach**: they connect to multiple IXPs but have direct connections with selected Autonomous Systems as well.

Summing it up:
* If devices are in the same network, they can be connected directly just by using IP addresses. The same network means the same physical infrastructure
* If devices are in different networks, which means different physical infrastructures, we need to locate them and somehow connect these two independent networks. Networks are identified by the *Autonomous System Number*, they announce supported *IP addresses* and they connect with each other either directly or by using shared *Internet Exchange Points (IXPs)*


## Domain Name System (DNS)

When we interact with the Internet, we do not use strange numbers like `142.250.203.142`, `216.58.215.110` or `2001:0:130f::9c0:876a:130b`. We use *memorable Domain Names* like `google.com` or `youtube.com`. But as we have established, devices in the Internet are identified by the IP addresses, not human-friendly domain names. How then `youtube.com` is translated to an IP address, so we can locate this machine and get desired data from it?

This problem is solved by the Domain Name System (DNS). **It is a protocol that handles Domain Name to IP address translation.** It is a hierarchical protocol, where we basically have three types of servers:
1. Root Name Servers
2. Top Level Domain Name Servers (TLDs)
3. Authoritative Name Servers

On the high level, this is how Domain Name to IP address translation works. Let's use `youtube.com` as an example:
1. we input `youtube.com` in the browser
2. DNS query is sent to one of the Root Name Servers; it returns a Top Level Domain Name Server we should ask next
3. we have the Top Level Domain Name Server and ask it about `youtube.com`; it also does not respond directly, instead, it returns an Authoritative Name Server we should consult next
4. finally, we ask the Authoritative Name Server about `youtube.com` IP address - it returns `216.58.215.110`

So, the flow is: 
```
1. Root Name Server -> Top Level Domain Name Server
2. Top Level Domain Name Server -> Authoritative Name Server
3. Authoritative Name Server -> IP address
```

Once we have an IP address, we interact with it as we have been describing in the previous sections.

**Working and coordination of the whole DNS protocol is a responsibility of the Internet Corporation for Assigned Names and Numbers (ICANN).** *But, who controls and sets up all of these different DNS servers?*

### Root Name Servers {#domain-name-system-dns-root-name-servers}

**There are thirteen logical DNS Root Name Servers, named from A to M.** They are controlled by twelve entities:

<div class="list-like">
    <p><strong>A & J.</strong> Verisign, Inc.</p>
    <p><strong>B.</strong> University of Southern California,
    Information Sciences Institute</p>
    <p><strong>C.</strong> Cogent Communications</p>
    <p><strong>D.</strong> University of Maryland</p>
    <p><strong>E.</strong> NASA (Ames Research Center)</p>
    <p><strong>F.</strong> Internet Systems Consortium, Inc.</p>
    <p><strong>G.</strong> US Department of Defense (NIC)</p>
    <p><strong>H.</strong> US Army (Research Lab)</p>
    <p><strong>I.</strong> Netnod (Swedish Internet Foundation)</p>
    <p><strong>K.</strong> RIPE NCC (Réseaux IP Européens Network Coordination Centre)</p>
    <p><strong>L.</strong> ICANN</p>
    <p><strong>M.</strong> WIDE Project (a Japanese academic research consortium)</p>
</div>

\
As said, Root Name Servers do not return IP addresses directly but return addresses of appropriate Top Level Domain Name Server, for further consultation. What is the source of this information? How do the Root Name Servers know to which Top Level Domain Name Server they should delegate DNS queries?

**The Root Zone File is a crucial file that contains information about the IP addresses of Top Level Domain Name Servers and the domain name extensions they support.** Responsibility for managing this critical file, without which DNS cannot function, is on the previously mentioned *Internet Assigned Numbers Authority (IANA)*. *Verisign* - which operates two of the root name servers, among other things - acts as the Root Zone Maintainer, playing a key role in the implementation and distribution of the Root Zone File.

### Top Level Domain Name Servers {#domain-name-system-dns-top-level-domain-name-servers}

Root Name Servers delegate DNS queries to Top Level Domain Name Servers (TLDs); each of them is responsible for a single domain name extension.

There are two types of TLDs:
1. **Generic (gTLDs)** - responsible for domains like *.com, .org, .net, .app, .dev or .online*
2. **Country-code (ccTLDs)** - responsible for country-specific domains like *.pl, .de, .fr, .uk or .us*

Different entities control *gTLDs* and *ccTLDS*, each with its own rules and regulations. In both cases, these entities need to cooperate and negotiate with our old, returning friend - *Internet Corporation for Assigned Names and Numbers (ICANN)*, who is responsible for coordinating the work on the DNS protocol as a whole.

Generic Top Level Domain Name Servers (gTLDs) for popular domain extensions are handled by:
* **.com & .net** - Verisign, Inc.
* **.org** - Public Interest Registry (PIR)
* **.app & .dev** - Google Registry

Country-code Top Level Domain Name Servers (ccTLDs) for some countries' extensions are handled by:
* **.pl (Poland)** - NASK (Research and Academic Computer Network)
* **.de (Germany)** - DENIC eG
* **.fe (France)** - AFNIC (Association française pour le nommage Internet en coopération)
* **.uk (United Kingdom)** - Nominet UK
* **.us (United States)** - GoDaddy Registry

\
As we have learned, these servers receive DNS queries from the Root Name Servers but they do not return IP addresses directly; instead, they delegate these queries further to Authoritative Name Servers.

### Authoritative Name Servers {#domain-name-system-dns-authoritative-name-servers}

Finally, at the end of the DNS query chain we have Authoritative Name Servers: **they take a Domain Name and return an IP address**. Who manages them?

They are *managed mostly by Domain Name Registrars* but also by Cloud Service Providers, Web Hosting Providers and some other, rather large, entities.

However, **Domain Name Registrars are the primary entities from which we can buy and own domain names**. It is not an overstatement to say that they control domain name ownership, for most people and companies. 
Who are they exactly and who can become one?

They are businesses and organizations from all around the world who can sell (lease) ownership of domain names to private individuals, companies and organizations. They must be accredited by *ICANN* for generic domains and by relevant country registries for country-specific domains.

They have direct relationships with Top Level Domain Name Servers (TLDs) which control the domain name extensions they sell. They also need to maintain robust infrastructure, including their own Authoritative Name Servers. On top of that, they should allow owners of the domains to change their Authoritative Name Servers and are responsible for propagating this crucial information throughout the DNS protocol. **Some of the most prominent Domain Name Registrars are:**
* GoDaddy, United States
* Namecheap, United States
* IONOS, Germany
* OVHcloud, France
* Hostinger, Lithuania
* Alibaba Cloud, China

## Conclusion

As we have learned, **the Internet is just a network of networks but a highly, highly complex one: there is no single entity that controls it**. It can be argued that its decentralized nature makes the Internet impossible to be centrally controlled; but there certainly are entities who have more influence than the others.

**At the top, sit ICANN and IANA.** *Internet Corporation for Assigned Names and Numbers (ICANN)* is one of the most prominent entities: it oversees the Domain Name System (DNS), a critical component of the Internet. Without it, we would need to use numerical IP addresses instead of human-friendly, memorable and more flexible domain names. *Internet Assigned Numbers Authority (IANA)*, which is a part of ICANN, manages IP addresses and Autonomous System Numbers allocation to particular regions of the world. Without IP addresses and Autonomous System Numbers, there would be no possibility of identifying devices in the Internet nor would it be possible to connect independent networks - to put it simply, the Internet would cease to exist.

**Regional Internet Registries (RIRs) have significant influence as well.** There are five of them, managing different regions of the world. They get IP addresses and Autonomous System Numbers from IANA and can basically decide which Internet Service Providers, Data Centers and other big entities have access to these critical resources, in their respective regions.

**National governments can have a major impact on Internet policies, especially when it comes to issues like cybersecurity, privacy and freedom of speech/information.** Government regulations can and do shape how the Internet is accessed and used within specific jurisdictions; it is not a secret that the Internet is censored by the government in some countries, notably Iran, Russia, North Korea and China. Governments might directly influence or outright control Internet Service Providers that function in the area of their control, banning certain domains or spying on their citizens. Unfortunately, there are regions of the world where this is happening at a large scale. Additionally, both *ICANN* and *Regional Internet Registries* are managed in the multistakeholder model and governments do have a say and influence there. There is clearly a tension between global governance, how the Internet should function as a whole, and national sovereignty: desire of many national governments to strictly control how the Internet functions and what is allowed there.

Also worth mentioning, the *Internet Engineering Task Force (IETF)* is responsible for developing and promoting Internet standards, particularly the standards that comprise the commonly used protocols (most notably TCP/IP), including defining protocols that govern data exchange over the Internet. Similarly, the *World Wide Web Consortium (W3C)* develops various standards, protocols and guidelines for the World Wide Web as well.

**Large tech companies, including Internet Service Providers, Domain Registrars and Social Media Platforms, exert enormous influence over the Internet through the services and platforms they provide, and the infrastructure they control**. Their ability to shape policies and opinions of individuals, public and private entities cannot be ignored. Companies like Google, Amazon, Meta, Apple, Microsoft, Twitter/X, GoDaddy or Verisign have an outsized impact on how the Internet functions in practice.

Fortunately, there is no single entity that controls the Internet; there are many, cooperating with each other to various degrees and at various levels. There are and always will be some issues with the Internet, especially where more corrupt governments and special interest groups try to have their way; but as a whole, it works surprisingly well. **Together, these diverse entities create one of the most complex, one of the most useful, but also one of the most disruptive technologies that humans have ever created: a decentralized network of digital information and services that knows almost no physical boundaries.**

<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources

1. Official websites of ICANN and IANA: https://www.icann.org, https://www.iana.org. There is lots of useful information there; for example, about the [ICANN governance model](https://www.icann.org/community) or about [Number Resources (IP addresses and Autonomous System Numbers)](https://www.iana.org/numbers)
2. Jon Postel - legendary man who, among so many of his pivotal contributions, started and ran IANA: https://internethalloffame.org/inductee/jon-postel/
3. Cloudflare has many great resources about the Internet:
    1. https://www.cloudflare.com/learning/network-layer/how-does-the-internet-work/
    2. https://www.cloudflare.com/learning/network-layer/internet-protocol/ 
    3. https://www.cloudflare.com/learning/network-layer/what-is-routing/
    4. https://www.cloudflare.com/learning/network-layer/what-is-an-autonomous-system/
    5. https://www.cloudflare.com/learning/security/glossary/what-is-bgp/
    6. https://www.cloudflare.com/learning/dns/what-is-dns/
    7. https://www.cloudflare.com/learning/dns/what-is-recursive-dns/
4. DNS Root Servers and crucial DNS root zone: 
    1. https://root-servers.org
    2. https://en.wikipedia.org/wiki/DNS_root_zone
5. Internet censorship: https://en.wikipedia.org/wiki/Internet_censorship
6. Internet Exchange Points (IXPs) are a fascinating topic as well: 
    1. https://www.cloudflare.com/learning/cdn/glossary/internet-exchange-point-ixp/
    2. https://en.wikipedia.org/wiki/Internet_exchange_point

</div>