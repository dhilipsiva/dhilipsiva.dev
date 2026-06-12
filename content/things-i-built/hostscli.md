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
— no extension, no daemon, no subscription. A small utility, not a flagship — but it works, and it keeps
working.
