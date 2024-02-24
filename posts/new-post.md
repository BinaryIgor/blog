---
{
    "title": "Kubernetes: maybe a few Bash/Python scripts is enough",
    "slug": "kubernetes-maybe-a-few-bash-python-scripts-is-enough",
    "publishedAt": "2024-03-02",
    "startedAt": "2024-02-24",
    "timeToRead": "17 minutes",
    "wordsCount": 2109,
    "excerpt": "Do you really need to deal with all this Kubernetes complexity?",
    "researchLog": [ 5, 3, 3 ],
    "writingLog": [ 2 ]
}
---

## What do we want from Infrastructure

When it comes to an infranstructure, there are characteristics that are universally needed, no matter the project nature, and some that are optional, or useful only in *some* projects and contexts. Coming from a posion of knowing what we *actually* need, being aware of our project context, we can make more informed decisions and reduce the complexity of our system, which is something that we should care about a lot.

So, what do we mostly need, when it comes to our system infrastructure? I would say that:
1. Fast and reliable builds of our applications/artifacts/libraries
2. Fast and reliable deployments of applications to various environments (like dev, stage, prod), with zero downtime for some of them, when and if it is needed - including an ability to quickly rollback failed deployment
3. Trace of at least recent deployments history - what version are we currently running of a given app?
4. Straightforward way to configure our apps: resources that they need (mostly memory and cpu), configuration parameters/environments variables, static files, secrets, number of instances and so on
5. Possibility of *manually* scaling our appplications - either through increasing number of instances or just scaling verticaly, by increasing resources of a single instance
6. Closed, private network (aka Virtual Private Cloud), so that applications can talk to each other in both more secure and perfomant way (even if we have more than one app, we usually have a database - unless we run everything on a single, big machine)
7. If we have multiple applications running on multiple machines - some kind of service discovery, where we can call other services by private host/domain, rather that hardcoded ip address (amazing-service.local:8080 vs 10.0.2.1:8080)
8. **As much as possible Infrastructure as Code** - so there is no magic, we have up to date documentation (source code), and most importantly - we can recreate the Infrastructure from scratch, at any point, with minimal effort, in mostly automated way
9. Backups of important data and an easy way to restore them
10. Easy way to look up application logs - both current and historical (for a reasonable time period)
11. Basic metrics of all running components and machines: things like memory and cpu usage, load average, disk space and I/O, network bandwidth etc.
12. Metrics visualization and alerts, to know that something is about to go into a wrong direction

Things that I consider mostly optional, nice to have, used far less often than the previous ones:
1. *Automatic scaling of applicatons* to less/more instances based on current system load or some other, arbitrary criteria (I find that's rarely needed and when it is, it is only for a specific application which can be hand-coded)
2. Automated application deployment scheduling to whatever machine is the most suitable - in 90%+ cases specyfing machine explicitly is enough, unless you have tens of services 
3. Isolated workspaces/resources per team - if you have more than a few teams
10. Canary releases - to be honest, in most cases they can be replaced by plain-old feature flags, implemented in application


\
Some of the choices might seem quite arbitrary, so a few words of comment might be useful.


## Kubernetes - why bother with so much Complexity?

What actually is Kubernetes? What problems does it try to solve? Here is my definition:
> Kubernetes is a container orchestrator/scheduler.

Kubernetes is a complex beast. It is mostly so, because it delivers soo many features; to allow for that, many (too many) abstractions are need. 

* multi-cloud: do we really need it? How often?


## Why an alternative solution might make sense

Lots of accidental complexity that we don't need...

* complexity
* vendor-lock in 
* abstractions...

## Simpler Bash/Python scripts and tools based approach

As we know what non-negotiable things we need, we can try to come up with solutions.

## One machine

For many simple project and certainly for Minimal Viable Products, I would argue that in 90%+ cases, we can start with a Single Machine. Especially considering...

TODO:
* fast scaling -> load balancer


If you can not any more, with only a few modifications, we can make it work on a few machines that should be enough for a long (forever?) time.

## A few machines

Let's say that we can not work on a single machine anymore. We would like to maintain the simplicity <a href="#one-machine">the previous approach</a>, but clearly it is not enough anymore. How can we do this?

## Lots of machines

Finally, we arrived at the point that even having a few machines (are you sure?) it is not enough. Or maybe our system's load is quite bursty and dynamic; in any case, we need something else.

##  When it might be wise do use things of Kuberentes complexity

?? Is there an objective case like that ??

## Summing it up

That was an interesting journey!



## TODO

* build/local machine objection
    * not audible - depends if you needed it
    * I need to clone all my repos - yeah, but you also need to setup CI/CD pipeline for every repo that you have
* complexity
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