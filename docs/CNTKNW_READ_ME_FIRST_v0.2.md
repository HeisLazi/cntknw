# CNTKNW v0.2 - Read This First

This package is the canonical documentation set for CNTKNW as of 24 July 2026.

## Read order

1. `CNTKNW_Product_Design_Document_v0.2.md`
2. `CNTKNW_AI_Implementation_Handoff_v0.2.md`
3. `CNTKNW_Requirements_v0.2.json`

The DOCX and PDF versions are for human review and presentation. The Markdown and JSON files are the preferred context for coding agents.

## Source-of-truth order

1. The user's latest explicit decision.
2. Product Design Document v0.2.
3. AI Implementation Handoff v0.2.
4. Approved later Architecture Decision Records.
5. Existing prototype behaviour.

## First safe engineering step

Do not begin with 3D, chess, AI, or additional feature pages. Begin with the Phase 0 foundation reset and migration dry run described in the handoff.

## Important limitation

These documents reduce ambiguity and provide gates, tests, and data contracts. They cannot guarantee defect-free implementation. Agents must inspect the real repository, run tests, and report failures honestly.
