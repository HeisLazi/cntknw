# Contributing

This project uses small, issue-driven changes with independent verification.

## Workflow

1. Start from an approved GitHub issue with an explicit outcome, scope, non-goals, and acceptance criteria.
2. Create a focused branch. Do not combine unrelated work.
3. Keep architecture and product decisions consistent with the repository's authoritative documentation.
4. Add or update tests that fail before the fix and pass afterward.
5. Run the repository's documented verification commands.
6. Open a pull request using the template and attach evidence.
7. Do not merge until review findings are resolved and required checks pass.

## AI-assisted changes

AI agents may plan, implement, or review work, but generated output is not accepted as evidence by itself. The pull request must record which tools were used and what a human or independent reviewer verified.

One implementation agent should own a milestone or bounded issue at a time. Review should be performed independently of implementation where practical.

## Human approval gates

Stop and request approval before:

- changing repository visibility or licensing;
- enabling payments, analytics, or public deployment;
- introducing a paid service or material recurring cost;
- changing authentication, authorization, privacy, or data-retention boundaries;
- performing a destructive migration or deleting user data;
- publishing private source, credentials, personal data, licensed media, or company material.

## Definition of done

A change is done only when its acceptance criteria pass, verification evidence is recorded, documentation is current, and the resulting repository state can be reproduced.
