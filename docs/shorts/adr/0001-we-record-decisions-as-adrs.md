# 0001. We record decisions as ADRs

- **Status:** accepted
- **Date:** 2026-11-27
- **Who decided:** The owner asked for ADRs; the format is Claude's.

## Context

The owner asked for a proper pipeline for the shorts, with its history, its plan and its decisions kept ("maintaining ADR, etc"). Decisions made in conversation are lost when the conversation ends, and get re-argued.

## Decision

Every decision about how the shorts are made is one file in this folder: numbered, dated, with its context, the decision, and what follows. A decision is never rewritten. To change one, a new ADR says so and the old one's status becomes `superseded by NNNN`. Statuses: `proposed` (Claude's pick, the owner has not answered), `accepted` (the owner decided or agreed), `superseded`.

## What follows

- Anyone, or any later session, can see why things are as they are.
- A proposed ADR is a question for the owner; it is listed in PLAN.md until answered.
- Small choices inside one short go in its brief, not here.
