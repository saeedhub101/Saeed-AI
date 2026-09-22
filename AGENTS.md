# Saeed AI — Agent Development Instructions

This file is the persistent source of truth for AI agents working on Saeed AI. Every AI coding agent must read it before making changes. Inspect the current repository and Git history first. Do not repeat existing work.

## Product
Saeed is a real Windows desktop AI Agent, not a demo or chatbot prototype. It is a native C++ Windows x64 application with a 3D character interface. The long-term product must reason over multi-step tasks, use Windows tools, interact with applications/files, perceive the screen, remember information, recover from failures, and communicate naturally in the user's language.

## Architecture
- Main application: native C++.
- Do not replace the application with C# or JavaScript.
- Do not create a separate Updater.exe. Updating is integrated into Saeed.exe.
- Avatar: assets/saeed.ai.glb, hosted through WebView2/Three.js.
- Native entry point: src/main.cpp.
- Build system: CMake.
- Windows CI: .github/workflows/build-windows-cpp.yml.
- Official version source: VERSION. Never hard-code the official version elsewhere.

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
- GitHub Actions creates/uploads the official Release automatically after a successful build when that version does not already exist.
- Never create a Release for every CI build.

## 3D Character
The centralized controller is in assets/avatar.html. Existing controlled areas include head, neck, spine, shoulders, arms, forearms, wrists, eyes, breathing, talking, gestures, facial expressions and procedural idle motion. Eye X/Z limits are ±15 degrees.

Existing natural behavior includes breathing, subtle head movement, eye saccades, blinking, speech gestures, occasional nods and subtle arm/hand motion.

Keep manual controller state separate from procedural offsets so idle animation never overwrites manual values. Do not create a second character controller.

Replacement GLB files should remain supported through automatic bone/morph detection where possible.

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
- assets/saeed.ai.glb
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
- Saeed must report native startup failures, WebView2 initialization failures, WebGL availability failures, JavaScript startup failures, and GLB loading failures in `%LOCALAPPDATA%\\Saeed\\saeed.log`.
- The 3D UI must show a clear human-readable startup diagnostic instead of silently remaining blank.
- A successful startup must emit the native diagnostic marker `STARTUP_READY: WebView2 + WebGL + GLB character loaded`.
- CI smoke tests must require that marker; a running EXE alone is not sufficient evidence that the avatar works.
- On successful character load, Saeed must visibly greet the user and attempt spoken greeting: "Hello. I am Saeed."
- Do not add Java, .NET, or unrelated runtime dependencies for the native C++ architecture unless a future design explicitly requires them.
