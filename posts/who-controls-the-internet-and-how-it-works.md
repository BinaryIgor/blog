---
{
    "title": "Who controls the Internet and How it works",
    "slug": "who-controls-the-internet-and-how-it-works",
    "publishedAt": "2024-08-29",
    "excerpt": "We take internet, as it is, completely for granted. But have you ever wondered: how does it work and who controls it exactly?",
    "researchLog": [ 1 ],
    "writingLog": [ 1, 2, 1.5, 1, 2, 1.5, 2.5 ]
}
---

## What the Internet is

We take the Internet, as it is, completely for granted. But have you ever wondered: how does it work and who controls it?

At its core, the Internet is **just a network of various networks that allows a flow of data between machines and people**. Unbounded by physical distance, flow of data between various devices is its primary functionality.

Of course, this seemingly unlimited movement of information between rooms, cities, countries and continents does not happen on its own and does not come for free. There are many moving pieces and functionalities that need to work harmoniously with each other, so that the Internet can be and stay what it is.

What are these crucial pieces and functionalities? 
1. **Physical Infrastructure** - we must have a transmission medium to efficiently send and receive data, to and from any machine in the network; most often used mediums are radio waves, copper and fiber-optic cables
2. **Identity** - to send and receive data, devices must be able to uniquely identify each other in the network
3. **Routing** - there must be a way of finding a path between networks and machines, so they know exactly how, using what path, it is possible to establish communication 
4. **Domain Names** - humans do not want to deal with weird numerical addresses like `31.0.34.99` (IPv4 format) or `2001:0:130f::9c0:876a:130b` (IPv6 format); we prefer to work with friendly, memorable addresses like `google.com` or `youtube.com`. Additionally, having another address layer gives us flexibility that allows for new functionalities and capabilities

\
To answer the question of who controls the Internet, we will go over the Internet's functionalities, see how they work, who provides and is responsible for them. We will then have a solid grasp of how it all works together - as a consequence, understanding who and how controls the Internet will come naturally.

## Identity - IP addresses

IP addresses **are simply unique, numerical identifiers of devices on the Internet**. The main problem and question is: who, and how, assigns them and keeps them unique?

Well, that is quite complicated and a multistep process. Where does it start? 

There is an organization called **Internet Assigned Numbers Authority (IANA)**, which is a part of **Internet Corporation for Assigned Names and Numbers (ICANN)**. Both are nonprofit organizations, located in the United States of America and operate in the multistakeholder model - meaning that they are many different groups and organization who control and have influence over it. 

Internet Assigned Numbers Authority is responsible for IP adresseses allocation, among other things. The process is hierarchical:
1. *IANA* allocates large blocks of IP addresses to a few *Regional Internet Registries (RIRs)*
2. *RIRs* in turn allocate some of IP address blocks to *Local Internet Registries*, which are mostly your Internet Service Providers, but also other organizations (governments, cloud/hosting service providers, big institutions)

Do understand this process better, let's go over each step.

### Regional Internet Registries

As of now, there are five RIRs, each responsible for a specific region:
1. **ARIN (American Registry for Internet Numbers)**: North America
2. **RIPE NCC (Réseaux IP Européens Network Coordination Centre)**: Europe, the Middle East and parts of Central Asia
3. **APNIC (Asia-Pacific Network Information Centre)**: Asia-Pacific region
4. **LACNIC (Latin American and Caribbean Internet Addresses Registry)**: Latin America and the Caribbean.
5. **AFRINIC (African Network Information Centre)**: Africa

Every Regional Internet Registry is an independent, not-for-profit organization managed by multiple stakeholders, including Internet Service Providers (ISPs), governments, academic institutions, data centers and other, internet-related companies and organizations.

**As said, they receive large blocks of IP addresses from *IANA*, but they do not do use them directly.** They assign parts of this address space to *Local Internet Registries*, which do use them directly.

### Local Internet Registries

These are mostly Internet Service Providers (ISPs), but also Telecom Operators, Cloud Service Providers and other large entities who need to own and manage IP addresses directly. 

Internet Service Providers give IP addresses to their clients so that they can be uniquely identifiable in the Internet and thus be able to use it; Telecom Operators need to the same in the context of mobile data. Many Data Centers and Cloud Service Providers like Amazon AWS, Google GCP or Microsoft Azure also need to own IP addresses to support services that they offer, assigning IP addresses to their servers for example.  

So finally, let's go over a **complete IP address allocation example**:
1. *IANA* assigns a pool of IP addresses to a *Regional Internet Registry*
2. *RIR* gives a subset of this pool to an *Internet Service Provider (Local Internet Registry)*
3. *Internet Service Provider* gives an IP address to their client (a person) who can now be uniquely identified in the Internet and exchange data with other members of this global network

## Routing

### What is the problem?

We right now know how each member of the Internet can get their unique identifier, an IP address. But, based on this address, how can we find them?

As we have established, the Internet is just a network of networks. These networks need to be connected with each other and exchange data between and about each other, so the data can arrive at its desired destination. How is it possible?

To illustrate it better, let's consider a few examples, operating in the following environment:
1. we have two Internet Service Providers, `A` and `B`
2. we have a Data Center, `DC`; it hosts a website `W`
3. we have four clients (people): `AA` and `AB` - using `ISP A`, `BA` and `BB` - using `ISP B`

\
Examples:
1. AA wants to exchange data with AB: they use the same Internet Service Provider A. They are in the same, internal network of the `A` provider, so they can be connected directly, without a need to interact with any other network
2. AA wants to access the website W, which is hosted and managed by the Data Center DC. Here is the problem: AA is in the network of the Internet Service Provider A, and the website W is in the network of the Data Center DC. We need to find a way to connect these two independent networks A and DC - more on this below
3. BA wants to exchange data with AB: they use different Internet Service Providers, B and A respectively. These are two independent networks; they need to have a way to find each other and exchange data

In the first example, since `A` and `B` are in the same network, the Internet Service Provider (ISP) can find and connect them directly. However, in the next examples, we encounter **a routing problem:**
> How can we efficiently locate and reliably exchange data with a device outside our own network?

### Solution - Border Gateway Protocol (BGP)

The problem of connecting independent networks is solved by the Border Gateway Protocol. How does it work?

In this protocol, **every network is called an Autonomous System and have its own, unique Autonomous System Number. It works similarly to the IP address, but instead of identifing devices, it identifies networks**.

As we could infer already, Autonomous Systems are rather large networks operated by Internet Service Providers, Data Centers, Cloud Service Providers and other large entities. Every Autonomous System owns a block of IP addresses and interacts with other Autonomous Systems - how is it possible?

First, becoming an Autonomous System is not an easy task. An organization that wants to become one, needs to negotiate with a Regional Internet Registry abd prove that it needs and is able to become an Autonomous System. The same organizations (RIRs) that have large pools of IP addresses, have pools of Autonomous System Numbers (ASN) as well, which they can hand over to Autonomous Systems they register. Once an organization is accredited as one, by appropriate *RIR*, it can start to build connections with other Autonomous Systems, announcing owned by it IP addresses, to become truly globally connected. There are basically two ways of doing it:
1. **Private Peering**: peer-to-peer, direct connections with other Autonomous Systems. It is more expensive and harder way to do this, since if done exclusively, every AS would need to connect and know about all other ASes. Still, it is sometimes done for performance reasons, usually between very large networks with high traffic 
2. **Public Peering: through Internet Exchange Points (IXPs)**, shared by multiple entities. Connecting there allows to be connected to all Autonomous Systems that also use this particular IXP, without any specific knowledge about them. Obviously, this is much more scalable and used for the majority of connnections

In practice, most Autonomous Systems (so ISPs as well) use hybrid approach: they connect to multiple IXPs, but have some direct connections with selected Autonomous Systems as well.

Summing it up:
* If devices are in the same network, they can be connected directly just by using IP addresses, since the same network means the same physical infrastructure
* If devices are in different networks, meaning different physical infrastructures, we need to locate them and somehow connect these two independent networks. Networks are identified by the *Autonomous System Number*, they announce supported by them IP addresses and they connect with each other either directly or using shared *Internet Exchange Points (IXPs)* 

## Domain Name System (DNS)

When we interact with the Internet, we do not use strange numbers like `142.250.203.142` or `216.58.215.110`. We use memorable *Domain Names* like `google.com` or `youtube.com`. But as we have established already, devices in the Internet are identified by IP addresses, not this human-friendly domain names. How then `youtube.com` is translated to `216.58.215.110`, behind the scenes, so we can locate this machine and get desired data from it?

This problem is solved by the *Doman Name System (DNS)*. It is a protocol that handles domain name to IP address translation. It is a hierarchical protocol, where we have a few types of servers:
1. Root Name Servers
2. Top Level Domain Servers (TLDs)
3. Authoritative Name Servers (ANS)

On the high level, this is how Domain Name to IP address translation works. Let's use `youtube.com` as an example:
1. we input `youtube.com` in the browser
2. DNS query is sent to one of the Root Name Servers; it returns Top Level Domain Name Server we should ask next
3. we have a Top Level Domain Name Server and ask it about `youtube.com`; it also does not respond directly, it returns us an Authoritaive Name Server we should consult next
4. finally, we ask the Authoritative Name Server about `youtube.com` IP address - it returns `216.58.215.110`

So, the flow is: 
```
1. Root Name Server -> Top Level Domain Server
2. Top Level Domain Server -> Authoritative Name Server
3. Authoritative Name Server -> IP address
```

Once we have an IP address, we interact with it as we have been describing in the previous sections.

Working and coordination of the whole DNS protocol is the responsibility of the Internet Corporation for Assigned Names and Numbers (ICANN). *But, who controls and sets up all of these different DNS servers?*

### Root Name Servers

There are 13 logical DNS Root Name Servers, named from A to M. They are controlled by 12 organizations:

<div class="list-like">
    <p>A & J. Verisign, Inc.</p>
    <p>B. University of Southern California,
    Information Sciences Institute</p>
    <p>C. Cogent Communications</p>
    <p>D. University of Maryland</p>
    <p>E. NASA (Ames Research Center)</p>
    <p>F. Internet Systems Consortium, Inc.</p>
    <p>G. US Department of Defense (NIC)</p>
    <p>H. US Army (Research Lab)</p>
    <p>I. Netnod (Swedish Internet Foundation)</p>
    <p>K. RIPE NCC (Réseaux IP Européens Network Coordination Centre)</p>
    <p>L. ICANN</p>
    <p>M. WIDE Project (a Japanese academic research consortium)</p>
</div>

\
As we said, Root Name Servers do not return IP addresses directly but return address of appropriate Top Domain Level Server, for further consultation. What is the source of this information? How do Root Name Servers know to which Top Domain Level Server they should delegate DNS queries?

**The Root Zone File is a special file that informs Root Name Servers about Top Domain Level Servers location and supported by them domain name extensions.** Responsibility for managing this crucial file, without which DNS cannot function, is on the mentioned previously Internet Assigned Numbers Authority (IANA), with the strong help of the Verisign (influential entity, running two root name servers, among other things), acting as the Root Zone Maintainer.  
It basically consists of all TLDs with their addresses and supported domain name extensions.

### Top Level Domain Servers

What is worth reiterating, DNS Root Name Servers delegate DNS queries to Top Level Domain Servers (TLDs); each of them is responsible for a single domain name extension.

There are two types of TLDs:
1. **Generic gTLDs**, responsible for domains like *.com, .org, .net, .app, .dev or .online*
2. **Country-code ccTLDs**, responsible for country-specific domains like *.pl, .de, .fr, .uk or .us*

Different entities control gTLDs and ccTLDS, each with its own rules and regulations for operation. In both cases, controlling entities need to cooperate and negotiate with our old, returning friend, Internet Corporation for Assigned Names and Numbers (ICANN), who is responsible for coordinating work on the DNS protocol as a whole.

Generic Top Level Domain Servers (gTLDs) for popular domain extensions are handled by:
- **.com & .net**: Verisign, Inc.
- **.org**: Public Interest Registry (PIR)
- **.app & .dev**: Google Registry

Country-code Top Level Domain Servers (ccTLDs) for some countries' extensions are handled by:
- **.pl (Poland)**: NASK (Research and Academic Computer Network)
- **.de (Germany)**:  DENIC eG
- **.fe (France)**: AFNIC (Association française pour le nommage Internet en coopération)
- **.uk (United Kingdom)**: Nominet UK
- **.us (United States)**: GoDaddy Registry under a contract with the U.S. Department of Commerce

As we have learned, these servers receive DNS queries from Root Name Servers, but they do not return IP addresses directly; instead, they delegate these queries further to Authoritative Name Servers.

### Authoritative Name Servers

Finally, at the end of the DNS query chain we have Authoritative Domain Name Servers: they take a Domain Name and return an IP address. Who manages them?

They are managed mostly by Domain Name Registrars, but also by Cloud Service Providers, Web Hosting Providers and some other, rather large, entities.

However, Domain Name Registrars are the primary entities from which we can buy and own (lease) domain names. It is not an overstatement to say that they control domain name ownership, for most people and companies. 
Who are they exactly, and who can become one?

They are businesses and organizations from all around the world, accredited by *ICANN*, that can sell (lease) ownership of Domain Names to private individuals, companies and organizations.

They have direct relationships with Top Level Domain Name Servers (TLDs), which control the domain name extensions they sell. They also need to maintain robust infrastructure, including their own Authoritative Domain Name Servers. On top of that, they should allow owners of the domains to change their Authoritative Domain Name Servers and are responsible for propagating this crucial information throughout the DNS protocol. Some of the most prominent Domain Name Registrars are:
* GoDaddy, United States
* Namecheap, United States
* IONOS, Germany
* OVHcloud, France
* Hostinger, Lithuania
* Alibaba Cloud, China

## Conclusion - who controls the Internet?

As we have learned, the Internet is a just a network of networks, but highly, highly complex one: **there is no single entity that controls it**.

At the top, sits ICANN/IANA. *Internet Corporation for Assigned Names and Numbers (ICANN)* is certainly one of the most influential: it oversees the Domain Name System, a critical component of the Internet, without which we would need to use numerical IP addresses instead of human-friendly and memorable domain names. *Internet Assigned Numbers Authority (IANA)*, which is a part of ICANN, manages IP addresses and Autonomous System Numbers allocation to particular regions of the world. Without IP addresses and Autonomous System Numbers, there would be no possibility of identifing devices on the Internet, nor would it be possible to connected independent networks, combination of which constitutes what we essentially call the Internet.

*Regional Internet Registries (RIRs)* have significant influence as well. There are five of them, managing different regions of the world. They get IP addresses and Autonomous System Numbers from IANA and can basically decide which Internet Service Providers and Data Centers have access to these critical resources, in their respective regions.

National governments and intergovernmental organizations also have significant influence over the Internet policies, especially when it comes to issues like cybersecurity, privacy, and Internet freedom. Government regulations can and do shape how the Internet is accessed and used within specific jurisdictions; it is not a secret that the Internet is partially censored by the government in some countries, like Iran, Russia and China for example. Governments can directly influence or outright control Internet Service Providers that function in the area of their control, banning certain domains or spying on their citizens. Unfortunately, there are regions of the world where this is happening at the large scale. Additionally, both ICANN and Regional Internet Registries are managed in the multistakeholder model and governments do have a say and influence there. There is clearly a tension between global governance, how the Internet should function as a whole, and national sovereignty: desire of many national governments to strictly control how the Internet functions and what is allowed there, within their territories.

Also worth mentioning, *Internet Engineering Task Force (IETF)* is responsible for developing and promoting Internet standards, particularly the standards that comprise the commonly used protocols (most notably TCP/IP). This includes defining protocols that govern data exchange over the Internet, making the IETF highly influential in terms of the Internet's technical functionality. Similarly, *World Wide Web Consortium (W3C)* also develops various standards, protocols and guidelines for the World Wide Web.

Altough not mentioned extensively here, large tech companies, including Internet Service Providers and Domain Registrars, exert enormous influence over the Internet through the services and platforms they provide and the infrastructure they control. Their ability to shape policies and opinions of both public and private entities, working in the Internet ecosystem, cannot be ignored. Companies like Google, Amazon, Meta, Apple, Microsoft, GoDaddy or Verisign have an outsized impact on how the Internet functions in practice.

Fortunately, there is no single entity that controls the Internet; there are multiple of them, cooperating with each other to various degree and at various level. There are and always be some issues with the Internet, especially where more corrupted governments and special interest groups try to have their way; but as a whole, it works surprisingly well. **Together, these diverse entities create one of the most complex, one of the most useful, but also one of the most disruptive technologies that humans have ever created: decentralized network of digital information and services that knows almost no physical boundaries.**

<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources
1. https://www.cloudflare.com/learning/security/glossary/what-is-bgp/
2. Oficial ICANN website: https://www.icann.org/
3. Jon Postel: https://internethalloffame.org/inductee/jon-postel/
4. https://root-servers.org/
5. https://en.wikipedia.org/wiki/DNS_root_zone
6. https://www.cloudflare.com/learning/network-layer/what-is-routing/
7. https://www.cloudflare.com/learning/network-layer/what-is-an-autonomous-system/
8. https://www.cloudflare.com/learning/dns/what-is-dns/
9. https://en.wikipedia.org/wiki/Net_neutrality
10. Internet censorship: https://en.wikipedia.org/wiki/Internet_censorship

</div>