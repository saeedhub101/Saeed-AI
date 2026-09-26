# Saeed AI 2.0 — Project Status

## Version baseline

- Product version: **2.0**
- `VERSION` is the single official version source.
- Build numbers identify CI runs and are not product versions.

## Agent Core 2.0

The repository now defines an Agent Core 2.0 foundation covering:

- planning / plan revisions;
- persistent goals;
- execution journal;
- permission classification;
- bounded retry/recovery policy;
- model-routing hints;
- scheduler state;
- persistent agent context;
- evaluation hooks.

The next implementation phases must connect these foundations more deeply to the existing tool loop, skills, perception, knowledge/RAG, application adapters, scheduler, model providers and evaluation suite. Documentation must not describe an architectural capability as production-complete until the corresponding implementation and CI tests verify it.

## Character intelligence

The avatar runtime now includes a base-pose controller that:

- detects Hips, head, arm and hand bones where available;
- measures hands relative to the head/hips/shoulders;
- classifies approximate T-pose/A-pose/standing state;
- prefers embedded Idle/Stand/Breath/Rest/Default animations as the base animation;
- attempts geometry-driven T-pose → A-pose correction when no suitable idle animation exists;
- leaves unsupported/incomplete rigs static without crashing.

The existing manual Character Controller remains the single controller. Procedural idle/talking behavior remains additive.

## Native UI

Chat and Settings are native independent Win32 top-level windows. WebView2/Three.js is reserved for the 3D avatar surface.

## Mandatory verification

The Windows workflow remains the product validation contract. Any feature described as verified must have the corresponding GitHub Actions build/smoke-test evidence. A source commit alone is not release evidence.

## Historical checkpoints

### Build 369 baseline
The product was based on the v0.3.7 Build 369 checkpoint for the stable native C++ direction.

### Icons and character selection
Application/tray/installer icon integration and native character selection controls were added on top of the Build 369 direction.

## Current development direction

Saeed 2.0 is being developed as one coherent Agent product. Priority areas are:

1. planning and long-horizon execution;
2. verification and autonomous recovery;
3. perception/OCR/vision;
4. reusable skills and application adapters;
5. web-agent capabilities;
6. knowledge/RAG;
7. persistent goals and scheduling;
8. model routing and offline/local capability;
9. voice/STT/TTS;
10. evaluation and regression testing;
11. safe self-improvement mechanisms;
12. richer avatar state and behavior.

## Agent Core implementation checkpoint — 2026-09-27

The current Electron-side Agent Core execution loop now has:
- unified Full Access / Ask Always / Denied permission policy;
- task IDs, cancellation and execution-step tracking;
- tool execution journal entries containing permission and verification data;
- dedicated post-action verification for filesystem operations and commands;
- GUI result observation support;
- bounded retry/recovery for selected non-destructive transient tool failures;
- dry-run execution mode that does not invoke tools.

Important repository-state note: the current default branch contains the Electron workflow .github/workflows/build-windows-electron.yml; the C++ workflow named in the older development contract is not currently present at that path. No build or release was triggered during this source-only capability phase. This discrepancy must be reconciled before the final production build rather than silently assuming the C++ workflow exists.

## Chat attachments and application automation checkpoint — 2026-09-27

The chat now has a first-class attachment flow:
- Attach button and multi-file selection.
- Drag-and-drop support for selected local files.
- Attachment metadata (name, type, size and local path) is passed into the Agent task.
- Text attachments can be included inline within the model context.
- Image attachments can be provided as image input when supported.
- PDF/Office files retain their local path so the Agent can use the appropriate document tools instead of forcing blind copy/paste.

Application automation policy is now explicit:
1. Prefer direct API/database integration when available and appropriate.
2. Prefer Windows UI Automation when available.
3. If those are unavailable, Saeed may use mouse and keyboard automation.
4. Visual inspection/OCR can support mouse/keyboard automation when element-level automation is unavailable.

This is source-only work. No intentional production build, EXE, or Release was created by the development task.

## Document / Pump-catalog groundwork checkpoint — 2026-09-27

Added source-level PDF visual-analysis support:
- PDF text search can locate pages containing a requested term before visual inspection.
- Selected PDF pages can be rendered to images for visual analysis of tables, performance curves, dimension drawings, labels and units.
- The Agent can feed rendered PDF pages back into the multimodal model as visual task input.
- The intended workflow is now: extract/search text first, locate relevant pages, render only needed pages, visually inspect curves/dimensions/tables, then structure and verify values.
- No build, EXE, or Release was triggered.


## Structured Pump Record checkpoint — 2026-09-27

Added `src/pump_catalog.js` and the `pump_normalize_record` Agent tool.
- Pump records now have a stable schema for manufacturer/series/model, operating data, dimensions, motor data, materials and performance-curve points.
- Units remain explicit instead of being silently converted or guessed.
- Source provenance is preserved with file/page/region/type metadata.
- Missing/uncertain data is surfaced as validation warnings rather than invented.
- The Agent instructions require normalization/provenance before treating extracted pump data as ready for downstream application entry.
- This remains source-only; no build, EXE, or Release was triggered.


## Application Adapter discovery checkpoint — 2026-09-27

Added `src/application_adapter.js` and two Agent tools:
- `discover_application`: finds matching Windows windows/processes, executable path, command line and nearby database-file candidates.
- `inspect_application_ui`: reads the visible Windows UI Automation control tree before coordinate-based interaction when UI Automation is available.

The Agent now follows the integration discovery order without assuming a database technology: inspect application → identify API/database option when appropriate → UI Automation → mouse/keyboard → visual/OCR assistance. This is designed for the user's pump-selection program without assuming it is SPAIX or SQLite.

No build, EXE, installer, or Release was created.


## Read-only Database Discovery checkpoint — 2026-09-27

Added `src/database_adapter.js` and integrated:
- `inspect_database`: detects supported local database formats and inspects schema without writing.
- `read_database_query`: permits a single read-only SQLite SELECT/PRAGMA query during discovery.
- SQLite tables/columns are surfaced when the local sqlite3 CLI is available.
- Access databases are identified separately and are not modified; provider availability is reported before deeper integration.
- The Agent is instructed to inspect database candidates read-only before any future data-entry strategy.

No database write adapter has been enabled yet. No build, EXE, installer, or Release was created.


## Pump normalization + Office verification checkpoint — 2026-09-27

- Pump normalization now converts common flow/head/power/pressure/temperature/dimension units into a canonical representation before downstream use.
- Performance-curve points preserve per-point source metadata and are normalized independently.
- Engineering validation now flags missing required operating values, missing curves/dimensions, invalid efficiency ranges, and negative curve flow values.
- Excel append now returns the written rows for verification instead of only a row count.
- Word replacement now reports whether the target text was removed after the save operation.
- No build, EXE, installer, or Release was created.


## Pump database mapping + dry-run import checkpoint — 2026-09-27

- SQLite detection now validates the SQLite file signature instead of trusting only the extension.
- Added `PumpSchemaMapper` to map common pump fields to discovered database columns without modifying the database.
- Added `PumpImportPlanner` to produce a dry-run import plan containing target, mapped values, unresolved fields, and provenance.
- Agent instructions now require schema mapping and a dry-run import plan before any future pump data-entry adapter.
- No database write adapter has been added.
- No build, EXE, installer, or Release was created.


## Pump UI mapping + permission-engine audit checkpoint — 2026-09-27

- Added read-only `ApplicationUIMapper` for matching visible UI Automation controls to common pump fields before any GUI entry.
- Added `pump_map_application_ui` tool; it does not click, type, or modify the target application.
- Agent can now use either database schema mapping or UI control mapping as a discovery path before future data entry.
- Audited Permission Engine: fixed a latent undefined risk-detector reference in `run_command` authorization logic.
- Preserved the approved Full Access default; only configured restrictions and genuinely critical operations require Allow/Deny.
- No build, EXE, installer, or Release was created.


## Scope decision — Pump module complete — 2026-09-27

The pump-catalog automation work is considered sufficient for the current project scope. No further pump-specific features are to be added unless explicitly requested later. Development now returns to the main Saeed roadmap and remaining general-purpose agent capabilities. No build/release was created in this checkpoint.


## Windows UI Automation capability checkpoint — 2026-09-27

Expanded the general application-automation layer beyond read-only discovery:
- UI Automation inspection now captures enabled/offscreen state plus Value, Invoke, SelectionItem, Toggle, RangeValue and Text pattern availability.
- Toggle and selection state are surfaced for post-action verification.
- Added a controlled `ui_automation_action` tool supporting invoke, set_value, select and toggle on a stable name/AutomationId selector.
- Agent instructions now prefer stable UI Automation actions before coordinate mouse/keyboard automation when available.
- UI Automation actions are re-inspected after execution so important state changes can be verified.
- Permission categories include UI Automation actions while preserving Full Access as the default.
- No build, EXE, installer, or Release was created.


## Email Agent source checkpoint — 2026-09-27

Added the first production-oriented email integration layer without building or releasing:
- IMAP receiving/synchronization through `imapflow`.
- POP3 receiving fallback with basic message listing/retrieval.
- SMTP sending through `nodemailer`.
- MIME parsing through `mailparser`.
- Settings UI for email address, IMAP/POP3 server, ports/security, SMTP server, username and password/app password.
- Email credentials are encrypted with Electron `safeStorage` and are never returned through public settings; the stored password can be cleared explicitly.
- Added Email Agent tools for connection test, listing, searching, reading and sending.
- Email operations are included in the central permission system while preserving the approved Full Access default.
- Browser/agent instructions treat email contents as untrusted data and restrict `email_send` to an actual user request.
- Added native IPC endpoints for future UI workflows.

No build, EXE, installer, or Release was created. The source remains in the implementation phase.


## Source-only capability checkpoint — 2026-09-27 (continued)
- Email transport hardened: POP3 STARTTLS is now explicitly upgraded with TLS; SMTP distinguishes implicit TLS, required STARTTLS, and plain transport; no build/release performed.
- Permissions UI now exposes the Email category for configurable Allow / Ask Always / Denied behavior.
- Persistent memory expanded to short-term, long-term, task, project and preference types with project/task metadata and secret-like data rejection.
- Task journal is now persisted under Electron userData and redacts API keys, tokens, passwords, secrets and private-key material before storage.
- Current rule remains: source changes only; no EXE/build/release until the remaining agent capabilities and full source audit are complete.


## Agent reliability checkpoint — 2026-09-27 (continued)
- Removed the remaining duplicate high-risk-command block from Computer; central PermissionEngine is now the authoritative Allow/Deny gate.
- Expanded VerificationEngine with text_contains, file_size and process_exists evidence checks.
- Marked web-search output as untrusted external data in the Agent tool boundary to reduce prompt-injection propagation.
- Fixed duplicate task failure accounting in Agent execution; TaskEngine remains the source of task failure counts.
- No build, EXE or release was created.


## Code Project Agent checkpoint — 2026-09-27

Added project discovery, source search/read, and read-only Git inspection tools. Agent instructions now use this workflow before software-project work. No build or release was created.


## Recovery / Emergency Stop checkpoint — 2026-09-27

Task state is now persisted incrementally to the task journal, including task creation, plans, step starts/results, journal entries, cancellation and completion. The renderer now has an emergency stop IPC path that cancels the active task and cancels Realtime generation. No build or release was created.


## Browser Agent checkpoint — 2026-09-27

Added browser-oriented page inspection and download capabilities: `browser_fetch`, `browser_extract_links`, and `browser_download`. Page/search/link content is explicitly treated as untrusted external data. Browser tools are integrated into the permission categories, and Agent retry/trust guidance was extended. Download results verify HTTP success and non-zero local file size. No build or release was created.


## Office Agent checkpoint — 2026-09-27

Hardened Excel/Word operations with input-path validation, safer Excel workbook creation, stronger Word replacement verification, and post-operation file-size verification for Excel outputs and browser downloads. No build or release was created.


## 10-stage reliability pass — 2026-09-27

Source-only continuation covering memory cleanup, task recovery exposure, permission rule inspection, API-key/settings revision tracking, Realtime session generation tracking, and existing task/emergency-stop IPC verification. These changes do not create an EXE or Release. Final capability audit and build remain gated until all source work is complete.


## Phase A/B/C source implementation checkpoint — 2026-09-27

Implemented in the existing Agent Core without creating a second agent:
- **A — Agent Core:** explicit task planning, plan events, bounded replanning after safe tool failures, safe task resume, and composite verification primitives.
- **B — Vision:** fresh screen observation with timestamp/path and optional local Tesseract OCR; visual evidence is fed back to the multimodal model and treated as time-scoped/untrusted.
- **C — Code/Project Agent:** project-scoped source editing, build/test commands, and Git/diff diagnostics integrated into the existing ToolRegistry and permission boundary.

No production build, EXE, installer or Release was created.

## Approved roadmap alignment — 2026-09-27

The project source of truth is now aligned with the approved nine-phase roadmap and cross-cutting A-I engineering gates. The current architecture is Electron/Node.js with the existing GLB + Three.js avatar surface. Retired C++/C#/Godot architecture is not the current implementation target.

Source-only work in this cycle included persistent task-journal loading/saving, relevance-ranked memory retrieval, hardened sensitive-data/Ask-Always permission behavior, local Knowledge/RAG indexing, persistent scheduling, scheduler-to-Agent execution wiring, proactive scheduled-task events, and documentation alignment in AGENTS.md and README.md.

No production build, EXE, installer or GitHub Release was created in this source-only cycle.


## Target capability definition — 2026-09-27

The next development target is explicitly **Saeed as an employee-like Agent**, not a chatbot with a loose set of tools. The ten target systems are:

1. Agent Brain — planner, task state, orchestration, bounded recovery/retry, verification, re-planning and reporting.
2. Computer Agent — screen/window perception, OCR/UI detection, mouse/keyboard/clipboard/drag-drop and window lifecycle/multi-window workflows.
3. Document & Office Agent — PDF/OCR/table extraction, Word, Excel/XLSX, CSV/data transformation, ZIP/filesystem and PDF -> structured data -> Excel.
4. Code/Project Agent — project/language/framework discovery, code search/editing, terminal, build/test/debug, compiler-error analysis, patching and Git verification.
5. Web/Integration Agent — real browser workflows plus API-first ERP/CRM/email/cloud integrations and GUI fallback.
6. Memory & Knowledge — short-term, long-term, task, project and preference memory plus Knowledge/RAG without secrets.
7. Proactive Saeed — Working, Finished, Needs approval, Error, Calling user and Notifications for meaningful task events.
8. Personality/Behavior — LLM -> Intent/Emotion -> Behavior Engine -> Animation Engine -> Bones/Morphs.
9. 3D Character — robust GLB rendering, animation state machine, full-body procedural movement, lip-sync, facial expressions, eye/head tracking, gestures, dance and sing behaviors.
10. Security — central permission, sensitive-action confirmation, audit, recovery and final regression boundary.

### Complex-task contract
A multi-step task should follow the bounded execution pattern:
Understand -> Discover -> Inspect -> Plan -> Execute -> Observe -> Verify -> Recover/Retry -> Re-plan -> Report

Examples used as acceptance targets include local project repair and PDF -> structured data -> XLSX -> ERP workflows. These are targets, not claims of current completeness. Individual tools must be wired into the Agent loop and covered by permission, verification, recovery and user-visible state before the corresponding capability is marked complete.

### Development priority
1. Agent Core reliability.
2. Computer + Code + Document execution reliability.
3. Browser/API/ERP integration workflows.
4. Memory/Knowledge and planning persistence.
5. Proactive events and user calling/notification behavior.
6. Intent/Emotion -> Behavior -> Animation -> 3D integration.
7. Security/audit/recovery and final regression gate.

Always Listening and existing voice/settings/UI behavior remain protected contracts during this work. Source-only development continues; no EXE, installer or Release is permitted before the complete Phase 1–9 and A–I review.


## Scheduler source integrity checkpoint — 2026-09-27

A source audit found that the Agent/ToolRegistry/main wiring referenced `src/scheduler.js`, while the file was absent from the default branch. This would prevent the Electron runtime from loading the ToolRegistry. The persistent scheduler module has now been restored with:
- validated one-time and recurring run times;
- persistent JSON state;
- atomic file replacement on save;
- execute/dry-run modes;
- cancellation;
- bounded due-task processing;
- explicit running/last-run/result state;
- scheduled execution routed back through the existing Agent.run path, so normal permissions and verification remain authoritative.

This is a source-only integrity repair. No build, EXE, installer or Release was created.
