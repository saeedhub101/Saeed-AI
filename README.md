# Saeed AI

**Saeed AI** is a Windows-first desktop AI agent and floating 3D companion. The current application is a **native C++ Windows program**, not an Electron application.

## What Saeed is designed to become

- **AI Agent:** plans and executes multi-step computer tasks.
- **Computer control:** inspect Windows, applications, processes and files; use mouse/keyboard; open applications and URLs.
- **Screen awareness:** capture the desktop so a vision-capable model can inspect the current state.
- **Persistent memory:** conversations and remembered information are stored locally.
- **Multiple AI providers:** provider/model settings are configurable.
- **3D companion:** transparent, borderless, always-on-top native Windows window with a replaceable GLB avatar.
- **Character system:** a central controller for eyes, head, neck, spine, shoulders, arms, forearms, wrists, breathing, speech gestures and facial behavior.
- **Safety:** sensitive or irreversible computer actions are designed to require confirmation.

## Current architecture

```
Saeed AI
├── Native Windows C++ desktop shell
│   ├── Win32 frameless/topmost window
│   ├── Per-monitor DPI / work-area handling
│   └── WebView2 bridge
├── Agent loop / LLM provider layer
├── Tool registry
│   ├── Windows inspection
│   ├── Mouse / keyboard control
│   ├── Files / applications
│   ├── Web search
│   ├── Screen capture
│   └── Memory / tasks
└── Three.js avatar runtime
    ├── Central Character Controller
    ├── Facial / blink controls
    ├── Natural idle motion
    ├── Speech gestures
    └── assets/saeed.ai.glb
```

The native executable is `Saeed.exe`. WebView2 renders the 3D interface, while C++ owns the Windows window, agent bridge and computer-control layer.

### Character Controller

The controller keeps manual pose values authoritative. Procedural idle and speech animation are applied as separate offsets, so natural motion does not overwrite values selected in the controller.

Current limits include:

- Eye X/Z: **-15° to +15°**
- Head X/Y/Z: **-15° to +15°**
- Neck X/Y/Z: **-15° to +15°**
- Spine X/Y/Z: **-8° to +8°**
- Arms: **-20° to +20°**
- Forearms/wrists: **-25° to +25°**

Automatic behaviors include blinking, eye saccades, subtle idle motion, breathing and speech gestures. Behavior settings persist locally.

## Repository structure

- `src/main.cpp` — native Windows application, WebView2 host, agent loop and computer-control bridge.
- `assets/avatar.html` — Three.js/WebView2 avatar UI and central character controller.
- `assets/saeed.ai.glb` — current avatar model used by the Windows build.
- `assets/vendor/` — Three.js runtime files prepared by the Windows build.
- `.github/workflows/build-windows-cpp.yml` — Windows C++ build, smoke test, portable ZIP and installer pipeline.
- `installer.iss` — Inno Setup installer definition.
- `docs/index.html` — browser preview.

## Windows build

GitHub Actions builds the native C++ application on `windows-2022`.

The pipeline:

1. prepares the Three.js runtime and avatar;
2. configures and builds the C++ application;
3. verifies the release payload;
4. launches the executable in a Windows smoke test;
5. creates a portable ZIP;
6. builds an Inno Setup installer;
7. optionally signs the binaries;
8. publishes SHA256 checksums and build artifacts.

A successful Windows Actions run is the verification point for the downloadable executable. The repository should not claim an EXE is verified until that run succeeds.

## Local Windows build

Install Visual Studio Build Tools with C++ support, CMake and the WebView2 runtime, then run:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

The native executable will be produced at:

```
build/Release/Saeed.exe
```

## Avatar

The current runtime loads:

```
assets/saeed.ai.glb
```

The avatar is kept independent from the AI-agent layer so the final rigged personal character can be replaced without redesigning the agent architecture.

The displayed idle pose should remain a natural standing pose rather than reverting to a T-pose.

## Project status

This GitHub repository is the source of truth for Saeed AI. Changes should be committed here so development can continue without rebuilding the project from zero.
