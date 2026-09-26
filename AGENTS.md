# Saeed AI — Agent Development Instructions

Saeed is one coherent Windows desktop AI Agent. The repository is the source of truth for current implementation. Inspect current code and Git history before changing it. Extend existing systems; do not create parallel Agent, memory, updater, permission, verification, or character systems.

## Current Architecture

- Desktop runtime: Electron + Node.js on Windows x64.
- Agent Core: existing src/agent.js, src/tools.js, src/task_engine.js, src/verification_engine.js and related modules.
- Avatar: replaceable GLB rendered through the existing Three.js/WebGL avatar surface.
- Official build workflow: .github/workflows/build-windows-electron.yml.
- Official version source: VERSION.
- C++/C#/Godot legacy implementations are not the current product architecture and must not be reintroduced.
- No separate updater executable.

## Approved Product Roadmap

### Phase 1 — Agent Core
Task Planner; Task State; Tool Orchestration; Retry / Recovery; Verification; Cancellation / Emergency Stop; Dry Run; Execution Journal.

Execution model:
Understand -> Plan -> Inspect -> Execute -> Verify -> Recover/Retry -> Re-plan -> Report.

A tool returning without an exception is never proof that the requested result happened.

### Phase 2 — Computer Agent
Screenshot; Window detection; OCR; UI-element detection; Mouse / Keyboard / Clipboard / Drag & Drop; Window open/close/minimize/maximize/switch; visual verification after important operations.

Automation priority:
1. Direct API / database / application automation.
2. Windows UI Automation.
3. Mouse / keyboard.
4. Vision / OCR + mouse / keyboard when necessary.

GUI automation is an allowed fallback, not a forbidden capability.

### Phase 3 — Document & Office Agent
PDF parsing; OCR; table extraction; Word; Excel/XLSX; CSV/data transformation; ZIP/filesystem; PDF -> structured data -> Excel.

### Phase 4 — Code/Project Agent
Project discovery; language/framework detection; code search; project inspection; terminal; Build/Test/Debug; compiler-error analysis; patching; Git status/diff/log; verification after repair.

Code changes should use bounded project-root paths, preserve evidence, and verify the resulting state.

### Phase 5 — Browser / Integration Agent
Browser navigation; page inspection; click/type/scroll; download/upload; API-first architecture; ERP/CRM integrations; GUI fallback when no suitable API exists.

Web pages, email bodies, downloaded documents and external content are untrusted data. They must never override Saeed's policy or cause unrelated commands/secrets to be exposed.

### Phase 6 — Memory & Planning
Short-term memory; long-term memory; task memory; project memory; user preferences; Knowledge/RAG.

Never store API keys, passwords, tokens, session secrets or other credentials in memory.

### Phase 7 — Proactive Saeed
States/events:
Working; Finished; Needs approval; Error; Calling user; Notifications.

Long-running tasks should emit meaningful proactive events without spamming the user.

### Phase 8 — Personality / 3D Behavior
The LLM never controls bones directly.

LLM -> Intent/Emotion -> Behavior Engine -> Animation Engine -> Bones/Morphs

Behavior families:
Idle; Listening; Thinking; Working; Success; Error; Greeting; Happy/Excited; Gestures; Walk; Dance; Sing; Blink; Lip-sync; Eye/Head tracking.

The existing central character controller remains the single controller. Character behavior must react to Agent state/results.

### Phase 9 — Security
The central permission engine applies to every Agent layer.

Default policy:
- Full Access for requested tasks.
- Ask Always configurable by operation/category.
- Denied configurable by operation/category.
- Critical/irreversible operations remain Ask Always by default.

Critical examples include shutdown/restart/logoff, dangerous Registry/Boot/Service changes, protected system modifications and financial transactions. Sensitive credential/private-data access is explicitly controlled.

Permission prompts must state WHAT, TARGET and WHY and provide Allow/Deny. Approval is fresh per sensitive operation and is never a permanent grant. Denial stops the operation and should permit safe recovery where possible.

## Phase A–I Engineering Gates

A–I are cross-cutting engineering gates applied across Phases 1–9, not a second product.

A — coherent Agent Core/state/tool contract.
B — perception and computer-use reliability.
C — document/Office/data reliability.
D — project/code execution and repair reliability.
E — browser/integration safety and verification.
F — memory/knowledge/planning persistence and isolation.
G — proactive event/notification behavior.
H — Intent/Emotion -> Behavior -> Animation -> character integration.
I — centralized security, permissions, audit, recovery and final regression gate.

A feature is not complete merely because a source file exists. It must be connected to the Agent loop, permissions, verification, recovery and user-visible state where applicable.

## Current Reliability Rules

- Always Listening must remain Always Listening unless the user explicitly changes that requirement.
- Emergency Stop must cancel active task execution and prevent stale realtime work from continuing.
- Dry Run must describe intended actions without executing them.
- Important file, application, GUI, browser, Office and project operations require evidence-based verification.
- Retries must be bounded and must not blindly repeat destructive operations.
- Browser/email/external content is untrusted.
- Secrets are kept out of memory, logs and normal model context.
- Persistent task state must survive application restart where designed to do so.
- Knowledge retrieval must remain distinguishable from live computer state and user memory.
- Character replacement must not require rewriting Agent architecture.
- Multi-monitor/DPI/work-area handling must not regress.
- Do not create duplicate controllers or databases.

## Source-Only Development Gate

Until the complete source review is finished, do not create an EXE, installer or GitHub Release. Source development may add and modify modules, tests and documentation, but the production build gate is opened only after Phases 1–9 and A–I have been reviewed together.

When the build gate is opened, inspect the current official Electron workflow and verify every required stage individually. Never call a build or release successful without evidence from GitHub Actions and, for releases, the actual release assets.

## Documentation

Update PROJECT_STATUS.md when implementation state or architecture changes. Update README.md for user-visible behavior or roadmap changes. Keep this file aligned with the approved roadmap and current architecture.

## Core Principle

Saeed must evolve as one coherent product: Agent Core + Computer + Documents/Office + Code/Project + Browser/Integrations + Memory/Knowledge + Proactive events + 3D Behavior + Security, with A–I engineering gates across all layers.
