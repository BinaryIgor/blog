---
{
    "title": "Bitcoin Core Code: C++, some Python and a Custom Build System",
    "slug": "bitcoin-core-code",
    "startedAt": "2025-07-20",
    "publishedAt": "2025-08-23",
    "updatedAt": "2025-09-01",
    "excerpt": "As we have recently analyzed how the Bitcoin P2P Network works, let's delve into arguably its most important software component - the Bitcoin Core, the reference client and the reference implementation of all aspects of the Bitcoin system. With the main goal of having a few questions answered...",
    "researchLog": [ 2.5, 2.5, 1, 2.5, 1, 7.5, 5, 3, 3, 2.5, 4, 7, 1.5, 3.5, 1.5, 3.5, 3, 1.5, 4, 1 ], 
    "writingLog": [ 1, 2, 2, 2, 1, 2, 2, 1.5, 1, 4, 1.5, 3, 3, 0.5, 2, 6, 1.5, 2, 1, 1, 1 ],
    "tags": ["deep-dive"]
}
---

[The Bitcoin Core](https://bitcoincore.org/) is a truly unique and crucial software project - it makes [the Bitcoin Network](/bitcoin-p2p-network.html) possible, supporting a decentralized, neutral, censorship-resistant and permissionless monetary system with a limited supply, independent of any central authority. 

As we have recently analyzed how the Bitcoin P2P Network works, let's delve into arguably its most important software component - **the Bitcoin Core, the reference client and the reference implementation of all aspects of the Bitcoin system.** With the main goal of having a few questions answered:
1. How big and complex is the codebase?
2. What is the code quality? How well is it covered by automated tests?
3. How is it implemented in general? What are its quirks, oddities, gotchas and constraints?
4. What the dependencies are? How important are they?
5. Can it be built and run on multiple platforms - operating systems, CPU architectures - or only on a handful of them?
6. How reproducible and verifiable the builds are?
7. How hard is it to get familiar with some parts of the code, modify it and verify the changes?

Let's take a look and find out!

## Overview: what is there?

[As we can see on GitHub](https://github.com/bitcoin/bitcoin), code is mostly C/C++ with some Python (functional/integration tests) and scripts:
<figure>
  <img src="{{ imagesPath }}/bitcoin-core-code/repo-structure.png" loading="lazy" alt="Bitcoin Core repo structure">
  <figcaption>Bitcoin Core repo structure</figcaption>
</figure>


By cloning it, we might get more detailed stats using the [*Count Lines of Code (cloc)*](https://github.com/AlDanial/cloc) tool:
```
cd <your-projects-dir>
git clone https://github.com/bitcoin/bitcoin
cd bitcoin

docker run --rm -v "$PWD:/tmp"  aldanial/cloc .
github.com/AlDanial/cloc v 1.98  T=2.37 s (1099.8 files/s, 386167.1 lines/s)

-----------------------------------------------------------------------------------
Language                         files          blank        comment           code
-----------------------------------------------------------------------------------
Qt Linguist                        131            408              0         337393
C++                                810          29050          28433         185234
C/C++ Header                       626          14178          27909          63224
Python                             350          13932          14041          58115
Markdown                           242           8237             38          31678
C                                   24           1314           1429          28586
JSON                                96            340              0          26853
Qt                                  19              2              0           8226
CMake                               80            800            843           5749
XML                                  2              5              0           5608
Bourne Shell                        49            474            952           5478
Text                                 6              5              0           2588
make                                46            374            189           2117
YAML                                21            249            175           1852

...

-----------------------------------------------------------------------------------
SUM:                              2609          70544          75239         770307
-----------------------------------------------------------------------------------
```

Ignoring [Qt (UI)](https://www.qt.io/product/framework) and other minor files, it mostly is C/C++ and Python:
```
----------------------------------------------------
Language                         files          code
----------------------------------------------------
C++                                810        185234
C/C++ Header                       626         63224
Python                             350         58115
C                                   24         28586
----------------------------------------------------
SUM:                              1810        335159
----------------------------------------------------
```
Omitting comments and blank lines, **we have a solid few hundred files and a few hundred thousand lines of code to work with**. It is not small but not enormous either; there are open-source codebases that have lines of code counted in millions - Postgres, Java Virtual Machine (OpenJDK), Google Chromium, Mozilla Firefox or Linux Kernel for example.

[Looking at the current repo structure](https://github.com/bitcoin/bitcoin/tree/57e8f34fe20620b3350ca1f0fa5c7d8d3a06be82), there mainly are these directories:
* **[cmake](https://github.com/bitcoin/bitcoin/tree/master/cmake)** - lots of *.cmake* (mainly) scripts to build and configure various parts of the Bitcoin Core using [CMake](https://cmake.org) build tool, They work together with a couple of scattered around repo *CMakeLists.txt* files like [this](https://github.com/bitcoin/bitcoin/blob/master/CMakeLists.txt), [this](https://github.com/bitcoin/bitcoin/blob/master/src/CMakeLists.txt) or [this one](https://github.com/bitcoin/bitcoin/blob/master/src/test/CMakeLists.txt)
* **[contrib](https://github.com/bitcoin/bitcoin/tree/master/contrib)** - various scripts and tools for contributors
* **[depends](https://github.com/bitcoin/bitcoin/tree/master/depends)** - custom build system that fetches and builds [dependencies](https://github.com/bitcoin/bitcoin/tree/master/depends/packages) directly from sources
* **[doc](https://github.com/bitcoin/bitcoin/tree/master/doc)** - lots of truly useful documentation
* **[src](https://github.com/bitcoin/bitcoin/tree/master/src)** - C++ source code. Interestingly, some dependencies are present here as git subtrees - this is the source of C, not C++, code in the stats. These usually are more Bitcoin-specific and tightly coupled to the project or the project is to them
* **[test](https://github.com/bitcoin/bitcoin/tree/master/test)** - functional/integration tests written in Python; they start and stop node processes, requiring bitcoin node binary to be built and available to execute. Unit tests live together with the source code under [src/test](https://github.com/bitcoin/bitcoin/tree/master/src/test) dir
* other than that we have a couple of not categorized files like [.cirrus.yml](https://github.com/bitcoin/bitcoin/blob/master/.cirrus.yml) for CI processes or[.editorconfig](https://github.com/bitcoin/bitcoin/blob/master/.editorconfig) for files formatting

## Implementation: <span class="nowrap">C++</span> {#implementation-cpp}

C++ code lives under the `src` dir. All the most important logic and functionalities of the bitcoin node and wallet are implemented here (some mining as well). Things like:
* accepting new blocks and transactions, checking some of the consensus rules - `validation.cpp`; some interesting functions: `AcceptToMemoryPool(...)`, `ProcessNewBlock(...)` or `ConnectBlock(...)`
* managing the mempool (memory pool) - transactions that might be included in the next block - also `validation.cpp` and `txmempool.cpp`
* peer-to-peer message processing - receiving and responding to other peers (nodes), connecting and disconnecting, relying or discarding transactions, getting and propagating new blocks and so on - `net_processing.cpp` mainly 
* cryptography - `crypto/`, `pubkey.cpp` or `secp256k1/`
* *Script*, Bitcoin's scripting language - `script/`
* consensus - unfortunately, still scattered across a few places; mostly `validation.cpp`, `consensus/`, `script/` and `pow.cpp`
* policy - more flexible than consensus and configurable - mainly `policy/`, but also some of `validation.cpp` and `txmempool.cpp`
* Remote Procedure Calls (RPCs) - `rpc/` and `rpc/server.cpp` especially - `StartRPC()`, `StopRPC()` and `execute(...)` functions (in this file) being particularly interesting
* node initialization - `init.cpp`; in particular functions called from `AppInit(...)` of the `bitcoind.cpp` file

\
What is worth noting is that at this point the Bitcoin Core codebase is quite old - it has been there for at least 16 years! **The network was created on 3 January 2009, when Satoshi Nakamoto mined the genesis block; it is known that he has worked on the implementation for two years before the release, so the codebase originated somewhere in 2007.** Because of its age, naturally, it has its own quirks and inconsistencies. 

For example, **there are a few styles and naming conventions employed**. In the beginning, Satoshi used something resembling the [Hungarian notation](https://en.wikipedia.org/wiki/Hungarian_notation) which is rather outdated; new code does not use it but there still is lots of old code that does. At the beginning, the code was also not modular at all and there was a rather heavy usage of global state and objects - it has undergone significant improvements since then, but there still are some related issues. For example, the consensus logic is spread over a few places; there are some God objects and functions which are way too large and take too many responsibilities; global `cs_main` lock is still being used in several spots. That said, the codebase is constantly getting better and is quite modular right now; there also are ongoing efforts in place to make it even more modular, thus easier to grasp and work on various parts. We can find [internal libraries](https://github.com/bitcoin/bitcoin/blob/master/doc/design/libraries.md) with described dependencies and scope; there also is a [growing number of internal interfaces](https://github.com/bitcoin/bitcoin/blob/master/src/interfaces/README.md), increasingly serving as an [explicit contract of communication between codebase modules](/modular-monolith-dependencies-and-communication.html). Even the [Bitcoin Kernel Library Project](https://github.com/bitcoin/bitcoin/issues/27587) has been started, aiming to extract Bitcoin Core's consensus logic/engine into a separate library, which might then be used by other software. 

The Bitcoin Core has its issues, as all mature and complex codebases do; there are areas that do not adhere to *Single Responsibility Principle* or do not respect *Loose Coupling, High Cohesion* rule and are more tangled and messy. Aside from a few coding styles and conventions, there is a heavy use of macros in some places (such as the serialization framework - `serialize.h`) and some parts of the code are using older C++ constructs, but it is being refactored out and modernized. As said, the codebase was born in 2007, when *C++03* was the newest C++ version; it then moved to *C++11*, *C++17* and is now at *C++20*, using many modern C++ features like: smart pointers, range-based loops, `auto` type deduction, constant expressions with `constexpr`, lambda expressions or standard `<thread>` library. **Having looked at the code and spending a considerable time reading and playing with it, I can genuinely say that it is of high quality already, and is only getting better and better with time.**

Interestingly, there are a lot of cryptographic primitives and algorithms implemented from scratch:
* SHA256 in `crypto/sha256.cpp`
* HMAC-SHA256 in `crypto/hmac_sha256.cpp`
* ChaCha20 in `crypto/chacha20.cpp`
* RIPEMD-160 in `crypto/ripemd160.cpp`
* Advanced Encryption Standard (AES) in `crypto/ctaes/`
* Elliptic Curve Cryptography (ECC) in `secp256k1/`

**It might seem odd to implement such concepts from scratch, where there exist libraries that provide ready-to-use implementations, but there are solid reasons to have it this way.** First of all, their proper and exactly the same byte-for-byte implementation is crucial to reach consensus by the nodes - it is too risky to bet on even [the smallest possibility of a difference or bug in the external library here](https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki); one might even argue that the exact cryptography implementation is a part of the Bitcoin protocol. Secondly, for this unique kind of project and its scope of responsibility, Bitcoin Core tries to limit external dependencies as much as possible and use them only if it really is necessary and for less important functionality, reducing all possible attack vectors. Additionally, it is also easier to audit and verify consensus code, having embedded implementations of the most important cryptographic operations, primitives and algorithms in the codebase.

Speaking of limiting all possible attack vectors - **the codebase had a few serious bugs**, an exhaustive list of which can be found [here](https://en.bitcoin.it/wiki/Common_Vulnerabilities_and_Exposures), [here](https://bitcoinops.org/en/topics/cve/) and [here](https://bitcoincore.org/en/security-advisories/). Most notably:
* **[August 2010, value overflow incident](https://en.bitcoin.it/wiki/Value_overflow_incident)** - not checking for arithmetic overflow allowed to craft a transaction that created `184,467,440,737` bitcoins for three different addresses, out of thin air. Satoshi released a patch within a few hours that rejected output value overflow transactions or any transaction that paid more than 21 million bitcoins in any output. The blockchain was effectively forked by everyone agreeing to discard the block containing an overflow causing transaction
* **[March 2013, blockchain fork (0.8 release)](https://github.com/bitcoin/bips/blob/master/bip-0050.mediawiki)** - switching from Berkeley DB to LevelDB in *0.8 release* produced a chain split between *0.7* and *0.8* nodes. As a result, there was a network fork for a few hours; fixing it required coordinated upgrades and human intervention
* **[September 2018, CVE-2018-17144](https://bitcoincore.org/en/2018/09/20/notice/)** - optimization that skipped checking for duplicate inputs in newly received blocks allowed specially crafted blocks/transactions to trigger crashes. More crucially, very precise miner (mis)behaviour could have allowed claiming the same transaction input twice. Fortunately, vulnerability was not exploited

**Looking at the dates, we might note that all these critical bugs and vulnerabilities are quite old at this point at - last one was in 2018, over 7 years ago as of now.** It does not mean that certainly there will be no bugs in the future (this possibility will always exist), but as the codebase continues to mature and improve, having better internal structure (lots of refactorings) and increasingly better [test coverage](#tests-units-in-cpp-and-functional-in-python) the number of bugs and vulnerabilities go down and those that are discovered are of a milder kind. But, this desirable state of affairs should never be taken for granted; it does require constant vigilance and employing the best engineering practices and discipline. **At least one known bug, that must be addressed at some point, is the future timestamp overflow problem.** Block timestamps are stored as *unsigned 32-bit integers*, representing seconds since the Unix epoch; maximum value of `2^32 -1` corresponds to February 7, 2106. Sadly, timestamp encoding format is a part of consensus-critical block header and will require a coordinated hard fork to pull it off - this is why fixing it is postponed for now but nobody will object to this change, since without it the network will cease to function properly.

**Let's conclude this section by saying that as Bitcoin's domain is quite unique, so are the solutions implemented in its code.** Thus, something that might seem odd at the first glance is often a natural consequence of how the Bitcoin system works. The codebase had its fair share of bugs and was not structured the best, but ongoing efforts of maintainers have significantly improved the system's quality - it already is at an excellent level - and their continuous work raises this bar still further.

{{ .js: newsletterSignUpPostMid() }}

## Tests: units in <span class="nowrap">C++</span> and functional in Python {#tests-units-in-cpp-and-functional-in-python}

In the `src/test` dir there are lots of unit tests, written with the help of [Boost.Test library](https://www.boost.org/doc/libs/master/libs/test/doc/html/index.html). [Assuming that we have built various bitcoin binaries](#custom-build-system-dependencies-reproducibility-and-verifiability), in the standard `build` dir there is a [unit tests binary](https://github.com/bitcoin/bitcoin/tree/master/src/test#unit-tests):
```
./build/bin/test_bitcoin --log_level=test_suite

Running 611 test cases...
Entering test module "Bitcoin Core Test Suite"
./test/addrman_tests.cpp(63): Entering test suite "addrman_tests"                                                                                                              
./test/addrman_tests.cpp(65): Entering test case "addrman_simple"                                                                                                              
./test/addrman_tests.cpp(65): Leaving test case "addrman_simple"; testing time: 2371us                                                                                         
./test/addrman_tests.cpp(109): Entering test case "addrman_ports"                                                                                                              
./test/addrman_tests.cpp(109): Leaving test case "addrman_ports"; testing time: 1035us                                                                                         
./test/addrman_tests.cpp(137): Entering test case "addrman_select"                                                                                                 

...

./test/versionbits_tests.cpp(185): Entering test suite "versionbits_tests"                                                                                                     
./test/versionbits_tests.cpp(187): Entering test case "versionbits_test"                                                                                                       
./test/versionbits_tests.cpp(187): Leaving test case "versionbits_test"; testing time: 346485us                                                                                
./test/versionbits_tests.cpp(440): Entering test case "versionbits_computeblockversion"                                                                                        
./test/versionbits_tests.cpp(440): Leaving test case "versionbits_computeblockversion"; testing time: 112303us                                                                 
./test/versionbits_tests.cpp(185): Leaving test suite "versionbits_tests"; testing time: 458849us                                                                              
Leaving test module "Bitcoin Core Test Suite"; testing time: 35502915us                                                                                                         
                                                                                                                                                                               
*** No errors detected
```
`611 test cases` have run in `35s(35502915us)` on my `Ubuntu 24.04.3 LTS, AMD Ryzen™ 7 PRO 7840U w/ Radeon™ 780M Graphics × 16` machine (compiled for coverage). These tests [test individual functions and classes as separate units](/unit-integration-e2e-contract-x-tests-what-should-we-focus-on.html#unit-tests) and are written in C++ as the whole code being tested is.

[There also are functional/integration tests written in Python](https://github.com/bitcoin/bitcoin/tree/master/test/functional#functional-tests); they work quite differently. Using previously compiled Bitcoin Core binaries, these tests start and stop node processes. They interact with the nodes through [Bitcoin's Remote Procedure Call (RPC) API](https://developer.bitcoin.org/reference/rpc/) and P2P network messages. In the spirit of limiting external dependencies, all that is required to write and run them is a Python interpreter - [there is a custom test framework implemented in the codebase](https://github.com/bitcoin/bitcoin/tree/master/test/functional/test_framework). We can then simply run them all (it takes a while):
```
build/test/functional/test_runner.py 

Temporary test directory at /tmp/test_runner_₿_🏃_20250813_195204
1/271 - feature_taproot.py skipped (wallet has not been compiled.)
2/271 - wallet_conflicts.py skipped (wallet has not been compiled.)
3/271 - feature_fee_estimation.py passed, Duration: 42 s                         
4/271 - p2p_opportunistic_1p1c.py passed, Duration: 46 s
5/271 - feature_block.py passed, Duration: 49 s
6/271 - p2p_node_network_limited.py --v1transport passed, Duration: 12 s
7/271 - mempool_ephemeral_dust.py passed, Duration: 60 s
8/271 - p2p_node_network_limited.py --v2transport passed, Duration: 13 s
9/271 - feature_assumeutxo.py passed, Duration: 23 s

...

264/271 - p2p_permissions.py passed, Duration: 12 s
265/271 - p2p_handshake.py passed, Duration: 4 s
266/271 - p2p_handshake.py --v2transport passed, Duration: 5 s
267/271 - wallet_migration.py skipped (wallet has not been compiled.)
Remaining jobs: [feature_framework_startup_failures.py, feature_shutdown.py, p2p_ibd_txrelay.py, p2p_seednode.py]
268/271 - feature_shutdown.py passed, Duration: 2 s
Remaining jobs: [feature_framework_startup_failures.py, p2p_ibd_txrelay.py, p2p_seednode.py]
269/271 - p2p_ibd_txrelay.py passed, Duration: 1 s
Remaining jobs: [feature_framework_startup_failures.py, p2p_seednode.py]
270/271 - feature_framework_startup_failures.py passed, Duration: 4 s
Remaining jobs: [p2p_seednode.py]
271/271 - p2p_seednode.py passed, Duration: 3 s

...

ALL                                                    | ✓ Passed  | 1379 s (accumulated) 
Runtime: 365 s
```
[Functional tests verify that the whole features and functionalities work as expected.](/unit-integration-e2e-contract-x-tests-what-should-we-focus-on.html#integration-tests)

Since we know how to build the Bitcoin Core, we might follow the [instructions to build it specifically to measure *test coverage*](https://github.com/bitcoin/bitcoin/blob/master/doc/developer-notes.md#compiling-for-test-coverage). I use *GCC* as a compiler and *lcov* for reports, so building for coverage with my toolchain looks like this (I skip GUI):
```
cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DENABLE_WALLET=OFF \
  -DCMAKE_BUILD_TYPE=Coverage

# adjust j value based on desirable parallelism
cmake --build build -j8
```
And then, the coverage report could be generated. It takes a while, as it runs all unit and functional tests:
```
# additionally generate branch coverage and ignore some errors
cmake \
  -DLCOV_OPTS="--ignore-errors mismatch,negative --rc branch_coverage=1" \
  -DJOBS=8 \
  -P build/Coverage.cmake
```
 Test (code) coverage report:
<figure>
  <img src="{{ imagesPath }}/bitcoin-core-code/test-coverage-summary.png" loading="lazy" alt="Bitcoin Core test coverage summary">
  <figcaption>Bitcoin Core test coverage summary</figcaption>
</figure>

Text version:
```
           Coverage   Total     Hit
-----------------------------------
Lines         87.4%   79514   69511          
Functions     87.3%   10791    9416
Branches      51.7%  224711  116177 
```

More detailed view:
<figure>
  <img src="{{ imagesPath }}/bitcoin-core-code/test-coverage-details.png" loading="lazy" alt="Bitcoin Core test coverage details">
  <figcaption>Bitcoin Core test coverage details</figcaption>
</figure>


**This is pretty solid coverage - close to 90% for line and function coverage.** What is a little surprising though, is **significantly lower branch coverage - around 50%**. That could be for a variety of reasons; some if/else branches or switch cases might be very hard to trigger; some might simply not be worth the effort, if the code executed there is not that important. But even if that is the case, branch coverage should still be higher - closer to 70% or even 80%; there definitely is room for improvement here.
 
As a side note, [**Bitcoin Core also employs *Fuzzing***](https://github.com/bitcoin/bitcoin/blob/master/doc/fuzzing.md) - testing strategy where you input a rather large volume of random or semi-random and unexpected/malformed data into your software; it is done in order to find nonobvious vulnerabilities and bugs.

## Custom Build System: dependencies, reproducibility and verifiability

Let's now analyze the build and distribution processes of the Bitcoin Core: 
* How can it be built? What platforms are supported?
* What and where are its dependencies?
* And last but not least - is it possible to verify that the officially distributed binaries are a result of publicly available source code and were not modified/tempered with?

\
[To build and compile the code we must have a few things](https://github.com/bitcoin/bitcoin/blob/master/doc/dependencies.md). First, a C++ compiler - either [Clang](https://clang.llvm.org/) or [GCC](https://gcc.gnu.org/) are supported. Needless to say, we also must have an operating system on which either of these compilers works; OS is a dependency as well. Fortunately, they support pretty much all modern operating systems and architectures. [The Bitcoin Core officially supports these operating systems (29.0 release)](https://bitcoincore.org/en/releases/29.0/):

>Compatibility
> 
>Bitcoin Core is supported and tested on operating systems using the Linux Kernel 3.17+, macOS 13+, and Windows 10+. Bitcoin Core should also work on most other Unix-like systems but is not as frequently tested on them. It is not recommended to use Bitcoin Core on unsupported systems.

[For these OSes, there are formally distributed binaries](https://bitcoincore.org/en/download/) - but nothing stops from compiling them to work on other platforms; it just isn't officially advised nor supported.

Then, **[there are only a few required and external dependencies](https://github.com/bitcoin/bitcoin/blob/master/doc/dependencies.md#required)**: [Boost library](https://www.boost.org/), [CMake build tool](https://cmake.org/) and the [libevent library](https://libevent.org/). Also, for most platforms CMake uses *Make* underneath the hood, but it can also adapt [Ninja](https://ninja-build.org/) or *Microsoft Build Engine (MSBuild)* with Microsoft Visual Studio. [If we want to build GUI and wallet (optional), there are a few more dependencies](https://github.com/bitcoin/bitcoin/blob/master/doc/dependencies.md#optional), but these are not crucial. In general, there are two options to get those dependencies:
1. install them using our OS's package manager or download binaries from the given dependency website/distribution channel - trusting that they are correct
2. build them directly from sources, using Bitcoin Core's custom build system - *depends*

**Additionally, some of the Bitcoin Core dependencies are directly embedded as git subtrees; 1:1 copies of the code developed in other repositories.** Examples include [LevelDB](https://github.com/bitcoin/bitcoin/tree/master/src/leveldb), [CRC32C](https://github.com/bitcoin/bitcoin/tree/master/src/crc32c), [libsecp256k1](https://github.com/bitcoin/bitcoin/tree/master/src/secp256k1), [ctaes](https://github.com/bitcoin/bitcoin/tree/master/src/crypto/ctaes), [UniValue](https://github.com/bitcoin/bitcoin/tree/master/src/univalue) or [Minisketch](https://github.com/bitcoin/bitcoin/tree/master/src/minisketch). While the exact rules as to why some dependencies are explicitly specified versus being embedded directly as copies of other repositories (this is what the git subtrees are) are not specified, there seems to be a few rules of thumb. Usually when the dependency is small, self-contained and security/consensus-critical it is a subtree; also when it is tailored to the Bitcoin Core and in practice is maintained by its developers. Other than that, it is not a subtree but explicitly listed, external dependency that must be downloaded or built from the source.

**For building external dependencies directly from sources, Bitcoin Core has its own, custom build system - [*depends*](https://github.com/bitcoin/bitcoin/blob/master/depends/description.md).** It was mainly created so that:
* we are not dependent on any particular package manager infrastructure
* there is no need to trust package managers or published binaries - they are compiled from sources
* we can better control build environment and its toolchain to have deterministic and reproducible build 

We will go to reproducible builds in a bit. Firstly, let's go over how the *depends* system works; on a high level:
* it downloads source code of specified dependencies
* it compiles them locally
* it generates a `{platform}/toolchain.cmake` file so that these locally built dependencies can be picked up by CMake when compiling Bitcoin Core

On my platform - `Ubuntu 24.04.3 LTS, AMD Ryzen™ 7 PRO 7840U w/ Radeon™ 780M Graphics × 16` - I made sure that I have a *GCC* compiler and [*depends prerequisites*](https://github.com/bitcoin/bitcoin/blob/master/depends/README.md#ubuntu--debian):
```
apt install cmake curl make patch
```
Having that, we go to the `depends` dir:
```
# skip GUI and run it on 8 cores
export NO_QT=1
make -j8

...

[  6%] Building CXX object CMakeFiles/objects.dir/src/curve_mechanism_base.cpp.o
[  6%] Building CXX object CMakeFiles/objects.dir/src/precompiled.cpp.o
[  6%] Building CXX object CMakeFiles/objects.dir/src/curve_client.cpp.o
[  6%] Building CXX object CMakeFiles/objects.dir/src/ctx.cpp.o
[  8%] Building CXX object CMakeFiles/objects.dir/src/channel.cpp.o
[  8%] Building CXX object CMakeFiles/objects.dir/src/client.cpp.o
[  8%] Building CXX object CMakeFiles/objects.dir/src/address.cpp.o
[  8%] Building CXX object CMakeFiles/objects.dir/src/clock.cpp.o

...

[ 92%] Building CXX object CMakeFiles/objects.dir/src/zap_client.cpp.o
[ 93%] Building CXX object CMakeFiles/objects.dir/src/zmtp_engine.cpp.o
[ 94%] Building CXX object CMakeFiles/objects.dir/src/stream_connecter_base.cpp.o
[ 95%] Building CXX object CMakeFiles/objects.dir/src/stream_listener_base.cpp.o
[ 96%] Building CXX object CMakeFiles/objects.dir/src/tipc_address.cpp.o
[ 97%] Building CXX object CMakeFiles/objects.dir/src/tipc_connecter.cpp.o
[ 98%] Building CXX object CMakeFiles/objects.dir/src/tipc_listener.cpp.o

...

copying packages: boost libevent sqlite systemtap zeromq
to: /home/igor/ws/code/CProjects/bitcoin/depends/x86_64-pc-linux-gnu
To build Bitcoin Core with these packages, pass '--toolchain /home/igor/ws/code/CProjects/bitcoin/depends/x86_64-pc-linux-gnu/toolchain.cmake' to the first CMake invocation
```

We right now have locally produced binaries of the Bitcoin Core dependencies. Let's then use them to build the codebase; from the root dir, run:
```
# no wallet and no GUI; change toolchain file to your specific path
cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DENABLE_WALLET=OFF

-- The CXX compiler identification is GNU 13.3.0
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Check for working CXX compiler: /bin/g++ - skipped
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Setting build type to "RelWithDebInfo" as none was specified
-- Performing Test CXX_SUPPORTS__WERROR
-- Performing Test CXX_SUPPORTS__WERROR - Success
-- Performing Test CXX_SUPPORTS__G3
-- Performing Test CXX_SUPPORTS__G3 - Success
-- Performing Test LINKER_SUPPORTS__G3
-- Performing Test LINKER_SUPPORTS__G3 - Success
-- Performing Test CXX_SUPPORTS__FTRAPV
-- Performing Test CXX_SUPPORTS__FTRAPV - Success
-- Performing Test LINKER_SUPPORTS__FTRAPV
-- Performing Test LINKER_SUPPORTS__FTRAPV - Success

...

NOTE: The summary above may not exactly match the final applied build flags
      if any additional CMAKE_* or environment variables have been modified.
      To see the exact flags applied, build with the --verbose option.

Treat compiler warnings as errors ..... OFF
Use ccache for compiling .............. OFF


-- Configuring done (12.5s)
-- Generating done (0.1s)
-- Build files have been written to: /home/igor/ws/code/CProjects/bitcoin/build
```
And then:
```
# change based on the desired level of parallelism
cmake --build build -j8

[  0%] Generating bitcoin-build-info.h
[  0%] Building CXX object src/CMakeFiles/minisketch.dir/minisketch/src/minisketch.cpp.o
[  0%] Building CXX object src/CMakeFiles/crc32c.dir/crc32c/src/crc32c.cc.o
[  0%] Building CXX object src/univalue/CMakeFiles/univalue.dir/lib/univalue.cpp.o
[  0%] Building CXX object src/CMakeFiles/bitcoin_consensus.dir/arith_uint256.cpp.o
[  0%] Building CXX object src/CMakeFiles/leveldb.dir/leveldb/db/builder.cc.o
[  1%] Building CXX object src/crypto/CMakeFiles/bitcoin_crypto.dir/aes.cpp.o
[  1%] Building CXX object src/zmq/CMakeFiles/bitcoin_zmq.dir/zmqabstractnotifier.cpp.o
[  1%] Building CXX object src/crypto/CMakeFiles/bitcoin_crypto.dir/chacha20.cpp.o
[  1%] Building CXX object src/CMakeFiles/crc32c.dir/crc32c/src/crc32c_portable.cc.o
[  1%] Building CXX object src/CMakeFiles/crc32c.dir/crc32c/src/crc32c_sse42.cc.o
[  1%] Built target generate_build_info

...

[ 98%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/txvalidationcache_tests.cpp.o
[ 98%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/uint256_tests.cpp.o
[ 98%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/util_string_tests.cpp.o
[ 98%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/util_tests.cpp.o
[ 98%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/util_threadnames_tests.cpp.o
[ 99%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/util_trace_tests.cpp.o
[ 99%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validation_block_tests.cpp.o
[ 99%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validation_chainstate_tests.cpp.o
[ 99%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validation_chainstatemanager_tests.cpp.o
[ 99%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validation_flush_tests.cpp.o
[100%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validation_tests.cpp.o
[100%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/validationinterface_tests.cpp.o
[100%] Building CXX object src/test/CMakeFiles/test_bitcoin.dir/versionbits_tests.cpp.o
[100%] Linking CXX executable ../../bin/test_bitcoin
[100%] Built target test_bitcoin
```
That is it; we have ready to be used Bitcoin binaries in the `build/bin` directory. All compiled from scratch, from the pure source code - dependencies included.

**The *depends* build system also allows supporting [Reproducible Builds](https://reproducible-builds.org/) - compiling software deterministically, so that multiple people can do it and verify that they get identical binaries.** Conducting this verification is a little bit more complicated than just using the *depends* build system - [it requires setting up the Guix package manager](https://guix.gnu.org/) and [a few other things](https://github.com/bitcoin/bitcoin/tree/master/contrib/guix). In the end, we are able to:
* [download Bitcoin Core binaries from the official website](https://bitcoincore.org/en/download/)
* set up a reproducible builds environment - mostly *depends* + *Guix*
* build the codebase locally, directly from sources
* verify that resulting binaries are byte-for-byte, bit-for-bit identical as the ones published on the official Bitcoin Core website and were signed by the official keys of the Bitcoin Core maintainers
* that currently is **the highest level of assurance one can get from the software project - full verification of the whole toolchain and processes that lead to the creation of executable binaries**; no need to trust anyone

\
**How dependent the Bitcoin Core is on its dependencies?** As we saw, it intentionally tries to reduce their number to the absolutely lowest necessary level. Additionally, ones that are critical are directly embedded as git subtrees and maintained, or at least audited, by the Bitcoin Core developers. Multiple operating systems and CPU architectures are supported, so there is no dependency on any particular ones, it is quite diversified. We must have a C++ compiler, but there are at least two solid open-source ones - *GCC* and *Clang* - and so many important open-source projects are written in C++ that we can safely assume - there will always be a reliable C++ compiler. Custom build system - *depends* - relies on *Make* software but it could be substituted by a bunch of bash scripts, if the need arises. Same goes for the *CMake* build tool that glues it all together - dependencies of this kind are not a problem at all. **Therefore, it is fair to say that the Bitcoin Core is as little dependent on its dependencies as it is pragmatically possible.**

## Contribution: let's change something {#contribution-lets-change-something}

Knowing how it all works - let's change something!

We will register a new *Remote Procedure Call (RPC)* called `getmagicnumber` that returns a magic number. How can we do this?

Let's take a look at the `src/rpc` dir. There are lots of files related to various parts of the RPC functionality. There is a file where all the RPCs are registered - `src/rpc/register.h`:
```
/** These are in one header file to avoid creating tons of single-function
 * headers for everything under src/rpc/ */
class CRPCTable;

void RegisterBlockchainRPCCommands(CRPCTable &tableRPC);
void RegisterFeeRPCCommands(CRPCTable&);
void RegisterMempoolRPCCommands(CRPCTable&);
void RegisterMiningRPCCommands(CRPCTable &tableRPC);
void RegisterNodeRPCCommands(CRPCTable&);
void RegisterNetRPCCommands(CRPCTable&);
void RegisterOutputScriptRPCCommands(CRPCTable&);
void RegisterRawTransactionRPCCommands(CRPCTable &tableRPC);
void RegisterSignMessageRPCCommands(CRPCTable&);
void RegisterSignerRPCCommands(CRPCTable &tableRPC);
void RegisterTxoutProofRPCCommands(CRPCTable&);

...

static inline void RegisterAllCoreRPCCommands(CRPCTable &t)
{
  RegisterBlockchainRPCCommands(t);
  RegisterFeeRPCCommands(t);
  RegisterMempoolRPCCommands(t);
  ...
}
```

Here, we should register our new commands. Let's call the registration function `RegisterMagicNumberRPCCommands` and modify the above `src/rpc/register.h` file:
```
...
void RegisterMagicNumberRPCCommands(CRPCTable&);

static inline void RegisterAllCoreRPCCommands(CRPCTable &t)
{
    ...
    RegisterMagicNumberRPCCommands(t);
#ifdef ENABLE_EXTERNAL_SIGNER
    RegisterSignerRPCCommands(t);
#endif // ENABLE_EXTERNAL_SIGNER
    RegisterTxoutProofRPCCommands(t);
}

#endif // BITCOIN_RPC_REGISTER_H
```
That is the header (declaration) part, now we should implement it. Create the following `src/rpc/magicnumber.cpp` file:
```
#include <rpc/util.h>
#include <univalue.h>
#include <rpc/server.h>

static RPCHelpMan getmagicnumber()
{
    return RPCHelpMan{
        "getmagicnumber",
        "Returns a magic number. Remember that magic can only be positive",
        {
            {"multiplier", RPCArg::Type::NUM, RPCArg::Default{1}, "Makes it even more magical. Must be > 0"}
        },
        RPCResult{
            RPCResult::Type::NUM, "", "A magic number"
        },
        RPCExamples{
            HelpExampleCli("getmagicnumber", "")
            + HelpExampleCli("getmagicnumber", "5")
            + HelpExampleRpc("getmagicnumber", "")
            + HelpExampleRpc("getmagicnumber", "5")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
        {
            const int multiplier{request.params[0].isNull() ? 1 : request.params[0].getInt<int>()};
            if (multiplier < 1) {
                throw JSONRPCError(RPC_INVALID_PARAMETER, "Multiplier must be greater than zero; magic is positive only");
            }
            return UniValue(multiplier * 437);
        }
    };
}

void RegisterMagicNumberRPCCommands(CRPCTable &t)
{
    static const CRPCCommand commands[] {
        {"util", &getmagicnumber},
    };
    for (const auto& c : commands) {
        t.appendCommand(c.name, &c);
    }
}
```
What we are doing here:
* using lots of predefined and helpful types from the `src/rpc/util.h` file
* defining new `getmagicnumber` RPC command in a function and registering it in the `CRPCTable`
* definition basically consists of:
  * command name and description
  * list of arguments - `multiplier` with the default value of 1 in our case
  * result type - just an integer number for us
  * some examples that are given to the user when issuing a `help` command through the `bitcoin-cli` interface - we are about to see it in action
  * lambda expression that defines the behaviour of our RPC command; it simply takes a value from the user - if given, else there is a default of 1 - and *multiplies it by the magic number 437*; there is some simple validation as well - magic number must be positive

\
There are two more things we must add before compiling and testing our changes. First, go the `src/rpc/client.cpp` file and modify `CRPCConvertParam vRPCConvertParams[]`:
```
/**
 * Specify a (method, idx, name) here if the argument is a non-string RPC
 * argument and needs to be converted from JSON.
 *
 * @note Parameter indexes start from 0.
 */
static const CRPCConvertParam vRPCConvertParams[] =
{
    { "setmocktime", 0, "timestamp" },
    { "mockscheduler", 0, "delta_time" },
    { "utxoupdatepsbt", 1, "descriptors" },
    { "generatetoaddress", 0, "nblocks" },
    { "generatetoaddress", 2, "maxtries" },
    ...
    { "getmagicnumber", 0, "multiplier" },
};
```
It is needed so that the `multiplier` argument is parsed correctly as an integer, not a raw string.
Then, head to the `src/CMakeLists.txt` file and modify the `bitcoin_node` target so that the new RPC command is linked properly:
```
# P2P and RPC server functionality used by `bitcoind` and `bitcoin-qt` executables.
add_library(bitcoin_node STATIC EXCLUDE_FROM_ALL
  addrdb.cpp
  addrman.cpp
  banman.cpp
  bip324.cpp
  ...
  rest.cpp
  rpc/blockchain.cpp
  rpc/external_signer.cpp
  rpc/fees.cpp
  rpc/magicnumber.cpp
  ...
)
```

Finally, we might successfully compile our changes:
```
# as previously, adjust the toolchain and desired parallelism
cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DENABLE_WALLET=OFF

cmake --build build -j8
```

We right now have bitcoin binaries with our brand new RPC command available! To test it, let's run a bitcoin node in the *regtest (local, mocked) network*. From the `build/bin` dir, run:
```
 ./bitcoind -regtest
```
Then, we are able to issue RPC commands against this node. Let's see a help message of our new command:
```
./bitcoin-cli -regtest help getmagicnumber
getmagicnumber ( multiplier )

Returns a magic number. Remember that magic can only be positive

Arguments:
1. multiplier    (numeric, optional, default=1) Makes it even more magical. Must be > 0

Result:
n    (numeric) A magic number

Examples:
> bitcoin-cli getmagicnumber 
> bitcoin-cli getmagicnumber 5
> curl --user myusername --data-binary '{"jsonrpc": "2.0", "id": "curltest", "method": "getmagicnumber", "params": []}' -H 'content-type: application/json' http://127.0.0.1:8332/
> curl --user myusername --data-binary '{"jsonrpc": "2.0", "id": "curltest", "method": "getmagicnumber", "params": [5]}' -H 'content-type: application/json' http://127.0.0.1:8332/
```
This is exactly how we have defined it. We can call it with and without an argument:
```
./bitcoin-cli -regtest getmagicnumber
437

./bitcoin-cli -regtest getmagicnumber 2
874

./bitcoin-cli -regtest getmagicnumber 5
2185
```

So, we now possess the ability to modify Bitcoin Core code! Let's also add a functional test so that we can prove to others that our change works in an automated and future-proof way. All we have to do is to create the following `rpc_getmagicnumber.py` file in the `test/functional` dir:
```
#!/usr/bin/env python3
from test_framework.test_framework import BitcoinTestFramework
from test_framework.util import (
    assert_equal, assert_raises_rpc_error
)

class GetMagicNumberRPCTest(BitcoinTestFramework):
    def set_test_params(self):
        self.num_nodes = 1
        self.setup_clean_chain = True

    def run_test(self):
        node = self.nodes[0]

        # Default is 437 * 1 (multiplier)
        magic = node.getmagicnumber()
        assert_equal(437, magic)

        # Respects multiplier arg
        multiplier = 5
        magic_multiplied = node.getmagicnumber(multiplier)
        assert_equal(multiplier * 437, magic_multiplied)

        # Does not allow 0 multiplier
        assert_raises_rpc_error(-8, "Multiplier must be greater than zero; magic is positive only", node.getmagicnumber, 0)
        # Does not allow negative multiplier
        assert_raises_rpc_error(-8, "Multiplier must be greater than zero; magic is positive only", node.getmagicnumber, -11)


if __name__ == '__main__':
    GetMagicNumberRPCTest(__file__).main()
```
What is going on here:
* based on other functional tests, we are making use of the custom `test_framework`; it mostly comes down to inheriting from the `BitcoinTestFramework` class, overriding a few methods and setting up some params
* in the `run_test` method we call our new RPC command by using the dynamically generated `node.getmagicnumber()` function
* there are a few simple test cases - calling the command with/without an argument and with not allowed values, showing that validation works

Running it:
```
# make it executable
chmod +x test/functional/rpc_getmagicnumber.py

# trigger test files with config generation - needs to be done only once per newly created test file;
# as previously, adjust the toolchain and desired parallelism
cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DENABLE_WALLET=OFF

# run version with the linked config
build/test/functional/rpc_getmagicnumber.py
2025-08-17T11:44:11.266897Z TestFramework (INFO): PRNG seed is: 3185391037459194884
2025-08-17T11:44:11.268210Z TestFramework (INFO): Initializing test directory /tmp/bitcoin_func_test_w41spy_7
2025-08-17T11:44:11.583631Z TestFramework (INFO): Stopping nodes
2025-08-17T11:44:11.686584Z TestFramework (INFO): Cleaning up /tmp/bitcoin_func_test_w41spy_7 on exit
2025-08-17T11:44:11.686734Z TestFramework (INFO): Tests successful
```
We should also add it to the functional test suite so that it runs together with all other tests; in the `test/functional/test_runner.py`:
```
BASE_SCRIPTS = [
    # Scripts that are run by default.
    # Longest test should go first, to favor running tests in parallel
    # vv Tests less than 5m vv
    'feature_fee_estimation.py',
    'feature_taproot.py',
    'feature_block.py',
    'mempool_ephemeral_dust.py',
    'wallet_conflicts.py',
    'p2p_opportunistic_1p1c.py',
    ...
    'feature_presegwit_node_upgrade.py',
    'feature_settings.py',
    'rpc_getdescriptorinfo.py',
    'rpc_getmagicnumber.py',
    ...
    'p2p_seednode.py',
    # Don't append tests at the end to avoid merge conflicts
    # Put them in a random line within the section that fits their approximate run-time
]
```
We can then run all functional tests and verify that our test is executed as well:
```
build/test/functional/test_runner.py

...
259/272 - rpc_getmagicnumber.py passed, Duration: 1 s
...

```

We now possess the ability not only to modify the Bitcoin Core codebase, but also to prove that our change works as intended - now, as well as in the future, thanks to automated tests. There still is knowledge to be gained about [development conventions and contributing workflow](https://github.com/bitcoin/bitcoin/blob/master/CONTRIBUTING.md), but by and large, if we understand the above change example, we are pretty much ready to start contributing to the Bitcoin Core repo!


## Closing thoughts

We went through many complex topics and have learned a ton about the Bitcoin Core code, the reference client and the reference implementation of all aspects of the Bitcoin system:
* **it mostly is a C++ codebase** - with over a few hundred thousand lines of code
* **it started as a monolithic system** - ongoing efforts of maintainers **made it into a rather modular codebase** and it is getting better still with time
* **it had its fair share of bugs and vulnerabilities** - but since it has been working in production for well over 16 years at this point (starting in 2009) and because codebase quality has improved over time, discovered bugs and vulnerabilities are getting rarer and rarer and are of less and less critical nature
* **there are lots of unit tests in C++ and functional tests in Python** - line and function coverage being around 90%, branch coverage is a little over 50%; it is a solid test coverage, but the branch metric could and definitely should be improved
* **external dependencies are limited to the absolute minimum and key concepts, cryptography for example, are implemented from scratch** - it allows to reduce attack vectors and simplifies auditing the code for correctness, as well as making it more self-contained and independent
* **there is a custom build system implemented** - it allows to build dependencies without being dependent on any package manager infrastructure as well as supporting *Reproducible Builds*; enabling anyone to verify, not trust, that the distributed by the Bitcoin Core maintainers binaries are indeed a result of publicly available source code and were not modified or tampered with
* **we have also tried our hand at modifying code, compiling it with made changes and writing tests to verify that it all works as intended** - once we know how various pieces come together, it turns out not be that hard after all!

\
Naturally, there is much more to learn about the Bitcoin Core code and the various parts of the Bitcoin system, but this definitely is a solid start. It surely helped me understand various pieces of the code, assess its quality and build confidence in the development and distribution processes. **Ultimately, everything can be verified and decisions are publicly debated, explained and justified. Now, nothing stops us from contributing - maybe see you then in the next Pull Request!**


<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Related video on my YouTube channel (*added 2025-09-01*): https://www.youtube.com/watch?v=C_8NjozwgL4
2. Official Bitcoin Core website: https://bitcoincore.org. Newest binaries are available here: https://bitcoincore.org/en/download/
3. Bitcoin Core code repo: https://github.com/bitcoin/bitcoin
4. Who controls the Bitcoin Core? https://blog.lopp.net/who-controls-bitcoin-core/
5. Bitcoin Knots, the most popular fork of the Bitcoin Core: https://github.com/bitcoinknots/bitcoin
6. btcd - alternative full node bitcoin implementation written in Go (golang): https://github.com/btcsuite/btcd
7. Why C++ for the Bitcoin Core then? https://bitcoin.stackexchange.com/questions/48414/why-is-bitcoin-written-in-c and https://www.youtube.com/watch?v=w4jq4frE5v4
8. Specification of the JSON-RPC protocol: https://www.jsonrpc.org/specification
9. What is the difference between consensus and policy in Bitcoin? Consensus is like the constitution - everyone (network) must agree or there is a civil war (The Blocksize War for example). Policy is like local bylaws - towns (nodes) can choose different traffic or tax laws, but they are still in the same country (network)
10. Possible blockchain bugs and vulnerabilities: https://github.com/akircanski/coinbugs and Bitcoin's history of them: https://en.bitcoin.it/wiki/Common_Vulnerabilities_and_Exposures and: https://bitcoinbriefly.com/hacking-bitcoin-history-of-bitcoin-hacks/
11. Various types of test (code) coverage: https://web.dev/articles/ta-code-coverage
12. Website with regularly generated Bitcoin Core code coverage reports: https://maflcko.github.io/b-c-cov/
13. Bootstrappable Builds: https://bootstrappable.org and related *Reflections on Trusting Trust* by Ken Thompson: https://users.ece.cmu.edu/~ganger/712.fall02/papers/p761-thompson.pdf
14. Reproducible Builds:
    1. https://guix.gnu.org
    2. https://bitcoinops.org/en/topics/reproducible-builds
    3. https://reproducible-builds.org 
    4. https://www.youtube.com/watch?v=I2iShmUTEl8
15. General Bitcoin resources:
    1. https://github.com/bitcoinbook/bitcoinbook
    2. https://bitcoin.org/en/development
    3. https://bitcoindevphilosophy.com
    4. https://bitcoinops.org/en/topics/
    5. https://learnmeabitcoin.com
16. The Bitcoin Kernel Library Project: https://thecharlatan.ch/Kernel/

</div>