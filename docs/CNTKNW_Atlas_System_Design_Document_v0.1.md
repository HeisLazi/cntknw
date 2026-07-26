# CNTKNW Atlas System Design Document

**Version:** 0.1
**Status:** Design specification
**Owner:** Lazarus Petrus
**Updated:** 25 July 2026
**Required companion:** `CNTKNW_Product_Design_Document_v0.2.md`
**Format note:** Markdown transcription of `CNTKNW_Atlas_System_Design_Document_v0.1.docx`, for use as coding-agent context. Content is unchanged.

---

## Purpose

Define the Atlas system concept for CNTKNW. The Atlas is a geographical interface to the user's knowledge, connecting places, time periods, historical events, people, organisations, concepts and sources.

## Core Vision

The Atlas is not a decorative globe. It is a way to explore knowledge through location and time.

Users should be able to discover:

- where something happened
- when it happened
- who was involved
- what systems influenced it
- which sources support it
- how their own understanding developed

## Physical Integration

The Atlas exists inside the immersive Library as a nearby destination, like the future Chess Room.

Walking creates immersion but should never create friction. It should be reachable within seconds, with a direct access option.

## Four Dimensions

Every Atlas exploration combines:

1. Place
2. Time
3. Knowledge
4. Perspective

## Knowledge Objects

The Atlas should not use random pins. It uses structured objects:

- Place
- Period
- Event
- Person
- Organisation
- Movement
- State or polity
- Religion
- Ideology
- Commodity
- Trade route
- Migration route
- Conflict
- Institution
- Source
- Claim

## Filling the World

The Atlas grows through:

### 1. Core Geography Packs

- continents
- countries
- regions
- rivers
- capitals

### 2. Historical Content Packs

Examples:

- African history
- African colonial history
- independence movements
- Christianity in Africa
- political economy
- Black radical history

### 3. Personal Knowledge Layer

Books and journal blocks create Atlas objects.

### 4. Structured Imports

CSV, JSON and GeoJSON support future expansion.

### 5. AI-Assisted Extraction

AI suggests entities from books. Users approve before adding them.

## Book Connection

Reading should allow users to turn information into:

- events
- people
- places
- timeline entries
- research nodes

Every item remains linked to the original book page.

## Time System

Historical information must support:

- exact dates
- approximate dates
- centuries
- date ranges
- uncertain dates

Historical borders must be time-aware and must not pretend certainty.

## Filtering

The Atlas needs filters for:

### Time

- year
- range
- century
- historical period

### Geography

- continent
- region
- country
- historical state
- location

### Entities

- people
- events
- organisations
- religions
- movements
- commodities

### Themes

- colonialism
- resistance
- trade
- labour
- religion
- migration
- capitalism
- socialism

### Knowledge

- studied
- not studied
- needs review
- disputed
- personal interpretation

## Layers vs Filters

Filters decide **what appears**.
Layers decide **how it appears**.

### Example

Filter: Southern Africa 1880–1920

Layers:

- colonial boundaries
- resistance movements
- railways
- mining
- trade routes

## Clutter Management

The Atlas should support:

- marker clustering
- zoom-based detail
- importance levels
- density controls
- relevance highlighting

## Learning Loop

```text
Explore
-> Ask questions
-> Read sources
-> Capture claims and evidence
-> Place information on map and timeline
-> Connect ideas
-> Compare perspectives
-> Write conclusions
-> Revisit understanding
```

## History and World Systems Use Cases

The Atlas should help study:

- African history
- colonialism
- liberation movements
- political economy
- capitalism
- socialism
- Christianity in Africa
- religion and society

## Development Roadmap

### Foundation

Create data structures for places, time, events, people, organisations and sources.

### Phase 1

2D map, personal knowledge markers, filters and saved views.

### Phase 2

Historical layers, routes, imports and content packs.

### Phase 3

AI extraction, conflict detection and advanced datasets.

### Phase 4

3D globe and immersive Atlas Room.

## Final Principle

Every place should answer:

- What happened here?
- When did it happen?
- Who shaped it?
- What systems influenced it?
- What sources support it?
- How has my understanding changed?

The Atlas transforms CNTKNW from a note-taking app into a personal model of the world.

---

## Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 25 July 2026 | Initial Atlas design specification. Markdown transcription added 25 July 2026 for coding-agent context. |
