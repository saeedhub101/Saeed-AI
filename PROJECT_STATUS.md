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