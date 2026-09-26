# Saeed AI 2.0 — Agent Development Instructions

This file is the persistent source of truth for AI agents working on Saeed AI. Every AI coding agent must read it before making changes. Inspect the current repository and Git history first. Do not repeat existing work.

## CRITICAL: Build Verification and Status Reporting — NON-NEGOTIABLE

**No agent may claim that a build, test, release, fix, or deployment succeeded unless it has actually verified the corresponding result from GitHub Actions/release data.**

When more than one build exists for the work being discussed, **EVERY relevant build must be checked individually**. Checking only the newest build is prohibited.

Example:
- If builds 310, 311, 312, and 313 were created, verify **310, 311, 312, and 313 separately**.
- Do not infer the status of older builds from the status of a newer build.
- Do not infer success from a commit, workflow creation, job start, artifact existence, or a green compilation step.
- Do not say “build succeeded” when only the C++ compile succeeded. For a release candidate, verify the complete required pipeline.

### Required verification record for each build

For **each relevant build/run number**, inspect and record at minimum:
1. Workflow run status.
2. Workflow conclusion.
3. Commit SHA.
4. Build/compile job conclusion.
5. Native Windows smoke-test conclusion.
6. Packaging/installer conclusion.
7. Artifact upload conclusion, when applicable.
8. Release publication conclusion, when applicable.
9. Release assets, when a release was expected.
10. Exact failing job/error if anything failed.

A build is **not fully successful** unless all required stages for that workflow have passed. If a stage was skipped because an earlier stage failed, report that explicitly.

### Required language for status reports

- **Never** write “تم بنجاح”, “نجح”, “تم الإصدار”, “جاهز”, or equivalent unless the required evidence has been checked.
- If verification is incomplete, say **“لم أتحقق بعد”** or equivalent and continue verification before making a success claim.
- If a build failed, state the exact failing stage and the relevant error.
- If multiple builds exist, provide the status of **each build**, not just the latest one.
- Do not overwrite or omit an older failure merely because a later build succeeded.
- If a previous agent gave an unverified or incorrect success claim, correct the record using the actual GitHub evidence.
- Before answering a user asking for build/release status, first inspect the relevant GitHub Actions runs and, when applicable, jobs/logs/artifacts/releases. The answer must be based on current evidence, not memory or assumption.

### Release verification gate

A production release may only be described as released after verifying:
- the intended workflow completed successfully;
- the native build passed;
- the Windows smoke test passed;
- packaging/installer passed;
- required artifacts were uploaded;
- the GitHub Release exists;
- the expected release assets exist and are downloadable.

If any one of these has not been verified, the agent must not call the release successful.

### Historical-build verification rule

When the user asks about “all builds”, “the builds”, “what happened”, “which builds succeeded”, or similar:
- enumerate all relevant build numbers/runs first;
- verify each one individually;
- include both successes and failures;
- do not only inspect the latest run;
- do not assume that consecutive build numbers have the same result.

These rules exist specifically to prevent repeated false status reports and to ensure reliable handoff between AI agents.

## Product — Version 2.0

Saeed 2.0 is a real Windows desktop AI Agent, not a demo or chatbot prototype. Version 2.0 is the architectural baseline for all future development. It is a native C++ Windows x64 product with a replaceable 3D character and an Agent Core that must evolve toward planning, verification, recovery, perception, skills, knowledge/RAG, scheduling, model routing, multilingual voice, evaluation and safe long-horizon execution.

The implementation must remain one coherent product. Do not create parallel agent, memory, updater or character systems. It is a native C++ Windows x64 application with a 3D character interface. The long-term product must reason over multi-step tasks, use Windows tools, interact with applications/files, perceive the screen, remember information, recover from failures, and communicate naturally in the user's language.

## Architecture
- Main application: native C++.
- Do not replace the application with C# or JavaScript.
- Do not create a separate Updater.exe. Updating is integrated into Saeed.exe.
- Avatar: assets/saeed_AI-3D.glb, hosted through WebView2/Three.js.
- Chat and Settings: native Win32 C++ top-level windows in src/main.cpp. Do not reintroduce HTML/WebView2 utility UIs.
- Native entry point: src/main.cpp.
- Build system: CMake.
- Windows CI: .github/workflows/build-windows-cpp.yml.
- Official version source: VERSION. Never hard-code the official version elsewhere.

## Version 2.0 Architecture Requirements

The following are product requirements, not optional documentation goals:

- Agent Core: planning, goal management, execution state, verification, recovery/retry, replanning, permissions and execution journal.
- Perception: screen capture today; OCR/UI-element understanding and stronger computer vision as the production capability is expanded.
- Skills/tools: reusable application, Windows, web, file, knowledge and future integration skills with explicit verification and recovery.
- Knowledge/RAG: retrieval over approved local/project/document/web sources without confusing retrieved knowledge with live screen state.
- Scheduler/background goals: persistent scheduled work with permission boundaries.
- Model router: explicit general/coding/vision/local routing based on actual provider capabilities.
- Evaluation: automated capability/regression tests for agent behavior, computer-use verification and avatar loading.
- Character base-pose controller: detect T/A/standing posture from rig geometry, prefer embedded Idle/Stand/Breath/Rest/Default animation, convert T-pose to A-pose when no suitable idle animation exists, and fail gracefully for unsupported rigs.
- Character replacement: different GLBs must not require rewriting the agent architecture.
- UI independence: Chat and Settings remain independent native top-level windows and must never be coupled to avatar movement.

## Existing Systems
The repository already contains multi-step Agent/tool calling, task IDs/serialization/cancellation, confirmation and recovery, execution journal, structured task state, long-term memory, character state verification, screenshot/visual perception, Windows tools, a central 3D character controller, facial controller, natural idle/talking behavior, integrated updater, GLB character replacement, multi-monitor/DPI/work-area handling, system tray, startup and single-instance behavior.

Before adding a feature, search the code and Git history. Extend existing systems instead of creating parallel implementations.

## Security
Sensitive actions require user confirmation.

Protected Windows paths are not permanently forbidden. Every operation affecting protected locations must request fresh approval every time, including:
- C:\Program Files
- C:\Program Files (x86)
- C:\Windows
- C:\Windows\System32

After approval, perform only the approved operation, use UAC/elevation only for that operation, keep Saeed itself unelevated, never store permanent approval, and verify the result. Stop if approval is denied.

## Updater and Releases
There is only one executable: Saeed.exe.

The updater must check official GitHub Releases, compare installed VERSION with official tag vX.Y.Z, ask the user whether to update now or later, download the official installer, apply the update and restart Saeed, and never use build-number tags as production versions.

Release policy:
- Every successful CI build is retained as a GitHub Actions artifact.
- Only official versions are GitHub Releases.
- VERSION 0.3.1 -> v0.3.1; VERSION 0.3.2 -> v0.3.2.
- GitHub Actions creates/uploads the official Release as `v<VERSION>` after a successful main-branch build when that version does not already exist.
- CI build numbers remain diagnostic/artifact identifiers and are not part of the official product version tag.
- Never create a separate Release for every CI build.

## 3D Character
The centralized controller is in assets/avatar.html. Existing controlled areas include head, neck, spine, shoulders, arms, forearms, wrists, thighs, shins, feet, eyes, breathing, talking, gestures, facial expressions and procedural idle motion. Eye X/Z limits are ±15 degrees.

Existing natural behavior includes breathing, subtle head movement, eye saccades, blinking, speech gestures, occasional nods and subtle arm/hand motion.

Keep manual controller state separate from procedural offsets so idle animation never overwrites manual values. Do not create a second character controller.

Replacement GLB files should remain supported through automatic bone/morph detection where possible.

### Base-pose requirement

On every character load, inspect the rig geometry. Measure hands relative to head/shoulders/hips and classify the initial pose. Prefer a suitable embedded Idle/Stand/Breath/Rest/Default animation as the base animation. If no suitable animation exists and the pose is T-like, automatically solve a safe A-pose using the detected arm rig. If required bones are unavailable, display the character statically without an error. Never assume fixed character proportions or universal bone axes.

## Facial System
Existing facial profiles include neutral, happy, sad, surprised, angry, thinking, greeting and speaking, with smooth interpolation, blinking, speech mouth/jaw motion, sliders and save/load. Extend this controller rather than creating another facial system.

## Multilingual
Saeed should detect the user's language automatically, understand commands in that language, answer in the same language by default, and allow language switching during a conversation.

Do not claim literal support for every language until the actual STT/TTS backend supports it. Browser speech recognition/voice selection alone is not sufficient to guarantee every world language. Future production STT/TTS should use a multilingual backend/model.

## Voice
Support Push to Talk, Smart Listening, Always Listening, and a visible Pause Listening control. Do not add a wake-word dependency unless explicitly requested. Do not record calls, save call audio, or create call memories/reminders from calls. Do not claim browser speech recognition can guarantee zero interference with every third-party calling application.

## Windows/Desktop
Saeed should be a frameless desktop companion, support always-on-top behavior, understand monitor/work-area boundaries, support different resolutions and multiple monitors, avoid positioning outside usable work areas, provide system tray controls, support Windows startup, and remain single-instance. Do not break existing DPI/display/work-area handling.

## Memory
Existing long-term memory categories include personal, preference, project, task, technical and general. Do not create a second memory database. Follow the existing rule that arbitrary conversation should not be stored when explicit remembering is required.

## Agent Execution
Evolve toward reliable long-horizon execution:
1. Understand the request.
2. Break it into steps.
3. Inspect current computer state.
4. Execute tools.
5. Ask confirmation when required.
6. Verify important operations.
7. Recover from safe failures.
8. Continue when possible.
9. Report the result in the user's language.

Never blindly execute destructive or sensitive actions.

## Coding Rules
Before changing code:
1. Inspect the current relevant files.
2. Search Git history for related work.
3. Reuse existing functions/classes/state.
4. Understand dependencies between native C++ and avatar.html.
5. Make one coherent architectural change.
6. Build/test it.
7. Inspect CI results.

Do not duplicate controllers, updater programs, memory systems or existing tools. Do not accidentally revert working features or remove security confirmations. Do not claim completion without testing.

## Build and Release Verification
Required Windows release payload:
- Saeed.exe
- WebView2Loader.dll
- assets/avatar.html
- assets/saeed_AI-3D.glb
- official installer
- SHA256 checksums

The build must fail if required executable/runtime/avatar assets are missing. A successful CI build is not automatically a new official release unless VERSION represents that official version.

## Agent Handoff
When finishing work, update documentation when architecture/behavior changes, leave the repository buildable, record important decisions, do not create duplicate implementations, and ensure the next AI agent can understand the current state from repository files.

For substantial architectural changes update AGENTS.md and relevant documentation. Update README.md when user-facing behavior changes.

## Priority
1. Security and user confirmation.
2. Existing working architecture.
3. Correctness and data integrity.
4. Production stability.
5. Requested functionality.
6. Performance.
7. Cosmetic improvements.

## Core Principle
Saeed must evolve as one coherent product. An AI agent joining the repository must understand what already exists and continue from the current state rather than repeatedly rebuilding the same systems under different names.

The repository is the source of truth for implementation state. Git history is the source of truth for past decisions.

## Startup diagnostics and compatibility contract
- The installer must detect x64/OS compatibility and must verify Microsoft WebView2 Runtime after attempting installation.
- Saeed must report native startup failures, WebView2 initialization failures, WebGL availability failures, JavaScript startup failures, and GLB loading failures in %LOCALAPPDATA%\\Saeed\\saeed.log.
- The 3D UI must show a clear human-readable startup diagnostic instead of silently remaining blank.
- A successful startup must emit the native diagnostic marker STARTUP_READY: WebView2 + WebGL + GLB character loaded.
- CI smoke tests must require that marker; a running EXE alone is not sufficient evidence that the avatar works.
- On successful character load, Saeed must visibly greet the user and attempt spoken greeting: "Hello. I am Saeed."
- Do not add Java, .NET, or unrelated runtime dependencies for the native C++ architecture unless a future design explicitly requires them.


## UI Architecture Rules — Mandatory

### Current implementation note — 2026-09-23
The native utility windows now expose standard **OK / Apply / Cancel** Settings actions: OK saves and closes, Apply saves and remains open, and Cancel closes without saving pending edits. The 3D WebView2 surface remains renderer-only; its camera now fits the complete loaded GLB bounds dynamically across window aspect ratios and resizes, rather than relying on a fixed camera distance.
- Settings, account pages, update center, controller pages, and other administrative screens must be real top-level Windows windows, not cramped overlays inside the 3D avatar window.
- Chat and Settings utility windows are implemented with native Win32 C++ controls. WebView2 is reserved for the 3D avatar surface.
- Top-level utility windows must be movable, resizable where appropriate, independently closable, and must close on Escape.
- Settings must use a clear Windows-style navigation hierarchy with sections/tabs and a standard bottom action bar containing **OK**, **Apply**, and **Cancel** where changes are editable.
- **OK** applies changes and closes. **Apply** applies changes and keeps the window open. **Cancel** closes without applying pending changes.
- Account screens must be English and use explicit **Sign in / Sign up / Connect your account** wording.
- All shipped UI labels, menus, dialogs, update messages, errors, confirmations, and Windows taskbar notifications must be English. User chat content may remain in the language the user chooses.
- The chat must be a separate, stable top-level window with a familiar messenger layout, readable message history, a practical size, a standard close button, and no clipping/freezing.
- Never create a settings UI that cannot be exited. Escape and the window close button must always provide a reliable exit path.
- The 3D avatar window remains the companion surface; normal avatar walking must not move the native window around the desktop.


### Offline Local Command Engine

Native SAPI recognition routes common Windows commands through the C++ local command engine before forwarding speech to any AI provider. Offline commands include volume up/down/mute, launching common Windows applications, opening common folders, and playing a local music file from the Music folder. These commands must not require an API key or internet access. Extend this engine rather than duplicating command handling in JavaScript.


## MANDATORY WORKFLOW-FIRST RULE

Before starting **ANY** task — including a feature, bug fix, refactor, investigation, UI change, documentation change, build, release, or configuration change — every AI agent MUST inspect the current GitHub Actions workflow:

**.github/workflows/build-windows-cpp.yml**

The workflow is part of Saeed's implementation contract and is the baseline for the agent's work. Do not begin coding first and inspect the workflow later.

### Required order before every task

1. Read AGENTS.md.
2. Read the current .github/workflows/build-windows-cpp.yml.
3. Read PROJECT_STATUS.md and relevant README/documentation.
4. Inspect the latest relevant Git history/commits.
5. Inspect the newest relevant GitHub Actions runs and their jobs/results.
6. Identify which workflow stages, validation checks, artifacts, runtime dependencies, packaging rules, and release rules are affected by the task.
7. Only then implement the requested change.

If the workflow has changed since a previous task, the current workflow takes precedence over memory, previous agent instructions, or assumptions.

### Workflow baseline

The current workflow defines the required product validation pipeline, including:

- VERSION validation.
- CMake/C++ Windows x64 build.
- Avatar and Three.js runtime preparation.
- Required native release payload.
- WebView2 Runtime installation and verification.
- Native Windows smoke test.
- STARTUP_READY WebView2 + WebGL + GLB verification.
- Optional code signing.
- Portable ZIP packaging.
- Inno Setup installer creation.
- SHA256 generation.
- Final artifact verification.
- CI artifact upload.
- GitHub Release publication and release-asset verification.

When a task changes behavior covered by one of these stages, the agent must verify that the workflow still validates the changed behavior and update the workflow when required.

### Do not bypass the workflow

Agents must not:

- Treat local compilation as proof that the GitHub build will pass.
- Remove or weaken an existing validation step merely to make a build green.
- Create a parallel build/release pipeline without a concrete architectural reason.
- Change packaging, startup, WebView2, avatar, installer, signing, or release behavior without inspecting the corresponding workflow stage.
- Assume an old workflow is still the current baseline.

### Completion rule

After implementation, inspect the applicable GitHub Actions run and verify the stages relevant to the change. For production/release work, the full build and release verification rules already defined in this document remain mandatory.

This rule exists so every future AI agent starts from the actual current build pipeline and continues the project instead of rebuilding, bypassing, or contradicting existing work.


## Current Capability-Completion Gate — 2026-09-26

Before the next production Build/EXE/Release, complete the capability contract in CAPABILITIES.md. During this phase agents may modify source code and documentation, but must not trigger a production build, create a new EXE, or publish a Release.

### Unified Allow/Deny rule

Any sensitive or high-risk operation must be routed through the unified permission engine and receive a fresh user decision. The prompt must explicitly state the operation, exact target, and reason for the permission request, followed by Allow/Deny.

Ordinary operations that are within the user's request remain direct: reading files, ordinary Excel edits requested by the user, opening applications/sites, inspection, and other non-dangerous operations.

Protected Windows locations include:
- C:\Windows
- C:\Program Files
- C:\Program Files (x86)

Protected-location operations require fresh approval every time. Approval is not persistent. If denied, Saeed must not perform the operation and should continue with a safe alternative when one exists.

The same policy applies to destructive PowerShell/CMD commands, registry/service/security changes, shutdown/restart/logoff, software installation/removal, important system-setting changes, and other actions that can materially affect system state, privacy, credentials or user data.

The implementation must not use a generic unexplained confirmation. Permission requests must carry structured operation/target/reason data to the UI.

### Scope before final build

The capability-completion scope includes:
Excel, Word, PDF text/table extraction, files/folders, Windows/PowerShell, Browser Agent, Code/Project Agent, Build/Test/Debug capability, installed applications, Memory, Task Planning/Scheduling, Knowledge/RAG, Model Routing, Vision/OCR, Computer Control, Verification/Recovery, Voice modes, Desktop/3D character behavior, prompt-injection defense, activity logging, rate/scope limits, Dry Run and Emergency Stop.

See CAPABILITIES.md for the authoritative capability contract.
