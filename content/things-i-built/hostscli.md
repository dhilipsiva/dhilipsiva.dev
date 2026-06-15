+++
title = "hostscli"
description = "A Python CLI to block and unblock websites straight from /etc/hosts — ad lists, trackers, malware domains, or just the feeds at 2am. Simple and easily extendable."
weight = 7

[extra]
glyph = "⊘"
status = "shipped"
role = "Built"
visibility = "open-source"
category = "personal"
marked = true
tech = ["Python", "CLI"]
repo = "https://github.com/dhilipsiva/hostscli"
+++

Sometimes the best firewall is a text file. `hostscli block facebook` rewrites `/etc/hosts` and the feed
is gone; `unblock` brings it back. Ad lists, trackers, malware domains, or just your own attention at 2am
— no browser extension, no daemon, no subscription, nothing phoning home. The block lists are plain
config, so extending it to whatever's eating your focus this month is a one-liner.

A small utility, not a flagship — I'm clear-eyed about that. But it does one thing, it does it without
ceremony, and it has kept working across years of OS churn. Not everything has to be ambitious to be
worth shipping.
