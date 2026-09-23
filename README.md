# Saeed AI

**Saeed AI** is a Windows-first desktop AI agent and floating 3D companion. The current application is a **native C++20 Windows program**.

## What Saeed is designed to become

- **AI Agent:** plans and executes multi-step computer tasks.
- **Computer control:** inspect Windows, applications, processes and files; use mouse/keyboard; open applications and URLs.
- **Screen awareness:** capture the desktop so a vision-capable model can inspect the current state.
- **Persistent memory:** conversations and remembered information are stored locally.
- **Multiple AI providers:** provider/model settings are configurable.
- **3D companion:** transparent, borderless, always-on-top native Windows window with a replaceable GLB avatar.
- **Character system:** centralized controller for eyes, head, neck, spine, shoulders, arms, forearms, wrists, thighs, shins and feet, plus breathing, speech and facial behavior.
- **Safety:** sensitive or irreversible computer actions are designed to require confirmation.

## Current Windows architecture

```
Saeed AI
├── Native Windows C++20 desktop shell
│   ├── Win32 frameless/topmost companion window
│   ├── Per-monitor DPI / work-area handling
│   ├── Native Chat and Settings windows
│   └── Agent / computer-control bridge
├── Agent loop / LLM provider layer
├── Tool registry
│   ├── Windows inspection
│   ├── Mouse / keyboard control
│   ├── Files / applications
│   ├── Web search
│   ├── Screen capture
│   └── Memory / tasks
└── DirectX 11 + DirectComposition avatar renderer
    ├── GLB mesh/material loading
    ├── Optional rig/animation support
    ├── Optional morph-target facial animation
    ├── Automatic capability-safe character control
    └── Full-body camera framing
```

The Windows runtime does **not** depend on HTML chat/settings pages. WebView2/Three.js is retained only where needed by the browser preview architecture; the native Windows avatar path is DirectX 11 + DirectComposition.

## Character Controller

The controller keeps manual pose values authoritative. Procedural idle, speech and walking motion are layered separately so natural motion does not overwrite manual values.

Current limits include:

- Eye X/Z: **-15° to +15°**
- Head X/Y/Z: **-15° to +15°**
- Neck X/Y/Z: **-15° to +15°**
- Spine X/Y/Z: **-8° to +8°**
- Arms: **-20° to +20°**
- Forearms/wrists: **-25° to +25°**
- Thighs: **-25° to +25°**
- Shins: **-30° to +30°**
- Feet: **-20° to +20°**

If a replacement GLB lacks a rig, animation or facial morphs, those capabilities are skipped without making the mesh unusable.

## Repository structure

- `src/main.cpp` — native Windows application, Agent loop and computer-control bridge.
- `src/dx11_avatar_renderer.cpp` — native DirectX 11 GLB avatar renderer and character deformation.
- `src/saeed_task_engine.cpp` — task dependency, retry and execution state handling.
- `assets/Saeed_AI-3D.glb` — native avatar asset used by the Windows build.
- `.github/workflows/build-windows-cpp.yml` — Windows C++ build, smoke test, packaging and verification pipeline.
- `installer.iss` — Inno Setup installer definition.
- `docs/index.html` — browser preview.

## Verified Windows build

The latest verified native Windows workflow is **Build Saeed Native C++ #554** from commit `9dcf65e9f3e8f524ce8a0591a961b9764f4ec0d3`.

All of these workflow stages passed:

- C++ configure/build
- native release-file verification
- native Windows smoke test
- portable ZIP packaging
- Inno Setup installer build
- SHA256 checksum generation
- final artifact verification
- SPDX SBOM generation
- executable/installer/portable-package provenance attestations
- CI artifact upload

The workflow produced the artifact **Saeed-Windows-x64-554**. Optional code signing was skipped because signing credentials are not configured yet, so Windows will not identify the unsigned executable/installer as publisher-signed.

The production version file is currently **0.3.9**. CI build number 554 is a verification/build identifier, not the semantic application version.

## Local Windows build

Install Visual Studio Build Tools with C++ support and CMake, then run:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

The native executable is produced at:

```
build/Release/Saeed.exe
```

## Avatar

The native runtime loads the configured GLB asset independently from the AI-agent layer. Rigging, animation and facial morphs are optional capabilities, so user-supplied replacement characters can remain static when unsupported features are absent.

The renderer calculates camera distance from the full GLB bounds and viewport aspect ratio so the complete body, including feet, remains visible.

## Project status

This GitHub repository is the source of truth for Saeed AI. Development changes must be committed here so future agents can continue from the current implementation rather than rebuilding the project from zero.

The 150-stage roadmap remains the governing development checklist. A stage is considered verified only after implementation, Windows build, native smoke test, artifact verification and relevant runtime verification all pass.

## Release and signing policy

The CI pipeline prepares:

1. native executable;
2. portable ZIP;
3. Inno Setup installer;
4. SHA256 checksums;
5. SPDX SBOM;
6. GitHub provenance attestations.

Code signing is intentionally optional until the real signing certificate and credentials are configured. The publisher identity used by the application/installer metadata is **Saeed O. Almansour**; that metadata is not the same thing as a cryptographic Windows Authenticode signature.

## Engineering rule

A feature is not considered verified merely because source code changed. Native features must pass the relevant GitHub Actions build/smoke workflow before being described as verified or release-ready.
