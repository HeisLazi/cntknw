# CNTKNW Read Aloud and Audiobook Mode — System Design Document

**Version:** 0.1
**Status:** **APPROVED — canonical feature specification.** Subordinate to Product Design Document v0.2.
**Approved by:** Lazarus Petrus, 25 July 2026.

> **Provenance, recorded for the record.** The substance of this specification was supplied by the owner as prose on 25 July 2026. The document — its structure, RA-nnn numbering, invariants, acceptance criteria and the conflict resolutions in §21 — was agent-drafted, and initially self-labelled canonical before any approval existed. That was corrected, and the owner has since approved it explicitly.
>
> The rule that produced the correction still stands: an agent may draft a specification; only the owner may approve one. See register entries A-013 and A-015.
**Owner:** Lazarus Petrus
**Updated:** 25 July 2026
**Required companions:** `CNTKNW_Product_Design_Document_v0.2.md`, `CNTKNW_AI_Implementation_Handoff_v0.2.md`
**Companion plan:** `CNTKNW_Read_Aloud_Implementation_Plan_v0.1.md`

> **Source-of-truth rule:** This document is subordinate to Product Design Document v0.2. Where this specification appeared to conflict with v0.2, the conflict has been resolved in favour of v0.2 and the resolution is recorded in §21. No v0.2 requirement has been weakened, renamed, or silently reinterpreted.

> **Scope of certainty:** This document removes ambiguity about *what* Read Aloud must do. It does not guarantee defect-free implementation. The companion implementation plan defines gates, tests, and sequencing.

---

## 1. Purpose

CNTKNW must be able to read supported sources aloud so the user can continue studying when they step away from the screen, move around, rest their eyes, follow along while reading, prefer audio learning, or need accessibility support.

Read Aloud is a **continuation of the Study Workspace**, not a separate audiobook application.

### 1.1 Governing principle

> The transition from reading to listening must preserve the exact source, page, sentence, journal context, and study session.

### 1.2 What Read Aloud is not

| Not this | Because |
|---|---|
| A fourth primary destination | INV-001 and IA-001 permit only Library, Gallery, Notes. |
| A separate audiobook app or route | INV-002 — it is a tool inside the shared Study Workspace. |
| A replacement for assistive-technology support | §20.1 of v0.2 governs real screen-reader (AT) compatibility. See §17 for the distinction. |
| An audiobook production or export tool | §18 copyright boundary. |
| A cloud text-to-speech product | INV-009 and NFR-001 — core reading works offline. |

---

## 2. Feature Invariants

Stop and report before implementing any change that would violate these.

| ID | Invariant |
|---|---|
| RA-INV-001 | Read Aloud is a Study Workspace layout mode. It never becomes a primary destination or a top-level route. |
| RA-INV-002 | Visual reading position and listening position are stored separately and are never silently merged. |
| RA-INV-003 | Core Read Aloud sends no source text off the device. Online voices are opt-in, per-source, and clearly labelled. |
| RA-INV-004 | A note captured while listening anchors to a resolvable **text anchor**, never to an audio timestamp alone. |
| RA-INV-005 | The reading text stream is derived and rebuildable from the canonical source. It is never the canonical record. |
| RA-INV-006 | Read Aloud does not export, publish, or distribute generated audio of copyrighted sources. |
| RA-INV-007 | Every Read Aloud capability is reachable by keyboard and does not depend on visual highlighting alone. |
| RA-INV-008 | Listening time is recorded as study time but remains distinguishable from active visual reading. |

---

## 3. Reading Modes

Read Aloud adds one workspace layout mode (`listen`) and one workspace flag (`awayMode`). It does not add routes.

### 3.1 Follow-Along Mode

The source pane remains visible while CNTKNW reads aloud. Layout mode is unchanged (`split`, `source-focus`, etc.).

While audio plays:

- the current sentence is highlighted;
- the current paragraph is subtly marked;
- the page advances automatically;
- the journal pane stays available and writable;
- pausing to create a note is a single action;
- selecting another sentence moves playback to it.

```text
Page 42

The current sentence is highlighted.
The current word may be lightly tracked.
Playback continues into the next paragraph.
```

Best for comprehension and difficult texts.

**RA-001** Follow-Along Mode must not block journal writing while audio plays.
**RA-002** Selecting any sentence in the source pane relocates playback to that sentence.
**RA-003** Automatic page advance must not overwrite the user's visual reading position (see §6).

### 3.2 Away Mode

Used when the user leaves the screen. A workspace flag, not a layout mode — it can be enabled from Follow-Along or Listen-Only.

Away Mode must:

- continue playing when the Study Workspace is not focused;
- optionally hold a screen wake lock;
- continue when the application window is minimised or the tab is hidden;
- expose compact playback controls;
- save the exact listening position continuously;
- accept keyboard and system media controls;
- return the user to the correct page and sentence on their return.

```text
The Wretched of the Earth

Chapter 1
Page 42 of 251

Now reading: "National liberation, national renaissance..."

[Back 15s]   [Pause]   [Forward 30s]
```

**RA-004** Playback must survive window blur, tab hide, and minimise without losing position.
**RA-005** Listening position must be persisted at least once per sentence boundary.
**RA-006** Returning to the workspace must offer the listening position without discarding the visual position.

### 3.3 Listen-Only Mode

Layout mode `listen`. The source pane is hidden.

The user sees: cover, title and chapter, current paragraph text, playback controls, session timer, quick note button, bookmark button.

**RA-007** Listen-Only Mode is a layout mode of the existing `/study/:sourceId` route. Leaving it restores the previous layout mode.
**RA-008** The current paragraph text remains visible and selectable in Listen-Only Mode so notes and quotes stay possible.

---

## 4. Speech Engine and Voices

### 4.1 Offline first

The preferred engine is local. Voice sources, in order of preference:

1. operating-system voices;
2. downloadable local voice packs;
3. higher-quality local neural voice packs (later);
4. cloud voices — only when the user deliberately enables them.

**RA-009** The default voice selection must be restricted to locally-executed voices.
**RA-010** Core reading must never transmit source text to an external server without an explicit, per-source, revocable user opt-in.
**RA-011** Every voice in the picker displays its provenance using exactly these labels:

```text
Offline
Downloaded
System-provided
Online
```

**RA-012** Enabling an Online voice requires an explicit confirmation that states what text will leave the device.

> **Implementation warning.** Some browser speech engines silently route "system" voices through a vendor server. Provenance must be determined by inspecting the engine's local-service flag, not by assuming. A voice that cannot be proven local is labelled `Online`.

### 4.2 Pronunciation

**RA-013** The user may store a preferred pronunciation for any term.

```text
Written:                Kwame Nkrumah
Preferred pronunciation: KWAH-meh en-KROO-mah
```

**RA-014** Pronunciation corrections apply to all future readings of that term, across sources.
**RA-015** Pronunciation entries are canonical user data and are included in backups.

> **Implementation warning.** SSML phoneme markup is not reliably supported by browser speech engines. Pronunciation must be implemented as a substitution applied in the text pipeline (§9), not as SSML.

---

## 5. Supported Source Types

### 5.1 Text-based PDFs

Read directly from the PDF text layer.

### 5.2 Scanned PDFs

Require OCR before reading.

```text
This PDF contains scanned pages.

Text recognition is required before Read Aloud can work.

[Recognise current page]  [Recognise chapter]  [Recognise entire book]
```

**RA-016** OCR runs locally.
**RA-017** OCR output is cached locally so a page is never processed twice.
**RA-018** OCR text is a derived asset. It is rebuildable and does not modify the original PDF binary (v0.2 §16.1).
**RA-019** OCR output feeds the universal search index as well as Read Aloud. One extraction pipeline serves both (v0.2 §17.1).

### 5.3 EPUB and text formats

Later support: EPUB, TXT, Markdown, HTML, and DOCX where practical.

**RA-020** EPUB provides better chapter structure than PDF and should eventually be a first-class book format with its own `SourceLocation` variant.

---

## 6. Position Model

This is the most important data decision in the feature.

CNTKNW tracks three distinct positions per source:

```text
Last visually read page:  67
Last listened position:   Page 82, paragraph 4
Highest reached location: Page 82
```

**RA-021** Visual reading position, listening position, and furthest-reached position are stored as three separate fields.
**RA-022** Listening progress must never silently overwrite careful-reading progress.
**RA-023** On reopening a source where the two differ, CNTKNW asks:

```text
Resume reading from page 67

or

Resume listening from page 82?
```

**RA-024** If the two positions are equal, no prompt appears.

Reportable progress values:

- visual reading progress;
- audio listening progress;
- furthest location reached;
- pages actively studied;
- pages only listened to.

---

## 7. Playback Controls

**RA-025** The following controls must exist:

| Group | Controls |
|---|---|
| Transport | Play, pause |
| Time seek | Back 10s / 15s / 30s, forward equivalent |
| Structural seek | Previous/next sentence, paragraph, page, chapter |
| Audio | Playback speed, voice selection, volume |
| Session | Sleep timer, bookmark, quick note, repeat paragraph |
| Correction | Pronunciation correction, report mis-read section |

Speed range:

```text
0.5× to 3.0×
```

Presets:

```text
Careful reading:  0.8×
Normal:           1.0×
Study:            1.25×
Fast review:      1.75×
Rapid review:     2.25×
```

**RA-026** Every control is keyboard-reachable and exposed to system media controls where the platform allows.

---

## 8. Notes While Listening

The user must be able to capture an idea without hunting for the page.

```text
[Add thought]  [Save quote]  [Add question]  [Bookmark moment]
```

**RA-027** A block created while listening automatically inherits the active `SourceLocation`, exactly as in v0.2 INV-004. Read Aloud supplies the location; it does not introduce a second mechanism.

Captured context:

- source ID;
- page;
- current sentence, stored as a resilient text anchor (quote, prefix, suffix);
- audio offset, stored only as a disposable convenience value;
- the active study session, resolved through `StudySession.createdBlockIds` — not duplicated onto the block.

```text
Audio note · Page 42 · 18:31

Question: Does the author distinguish national consciousness
from nationalism here?

Source passage: "..."
```

**RA-028** Selecting the note in the journal returns the user to both the page and the sentence.

> **Why the anchor and not the timestamp.** Audio offsets change with voice and playback speed. The same note replayed with a different voice would point at the wrong words. The text anchor is the durable reference (v0.2 §14.3); the offset is a cached convenience that may be recomputed or discarded. This is RA-INV-004.

---

## 9. Reading Text Pipeline

PDF text extraction produces poor speech without cleanup. Known problems: running headers, page numbers, footers, lines broken mid-sentence, hyphenated words, footnotes injected mid-sentence, multiple columns, image captions, and reference lists.

**RA-029** A reading-cleanup layer sits between text extraction and the speech engine. It must:

- remove repeated headers and footers;
- rejoin words split across line breaks;
- preserve paragraph order;
- detect and correctly order columns;
- skip page numbers;
- handle footnotes separately (§10);
- identify chapter headings;
- ignore decorative text where appropriate;
- segment the result into sentences.

**RA-030** The user can report a section as being read incorrectly, and the report is retained for tuning.
**RA-031** The cleaned, sentence-segmented reading stream is **derived data**. It is cacheable, disposable, and rebuildable from the source (RA-INV-005), following the same rule as the search index in v0.2 §16.

> **Architectural requirement.** This pipeline is the same pipeline that feeds the universal search index. Two independent text extractors would drift and produce different page text for search and speech. One service, two consumers.

---

## 10. Footnotes and References

**RA-032** Footnote handling is user-configurable:

```text
Footnotes:
  ○ Skip
  ○ Read after the paragraph
  ○ Read immediately
  ○ Read only when requested
```

Default:

```text
Read after the paragraph
```

**RA-033** Reference lists and bibliographies are skipped unless explicitly enabled.

---

## 11. Images and Diagrams

**RA-034** CNTKNW must not silently pretend a visual is absent.

```text
Image on page 42.
Caption: Map of colonial railway routes in Southern Africa.
```

Description sources, in precedence order:

1. existing captions;
2. user-written descriptions;
3. accessible document metadata;
4. optional AI-generated visual descriptions.

**RA-035** AI-generated descriptions are labelled as generated and never replace an original caption (v0.2 §24).

---

## 12. Chapters and Reading Queue

**RA-036** CNTKNW detects, or lets the user define: parts, chapters, sections, appendices, bibliography, and page ranges.

**RA-037** The user can build an ordered listening queue.

```text
Tonight's listening queue

1. Chapter 2 — Colonial administration
2. Chapter 3 — Labour and extraction
3. Saved passage — Page 122
```

**RA-038** Scope selection must include:

```text
Read current page
Read current chapter
Read selected pages
Continue until stopped
```

---

## 13. Sessions and Statistics

**RA-039** Reading aloud creates a normal source-linked `StudySession` with an additional activity mode. It does not introduce a parallel session type.

The canonical `StudySession` (v0.2 §9.11) is **extended**, not replaced:

```ts
activityMode: 'reading' | 'listening' | 'mixed'   // new
listenedSeconds: number                            // new
```

All existing fields — `breakSeconds`, `manualPauseSeconds`, `removedIdleSeconds`, `visitedLocations`, `createdBlockIds`, `createdAnnotationIds`, `createdConnectionIds`, `dictionaryLookupIds` — are retained unchanged.

Per-source statistics may show:

- visual reading time;
- listening time;
- mixed follow-along time;
- pages listened to;
- chapters completed;
- average playback speed;
- audio bookmarks;
- notes created while listening;
- frequently replayed passages.

**RA-040** Listening counts as study time but remains separable from active visual reading (RA-INV-008).
**RA-041** Statistics remain descriptive. They do not score or reward speed (v0.2 §18.3).

---

## 14. Timer Integration

**RA-042** Active playback is a positive activity signal for assisted auto-pause. It must never be used to force a mode change on the default manual timer (INV-010).
**RA-043** Absence of mouse movement during playback is not evidence of inactivity (v0.2 §18.1).

**RA-044** End-of-interval behaviour is configurable:

```text
When a focus interval ends:

  ○ Pause reading aloud
  ○ Finish the current paragraph, then pause
  ○ Continue playing
```

Default:

```text
Finish the current paragraph, then pause
```

---

## 15. Sleep Timer

**RA-045** Away Mode supports stopping after 10, 20, 30, 45 or 60 minutes; at end of page; at end of chapter; or after the current section.
**RA-046** Volume may fade gradually before stopping.
**RA-047** On stop, the exact sentence and page are saved.

---

## 16. Remote Control

Later capability. Not required for the first release.

**RA-048** Playback should eventually be controllable through keyboard media keys, lock-screen media controls, a phone companion, a local-network controller, and Bluetooth headphone controls.
**RA-049** A full mobile application is out of scope for the first version (v0.2 §26).

---

## 17. Accessibility

Read Aloud is an accessibility feature **and** must itself be accessible. These are two different obligations and both apply.

**RA-050** Read Aloud must support: keyboard-only control; visible focus indicators; reduced motion; high-contrast highlighting; adjustable text size; dyslexia-friendly display options; persisted voice and speed preferences; sentence-level navigation.
**RA-051** The feature must not depend entirely on visual highlighting to convey position (RA-INV-007).
**RA-052** Read Aloud does **not** discharge the v0.2 §20.1 obligations for assistive-technology compatibility. Playback controls must themselves be operable by a genuine screen reader.

---

## 18. Copyright and Privacy Boundary

CNTKNW may generate speech locally from sources the user has imported for personal reading and accessibility.

**RA-053** CNTKNW must not automatically upload copyrighted sources, publish generated audio files, share full-book audio, distribute generated recordings, or present generated audio as a licensed audiobook.
**RA-054** Exporting personal listening bookmarks and notes is permitted.
**RA-055** Exporting a complete generated audiobook is restricted and, if ever offered, must be explicitly framed as personal-use functionality.

---

## 19. Acceptance Criteria

| ID | Criterion |
|---|---|
| RA-AC-001 | A text-based PDF can be read aloud offline with the network disabled, using a voice proven to execute locally. |
| RA-AC-002 | The spoken sentence is highlighted in the source pane and stays in sync across an automatic page advance. |
| RA-AC-003 | Selecting a different sentence moves playback to that sentence. |
| RA-AC-004 | Playback continues and position is preserved across window blur, tab hide, and minimise. |
| RA-AC-005 | Closing and reopening a source where visual and listening positions differ offers both, and neither is overwritten. |
| RA-AC-006 | A note created while listening carries the correct page and a text anchor that resolves back to the same sentence after a voice change and a speed change. |
| RA-AC-007 | Running headers, footers, and page numbers are absent from spoken output on a representative test PDF. |
| RA-AC-008 | Words hyphenated across a line break are spoken as one word. |
| RA-AC-009 | Footnote handling honours the configured setting, defaulting to reading after the paragraph. |
| RA-AC-010 | A stored pronunciation is applied on the next reading of that term, in a different source. |
| RA-AC-011 | A listening session records `activityMode: 'listening'` and reports listening time separately from visual reading time. |
| RA-AC-012 | With the default setting, a focus interval ending mid-paragraph finishes the paragraph before pausing. |
| RA-AC-013 | The sleep timer stops playback and saves the exact sentence and page. |
| RA-AC-014 | Every playback control is reachable and operable by keyboard alone. |
| RA-AC-015 | Selecting an Online voice presents an explicit confirmation stating what text leaves the device; declining leaves the local voice active. |
| RA-AC-016 | The reading text cache can be deleted and fully rebuilt from the source with identical output. |
| RA-AC-017 | A scanned PDF prompts for recognition, and OCR output serves both Read Aloud and universal search. |

---

## 20. Delivery Phases

Read Aloud is a cross-cutting track. It has hard prerequisites in the v0.2 roadmap and must not begin before them.

| RA Phase | Scope | Prerequisite | Exit condition |
|---|---|---|---|
| RA-0 | Domain fields, schemas, settings, migrations | v0.2 Phase 0C | Schemas validate; migration round-trips |
| RA-1 Foundation | Text-layer detection, sentence segmentation, local TTS, play/pause/speed, sentence highlight, position persistence, fully local | v0.2 Phase 1 + 2 | RA-AC-001 to RA-AC-006 pass offline |
| RA-2 | Chapter detection, background playback, sleep timer, footnote controls, improved cleanup, audio bookmarks, listening statistics | v0.2 Phase 2 + 8 | RA-AC-007 to RA-AC-013 pass |
| RA-3 | Local OCR, downloadable offline voices, pronunciation dictionary, voice notes, system media controls | v0.2 Phase 5 + 9 | RA-AC-010, RA-AC-017 pass |
| RA-4 | Phone control, neural voices, image descriptions, listening queues, optional audio caching | v0.2 Phase 9 | Reviewed against §18 before release |

**RA-056** Read Aloud implementation must not begin before v0.2 Phase 2 exits. RA-0 schema work is the sole exception and belongs inside Phase 0C.

---

## 21. Conflicts Resolved Against v0.2

Recorded per the source-of-truth rule. Each entry states the original wording of this feature request, the v0.2 requirement it touched, and the resolution.

| # | Feature request implied | v0.2 requirement | Resolution |
|---|---|---|---|
| 1 | Away Mode and Listen-Only Mode as distinct full-screen surfaces | INV-001, IA-001 — three destinations only | Modelled as workspace layout mode `listen` plus an `awayMode` flag. No new route or tab. (§3) |
| 2 | A reduced `StudySession` shape with `sourceType`, `pagesVisited`, `notesCreated` | §9.11 canonical `StudySession` | Canonical shape retained and **extended** with `activityMode` and `listenedSeconds`. `pagesVisited` and `notesCreated` are already covered by `visitedLocations` and `createdBlockIds`. (§13) |
| 3 | Notes anchored by audio timestamp | §14.3 text anchors; INV-004 | Text anchor is canonical; audio offset is disposable cache. Timestamps are not stable across voice and speed. (§8, RA-INV-004) |
| 4 | `listeningSessionId` stored on the note | §9.11 `createdBlockIds` | Not duplicated. Session linkage is resolved through the existing session record. (§8) |
| 5 | "Offline text-to-speech" assumed available in browser | NFR-001, NFR-006, §23 privacy | Voice provenance must be verified, not assumed. Unverifiable voices are labelled `Online` and require opt-in. (§4.1) |
| 6 | Pronunciation stored as a phonetic hint | — | Implemented as text substitution in the pipeline; SSML is not reliably supported. (§4.2) |
| 7 | A dedicated reading-cleanup layer | §16 search indexing, §14.2 worker extraction | Unified into a single text extraction service serving both speech and search. (§9) |
| 8 | Playback counts as active study | INV-010 manual timing default | Playback is an activity *signal* for assisted auto-pause only. It does not override the manual default. (§14) |
| 9 | "Screen reader" as the feature name | §20.1 assistive-technology requirements | Renamed Read Aloud. AT compatibility is a separate, still-binding obligation. (§17) |
| 10 | OCR in the Read Aloud foundation | §7.3 OCR is later-phase | OCR held to RA-3, consistent with v0.2. (§5.2, §20) |

**No v0.2 requirement was removed, weakened, or reinterpreted.**

---

## 22. Open Decisions

- speech engine for the desktop packaging step, once web-first is wrapped;
- OCR engine and licence;
- downloadable voice pack format, hosting, and licence;
- whether audio caching is ever offered, given §18;
- sentence segmentation library versus a purpose-built segmenter for academic prose with citations;
- EPUB `SourceLocation` variant shape;
- whether mis-read reports are retained locally only or ever aggregated.

---

## 23. Change Log

| Version | Date | Change |
|---|---|---|
| 0.1 | 25 July 2026 | Initial specification, reconciled against Product Design Document v0.2 and the verified repository state. |
