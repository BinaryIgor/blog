---
{
    "title": "Bitcoin Core Code: C++, some Python, custom build system and lots of scripts",
    "slug": "bitcoin-core-code",
    "startedAt": "2025-07-20",
    "publishedAt": "2025-08-10",
    "excerpt": "Some interesting findings.",
    "researchLog": [ 2.5, 2.5, 1, 2.5, 1, 7.5, 5, 3, 3, 2.5, 4, 7, 1.5 ], 
    "writingLog": [ 1, 2, 2]
}
---

[The Bitcoin Core](https://github.com/bitcoin/bitcoin) is a crucial software project - it makes [The Bitcoin Network](bitcoin-p2p-network.html) possible, supporting decentralized, neutral, censorship-resistant and permissionless monetary system with a limited supply, independent of any central authority. 

As we recently analyzed how the Bitcoin P2P Network works, let's delve into its arguably the most important software component - the Bitcoin Core, the reference client implementation of all aspects of the bitcoin system. Our goal here is to have a few questions answered:
1. How big and complex is the code base?
2. What is the code quality? How well is it covered by automated tests?
3. How in general is it implemented? What are its quirks, oddities, gotchas and limitations?
4. What the dependencies are? How imporant are they? How resistant is the project to their disappearance?
5. Can it be run on multiple platforms - operating systems, cpu architectures - or only on a handful of them?
6. How reproducible, verifiable and deterministc the builds are?
7. Learning curve - how hard is to get familiar with some parts of the code, modify and verify made changes?

Let's take a look and find out!


## Overview: what is there?

[As we can see on GitHub](https://github.com/bitcoin/bitcoin), code is mostly C/C++ with some Python (functional/integration tests) and scripts:
<figure>
  <img src="{{ imagesPath }}/bitcoin-core-code/code-structure.png" loading="lazy">
  <figcaption>Bitcoin Core code structure</figcaption>
</figure>


By cloning it, we might get more detailed stats using [*Count Lines of Code (cloc)*](https://github.com/AlDanial/cloc) tool:
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
m4                                   7            317             12           1554
Bourne Again Shell                  14            336            543           1271
Rust                                 3             82             56           1081
Assembly                             2             84            105            736
SVG                                 20              8             15            697
Scheme                               1             23             37            514
diff                                33            162            370            499
HTML                                 2             39              0            460
Windows Resource File                7             22              0            216
Fish Shell                           6             50             48            209
Objective-C++                        3             32             20            134
CSV                                  3              0              0            130
Dockerfile                           2             11             20             69
INI                                  1              5              0             21
TOML                                 3              5              4             15
-----------------------------------------------------------------------------------
SUM:                              2609          70544          75239         770307
-----------------------------------------------------------------------------------
```

Ignoring [Qt (UI)](https://www.qt.io/product/framework) and other minor files, it is mostly C/C++ and Python:
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
Omitting comments and blank lines, we have solid few hundred files and and a few hundred thousand lines of code to work with. It is not small but not very large either; there are open-source code bases that have lines of code counted in millions - Postgres, Java Virtual Machine, Google Chrommium, Mozille Firefox or Linux Kernel for example.

TODO: update ref.

Looking at the repo structure - [29.0 release, master branch](https://github.com/bitcoin/bitcoin/tree/83a2216f5278c1123ba740f1c8a055652e033ddd) - there mainly are these directories:
* **[cmake](https://github.com/bitcoin/bitcoin/tree/master/cmake)** - lots of .cmake (mainly) scripts to build and configure various parts of the Bitcoin Core using [CMake](https://cmake.org) build tool
* **[contrib](https://github.com/bitcoin/bitcoin/tree/master/contrib)** - various scripts and tools for contributors
* **[depends](https://github.com/bitcoin/bitcoin/tree/master/depends)** - custom build system that fetches and builds [dependencies](https://github.com/bitcoin/bitcoin/tree/master/depends/packages) directly from sources
* **[doc](https://github.com/bitcoin/bitcoin/tree/master/doc)** - lots of truly useful documentation
* **[src](https://github.com/bitcoin/bitcoin/tree/master/src)** - C++ source code. Interestingly, some dependencies are present here as git subtrees. These are more Bitcoin-specific and tigthly coupled
* **[test](https://github.com/bitcoin/bitcoin/tree/master/test)** - functional/integration tests written in Python; they start and stop node processes separately and require Bitcoin Core's binary to be built and available to execute. Unit tests live together with the source code under [src/test](https://github.com/bitcoin/bitcoin/tree/master/src/test) dir
* other then that we have a couple of not categorized files like [.cirrus.yml](https://github.com/bitcoin/bitcoin/blob/master/.cirrus.yml) for CI processes or[.editorconfig](https://github.com/bitcoin/bitcoin/blob/master/.editorconfig) for files formatting

## C++ implementation {#cpp-implementation}

C++ code lives under the src/ dir. Here, all the most important logic and funcionalities of the Bitcoin node and wallet are implemented. Things like:
* accepting new blocks and transactions, checking some of the consensus rules - `validation.cpp` mainly; some interesting functions: `AcceptToMemoryPool(...)`, `CheckTransaction(...)`, `ProcessNewBlock(...)` or `ConnectBlock(...)`
* managing the mempool (memory pool) - transactions that might be included in the next block - also `validation.cpp` and `txmempool.cpp`
* peer-to-peer message processing - receiving and responding to other peers (nodes), connecting and disconnecting, relying or discarding transactions, getting and propagating new blocks and so on - `net_processing.cpp` mainly 
* crypto primitives - mainly `crypto/`, `pubkey.cpp` and `secp256k1/`
* Bitcoin scripting language - `script/`
* consensus - unfortunately scattered through many places; mostly `validation.cpp`, `consensus/`, `script/` and `pow.cpp`
* policy (more flexible than consensus and configurable) - mainly `policy/` and `mempool/`
* initialization?
* ... others?? https://chatgpt.com/c/688c5156-f9dc-832c-8a63-4361691c1307

\
What is worth nothing is that at this point the Bitcoin Core code base is quite old - it is been there for at least 16 years! The network was created on 3 January 2009, when Satoshi Nakamoto mined the genesis block and he said that he worked on in for two years before the release, so the code base originated somewhere in the 2007. Because of that, naturally it has its own quirks and inconsistencies. For example, there are a few styles and naming conventions employed. In the beginning, Satoshi used something resembling [Hungarian notation](https://en.wikipedia.org/wiki/Hungarian_notation) which is rather outdated and not encouraged - newer code does not use it, but there still is lots of old code that does. At the beginning the code was also not modular at all and used a lot of global state and objects - it is significantly better right now, but there still are some related issues. As mentioned, the consesus logic is spread and there are still are some god objects and functions which are way too large and take too many responsibilities. That said, the code base has undergone many improvements and it is quite modular right now. Additionally, there are ongoing efforts to make it even modular. There are [internal libraries](https://github.com/bitcoin/bitcoin/blob/master/doc/design/libraries.md) with described dependencies and scope; [there also is a growing number of interfaces](https://github.com/bitcoin/bitcoin/blob/master/src/interfaces/README.md) increasingly serving as an [explicit contract of communication between code base modules](modular-monolith-dependencies-and-communication.html).

Locks?

There is a lot of unit tests. We also have a decent code coverage:
<figure>
  <img src="{{ imagesPath }}/bitcoin-core-code/code-coverage-summary.png" loading="lazy">
  <figcaption>Bitcoin Core code coverage summary</figcaption>
</figure>

TODO: quality when it comes to correctness vs structure?
TODO: verbal-musical or some kind of tool with stats?
TODO: code coverage? Static analysis of complexity/quality? Quality/coverage here or down below?

## C++ unit and Python functional tests

Some Python..
TODO: fuzzing

## Dependencies

???
Git subtrees

## Custom build system: determinism, verifiability and reproducibility

Ahh, that C++ problem...


## Making a change

Random change...
Build and compile guide here!

## Closing thoughts

Some closing thoughts...


<div id="post-extras">

<div class="post-delimiter">---</div>

### Notes and resources
1. https://chain.link/education-hub/schnorr-signature
2. https://en.wikipedia.org/wiki/SegWit
3. https://www.jsonrpc.org/specification
4. Add test example!
5. https://chatgpt.com/c/688e00b4-f108-8321-ba88-b2866d2799de
6. https://chatgpt.com/c/688e4627-ef80-832d-94c6-a2d100f4be70
7. https://github.com/btcsuite/btcd
8. https://chatgpt.com/c/688c5156-f9dc-832c-8a63-4361691c1307
9. https://river.com/learn/terms/b/bitcoin-core/
10. https://cypherpunks-core.github.io/bitcoinbook/ch03.html
11. https://bitcoin.org
12. https://bootstrappable.org/
13. https://users.ece.cmu.edu/~ganger/712.fall02/papers/p761-thompson.pdf
14. https://guix.gnu.org/
15. https://en.wikipedia.org/wiki/Executable_and_Linkable_Format
16. Links to the repo - master vs that specific commit?
17. Mention chat gpt convos help
18. https://bitcoin.stackexchange.com/questions/48414/why-is-bitcoin-written-in-c
19. https://github.com/bitcoin/bitcoin/pull/31755/files
20. https://cppreference.com/w/cpp/language/modules.html
21. https://web.dev/articles/ta-code-coverage
22. https://maflcko.github.io/b-c-cov/
23. https://github.com/bitcoin/bitcoin/pull/32427/files - leveldb might be finally remove, just flat files!
24. https://github.com/bitcoin/bitcoin/blob/master/doc/design/multiprocess.md
25. Modularity - getting better with interfaces and libs
26. Fuzz tests -> inputs can be from everyone so it must be made sure that node never crashes, not matter the input
27. https://developer.bitcoin.org/reference/
28. https://bitcoin.org/
29. Consensus vs policy. Consensus is the constitution - everyone must agree or there's civil war. Policy is your local bylaws - your town can choose different traffic laws, but it’s still in the same country.

---

### C++ stuff

* Operators make it so that code can get quite complex fast
* pointers, references and const references - without const reference one can override inside what it points to! Hard to reason about;


Build deps:
```
cd depends
export NO_QT=1
make
```

Build core, using previously compiled deps:
```
rm -rf build/

cmake --build build --target clean

cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=$PWD/depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DCMAKE_PREFIX_PATH=$PWD/depends/x86_64-pc-linux-gnu \
  -DENABLE_WALLET=OFF

cmake -B build \
  -DCMAKE_TOOLCHAIN_FILE=depends/x86_64-pc-linux-gnu/toolchain.cmake \
  -DENABLE_WALLET=OFF \
  -DCMAKE_BUILD_TYPE=Coverage

https://github.com/bitcoin/bitcoin/blob/master/doc/developer-notes.md#compiling-for-test-coverage
cmake -B build -DCMAKE_BUILD_TYPE=Coverage
cmake --build build -j$(nproc)
ctest --test-dir build

cmake --build build --target bitcoind

cmake -DLCOV_OPTS="--ignore-errors mismatch,negative --rc branch_coverage=1" -DJOBS=4 -P build/Coverage.cmake
``` 

Notes:
* custom build system around `depends/`, CMake and make/ninja
* https://chatgpt.com/c/687fbb87-1b34-832f-a0ff-7dad49fcc8af
* https://en.wikipedia.org/wiki/GNU_Autotools
* https://en.wikipedia.org/wiki/Make_(software)
* https://rajarshi149.medium.com/from-hello-world-to-bitcoin-core-dd233ce99f72
* lots of flags pattern like `ServiceFlags`
* some Python magic in their own test framework
* `cmake --build build -j8` is pretty smart; can handle changes of `build/test/functional/rpc_getmagicnumber.py` kind

</div>