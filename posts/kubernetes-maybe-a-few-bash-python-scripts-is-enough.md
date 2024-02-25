---
{
    "title": "Kubernetes: maybe a few Bash/Python scripts is enough",
    "slug": "kubernetes-maybe-a-few-bash-python-scripts-is-enough",
    "publishedAt": "2024-03-03",
    "startedAt": "2024-02-24",
    "timeToRead": "29 minutes",
    "wordsCount": 3636,
    "excerpt": "Do you really need to deal with all this Kubernetes complexity?",
    "researchLog": [ 5, 3, 3 ],
    "writingLog": [ 2, 1.5, 2, 2.5, 0.5, 4 ]
}
---

## What do we want from Infrastructure

When it comes to an infranstructure, there are characteristics that are universally needed, no matter the project nature, and some that are optional, or useful only in *some* projects and contexts. Coming from a posion of knowing what we *actually* need, being aware of our project context, we can make more informed decisions and reduce the complexity of our system, which is something that we should care about a lot.

So, what do we mostly need, when it comes to our system infrastructure?

### Required, must haves
1. Fast and reliable builds of our applications/artifacts/libraries
2. Fast and reliable deployments of applications to various environments (like dev, stage, prod), with zero downtime for some of them, when and if it is needed - including an ability to quickly rollback failed deployment
3. Trace of at least recent deployments history - what version are we currently running of a given app?
4. Straightforward way to configure our apps: resources that they need (mostly memory and cpu), configuration parameters/environments variables, static files, secrets, number of instances and so on
5. Possibility of *manually* scaling our appplications - either through increasing number of instances or just scaling verticaly, by increasing resources of a single instance
6. Closed, private network (aka Virtual Private Cloud), so that applications can talk to each other in both more secure and performant way (even if we have more than one app, we usually have a database - unless we run everything on a single, big machine of course)
7. If we have multiple applications running on multiple machines - we need to have some kind of service discovery, where we can call other services by private host/domain, rather that hardcoded ip address (amazing.service.local:8080, not 10.0.2.1:8080)
8. **As much as possible Infrastructure as Code** - so there is no magic, we have up to date documentation (source code), and most importantly - we can recreate our infrastructure from scratch, at any point, with minimal effort, in mostly automated way
9. Backups of important data and an simple way to restore them
10. Easy way to look up application logs - both current and historical (for a reasonable time period)
11. Basic metrics of all running components and machines: things like memory and cpu usage, load average, used disk space and I/O operations, network bandwidth etc.
12. Metrics visualization and alerts - to know that something is about to go into a wrong direction, as fast as possible

### Optional, nice to haves
1. *Automatic scaling of applicatons* to less/more instances based on current system load or some other, arbitrary criteria (I find that's rarely needed and when it is, it is only for a specific application which can be hand-coded or delegated to external services like AWS lambda + it's not that easy)
2. Automated application deployment scheduling to whatever machine is the most suitable - in 90%+ cases specyfing machine explicitly is enough, unless you have tens of services and each of them needs automatic, horizontal scaling which is rarely the case
3. Isolated workspaces/resources per team - if you have more than a few teams
4. Canary releases - to be honest, in most cases they can be replaced by plain-old feature flags, implemented in application

### Reasoning and assumptions
Some of the choices might seem quite arbitrary, so a few words of comment might be useful. I make a few assumptions:
* <a href="/modular-monolith-and-microservices-modularity-is-what-truly-matters.html">*Most* systems can be built with only one (modular monolith) or just a few deployment units</a> - this significantly simplifies our infrastructure
* Most systems can be built by one or a few teams - this also simplifies our infrastructure; we do not need to have elaborate resources and workspaces isolation for example
* Many systems have quite predictable resources requirements - it can vary, but not to a point that would justify a need to have automated horizontal scaling for example. Also, it can be known in advance, where/when and how we can change this resources in manual or semi-automatic way (automatic being actually not that much harded)
* We should judge system complexity holistically - if applications are simple, but infrastructure is quite complex, we still have a complex system that needs a lot of maintenance; just from a different person/team/departament/company
* Containers are amazing abstraction: they improve security, dependencies management and processes isolation to a great degree - in most cases that is all we need, we do not need another layer, two or three of abstraction (what is the purpose of this rant exactly?)
* As will be decribed below, Kubernetes besides being complex, needs a lot of additional to make it usable - custom scripts/tools are often easier to write, understand and maintain 

These are my observations, coming not only from personal, direct experience, but also from talking to others and analyzing their problems and work. In general, I would argue that many, if not most, systems that we create these days are highly overengineered and would benefit greatly from simplification. If you do not share that sentiment, you might come to a different conclusion. Having stated that, let's see how Kubernetes stakes up against these requirements.

## Kubernetes - why so much Complexity?

It will soon be clear why Kuberentes is so complex: it tries to solve basically all theoretically possible infrastructure problems in the most abstract and configurable way posssible. But what exactly is Kubernetes?
> Kubernetes is a container orchestration platform. It allows to automatically deploy, scale and manage containerized applications. 
> 
> To put it differently: it is a sophisticated container scheduler. You need to set it up on a set of machines (cluster). Once you have it, you can define your application as a set of Kubernetes objects and Kubernetes will take care of the rest. The rest means deploying it to a node (machine) or nodes with enough available resources, scale it to required number of instances, restarting if it is not healthy, making it available to other applications in the cluster or to an external word, if that is what we need.
>
> Virtually everything is configurable and dynamic. It is possible to have variable numbers of nodes (machines) that make up a Kubernetes cluster, for example; it is also possible to have dynamic number of replicas for some or all applications, depending on their cpu/memory usage or any other criteria. 

For all these features we pay high price: Complexity. Kubernetes is a complex beast. It is mostly so, because it delivers soo many features; to allow for that many, many abstractions are needed. There are many new concepts to be learned. Additionaly, despite the fact that there are many managed Kubernetes services (list them) that make operating a Kubernetes cluster, it still needs to be learned and configured properly. Managed services just easy the burden of setting up the cluster ourselves and make it easy to maintain, but it does not take away the fact that we need to learn it. By we I mean mostly DevOps person/people/team, but also to some extend developers, because they will be the ones who will configure and deploy applications (or at the very least they should be). 

// Maybe should give an example of an Kubernetes object/objects defined in yaml
// What about a note touching on declarative approach complexity?
To make it less abstract, let's say what we have...

Additionally, Kubernetes itself is not enough to solve all our infrastructure problems. We still need to have additonal tools and scripts to build, package and deploy our apps. Once we have a Kubernetes cluster, which itself is not an easy task, we just have *an ability* to deploy something. We then need to at least figure out:
* Where and how to store our Kubernetes objects? In most cases, the answer is a git repo
* How to synchronize the state of Kubernetes objects between git repo and a cluster? We need yet another tool for that
* In the Kubernetes context, an application is just a set of Kubernetes objects. We need to answer: how are we going to package and deploy those objects as a single unit? Unfortunately, we need yet another tool for that

Unfortunately, Kubernetes is not a complete platform for what it claims to be; we need additional tools to make it easy to use day-to-day. That of course means even more complexity. This is an important factor to keep in mind when evaluating whether a set of custom scripts and tools to build and deploy (Docker) Containers is really that complex.

Is this complexity worth paying the price? As with everything, it depends. If we have tens of tens and hudreds of services, the most likely yes (why we have so many?). In most cases though, our system can be compromised of one or just a few deployment units - if you still do not agree, I encourage you to read <a href="/modular-monolith-and-microservices-modularity-is-what-truly-matters.html">this article and its references</a>.
Knowing that in 90%+ Kubernetes is an overkill, the question remains: what is the alternative?

## Simpler Bash/Python scripts and tools based approach

What if our system is just a modular monolith with a single database, or we have a few services with a few databases (as most system can and should be build - <a href="https://en.wikipedia.org/wiki/KISS_principle">KIIS</a>)? In that case, we do not need to have Kubernetes, we can get away with much simpler, and cheaper approach.

What we fundamentally need is:
* to have one - few virtual machines, where we can run containerized applications
* have an easy way to deploy our containerized applications there
* have a few services/tools to monitor our application/applications, have access to their logs
* if we have more than one application and they communicate over the network - have some way of allowing it

Basically what we can do:
* have a few VPS's (Droplets from Digital Ocean for example) with the same automated setup - same user, ssh access, docker installed, maybe node exporter for Prometheus for example + our tools like Metrics and Logs Collector


## Tradeoffs, when to use what

For many simple project and certainly for Minimal Viable Products, I would argue that in 90%+ cases, we can start with a Single Machine. Especially considering...

TODO:
* fast scaling -> load balancer


If you can not any more, with only a few modifications, we can make it work on a few machines that should be enough for a long (forever?) time.

?? Is there an objective case like that ??

## Summing it up

That was an interesting journey!

Maybe here is a good place to extend on things like (if not convered elsewhere):
* how to generate, store and distribute secrets
* how to collect logs and metrics; how to have access to them
* file-based service-discover, if needed
* accidental vs essential complexity
* ssh/firewalls/network security
* bursty requirements - either serveless or custom solution that's extremely elastic in scaling


Stay tuned for more!

## TODO

* horizontal auto scaling - something sometimes needed vs always (mostly) needed
* build/local machine objection
    * not audible - depends if you needed it
    * I need to clone all my repos - yeah, but you also need to setup CI/CD pipeline for every repo that you have
* complexity
* logs - kubernetes also doesn't solve it by itself, we need to configure it and use external tools
* tags dates in scripts examples!
* same with updates/metrics etc - still there a need for quite elaborate configuration
* what most systems need - simple infra
* scaling do you always/how need it
* does kubernetes work out of the box - need for additional tools
* containers are enough - do we really need to orchestrate them?
* /etc/hosts is probably enough, we don't need more than a few (3 - 5) machines in most cases (https://superuser.com/questions/750444/difference-between-dns-and-etc-hosts-in-name-resolving-during-an-https-request)
    * load balancing? Custom tool?
    * maybe just a map of "emitter": ['machine-1:8089', 'machine-2:9090']
    * https://www.solo.io/topics/microservices/microservices-service-discovery/
    * each node -> nginx -> process that updates "upstreams"
    * dns / ip-tables magic / separate process / client-side logic
* multi regions?
* Simple Approach scaling limitations - how to overcome them?
    * if every app has fixed target (machine) in its config - that's not possible, we need another approach
    * another approach: how to get available resources and num of containers? Then decide based on that
* assumptions
    * a few machines with the same setup on each
    * manual scheduler in the code (machines has assigned apps)
    * each app should have limits defined (request also? can build tools around that!)
* autoscaling/targeting
  * code as a source of truth
  * "However, if every machine has a well defined function, and you don't plan to scale arbitrarily, then it can be more trouble than it's worth. Automate with some ansible, terraform, docker compose or anything else you would like."
* "So when you deploy something to kubernetes, you deploy it to the cluster, and the k8s scheduler will decide which computer to run your containers on (or you can still specify which server should get the container and the scheduler will make sure that happens.)"
* more on those reverse proxy things
    * https://prometheus.io/docs/guides/file-sd/
    * https://prometheus.io/docs/prometheus/latest/storage/
* modular approach in the article: what features are mostly needed, what we can replaced, what's optional etc.

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. ?

<div class="article-delimiter">---</div>

### Notes and resources

1. I plan to write/make a video about how much a single machine can handle - stay tuned for that ;)
1. https://thenewstack.io/how-kubernetes-is-transforming-into-a-universal-scheduler/
2. https://medium.com/@radenfajrus/simple-canary-deployment-with-openresty-nginx-for-small-application-7aae77aaf97a
3. https://www.digitalocean.com/community/tutorials/an-introduction-to-haproxy-and-load-balancing-concepts
4. https://cloudnativenow.com/features/3-ways-to-offset-kubernetes-complexity/
5. https://cloudplane.org/blog/why-kubernetes-is-so-complex
6. https://github.com/simplenetes-io/simplenetes
7. https://www.ufried.com/blog/simplify_15_summing_up/
8. https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables
9. https://docs.digitalocean.com/products/networking/vpc/how-to/configure-droplet-as-gateway/
10. OSS is not for free: https://www.ufried.com/blog/oss_2_misconceptions/
11. https://signalvnoise.com/svn3/the-majestic-monolith/
12. https://www.youtube.com/watch?v=4Wa5DivljOM
13. https://getdeploying.com/reference/data-egress
14. https://docs.podman.io/en/stable/markdown/podman-save.1.html
15. https://www.ufried.com/blog/continuous_amnesia_issue/
16. https://paperswelove.org/
17. https://cloudplane.org/blog/why-kubernetes-is-so-complex
18. https://erkanerol.github.io/post/complexity-of-kubernetes/
19. https://whyk8s.substack.com/p/why-not-dns
20. https://www.it-labs.com/why-is-kubernetes-more-than-a-container-orchestration-platform/
21. Good or bad? https://www.cncf.io/
22. https://www.reddit.com/r/homelab/comments/ag10jg/haproxy_vs_nginx_vs_others_for_a_reverse_proxy/
23. https://reverseproxy.com/docs/comparison/nginx-vs-haproxy/
24. https://romanglushach.medium.com/kubernetes-networking-load-balancing-techniques-and-algorithms-5da85c5c7253
25. https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/
26. https://www.cloudways.com/blog/horizontal-vs-vertical-scaling/#:~:text=Fewer%20Changes%3A%20Vertical%20scaling%20is,resources%2C%20just%20upgrading%20existing%20ones.
27. https://docs.gitlab.com/ee/user/packages/generic_packages/index.html
28. https://endler.dev/2019/maybe-you-dont-need-kubernetes/
30. https://en.wikipedia.org/wiki/You_aren't_gonna_need_it
31. https://forum.freecodecamp.org/t/explain-to-me-like-im-five-kubernetes-and-infrastructure-as-code/353222/3
32. https://www.youtube.com/watch?v=4MEKu2TcEHM