+++
title = "On building things that outlive their meaning"
date = 2026-05-28
description = "The universe doesn't owe your software a reason to exist. That's not despair — it's the most freeing license a builder can be handed. A note on authoring your own fixed point."
weight = 1

[taxonomies]
tags = ["philosophy", "distributed-systems", "rust"]

[extra]
type = "essay"
pinned = true
+++

<figure style="margin-bottom:40px"><div class="img-slot" style="aspect-ratio:16/7" role="img" aria-label="Hero image placeholder">[ SLOT: hero image · 1600×700 · alt text required ]</div></figure>

The universe does not owe your software a reason to exist. It does not owe your cluster a quorum, your proof a model, or your name a legacy. This is usually delivered as bad news. I have come to read it as the most freeing license a builder can be handed.

If nothing is owed, then nothing is wasted either. You are free to build the thing precisely because it does not *have* to matter. The meaning is not discovered in the artifact; it is **authored** into it, by you, at the moment you decide to begin.

> A quine is a program that, run, prints its own source. It needs no input from the world to justify its output. It is its own reason.
> <cite>— from the margins of an old notebook</cite>

## The fixed point as a way of life

In mathematics, a **fixed point** of a function `f` is a value `x` where `f(x) = x` — apply the function and nothing moves. Consensus is a fixed point. A quine is a fixed point. A self-consistent worldview is a fixed point. The trick of building systems that last is to find the place where the system stops needing the world to hold it up, and instead holds itself.

Here is the smallest honest version of the idea, in Rust:

<pre><code><span class="c-com">// the network's opinion of itself, iterated to a fixed point</span>
<span class="c-key">fn</span> <span class="c-fn">settle</span><span class="c-pun">&lt;</span><span class="c-type">T</span><span class="c-pun">:</span> <span class="c-type">Eq</span> + <span class="c-type">Clone</span><span class="c-pun">&gt;(</span><span class="c-key">mut</span> x<span class="c-pun">:</span> <span class="c-type">T</span><span class="c-pun">,</span> f<span class="c-pun">:</span> <span class="c-key">impl</span> <span class="c-type">Fn</span><span class="c-pun">(&amp;</span><span class="c-type">T</span><span class="c-pun">)</span> -&gt; <span class="c-type">T</span><span class="c-pun">)</span> -&gt; <span class="c-type">T</span> <span class="c-pun">{</span>
    <span class="c-key">loop</span> <span class="c-pun">{</span>
        <span class="c-key">let</span> next = <span class="c-fn">f</span><span class="c-pun">(&amp;</span>x<span class="c-pun">);</span>
        <span class="c-key">if</span> next == x <span class="c-pun">{</span> <span class="c-key">return</span> x<span class="c-pun">; }</span>  <span class="c-com">// ∴ eval(x) = x</span>
        x = next<span class="c-pun">;</span>
    <span class="c-pun">}</span>
<span class="c-pun">}</span></code></pre>

You can call `settle` on anything that knows how to compare itself to a previous version of itself. Nodes in `gossipd` do exactly this: they exchange opinions until no opinion changes, and then they call that agreement. The optimism is not that agreement is guaranteed — it isn't. The optimism is that it is *worth iterating toward anyway*.

### Three properties of things that last

When I look at the systems that have outlived their original purpose, they tend to share a few traits:

- **They are deterministic.** Same inputs, same history, every time. A future maintainer can replay the past instead of guessing at it.
- **They are small.** A 12kB core can be understood, ported, and resurrected. A 12MB one becomes a fossil the moment its authors leave.
- **They are honest about limits.** They say what they cannot do, in writing, near the code that cannot do it.

#### An aside on undecidability

There are questions our systems provably cannot answer — whether an arbitrary program halts, chief among them. This is not a flaw to engineer around so much as a horizon to build up to.<a class="fn-ref" href="#fn1" id="fnref1">1</a> Knowing the horizon exists is what lets you stop pretending you can see past it.

<figure><div class="img-slot" style="aspect-ratio:16/9" role="img" aria-label="Diagram placeholder">[ SLOT: figure · diagram of a 5-node quorum reaching a fixed point ]</div><figcaption>Fig 1. Five peers, gossiping on a 200ms tick, converging on a single committed value.</figcaption></figure>

## Writing across two scripts

I think in English and in Tamil, and the two scripts disagree about how a sentence should breathe. Long-form type has to hold both without one looking like an afterthought. Here is the same idea in both — the line-height has room for Tamil's tall vowel signs:

<p lang="ta" class="tamil">ஒரு நிரல் தன்னைத்தானே எழுதிக்கொள்ளும்போது, அதற்கு வெளியே இருந்து எந்த அர்த்தமும் தேவையில்லை. அதுவே அதன் காரணம். <span lang="en">(A program that writes itself needs no meaning from outside; it is its own reason.)</span></p>

Naming things well is the same act in either language: you are choosing the fixed point a future reader will resolve the symbol to. Choose generously.

> நம்பிக்கையோடு கட்டு. ஒன்றும் கடன் இல்லை. <cite>— build with hope; nothing is owed</cite>

## So: build anyway

The nihilism is the premise, not the conclusion. The conclusion is a working system, committed to disk, that did not have to exist and does. That is the whole optimistic move — to look at an indifferent universe and add one more fixed point to it, on purpose.

One must imagine the compiler happy.

<div class="footnotes"><ol><li id="fn1">The halting problem: there is no general algorithm that decides, for every program-input pair, whether the program eventually halts. Turing, 1936. <a class="fn-ref" href="#fnref1" aria-label="Back to content">↩</a></li></ol></div>
