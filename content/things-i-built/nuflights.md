+++
title = "NuFlights"
description = "Principal Architect, Platform (2023–26) — on the airline-retailing platform I originally built from scratch at Reckonsys. Highlight: rewriting the NDC adapter from Python to Rust."
weight = 13

[extra]
glyph = "⇄"
status = "shipped"
role = "Principal Architect"
visibility = "closed source"
category = "professional"
marked = false
featured = false
tech = ["Rust", "Python", "GraphQL", "Protocols"]
no_link_note = "2023–2026 · nuflights.com"
+++

Airline retailing on the IATA NDC standard — cloud SaaS for the air-travel industry, registered in Doha,
Qatar. I built the entire product from scratch during my Reckonsys tenure, then returned as Principal
Architect, Platform (2023–26) to scale it.

## The Rust rewrite

The headline: rewriting the NDC adapter from Python to Rust — async-graphql, sea-orm, yaserde — for
performance, efficiency, and maintainability on complex NDC content exchange. Backend services spanned
Django/GraphQL and Rust behind a Tyk API gateway.

## The platform work

Led the migration from AWS Copilot/ECS Fargate to **EKS with ArgoCD GitOps**, on a two-cluster topology:
a PCI-scoped gateway cluster and a platform cluster, VPC-peered. Ran the **PCI DSS 4.0** compliance and
remediation program. Rebuilt identity on **Casdoor (OIDC)** with Redis-backed token resolution and JWT
slimming via a BFF re-signing service written in Rust. Along the way: Pod Identity/IRSA replacing static
credentials, CloudNativePG for the non-CDE databases, and ExternalDNS replacing a Lambda-based service
discovery sync.

Protocol work; very real flights.
