---
{
    "title": "Load Testing: how many HTTP requests/second can a Single Machine handle?",
    "slug": "how-many-http-requests-can-a-single-machine-handle",
    "publishedAt": "2024-03-28",
    "excerpt": "When designing systems and deciding on the architecture, I often hear justifying the use of <em>microservices</em> and other complex solutions because of the predicted <em>performance</em> and <em>scalability</em> needs. Out of curiosity then, let's test the limits of an extremely simple approach, the simplest possible one.",
    "researchLog": [ 1.5 ],
    "writingLog": [ 2, 2, 1, 2, 2.5, 2, 1 ]
}
---

When designing systems and deciding on the architecture, I often hear justifying the use of *microservices* and other complex solutions because of the predicted *performance* and *scalability* needs. Out of curiosity then, let's test the limits of an extremely simple approach, the simplest possible one. **Let's test a single instance of an application, with a single instance of a database, deployed to a single machine, and answer the question**:
> How many HTTP requests per second can a Single Machine handle?

## Tests setup

To resemble real-world use cases as much as possible, [we have the following](https://github.com/BinaryIgor/code-examples/tree/master/single-machine-tests):
* Java 21-based REST API built with Spring Boot 3 and using Virtual Threads
* PostgreSQL as a database, loaded with over one million rows of data
* External volume for the database - it does not write to the local file system (we use [DigitalOcean Block Storage](https://docs.digitalocean.com/glossary/block-storage/))
* Realistic load characteristics: tests consist primarily of read requests with approximately 20% of writes. They call our REST API which makes use of the PostgreSQL database with a reasonable amount of data (over one million rows)
* *Single Machine* in a few versions:
    * 1 CPU, 2 GB of memory
    * 2 CPUs, 4 GB of memory
    * 4 CPUs, 8 GB of memory
* Single [LoadTest.java](https://github.com/BinaryIgor/code-examples/blob/master/single-machine-tests/load-test/LoadTest.java) file as a testing tool - we run it on *4 test machines*, in parallel, since we usually have many http clients, not just one
* Everything built and running in Docker
* [DigitalOcean](https://digitalocean.com) as our infrastructure provider

\
Whole infrastructure setup is automated by one Python script; it is extremely easy to run:
```
bash setup_python_env.bash
source venv/bin/activate
export DO_API_TOKEN=<your DigitalOcean API token>
export SSH_KEY_FINGERPRINT=<your ssh key fingerprint uploaded to DigitalOcean; it gives access to created machines>
python3 prepare_infra.py <machine size: small, medium, large>
```

\
In the database, we have one table with the following schema:
```
CREATE TABLE account (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version BIGINT NOT NULL
);

CREATE INDEX account_name ON account(name);
```
We call `POST: /accounts/generate-test-data` endpoint to generate `random 1_250_000 rows` of it.

`LoadTest` calls the following endpoints:
```
GET: /accounts/{id}
GET: /accounts/count?name={name}
// randomly executes either insert or delete
POST: /accounts/execute-random-write
```
For `GET: /accounts/{id}`, we will see some responses with 404 status as we sometimes try to GET nonexistent accounts.

To make it even more realistic, there is a simple security mechanism.
For all requests, we require a secret value in the query string ([SecurityFilter.java](https://github.com/BinaryIgor/code-examples/blob/master/single-machine-tests/single-app/src/main/java/com/binaryigor/single/app/SecurityFilter.java)):
```
...
// Keep in sync with LoadTest!
private static final String SECRET_QUERY_STRING = "17e57c8c-60ea-4b4a-8d48-5967f03b942c";
private static final Logger log = LoggerFactory.getLogger(SecurityFilter.class);

...

var authorized = Optional.ofNullable(httpRequest.getQueryString())
  .map(q -> q.contains(SECRET_QUERY_STRING))
  .orElse(false);

if (authorized) {
  // pass
} else {
  log.warn("Somebody tried to poke around! Their request:");
  log.warn("Method: {}, url: {}, query: {}", httpRequest.getMethod(), httpRequest.getRequestURI(), httpRequest.getQueryString());
  var httpResponse = (HttpServletResponse) response;
  httpResponse.setStatus(404);
  httpResponse.getWriter().write("Don't know anything about it");
}
...
```

\
Having all these details in mind, let's run some tests and examine the results!

## Test results

**All tests were run on 4 test machines, in parallel, with 2 CPUs and 2 GB of memory**, on the DigitalOcean infrastructure. Most tests took ~ 15 seconds: every second, for 15 seconds, a certain number of requests was issued.

Tests were mainly executed in four profiles:
* **low_load**: 20 requests per second - 4 machines x 5 RPS
* **average_load**: 200 requests per second - 4 machines x 50 RPS
* **high_load**: 1000 requests per second - 4 machines x 250 RPS
* **very_high_load**: 4000 requests per second - 4 machines x 1000 RPS

To test *sustained load* and see whether we experience a performance degradation, I have also run a few *long variations* of these profiles for ~ 10 minutes: every second, for 600 seconds, a certain number of requests was issued.

[All test results](https://github.com/BinaryIgor/code-examples/tree/master/single-machine-tests/load-test-results) shown below come from 1 test machine. Therefore, we need to multiply the request rate by 4, as tests were always run on 4 machines in parallel.

### Small machine - 1 CPU, 2 GB of memory

**low_load**: not worth showing, since average load performed so well.

**average_load**:
```
...

750 requests with 50 per second rate took PT15.303S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 750, with 50/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.002 s
Max: 0.153 s
Mean: 0.01 s

Percentile 10: 0.003 s
Percentile 25: 0.004 s
Percentile 50 (Median): 0.007 s
Percentile 75: 0.012 s
Percentile 90: 0.019 s
Percentile 95: 0.029 s
Percentile 99: 0.06 s
Percentile 999: 0.153 s

...

POST: /accounts/execute-random-write
Requests: 138, which is 18% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=138}

...

GET: /accounts/{id}
Requests: 324, which is 43% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=152, 200=172}

...

GET: /accounts/count?name={name}
Requests: 288, which is 38% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=288}

...
```

To check whether performance does not decrease over time, I have also run an **average_long_load** test:
```
...

30000 requests with 50 per second rate took PT10M0.605S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 30000, with 50/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.0 s
Max: 0.11 s
Mean: 0.002 s

Percentile 10: 0.001 s
Percentile 25: 0.002 s
Percentile 50 (Median): 0.002 s
Percentile 75: 0.003 s
Percentile 90: 0.004 s
Percentile 95: 0.005 s
Percentile 99: 0.008 s
Percentile 999: 0.016 s

...

POST: /accounts/execute-random-write
Requests: 6050, which is 20% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=6050}

...

GET: /accounts/{id}
Requests: 11940, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=5972, 200=5968}

...

GET: /accounts/count?name={name}
Requests: 12010, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=12010}

...
```
As we can see, no issues there.


\
**high_load**:
```
...

3750 requests with 250 per second rate took PT15.371S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 3750, with 250/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.001 s
Max: 0.2 s
Mean: 0.013 s

Percentile 10: 0.003 s
Percentile 25: 0.005 s
Percentile 50 (Median): 0.009 s
Percentile 75: 0.017 s
Percentile 90: 0.026 s
Percentile 95: 0.034 s
Percentile 99: 0.099 s
Percentile 999: 0.157 s

...

POST: /accounts/execute-random-write
Requests: 753, which is 20% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=753}

...

GET: /accounts/{id}
Requests: 1483, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=750, 200=733}

...

GET: /accounts/count?name={name}
Requests: 1514, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=1514}

...
```

\
**very_high_load** - this is where a small machine reached its limits, we got many timeouts:
```
...

15000 requests with 1000 per second rate took PT25.557S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 15000, with 1000/s rate
Requests with connect timeout [5000]: 4215, as percentage: 28
Requests with request timeout [5000]: 7730, as percentage: 51

Min: 0.007 s
Max: 5.052 s
Mean: 4.413 s

Percentile 10: 1.861 s
Percentile 25: 4.999 s
Percentile 50 (Median): 5.0 s
Percentile 75: 5.0 s
Percentile 90: 5.001 s
Percentile 95: 5.001 s
Percentile 99: 5.012 s
Percentile 999: 5.037 s

...

POST: /accounts/execute-random-write
Requests: 2974, which is 20% of all requests
Connect timeouts: 834
Request timeouts: 1554
Requests by status: {200=586}

...

GET: /accounts/{id}
Requests: 6088, which is 41% of all requests
Connect timeouts: 1730
Request timeouts: 3152
Requests by status: {404=599, 200=607}

...

GET: /accounts/count?name={name}
Requests: 5938, which is 40% of all requests
Connect timeouts: 1651
Request timeouts: 3024
Requests by status: {200=1263}

...
```


### Medium machine - 2 CPUs, 4 GB of memory

**high_load**:
```
...

3750 requests with 250 per second rate took PT15.336S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 3750, with 250/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.001 s
Max: 0.135 s
Mean: 0.004 s

Percentile 10: 0.002 s
Percentile 25: 0.002 s
Percentile 50 (Median): 0.003 s
Percentile 75: 0.005 s
Percentile 90: 0.007 s
Percentile 95: 0.01 s
Percentile 99: 0.023 s
Percentile 999: 0.072 s

...

POST: /accounts/execute-random-write
Requests: 772, which is 21% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=772}

...

GET: /accounts/{id}
Requests: 1457, which is 39% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=706, 200=751}

...

GET: /accounts/count?name={name}
Requests: 1521, which is 41% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=1521}

...
```
Again, to see whether we can sustain this load over a longer period of time I have executed a **high_long_load** test:
```
...

150000 requests with 250 per second rate took PT10M0.701S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 150000, with 250/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.0 s
Max: 0.217 s
Mean: 0.003 s

Percentile 10: 0.001 s
Percentile 25: 0.002 s
Percentile 50 (Median): 0.002 s
Percentile 75: 0.004 s
Percentile 90: 0.005 s
Percentile 95: 0.007 s
Percentile 99: 0.018 s
Percentile 999: 0.129 s

...

POST: /accounts/execute-random-write
Requests: 30277, which is 20% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=30277}

...

GET: /accounts/{id}
Requests: 59880, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=30005, 200=29875}

...

GET: /accounts/count?name={name}
Requests: 59843, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=59843}

...
```
No problems there.

**very_high_load** - it also failed there, but notice much better times and significantly fewer timeouts:
```
...

15000 requests with 1000 per second rate took PT22.588S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 15000, with 1000/s rate
Requests with connect timeout [5000]: 1896, as percentage: 12
Requests with request timeout [5000]: 68, as percentage: 0

Min: 0.008 s
Max: 5.032 s
Mean: 1.97 s

Percentile 10: 0.21 s
Percentile 25: 0.437 s
Percentile 50 (Median): 1.038 s
Percentile 75: 4.125 s
Percentile 90: 5.0 s
Percentile 95: 5.0 s
Percentile 99: 5.001 s
Percentile 999: 5.018 s

...

POST: /accounts/execute-random-write
Requests: 2998, which is 20% of all requests
Connect timeouts: 348
Request timeouts: 16
Requests by status: {200=2634}

...

GET: /accounts/{id}
Requests: 6019, which is 40% of all requests
Connect timeouts: 767
Request timeouts: 28
Requests by status: {404=2640, 200=2584}

...

GET: /accounts/count?name={name}
Requests: 5983, which is 40% of all requests
Connect timeouts: 781
Request timeouts: 24
Requests by status: {200=5178}

...
```

### Large machine - 4 CPUs, 8 GB of memory

**very_high_load**:
```
...

15000 requests with 1000 per second rate took PT15.32S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 15000, with 1000/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.0 s
Max: 1.05 s
Mean: 0.058 s

Percentile 10: 0.002 s
Percentile 25: 0.002 s
Percentile 50 (Median): 0.005 s
Percentile 75: 0.053 s
Percentile 90: 0.124 s
Percentile 95: 0.353 s
Percentile 99: 0.746 s
Percentile 999: 0.879 s

...

POST: /accounts/execute-random-write
Requests: 3047, which is 20% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=3047}

...

GET: /accounts/{id}
Requests: 6047, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=2982, 200=3065}

...

GET: /accounts/count?name={name}
Requests: 5906, which is 39% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=5906}

...
```

\
Last results seemed a little too good to be true, so to double-check, I decided to repeat this test, but for a longer time period. **very_high_long_load** results:
```
...

600000 requests with 1000 per second rate took PT10M11.923S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 600000, with 1000/s rate
Requests with connect timeout [5000]: 5197, as percentage: 0
Requests with request timeout [5000]: 10180, as percentage: 1

Min: 0.0 s
Max: 5.05 s
Mean: 0.158 s

Percentile 10: 0.002 s
Percentile 25: 0.002 s
Percentile 50 (Median): 0.004 s
Percentile 75: 0.01 s
Percentile 90: 0.033 s
Percentile 95: 0.132 s
Percentile 99: 5.0 s
Percentile 999: 5.002 s

...

POST: /accounts/execute-random-write
Requests: 119950, which is 20% of all requests
Connect timeouts: 1065
Request timeouts: 2108
Requests by status: {200=116777}

...

GET: /accounts/{id}
Requests: 240329, which is 40% of all requests
Connect timeouts: 2117
Request timeouts: 4045
Requests by status: {404=117141, 200=117026}

...

GET: /accounts/count?name={name}
Requests: 239721, which is 40% of all requests
Connect timeouts: 2015
Request timeouts: 4027
Requests by status: {200=233679}

...
```

As we can see, there is a performance degradation. Times are still very good, but we had more than 1% of timeouts; we only made it in 95 percentile, not 999 as previously. We most likely are on the edge of running out of resources and probably need to reduce this load from 4000 RPS to 2000 - 3000 RPS to make it sustainable for a longer period of time. Of course, I did exactly that; **here are the results of a 3000 RPS test running for 10 minutes**:
```
...

450000 requests with 750 per second rate took PT10M30.998S

...

Tests executed on: 4 machines, in parallel
Executed requests on 1 machine: 450000, with 750/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.0 s
Max: 1.921 s
Mean: 0.016 s

Percentile 10: 0.001 s
Percentile 25: 0.001 s
Percentile 50 (Median): 0.002 s
Percentile 75: 0.003 s
Percentile 90: 0.004 s
Percentile 95: 0.006 s
Percentile 99: 0.616 s
Percentile 999: 1.419 s

...

POST: /accounts/execute-random-write
Requests: 89991, which is 20% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=89991}

...

GET: /accounts/{id}
Requests: 180012, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {404=90140, 200=89872}

...

GET: /accounts/count?name={name}
Requests: 179997, which is 40% of all requests
Connect timeouts: 0
Request timeouts: 0
Requests by status: {200=179997}

...
```
No timeouts, 99 percentile under 1 second and 999 percentile under 1.5, which is amazing.
Out of curiosity, I have also pulled out some cpu/memory stats from Docker (we have *4 CPUs, so 400% CPU is available*):
```
...

Date: 2024-03-25T16:51:11Z
CONTAINER ID   NAME         CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
accd79ae0eb8   single-app   77.67%    652.4MiB / 7.763GiB   8.21%     0B / 0B   0B / 6.5MB    38
2dbb4ee8610e   single-db    47.62%    595.3MiB / 7.763GiB   7.49%     0B / 0B   0B / 16.6GB   20

Date: 2024-03-25T16:51:34Z
CONTAINER ID   NAME         CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
accd79ae0eb8   single-app   83.01%    652.7MiB / 7.763GiB   8.21%     0B / 0B   0B / 6.55MB   38
2dbb4ee8610e   single-db    57.63%    595.5MiB / 7.763GiB   7.49%     0B / 0B   0B / 16.8GB   20

...

Date: 2024-03-25T16:53:49Z
CONTAINER ID   NAME         CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
accd79ae0eb8   single-app   101.57%   652.5MiB / 7.763GiB   8.21%     0B / 0B   0B / 6.89MB   38
2dbb4ee8610e   single-db    70.83%    600.4MiB / 7.763GiB   7.55%     0B / 0B   0B / 17.7GB   21

Date: 2024-03-25T16:54:12Z
CONTAINER ID   NAME         CPU %     MEM USAGE / LIMIT     MEM %     NET I/O   BLOCK I/O     PIDS
accd79ae0eb8   single-app   53.55%    652.4MiB / 7.763GiB   8.21%     0B / 0B   0B / 6.93MB   38
2dbb4ee8610e   single-db    37.06%    599.3MiB / 7.763GiB   7.54%     0B / 0B   0B / 17.9GB   20

...
```

## Summing it up

As we have seen, a single machine, with a single database, can handle *a lot* - way more than most of us will ever need. Here is a summary of the test results:

1. **Small machine - 1 CPU, 2 GB of memory**
    * Can handle sustained load of *200 - 300 RPS*
    * For 15 seconds, it was able to handle *1000 RPS* with stats:
      * Min: 0.001s, Max: 0.2s, Mean: 0.013s
      * Percentile 90: 0.026s, Percentile 95: 0.034s
      * Percentile 99: 0.099s
2. **Medium machine - 2 CPUs, 4 GB of memory**
    * Can handle sustained load of *500 - 1000 RPS*
    * For 15 seconds, it was able to handle *1000 RPS* with stats:
      * Min: 0.001s, Max: 0.135s, Mean: 0.004s 
      * Percentile 90: 0.007s, Percentile 95: 0.01s
      * Percentile 99: 0.023s 
3. **Large machine - 4 CPUs, 8 GB of memory**
    * Can handle sustained load of *2000 - 3000 RPS*
    * For 15 seconds, it was able to handle *4000 RPS* with stats:
      * Min: 0.0s, (less than 1ms), Max: 1.05s, Mean: 0.058s
      * Percentile 90: 0.124s, Percentile 95: 0.353s
      * Percentile 99: 0.746s
4. **Huge machine - 8 CPUs, 16 GB of memory (not tested)**
    * Most likely can handle sustained load of *4000 - 6000 RPS*

\
Of course, there are other, non-performance related, reasons for having more than one machine - mostly associated with resilience and redundancy in case of failures. Nevertheless, **remember these results the next time someone tries to persuade you into implementing a complex solution, architecture and infrastructure, for a system expected to handle at most 5 requests per second**.

Keep things simple!

<div id="post-extras">
<div class="post-delimiter">---</div>

### Links
1. Related video on my YouTube channel: https://www.youtube.com/watch?v=NsdDIBll-Lw
2. Source code, so you can experiment and run tests on your own: https://github.com/BinaryIgor/code-examples/tree/master/single-machine-tests

</div>