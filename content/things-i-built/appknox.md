+++
title = "Appknox ×2"
description = "Two tenures. 2014–17: architected the mobile-security scanning platform from scratch, built the team 1→5, ran an iOS/Android device farm. 2022–23: a Rust microservice generating CycloneDX SBOMs from mobile binaries — no source required."
weight = 10

[extra]
glyph = "⊢"
status = "shipped"
role = "Tech Lead, then Software Architect"
visibility = "closed source"
category = "professional"
marked = false
featured = false
tech = ["Security", "Rust", "Django", "Distributed Systems"]
no_link_note = "2014–17 · 2022–23 · appknox.com"
+++

The same mobile-security company, twice, with five years in between — and very different work each time.

**First tenure (2014–2017, Tech Lead):** clients upload APK/IPA binaries; the platform runs SAST, DAST,
and API scans in a secure sandbox, fully automated. Architected it from the ground up, started as the sole
contributor, grew the team to five, and built the iOS/Android device farm the scanning relied on.

**Second tenure (2022–2023, Software Architect):** a Rust microservice that generates CycloneDX SBOMs for
iOS and Android binaries *without access to their source code* — deep binary analysis to extract metadata
on third-party components.

The 2015 stack, for the record: Django, CoffeeScript/LESS, Postgres (migrated from MySQL), RabbitMQ,
Celery, Redis, Memcached, Varnish, Nginx, and an Ember front-end developed fully decoupled from the
backend. The backend was named Sherlock, the front-end Irene, the admin Hudson. I wrote the whole thing up
at the time — [Architecture at AppKnox](/musings/architecture-at-appknox/).
