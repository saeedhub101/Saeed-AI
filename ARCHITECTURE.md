# Saeed AI — Architecture and Development Contract

## 1. Responsibility boundaries

### C++ character host

C++ is responsible for the native desktop character host:

- Win32 character window;
- WebView2 controller used to display the 3D surface;
- work-area, monitor, DPI and window placement;
- tray and native desktop integration;
- character-host lifecycle;
- semantic character commands and the character bridge.

C++ must not grow into a second implementation of the Agent, memory, permissions, email, document, browser or task systems.

### Electron application

Electron is responsible for application intelligence and application settings:

- Agent runtime;
- Task Planner and Task Engine;
- Tool Registry;
- verification and recovery;
- computer, file, document, Office and browser capabilities;
- code/project capabilities;
- email;
- memory and knowledge;
- scheduling;
- permissions and audit state;
- LLM/STT/TTS/Realtime configuration;
- API-key handling;
- Settings UI.

Do not create a second Electron Agent or a second C++ Agent.

## 2. Character bridge

The character bridge is the boundary between application intelligence and the 3D host.

The Agent sends semantic character intents such as:

idle, listen, think, talk, greet, nod, walk, jump, look, emotion and stop.

The character host converts semantic commands into character behavior. Three.js/WebGL renders and animates the GLB inside the WebView2 character surface.

The LLM must never issue direct bone rotations.

## 3. Character data

The production character format is GLB.

The character runtime should auto-detect available hips/spine/chest/neck/head, eyes, arms/forearms/hands, thighs/legs/feet and facial morphs/visemes.

A replacement GLB must not require rewriting the Agent.

## 4. Agent execution contract

Every multi-step task follows:

Understand → Discover → Inspect → Plan → Execute → Observe → Verify → Recover/Retry → Re-plan → Report

A successful function return is not proof that the requested outcome happened.

Important actions require observable evidence. Retries are bounded. Destructive actions must not be blindly repeated.

## 5. Permission contract

Full Access is the default.

The permission policy is user-configurable and supports the existing Allow always / Ask always / Deny model.

Ask always requests must contain:

1. WHAT will happen;
2. TARGET;
3. WHY it is required;
4. Allow / Deny.

Do not add automatic sensitive-file restrictions or a second security policy.

## 6. Protected voice/API subsystem

The existing voice and API subsystem is a compatibility boundary.

Do not change its architecture or behavior during unrelated development.

Protected areas include:

- Always Listening;
- microphone start/stop lifecycle;
- current microphone settings;
- STT;
- TTS;
- Realtime;
- provider/model selection;
- API-key settings and secure storage;
- existing voice behavior.

Any future change to these areas requires explicit user instruction.

## 7. Settings

Settings belong to the Electron application layer.

Settings remain explicit and user-editable. API keys must never be written to ordinary logs, memory, prompts or public settings responses.

Character selection is configuration data, while character rendering/control remains the responsibility of the C++/WebView2 character host.

## 8. Existing module rule

### Tool module structure

The Tool Registry is intentionally split by capability family. `src/tools.js` is the stable ToolRegistry entry point and must remain the public owner used by the Agent, but it must not become a monolithic implementation file again.

Tool execution is organized under `src/tools/` into focused modules:

- `project_tools.js` — project discovery, code search, build/test and Git;
- `system_tools.js` — system and process inspection;
- `filesystem_tools.js` — files, directories, tasks and rollback;
- `computer_tools.js` — Windows applications, input and UI automation;
- `web_tools.js` — browser fetching, downloads and web navigation;
- `vision_tools.js` — screen observation, OCR and verification;
- `memory_tools.js` — persistent memory and knowledge;
- `office_tools.js` — Excel, Word and PDF;
- `data_tools.js` — database and pump/data mapping;
- `email_tools.js` — email operations;
- `scheduling_tools.js` — scheduled tasks;
- `schemas.js` — centralized tool schemas;
- `dispatcher.js` — centralized authorization and routing.

New tools must be added to the owning capability module and its schema/dispatcher registration. Do not put new capability implementations back into `src/tools.js` merely for convenience. Keep one ToolRegistry, one permission boundary and one dispatcher; this modular structure is now the required project pattern for all future development.


Before creating a new module:

1. search the repository;
2. identify the current owner of the capability;
3. extend that implementation;
4. avoid duplicate registries, agents, memory stores, permission engines or character controllers.

## 9. Legacy code rule

C++ code that belongs to the character host is active architecture.

Old C++ Agent/Task implementations are not a separate product. They must not be expanded into competing Agent functionality. When legacy C++ Agent logic overlaps with the Electron Agent, future work must converge on the Electron owner while retaining the C++ character-host responsibility.

C#/Godot implementations are not part of the target architecture.

## 10. Documentation rule

Keep repository documentation limited to:

- README.md — product purpose and high-level architecture.
- ARCHITECTURE.md — implementation architecture and development contracts.

Do not recreate separate roadmap, status, security, bridge or packaging instruction files unless the user explicitly requests a new document.

## 11. Capability coverage contract

The following capability phases define the required scope of the Saeed Agent. They are implementation requirements, not a claim that every item is already complete. Future development must preserve this scope and must not silently remove a capability.

### Phase A — Agent Core
1. Planner
2. Task state
3. Tool orchestration
4. Retry/recovery
5. Verification

### Phase B — Computer Agent
6. Windows UI inspection
7. OCR/UI detection
8. Robust mouse/keyboard control
9. Application control
10. Multi-window workflows

### Phase C — File/Office Agent
11. PDF
12. OCR
13. Word
14. Excel/XLSX
15. CSV/data transformation
16. ZIP/filesystem

### Phase D — Code Agent
17. Project discovery
18. Code search
19. Terminal
20. Build/test
21. Compiler error analysis
22. Patching
23. Verification
24. Git

### Phase E — Web/ERP
25. Browser automation
26. Downloads/uploads
27. API integrations
28. ERP workflows

### Phase F — Memory
29. Persistent memory
30. Project memory
31. Task memory
32. User preferences

### Phase G — Personality
33. Emotional state
34. Proactive events
35. Greetings
36. Calling the user
37. Reactions
38. Jokes
39. Singing
40. Dancing

### Phase H — 3D Character
41. Robust GLB renderer
42. Animation state machine
43. Full-body procedural movement
44. Lip-sync
45. Facial expressions
46. Eye/head tracking
47. Dance/gesture library
48. Low-resource rendering

### Phase I — Safety and Recovery
49. Permission engine
50. Sensitive-action confirmation
51. Audit log
52. Recovery/rollback

These phases are cross-cutting requirements for the production Agent. When implementing or reviewing a feature, identify its phase/item and extend the existing owning subsystem rather than creating a duplicate subsystem.

The current permission baseline is Full Access. The user may explicitly configure permission behavior. If an operation is configured to require confirmation, Saeed must present a clear request describing WHAT will happen, the TARGET, WHY the permission is needed, and Allow/Deny controls. The current project must not impose an unrelated default-deny policy.


## 12. Change discipline

Changes must preserve existing working behavior, especially voice, microphone and API settings.

For every requested change:

- inspect related existing code first;
- modify the owning subsystem;
- remove contradictory duplicate logic when safe;
- keep working interfaces stable;
- verify affected source behavior before declaring the task complete.
