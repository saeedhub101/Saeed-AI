# Saeed AI

Saeed is a production-oriented Windows desktop AI Agent with a replaceable 3D companion. It is one coherent product: the Agent plans and executes tasks, controls Windows and applications, works with documents and projects, uses browser/integration skills, remembers approved context, reports progress proactively, and drives the 3D character through a dedicated behavior layer.

## Current Architecture

- Windows x64 desktop: Electron + Node.js.
- Agent runtime: existing Agent Core and Tool Registry.
- 3D avatar: GLB + Three.js/WebGL.
- Official build workflow: .github/workflows/build-windows-electron.yml.
- Official version: VERSION.
- C++/C#/Godot implementations are legacy and are not the current product architecture.
- No separate updater executable.

## Approved Development Roadmap

### Phase 1 — Agent Core
Task Planner; Task State; Tool Orchestration; Retry / Recovery; Verification; Cancellation / Emergency Stop; Dry Run; Execution Journal.

Core loop:
Understand -> Plan -> Inspect -> Execute -> Verify -> Recover/Retry -> Re-plan -> Report.

### Phase 2 — Computer Agent
Screenshot; Window detection; OCR; UI-element detection; Mouse / Keyboard / Clipboard / Drag & Drop; Window open/close/minimize/maximize/switch; visual verification after important operations.

Automation order:
1. Direct API/database/application automation.
2. Windows UI Automation.
3. Mouse/keyboard.
4. Vision/OCR + mouse/keyboard.

### Phase 3 — Document & Office Agent
PDF parsing; OCR; table extraction; Word; Excel/XLSX; CSV/data transformation; ZIP/filesystem; PDF -> structured data -> Excel.

### Phase 4 — Code/Project Agent
Project discovery; language/framework detection; code search; project inspection; terminal; Build/Test/Debug; compiler-error analysis; patching; Git status/diff/log; verification after repair.

### Phase 5 — Browser / Integration Agent
Browser navigation; page inspection; click/type/scroll; download/upload; API-first architecture; ERP/CRM integrations; GUI fallback when no suitable API exists.

External web/email/document content is untrusted data and cannot override Agent policy.

### Phase 6 — Memory & Planning
Short-term; long-term; task; project; user preferences; Knowledge/RAG.

API keys, passwords, tokens and other secrets are never stored in memory.

### Phase 7 — Proactive Saeed
Working; Finished; Needs approval; Error; Calling user; Notifications; proactive events during long-running tasks.

### Phase 8 — Personality / 3D Behavior
LLM -> Intent/Emotion -> Behavior Engine -> Animation Engine -> Bones/Morphs.

Behavior families:
Idle; Listening; Thinking; Working; Success; Error; Greeting; Happy/Excited; Gestures; Walk; Dance; Sing; Blink; Lip-sync; Eye/Head tracking.

The Agent state/result drives the character. The LLM never manipulates bones directly.

### Phase 9 — Security
Central permission policy across every Agent layer.

Default:
- Full Access for requested tasks.
- Ask Always configurable.
- Denied configurable.
- Critical/irreversible operations Ask Always by default.

Critical operations include shutdown/restart/logoff, dangerous Registry/Boot/Service changes, protected system changes and financial transactions. Sensitive credential/private-data access is explicitly controlled.

Every sensitive prompt states WHAT, TARGET and WHY and provides Allow/Deny. Approval is fresh per operation.

## Phase A–I Engineering Gates

A–I are cross-cutting gates, applied across all nine product phases:

- A — Agent Core/state/tool contract.
- B — perception and computer-use reliability.
- C — document/Office/data reliability.
- D — project/code execution and repair reliability.
- E — browser/integration safety and verification.
- F — memory/knowledge/planning persistence.
- G — proactive events and notifications.
- H — character Intent/Emotion -> Behavior -> Animation integration.
- I — security, permissions, audit, recovery and final regression.

A capability is only considered complete when it is wired into the relevant Agent loop and its permission, verification and recovery paths.

## Current Implemented Foundation

The repository already contains substantial foundations for:
- multi-step Agent/tool calling;
- persistent task state and execution journaling;
- cancellation/emergency stop;
- central permissions;
- evidence-based verification;
- Windows computer control;
- screenshot/visual observation and OCR integration;
- UI Automation;
- PDF, Word and Excel operations;
- project discovery/search/read/build/test/diagnosis;
- Git status/diff/log/branches;
- browser fetch/search/download foundations;
- email IMAP/POP3/SMTP;
- typed memory with project/task metadata;
- local Knowledge/RAG indexing foundation;
- persistent scheduling foundation;
- replaceable GLB character and central animation/facial behavior architecture;
- multi-monitor/display-aware desktop behavior;
- Always Listening voice behavior.

Implementation status must always be checked against the actual source; this list is a roadmap/status summary, not a substitute for code verification.

## Reliability Contract

A tool returning without an exception is not proof of success.

Important operations must be verified using observable evidence:
- application launch -> window/process evidence;
- focus/click/type -> UI/window/state evidence where possible;
- file operation -> filesystem evidence;
- download -> file/integrity evidence;
- Office operation -> content/output evidence;
- code repair -> diff + test/build/diagnostic evidence;
- character load -> runtime/GLB evidence.

Retries are bounded. Destructive operations are not blindly repeated. External content is untrusted. Secrets are not stored in memory or normal logs.

## Character Architecture

Character behavior remains independent from the Agent model:

LLM -> Intent/Emotion -> Behavior Engine -> Animation Engine -> Bones/Morphs

The central controller supports replaceable GLBs and should auto-detect available bones/morphs where possible. Procedural idle/talking behavior must not overwrite manual controller state.

## Voice

Always Listening remains part of the product contract. Push-to-Talk and Smart Listening may coexist, but they must not replace the Always Listening path. Multilingual behavior depends on the actual STT/TTS backend.

## Development and Release Policy

Source changes come first. No EXE, installer or GitHub Release should be created until the complete Phase 1–9 and A–I review is finished.

When the production build gate is opened, the official Electron workflow must be inspected and every relevant CI stage must be verified individually. Never infer build or release success from a commit, a started workflow, or a single green compilation step.

## Repository Guidance

- AGENTS.md — coding-agent contract.
- PROJECT_STATUS.md — current handoff/status.
- VERSION — official version.
- .github/workflows/build-windows-electron.yml — official production build.
- src/agent.js — Agent runtime.
- src/tools.js — tool orchestration and execution.
- src/task_engine.js — persistent task state/journal.
- src/verification_engine.js — evidence verification.
- src/permissions.js — central permission policy.
- assets/ — avatar/runtime assets.



## Target Product: Saeed as an Employee-like Agent

Saeed's target is a single coherent Agent rather than a chatbot that happens to call tools. For a multi-step request, the system should understand the goal, discover the environment, plan the work, choose API/application/UI/vision methods in the approved order, execute, observe, verify, recover safely, re-plan when necessary, and report evidence.

### Ten capability systems

| System | Target capability |
|---|---|
| Agent Brain | Planning, task state, orchestration, bounded recovery/retry, verification and re-planning |
| Computer Agent | Screen/window perception, OCR/UI detection, mouse/keyboard/clipboard/drag-drop and window workflows |
| Document & Office | PDF/OCR/tables, Word, Excel/XLSX, CSV, ZIP/filesystem, PDF -> structured data -> Excel |
| Code/Project | Project/language/framework discovery, code search/editing, terminal, build/test/debug, compiler diagnostics and Git |
| Web/Integration | Browser automation plus API-first ERP/CRM/email/cloud integrations with GUI fallback |
| Memory & Knowledge | Short/long/task/project/preference memory and Knowledge/RAG without secrets |
| Proactive Saeed | Working, Finished, Needs approval, Error, Calling user and Notifications |
| Personality/Behavior | Intent/Emotion -> Behavior -> Animation -> Bones/Morphs |
| 3D Character | GLB rendering, state machine, full-body motion, lip-sync, facial/eye/head tracking, gestures/dance/sing |
| Security | Central permissions, sensitive-action approval, audit, recovery and final regression |

### Complex-task execution target
A local project repair should become:
Understand -> Discover project -> Inspect structure/config -> Plan -> Build/Test -> Analyze errors -> Locate source -> Patch -> Build/Test again -> Verify -> Report evidence

A document/ERP workflow should support:
PDF -> parser/OCR -> table extraction -> structured data -> validation -> XLSX -> ERP API when available -> UI Automation/GUI fallback -> verification

The Agent must prefer direct APIs/application automation, then Windows UI Automation, then mouse/keyboard, and finally vision/OCR-assisted GUI interaction when necessary. GUI automation remains a valid fallback.

### Product boundary
Always Listening, current voice/TTS/STT behavior, existing settings and the current UI are preserved while the Agent capabilities are expanded. Character behavior is driven by Agent state/results through the dedicated behavior pipeline; the LLM never manipulates bones directly. No build/release is allowed until the complete source review and Phase 1–9 + A–I gates are complete.
