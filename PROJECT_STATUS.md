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
