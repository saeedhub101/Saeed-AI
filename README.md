# Saeed AI 2.0

**Saeed AI** is a production-oriented Windows desktop AI Agent and floating 3D companion. Version **2.0** establishes the project's long-term architecture: native C++ Windows execution, a persistent Agent Core, verified computer use, memory, extensible skills/tools, knowledge retrieval, model routing, scheduling, and a replaceable intelligent 3D character.

Saeed is **not** a chatbot demo. The repository is the source of truth for one coherent Agent product.

## Product contract

Saeed 2.0 is designed around these capabilities:

- **Agent Core:** understand goals, decompose work, plan, execute, verify, recover, retry safely, and re-plan.
- **Computer use:** inspect Windows, applications, processes, windows, files and screens; use mouse/keyboard; launch applications and URLs.
- **Perception:** screenshots, visual verification, and a future OCR/vision layer for identifying text and UI elements.
- **Application skills:** extensible adapters for browsers, Explorer, Office/Excel and other applications.
- **Web Agent:** search, open, read, interact, compare and download/upload with confirmation where needed.
- **Knowledge/RAG:** indexed documents, project files, PDFs, Word/Excel data, images and approved web knowledge.
- **Skills/tools:** modular tools with permissions, verification, recovery and evaluation hooks.
- **Persistent goals:** long-running goals survive task boundaries and can be resumed.
- **Scheduler/background work:** scheduled and recurring tasks with explicit permissions.
- **Model Router:** route general, coding, vision and future local/offline work to appropriate models/providers.
- **Memory:** persistent user/project/task/technical/preference knowledge with controlled retention.
- **Execution journal:** auditable task/tool state and results.
- **Safety:** destructive, financial, credential, account and other sensitive actions require appropriate confirmation.
- **Evaluation:** capability and regression tests must verify real behavior rather than source-code presence.
- **Voice:** Push to Talk, Smart Listening and Always Listening, with multilingual STT/TTS as the production backend evolves.
- **3D companion:** replaceable GLB character with full-body controller, facial behavior, idle behavior and animation support.

## Architecture

```
Saeed AI 2.0
├── Native Windows C++20 shell
│   ├── Win32 frameless/topmost companion
│   ├── DPI / multi-monitor / work-area handling
│   ├── system tray / startup / single instance
│   └── native Chat + Settings windows
├── Agent Core 2.0
│   ├── goal manager
│   ├── planner / task decomposition
│   ├── execution + verification
│   ├── recovery / retry / replanning
│   ├── permissions / confirmations
│   ├── execution journal
│   ├── context persistence
│   ├── model routing
│   ├── scheduler state
│   └── evaluation / skill hooks
├── Tool & Skill Layer
│   ├── Windows automation
│   ├── files / applications
│   ├── browser / web
│   ├── screen / vision
│   ├── memory / knowledge
│   └── future OAuth / cloud / MCP integrations
└── WebView2 + Three.js avatar runtime
    ├── replaceable GLB
    ├── bone auto-detection
    ├── Character Controller
    ├── base-pose detection
    ├── T-pose → A-pose correction
    ├── idle-animation selection
    ├── facial / morph controls
    ├── breathing / blinking / eye behavior
    └── speech / gesture / walking behavior
```

### Native desktop architecture

The main executable is **Saeed.exe**. C++ owns the Windows lifecycle, security boundary, agent bridge, computer-control layer, utility windows and update process.

WebView2 is reserved for the **3D avatar rendering surface**. Chat and Settings are independent top-level native Win32 windows. Avatar movement must never move the Chat or Settings windows.

There is no separate updater executable.

## Agent Core 2.0 contract

Agent Core 2.0 is the foundation for future agent intelligence. It must evolve as one system rather than as unrelated scripts.

### Required execution loop

1. Understand the user's goal.
2. Build or update a structured plan.
3. Inspect the current state.
4. Select the required skill/tool/model.
5. Ask for confirmation when policy requires it.
6. Execute the smallest appropriate action.
7. Verify the resulting state.
8. If verification fails, diagnose and recover safely.
9. Retry only within a bounded policy.
10. Re-plan when the environment or goal changes.
11. Persist relevant goal/task state.
12. Report the verified result in the user's language.

The Agent must never treat a tool invocation as proof that the requested outcome happened.

### Core state

Agent state must support:

- goals and long-running objectives;
- plans and plan revisions;
- task IDs and cancellation;
- step state and retry count;
- tool results;
- verification results;
- confirmation state;
- recovery/replanning;
- execution journal;
- relevant context and memory;
- model/provider routing;
- scheduled work.

## Computer-use requirements

Computer control is an execution capability, not an assertion mechanism.

Every important operation should have an observable verification path. Examples:

- launching an application → verify foreground process/window;
- focusing a window → verify focus;
- clicking → verify resulting UI/state when possible;
- typing → verify target context and resulting state;
- file operation → verify filesystem result;
- download → verify file existence/integrity;
- settings change → verify persisted value;
- avatar load → verify GLB/WebGL startup marker.

Sensitive operations remain confirmation-gated.

## Skill and tool architecture

New capabilities must be implemented as reusable skills/tools where practical. A skill should define:

- purpose and inputs;
- required permissions;
- execution method;
- expected result;
- verification method;
- safe retry/recovery behavior;
- failure conditions;
- evaluation tests.

Do not create duplicate implementations of existing memory, updater, character controller or tool systems.

## Knowledge and RAG direction

The production architecture must support retrieval from approved sources such as:

- local project files;
- PDFs;
- Word documents;
- spreadsheets;
- images;
- indexed application/project data;
- approved web sources.

Retrieved knowledge must remain distinguishable from live computer state and from user memory.

## Model routing

The Agent should eventually select models by task:

- general reasoning;
- coding;
- vision/screen understanding;
- document/knowledge tasks;
- local/offline tasks.

Routing must be explicit and observable. A model must never be claimed to have vision or tool capabilities that it does not actually provide.

## 3D Character System

The character is replaceable. The runtime must tolerate different GLB rigs and capabilities.

### Automatic base-pose controller

When a GLB loads:

1. Detect relevant bones automatically where possible:
   - Hips/Pelvis
   - Head/Neck
   - shoulders
   - upper/lower arms
   - hands/wrists
   - thighs/shins/feet
   - eyes
2. Measure the relationship of the hands to the head, shoulders and hips.
3. Classify the initial pose as approximately T-pose, A-pose or standing/other.
4. If the file contains an appropriate **Idle/Stand/Breath/Rest/Default** animation, select and play that animation as the base behavior.
5. If there is no suitable animation and the character is detected in T-pose, automatically lower the upper arms toward an A-pose using the detected rig geometry rather than hard-coded character dimensions.
6. If the rig is incomplete or unsuitable, leave the character static instead of throwing an error.
7. Procedural idle, speech and manual controller offsets remain separate from the base animation.

The controller must not assume that every character uses the same bone names, proportions, axes or animation set.

### Manual Character Controller

Current controller ranges include:

- Eyes X/Z: ±15°
- Head X/Y/Z: ±15°
- Neck X/Y/Z: ±15°
- Spine X/Y/Z: ±8°
- Arms: ±20°
- Forearms/Wrists: ±25°
- Thighs: ±25°
- Shins: ±30°
- Feet: ±20°

Natural behavior includes breathing, subtle idle motion, blinking, eye saccades, speech gestures and walking. Manual controller values remain authoritative; procedural behavior is additive.

If facial morphs do not exist, facial animation is skipped without failing the character.

## Voice and multilingual behavior

Saeed should understand the user's language and answer in that language by default. Production multilingual support depends on the actual STT/TTS backend; UI language and browser speech selection alone are not proof of universal language support.

Supported voice modes include Push to Talk, Smart Listening and Always Listening, with a visible Pause Listening control.

## Memory

Use the existing persistent memory system. Do not create a second memory database.

Memory categories include:

- personal
- preference
- project
- task
- technical
- general

Sensitive or unnecessary information must not be retained merely because it appeared in a conversation.

## Security

Sensitive actions require confirmation. This includes destructive operations, credential/account changes, payments/purchases, shutdown/restart where applicable, and protected Windows locations.

Protected paths include:

- C:\Program Files
- C:\Program Files (x86)
- C:\Windows
- C:\Windows\System32

Approvals are per-operation and are never permanent.

## UI requirements

- Chat and Settings are independent native Windows windows.
- They are movable and independently resizable where appropriate.
- Escape and the standard close button must always provide an exit path.
- Settings uses OK / Apply / Cancel semantics.
- Administrative UI is English.
- User conversation may be Arabic or another supported language.
- The avatar window remains separate from utility windows.
- The avatar must remain inside usable monitor/work-area bounds.
- The full character should be framed using actual GLB bounds rather than a fixed camera distance.

## Repository structure

- `src/main.cpp` — native Windows application and agent bridge.
- `src/agent_core2.hpp` — Agent Core 2.0 planning, goals, journal, permissions, routing and recovery foundation.
- `src/agent_core2.cpp` — Agent Core 2.0 runtime initialization.
- `assets/avatar.html` — Three.js/WebView2 avatar runtime and Character Controller.
- `assets/saeed.ai.glb` — default avatar asset used by CI/build.
- `assets/vendor/` — Three.js runtime prepared by CI.
- `.github/workflows/build-windows-cpp.yml` — mandatory Windows build, smoke test, packaging and release validation.
- `installer.iss` — Inno Setup installer.
- `AGENTS.md` — mandatory development contract for coding agents.
- `PROJECT_STATUS.md` — current implementation/handoff record.
- `VERSION` — official application version source.

## Build and release contract

The Windows pipeline must verify:

1. VERSION.
2. CMake/C++ x64 build.
3. Required executable/runtime/avatar files.
4. WebView2 Runtime.
5. Native smoke test.
6. `STARTUP_READY: WebView2 + WebGL + GLB character loaded`.
7. Portable ZIP.
8. Inno Setup installer.
9. SHA256 checksums.
10. Artifact upload.
11. Release publication and release assets.

A source-code change is not a verified feature until the relevant CI stages pass.

Official version: **2.0**.

Build numbers are CI identifiers; they are not substitutes for the product version.

## Local Windows build

Install Visual Studio C++ tools, CMake and Microsoft WebView2 Runtime:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

Output:

```
build/Release/Saeed.exe
```

## Development principle

Saeed 2.0 is one coherent Agent product. Future work should strengthen the Agent Core, skills, perception, verification, knowledge, voice, scheduling and character intelligence without replacing the native architecture or creating parallel systems.

The repository and Git history are the source of truth.
