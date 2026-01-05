---
{
    "title": "Bitcoin P2P Network: peer discovery, reachability and resilience",
    "slug": "bitcoin-p2p-network",
    "startedAt": "2025-03-21",
    "publishedAt": "2025-04-05",
    "excerpt": "<em>Peer-to-Peer (P2P) Networks</em> introduce a completely new set of challenges. In the traditional <em>Client-Server Architecture</em>, there is a server and client ... Things work completely differently in the <em>Peer-to-Peer (P2P) Networks</em>. These networks consist of equal peers that communicate directly with each other. Their goal is to be as decentralized as possible and not to have any single point of control or failure.",
    "researchLog": [ 2, 2, 1 ], 
    "writingLog": [ 2, 5, 2, 2.5, 3, 1.25, 3, 3.5, 0.5, 1, 1],
    "tags": ["networks", "deep-dive"]
}
---

*Peer-to-Peer (P2P) Networks* introduce a completely new set of challenges. In the traditional *Client-Server Architecture*, there is a server and client. Server has a known, rather static, and reachable by the client address; server does not need to be aware and reach its clients, clients connect to it. By doing that, they can get data and use various functionalities provided by the server, usually being totally dependent on it. Server is often controlled by a single entity, might be shut down at any point and clients cannot do anything about it. Most systems work in this model and they should: it scales well, is simple to implement and to reason about - as long as we can live with having a single point of control (company, foundation, institution or government). 

Things work completely differently in the *Peer-to-Peer (P2P) Networks*. These networks consist of equal peers that communicate directly with each other. Their goal is to be as decentralized as possible and not to have any single point of control or failure.

**The Bitcoin Network is one of the biggest and most decentralized P2P networks that has ever existed (it certainly is the most valuable).** The network has been successfully operating without a single point of control since 2009 (over 16 years at the time of writing). What is more, it has a real world utility, creating a *decentralized, neutral, censorship-resistant and permissionless monetary system with a limited supply, independent of any central authority*. We will use it as an example of a P2P network, comparing it sometimes to others (BitTorent, Tor) to analyze problems and solutions common to all networks of this dispersed and direct nature. Mostly, we will cover:
1. [Bootstrapping: how to join the network?](#bootstrapping-how-to-join-the-network)
2. [Reachability: where am I?](#reachability-where-am-i)
3. [Resilience: how hard is it to take us down?](#resilience-how-hard-is-it-to-take-us-down)
4. [Incentives: why should we care?](#incentives-why-should-we-care)
5. [Final thoughts](#final-thoughts)

## Bootstrapping: how to join the network?

In the *Client-Server Architecture*, clients connect to a well-known and reachable server. **When we communicate peer-to-peer, there is no server - only peers**; how can we discover them and join the network?

Options are rather limited:
1. manually configure known address/addresses - IP, domain name, [onion service](https://en.wikipedia.org/wiki/.onion) - of a peer or set of peers
2. get addresses of publicly available peers from some sort of centralized directory or directories - [Tor Directory Authorities](https://community.torproject.org/relay/governance/policies-and-proposals/directory-authority/), [BitTorrent Trackers](https://en.wikipedia.org/wiki/BitTorrent_tracker)
3. scan the network in search of available peers

Only the third method does not require any trust or dependency; unfortunately, it is not really feasible in practice. First of all, in most countries it is not legal to randomly scan the public internet to find software processes willing to accept connections; at the very least, it is quite resource-intensive - scanning all possible IPs and various ports - and certainly rude. First method relies on reputation - we have to get an address or addresses from someone/somewhere we trust. At the same time, it does not really scale; everybody is posed with the same problem of finding a source of trusted peers, over and over again. It is a good method to have as a backup, if all others fail, but it should not be the core of a bootstrapping solution. This leaves us with the second option - centralized directory/directories.

**In the Bitcoin Network, we do not rely on a single directory or entry point to join the network, but rather on a quite diverse set of publicly reachable and well-maintained nodes (peers).** There are *DNS Seeds and Seed Nodes*. How does it work?

[*DNS Seeds* are just DNS servers](/who-controls-the-internet-and-how-it-works.html#domain-name-system-dns) that return a list of IP addresses of publicly reachable and well-maintained nodes. Their addresses (domain names) are hardcoded into the Bitcoin Core source code; they are revised in each release and maintained by respected individuals in *the Bitcoin Community*. [At the time of writing, there were 9 of them](https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp#L142):
1. `seed.bitcoin.sipa.be` - Pieter Wuille
2. `dnsseed.bluematt.me` - Matt Corallo
3. `dnsseed.bitcoin.dashjr-list-of-p2p-nodes.us` - Luke Dashjr
4. `seed.bitcoin.jonasschnelli.ch` - Jonas Schnelli
5. `seed.btc.petertodd.net` - Peter Todd
6. `seed.bitcoin.sprovoost.nl` - Sjors Provoost
7. `dnsseed.emzy.de` - Stephan Oeste
8. `seed.bitcoin.wiz.biz` - Jason Maurice
9. `seed.mainnet.achownodes.xyz` - Ava Chow

When issuing a DNS query to any of these servers, we get IP addresses of reachable nodes:
```
dig seed.bitcoin.sipa.be

; <<>> DiG 9.18.30-0ubuntu0.22.04.2-Ubuntu <<>> seed.bitcoin.sipa.be
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 14304
;; flags: qr rd ra; QUERY: 1, ANSWER: 25, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 65494
;; QUESTION SECTION:
;seed.bitcoin.sipa.be.		IN	A

;; ANSWER SECTION:
seed.bitcoin.sipa.be.	3600	IN	A	<ip1>
seed.bitcoin.sipa.be.	3600	IN	A	<ip2>
seed.bitcoin.sipa.be.	3600	IN	A	<ip3>
seed.bitcoin.sipa.be.	3600	IN	A	<ip4>
seed.bitcoin.sipa.be.	3600	IN	A	<ip5>
seed.bitcoin.sipa.be.	3600	IN	A	<ip6>

;; Query time: 289 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: Wed Mar 26 19:47:41 CET 2025
;; MSG SIZE  rcvd: 449

```
Bitcoin node software then takes a few or all of these IPs and connects to peers, joining the network. **As there are 9 independent DNS seed servers, operated by different people, it is highly unlikely that they will all go down and not be available at the same time.** But, if such an event happens, there also are *Seed Nodes*.

*Seed Nodes* is a list of hard coded IP addresses of publicly reachable and well-maintained nodes. This is a backup strategy to join the network, used only if *DNS Seeds* do not work. This list is regenerated with each new release of Bitcoin Core using a [set of scripts](https://github.com/bitcoin/bitcoin/tree/master/contrib/seeds) and is compiled to [the chainparamseeds.h file](https://github.com/bitcoin/bitcoin/blob/master/src/chainparamsseeds.h). It also protects us from potential DNS problems and attacks, since seed nodes are referred to by the IP address, not domain name. Interestingly, there is also a set of peers with *onion service* addresses available through the Tor Network, if this is how we choose to join the network ([I2P](https://geti2p.net/) is also supported).

**Combination of 9 DNS seeds, returning lots of various IP addresses and controlled by different people, and seed nodes gives us as decentralized and resilient a way to bootstrap ourselves into the Bitcoin Network as it gets.** What is more, Bitcoin client supports setting/adding our own set of peers through a config file or command line parameters - in case we want to control the process, but also if all other strategies fail. At any point, people might share addresses of their or others publicly reachable nodes from which everybody can join the network. *Does it get more decentralized and resilient than this?*

Furthemore, Bitcoin node software does everything possible to minimize load on DNS seeds and seed nodes. First of all, **peers share other peer addresses with each other all the time**. As soon as our node joins the network, it learns other peer addresses from the peers it knows already. Additionally, it stores discovered peer addresses along their stats - availability, speed, reliability, misbehavior (ban score) etc. - and it prioritizes utilizing them rather than DNS seeds or seed nodes.

Summing it up, to join the Bitcoin Network:
* If we do not know any peers, we start with *DNS Seeds* that return IP addresses of publicly available and well-maintained peers (nodes)
* If all DNS seeds fail, we consult hardcoded (by IP addresses) *Seed Nodes*
* If for any reason this does not work as well, we can configure our own set of peers, taken from a website, social media, friend, trusted community member or received by any other communication channel
* Once we connect with at least one peer, we ask it about peers it knows and then try to connect to them, saving their addresses for future use. At any point, we might ask those new peers about other peers they know and repeat the process
* Discovered peers are always prioritized

**Thanks to this strategy, predefined DNS seeds and seed nodes are used only when absolutely necessary, which minimizes the load placed on them while maximizing the use of a discovered and variable set of peers.**

{{ .js: newsletterSignUpPostMid() }}

## Reachability: where am I?

Once we have joined the network, we are faced with another problem:
> How can we make ourselves reachable and useful to other peers?

**Two things are required:**
1. publicly reachable address
2. broadcasting it to other peers in the network 

\
In most cases, devices that are connected to our local area network (LAN) are not exposed to the internet as a whole. Our Internet Service Provider (ISP) usually gives us a modem/router - device through which all our personal devices are exchanging data with the internet, being at the same time hidden from it and not publicly reachable. **Because of this security model and [Network Address Translation (NAT)](https://en.wikipedia.org/wiki/Network_address_translation) mechanism, only our modem/router has an external/public IP address**; all devices connected to it have internal addresses, which are meaningful only in the local network, they are not recognizable and reachable from the outside. It is the router's job to translate requests and responses between our devices and the public internet; to make them available to a wider network, [port forwarding](https://en.wikipedia.org/wiki/Port_forwarding) is needed.

What port forwarding essentially does is telling the router to forward all data it receives on a given port to the particular device in our local network. For example, let's say that our external (router) IP address is `88.121.126.217` and the local address of our Bitcoin Node is `192.168.4.8:8333` (ip:port). We might set up port forwarding on the router to have the following rule:
> Forward all external traffic received on port 8333 to the device associated with 192.168.4.8 IP in the local network, port 8333.

Thanks to this, we made one of the devices in our local area network publicly available on port 8333, through the router.

**Port forwarding works, but the disadvantage is that our personal IP address is right now known to other peers.** What if we want to hide this information while still being publicly reachable?

Firstly, **we might host our node (peer) in the cloud where it will have a public IP address, treating it more like a server**. It goes against the principle of decentralization a little bit - Cloud Service Provider is a centralizing force - but it solves the problem. 

Secondly, **we might use Virtual Private Network (VPN) that supports port forwarding**. Then, it works similarly as with a router:
* we connect our node machine to one of the VPN provider servers
* this server has a public IP address 
* we configure port forwarding in our VPN provider software - all traffic will be forwarded to our local machine, through chosen VPN server, without revealing our true IP address

In this way, we still run and fully control software on our local machine but hide it and enhance its privacy using VPN provider infrastructure.

Thirdly, **we might run [Bitcoin Node on the Tor Network](https://github.com/bitcoin/bitcoin/blob/master/doc/tor.md)**. This network is isolated from the public internet, so our node will only be available and reachable on the Tor Network. It represents a different set of tradeoffs - we are hidden and anonymous but depend on the [Tor Project](https://www.torproject.org) and are only of service to the peers operating there.

Finally, once we have a publicly reachable address, there must be a way for other peers to discover it and connect to us. In the Bitcoin Network, it is automatically announced by the peers we connect with. As described, once we start the node, it connects to other nodes (peers), informing them about our address; since peers in the network constantly share addresses of peers known to them, it automatically gets propagated.

## Resilience: how hard is it to take us down?

Another dimension worth considering in P2P networks is their resistance to attacks. How hard is it to take the whole network down? What does it depend on?

Here are some important questions to ask:
1. How many nodes (peers) does the network have?
2. How distributed is the network?
    1. Are nodes controlled by a single or multiple entities? 
    2. Are they hosted in a single or multiple geographical regions?
    3. Are they hosted by just one or multiple Cloud/Infrastructure Providers; or mostly by individual people, on their own devices?
    4. Do nodes belong to one network (controlled by a single company/organization) or a multitude of them?
3. Are there any roles or hierarchy in the network? Are some nodes more important than others and can they be easily located and taken down, thus disrupting the whole network?

Using these queries, let's analyze the Bitcoin Network.

### How many nodes does the network have? {#resilience-how-many-nodes-does-the-network-have}

According to the popular [bitnodes service](https://bitnodes.io), *at the time of writing* there were:
* [21 960 publicly available nodes](https://bitnodes.io/nodes) 
    * `20 189 (92%)` are full nodes, serving the whole history of the blockchain, since its inception
    * surprisingly, most of them - `14 115 (64%)` - run on the Tor Network
    * the rest `7 845` are available on the public internet
* [62 725 all nodes](https://bitnodes.io/nodes/all) (most are not publicly reachable)

Publicly available full nodes are the most important; they store the whole history of the blockchain and accept incoming connections, thus helping others to bootstrap themselves into the network. We have over 20 000 of them - that is a huge number.

### How distributed is the network? {#resilience-how-distributed-is-the-network}

Let's analyze the distribution of over 20 000 publicly available full nodes. Starting with countries:
1. **14 115 (64.28%) nodes** - unknown countries (Tor Network)
2. **2 228 (10.15%) nodes** - United States
3. **1 303 (5.93%) nodes** - Germany
4. **553 (2.52%) nodes** - France
5. **396 (1.80%) nodes** - Finland
6. **379 (1.73%) nodes** - Canada
7. **341 (1.55%) nodes** - Netherlands
8. **279 (1.27%) nodes** - United Kingdom
9. **252 (1.18%) nodes** - Switzerland
10. **171 (0.78%) nodes** - Russia

That is a rather diverse set of geolocations - most of the nodes are on at least two continents and in multiple different countries (we do not know where exactly the Tor nodes are). What about networks? By network here we mean an [Autonomous System (AS)](/who-controls-the-internet-and-how-it-works.html#routing-solution-border-gateway-protocol-bgp) - single entity that owns a set of IP addresses, manages them on its own infrastructure and connects with other networks; it is identified by an *Autonomous System Number (ASN)*. Excluding 64% of nodes hidden behind the Tor Network, the rest is running on the following networks:
1. **894 nodes - Hetzner Online GmbH (AS24940)**, cloud service provider from Germany, operating in multiple countries
2. **423 nodes - GOOGLE-CLOUD-PLATFORM (AS396982)**, cloud service provider from the USA, operating in multiple countries
3. **423 nodes - OVH SAS (AS16276)**, cloud service provider from France, operating in multiple countries
4. **364 nodes - AMAZON-02 (AS16509)**, cloud service provider from the USA, operating in multiple countries
5. **314 nodes - COMCAST-7922 (AS7922)**, internet service provider from the USA
6. **254 nodes - DIGITALOCEAN-ASN (AS14061)**, cloud service provider from the USA, operating in multiple countries
7. **177 nodes - ATT-INTERNET4 (AS7018)**, internet service provider from the USA
8. **174 nodes - Contabo GmbH (AS51167)**, cloud service provider from Germany, operating in multiple countries
9. **143 nodes - Deutsche Telekom AG (AS3320)**, telecommunications company from Germany
10. **143 nodes - UUNET (AS701)**, Verizon, telecommunications company from the USA

Similarly to geolocations, this is an impressive diversity of various networks managed by companies from different countries, operating all around the world.

### Are some nodes more important than others? {#resilience-are-some-nodes-more-important-than-others}

In the Bitcoin Network, we essentially have two roles: nodes - analyzed so far - and miners. In a nutshell:

> Miners solve cryptographic puzzles - [performing Proof of Work (PoW)](https://en.wikipedia.org/wiki/Proof_of_work) - and mine new blocks approximately every ten minutes. Each block contains transactions collected and broadcast by nodes. By mining a block, miners earn a block subsidy - currently 3.25 BTC, decreasing over time - along with transaction fees from the included transactions.
> 
> Nodes propagate transactions and new blocks while verifying that they follow Bitcoin's consensus rules (no double-spending, 21 million supply cap, expected block subsidy etc.).
>
> Miners expend resources on mining new blocks to earn BTC.

For the network to function fully, both nodes and miners are necessary, with their roles being complementary. **While both are crucial, one could argue that nodes play a more foundational role; they propagate transactions, validate new blocks and store the entire history of the Bitcoin blockchain.** If all miners were to disappear overnight, no new transactions would be added to the blockchain, as mining new blocks is the only way to include them. However, the current state of the network would be fully preserved by nodes. Once new miners emerged, which given the profitability of mining is bound to happen, the network would resume its regular operations.

**This is why we do not analyze the resilience of miners here: miners are profit-driven entities and their primary incentive is to remain fully operational, mining as frequently and efficiently as possible.**

Considering nodes then, in the Bitcoin Network there is no hierarchy - there just are nodes that propagate and validate transactions and blocks, exchanging data with each other. Almost: there are *DNS Seeds and Seed Nodes*.

These components are crucial to bootstrap new peers into the network. **Fortunately, as described previously, there are lots of them - currently nine DNS servers and hundreds of seed nodes - and they are operated by various people and companies.** Additionally, they are used only to bootstrap new peers into the network - running nodes prioritize peers that they have discovered through other peers. What is more, there is a backup strategy of configuring our own seed nodes that we might obtain through any possible communication channel - it is thus highly unlikely that operations of the Bitcoin Network could be seriously disrupted by attacking DNS seeds or seed nodes.

### Resilience summary

To take down the Bitcoin Network, all or almost all nodes would have to cease to function. Then, transactions are no longer propagated, remaining few nodes (peers) cannot discover each other and the transaction history is potentially lost. On top of that, miners would need to stop their operations permanently, even though it is a rather profitable activity.

**At present, there are over 20 000 publicly available full Bitcoin Nodes, storing the whole Bitcoin history since its inception**. They are spread across many continents and countries, controlled and run by a multitude of independent individuals and companies, hosted on a variety of networks. 

It is safe to say that at this point, the network is as distributed as it gets and is practically impossible to be taken down.

## Incentives: why should we care?

For the sustainability of a P2P network, motivation and incentives are something of crucial importance. Essentially, why should peers (we) care to spend resources on running software and supporting the network?

On the BitTorrent Network, people exchange files with each other. Peers that download (consume) more than they upload (produce) are deprioritized and penalized; as a result, their consumption is limited. It thus incentives peers to share data and make themselves available to the network, if they want to use it as well.

On the Tor Network, there is no direct compensation for helping the network - it relies mainly on ideological support of people and institutions that support internet privacy and anonymity and are willing to spend their resources on it. The network has been running since 2002 (for 23 years) and has proven resilient, though it remains to be seen whether this support model is enough to maintain the project as it continues to scale.

**On the Bitcoin Network, there are strong economic and ideological incentives to support the network.** People run nodes because they own significant amounts of bitcoin and/or have businesses that rely on it. It is then in their self-interest to run nodes because without independent nodes there is no Bitcoin Network; if there is no network, assets of those individuals and companies are essentially worthless. Running a node ensures they can verify transactions independently, enhancing the security and reliability of their holdings while simultaneously strengthening the network. Many people also run nodes because they genuinely care about the Bitcoin idea: *decentralized, neutral, censorship-resistant and permissionless monetary system with a limited supply, independent of any central authority*. For miners, the incentives are even more direct - mining is a competitive business where rewards come from newly mined bitcoin and transaction fees. As Bitcoin’s value increases, so does the profitability of mining.

## Final thoughts

As we have seen, there are many challenges to overcome in the *Peer-to-Peer* networks that do not exist in the traditional, centralized *Client-Server* approach. Mainly:
1. **Bootstrapping** - how to find first peers and join the network?
2. **Reachability** - how to make oneself reachable and useful to other peers?
3. **Resilience** - how to make sure that the network is resilient to random attacks, since all peers are public? 
4. **Incentives** - why should peers care to run software and spend resources to serve other peers?

\
**The Bitcoin Network is arguably one of the biggest and most decentralized P2P networks that has ever existed.** Certainly it is the most valuable one, with the mission of creating a completely new monetary system that does not depend on any central authority. It solves explored P2P network problems in the following way:
1. **Bootstrapping** - it has a diverse set of *DNS Seeds and Seed Nodes*, controlled by various independent people and companies. Additionally, once in the network, peers constantly exchange addresses of discovered peers, making themselves known to others thus reducing reliance on common seeds as much as possible. Finally, every peer can configure their own set of trusted *Seed Nodes* by hand (obtained by any possible communication channel), in case everything else has failed
2. **Reachability** - peers must make themselves publicly available  - by having an IP or [Tor](https://community.torproject.org/onion-services/) address. It does not need to be static, as peers announce each other when connecting to other peers, but frequent changes might reduce connectivity. As discussed, there are many ways to make node publicly reachable: port forwarding on the local network, using VPN that supports port forwarding, running node on the Tor Network or just hosting it in the cloud, where it gets static and reachable IP
3. **Resilience** -  the Bitcoin Network is extremely distributed; at the time of writing, there were over *20 000 publicly reachable full nodes*, running on various hardware, operating systems, infrastructures and networks; located in different countries and controlled by a variety of individuals and companies. Additionally, the Bitcoin Community is paranoid about security and the Bitcoin Core (reference node software implementation) undergoes rigorous security audits all the time
4. **Incentives** -  there are both strong economic and ideological reasons to run nodes. More and more individuals and companies store a significant portion of their wealth in Bitcoin, existence and security of which depends on having a diverse and numerous set of publicly available full nodes. On top of that, lots of people genuinely care about the Bitcoin mission

\
By overcoming all these hard problems of P2P networking and operating successfully for over sixteen years with near 100% uptime, **Bitcoin has proven that once proper design and incentives are 
in place, it is possible to create a fully decentralized network that no single entity can control and that is pretty much impossible to take down**.

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. About the Bitcoin P2P Network:
    1. https://en.bitcoin.it/wiki/Satoshi_Client_Node_Discovery
    2. https://en.bitcoin.it/wiki/Network
    3. https://developer.bitcoin.org/devguide/p2p_network.html
    4. https://inria.hal.science/hal-03380595/file/brains2021_Bitcoin_P2P_network_study.pdf
2. I know that Tor is not *strictly* a P2P network, but it certainly shares many features of such a network. Its core - relays and bridges - comes in large numbers and the communication between them and clients is direct and distributed. More interesting things about Tor:
    1. https://community.torproject.org/relay/
    2. https://bridges.torproject.org/
    3. https://community.torproject.org/onion-services/
3. Reachability is considered separately because, in P2P networks, it is not so obvious that all (many) participants should be publicly reachable. Especially since some protocols, [WebRTC](https://webrtc.org) for example, rely on centralized components to get around NAT limitations: https://en.wikipedia.org/wiki/Hole_punching_(networking)
4. Interesting threads about finding peers in P2P networks:
    1. https://stackoverflow.com/questions/310607/peer-to-peer-methods-of-finding-peers
    2. https://bitcoin.stackexchange.com/questions/2027/how-does-the-bitcoin-client-make-the-initial-connection-to-the-bitcoin-network/
5. https://raghavsood.com/blog/2018/05/20/demystifying-peers-dat/
4. What the Sybil attack is: https://en.wikipedia.org/wiki/Sybil_attack. Bitcoin Core employs a variety of mechanisms to keep peers as diverse as possible, decreasing likelihood that they are controlled by a single and possibly malicious entity; recently, there has been an effort to diversify Autonomous Systems to which connected peers belong: https://asmap.org
5. The Invisible Internet Project (I2P): https://geti2p.net/en/about/intro. In many ways, it is a Tor alternative, also supported by the Bitcoin Core
6. DNS hijacking: https://en.wikipedia.org/wiki/DNS_hijacking. This is one of the reasons why we are better off that Bitcoin largely uses IP addresses, not domain names (with *DNS Seeds* exception)
7. Possible Bitcoin weaknesses and attack vectors: https://en.bitcoin.it/wiki/Weaknesses
8. Proof of Work (PoW), the foundation of Bitcoin: https://en.wikipedia.org/wiki/Proof_of_work

</div>
