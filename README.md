# Saeed AI

Saeed is a Windows desktop AI companion designed as one coherent product: an AI Agent that can understand multi-step goals, operate Windows and applications, work with documents and projects, use web/integration capabilities, retain approved memory, and drive a persistent 3D character.

## Product vision

Saeed is intended to behave like a capable desktop employee rather than a simple chatbot.

Execution model:

Understand → Discover → Inspect → Plan → Execute → Observe → Verify → Recover/Retry → Re-plan → Report

Important operations must be verified from observable evidence. External web pages, email content, downloaded documents and other external content are untrusted data and cannot override Saeed's rules.

## Architecture at a glance

The project has two cooperating desktop layers.

### C++ / WebView2 character host

C++ owns the native desktop character surface:

- native character window;
- WebView2 used to display the 3D surface;
- monitor, work-area and DPI behavior;
- placement, sizing and desktop interaction;
- tray/native desktop integration;
- character-host lifecycle and character commands.

The 3D character is GLB-based. Rendering and animation happen in the WebView surface.

### Electron application

Electron owns application intelligence and application settings:

- Agent and Tool Registry;
- task execution, planning, verification and recovery;
- Windows/computer capabilities;
- files, documents and Office;
- code/project capabilities;
- browser/integrations;
- email;
- memory and knowledge;
- scheduling and proactive events;
- permissions;
- LLM/STT/TTS/Realtime configuration;
- API-key handling;
- Settings UI.

These responsibilities must not be duplicated.

## 3D character rule

The character control path is:

LLM/Agent intent → Character behavior → Character command bridge → C++ character host → WebView2/Three.js → GLB bones/morphs

The LLM never directly manipulates bones.

The replaceable GLB character should support, when the selected asset provides the required data:

- idle and breathing;
- listening and thinking;
- talking and lip-sync;
- blinking;
- eye/head tracking;
- nodding and gestures;
- walking and full-body behaviors;
- facial expressions;
- character replacement.

## Voice, microphone and API contract

The existing voice, microphone and API subsystem is a protected working subsystem.

Do not redesign, replace, simplify, migrate or otherwise alter it unless the user explicitly requests it.

Preserve:

- Always Listening;
- microphone enable/disable and device lifecycle;
- current STT/TTS/Realtime behavior;
- current API-key storage and settings;
- current provider/model settings;
- current voice settings.

Changes elsewhere must not silently change this subsystem.

## Permissions

The default permission model is Full Access.

The user can configure operation/category policies such as Allow always, Ask always and Deny.

When Ask always is configured, Saeed shows what will happen, the target, the reason, and Allow/Deny controls.

Do not introduce a second permission system, a global sensitive-file block, or a default-deny policy.

## Main capability areas

- Agent planning, task state, orchestration and recovery.
- Windows computer interaction and verification.
- Files and folders.
- PDF, OCR, Word, Excel and structured document workflows.
- Code/project discovery and repair.
- Browser and integration workflows.
- Email.
- Memory and local knowledge.
- Scheduling and proactive events.
- Central permissions and verification.
- 3D character behavior and desktop interaction.

## Documentation

The repository intentionally keeps documentation to two files:

- README.md — product purpose and high-level architecture.
- ARCHITECTURE.md — detailed implementation boundaries and development contracts.

Everything else belongs in source code or Git history unless the user explicitly requests another document.
