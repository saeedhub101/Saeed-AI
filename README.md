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
- Thighs: **-25° to +25°**
- Shins: **-30° to +30°**
- Feet: **-20° to +20°**

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


## Development status — September 22, 2026

### 0.3.6 desktop UX hardening

- Compact 320x420 default companion window with bottom-right placement and smaller maximum size.
- Settings redesigned as a scrollable English-first screen with Back/Close navigation and Arabic language switch.
- Account connection UI uses **Sign in / Connect your account** and exposes Google, Microsoft/Hotmail, Facebook, and Email & Password entry points. Live provider OAuth still requires real provider application credentials and PKCE/redirect configuration; the UI never fabricates a connected account.
- Microphone controls moved out of the character area into the right-click menu; permission is checked before recognition and recognition language can be selected.
- Windows startup is enabled/repaired automatically and the installer registers the HKCU Run entry.
- Uninstall removes Roaming and Local Saeed user data.
- Custom character loading now uses a dedicated WebView2 virtual host instead of `file:///` URLs.


This repository is the source of truth for continuous Saeed AI development. The native C++ agent, Windows automation, persistent memory, and 3D character systems are integrated and are being hardened incrementally.

### Agent / Windows automation

- Multi-step agent loop with configurable maximum steps (1–32; default 12).
- Serialized confirmation requests with response-ID validation for sensitive actions.
- Active-window, window-list and monitor inspection.
- window_geometry reports window rectangle, monitor, PID, minimized/maximized state and title.
- Screen capture can be supplied to the vision-capable model for visual verification.
- Focus/close/minimize/maximize operations verify their resulting Windows state.
- Mouse positioning is read back from Windows before a click is sent.
- Keyboard/text input verifies SendInput results.
- Application and URL launching reports the resulting foreground window/PID after launch instead of relying only on ShellExecute.
- Native tray lifecycle, Windows startup option, Ctrl+Shift+S visibility hotkey, session lifecycle, single-instance protection, DPI and multi-monitor work-area handling.
- Native crash logging under %LOCALAPPDATA%\\Saeed\\saeed.log.

### Long-term memory

- Persistent local memory with categories: personal, preference, project, task, technical, general.
- Importance 1–5 and relevance-ranked recall.
- Automatic relevant-memory injection into agent context.
- Arabic-aware tokenization for automatic memory matching.
- New memories receive persistent IDs.
- forget removes a memory by ID or matching fact when the user explicitly requests deletion.

### Character / facial system

The central controller is in assets/avatar.html. Manual pose values remain authoritative while procedural motion is applied as separate offsets. Controls cover eyes, head, neck, spine, shoulders, arms, forearms, wrists, breathing, talking, gestures and facial behavior. Facial profiles include neutral, happy, sad, surprised, angry, thinking, greeting and speaking. Automatic blink, eye saccades, idle motion and speech gestures are supported.

The live character_state bridge lets the native agent read the actual controller, facial and behavior state from the running avatar for verification.

### Engineering rule

A feature is not considered verified merely because source code changed. Native features must pass the relevant GitHub Actions build/smoke test before being described as verified or release-ready.

### Verified checkpoint

- Native Windows build #117 succeeded and produced Saeed-Windows-x64-117.
- Preview build #170 succeeded on the current development line before the newest native changes.
- Newer changes remain subject to their own Actions verification.

### Development priorities

1. Continue hardening computer-use verification and failure reporting.
2. Add robust agent task cancellation and status handling.
3. Expand structured memory management and wall-clock timestamps.
4. Continue improving natural body movement, facial behavior and controller quality.
5. Keep this README and a dedicated project-status document synchronized with significant changes.

### Agent task lifecycle
Saeed now serializes active Agent tasks and exposes structured task states (`running`, `thinking`, `tool`, `waiting_confirmation`, `approved`, `denied`, `cancelling`, `completed`, `cancelled`, `error`) with a task ID. The UI can cancel the active task; cancellation first reports `cancelling`, then the Agent loop emits the final `cancelled` state. Successful Agent completion releases the task lock so subsequent requests can run. Confirmation requests now expose an explicit `waiting_confirmation` state and report `confirmation_timeout` after 60 seconds without a decision.


### Input verification

Text and keyboard Agent actions now report the resulting foreground process/window context after `SendInput`, so the Agent has explicit evidence about the target context instead of treating input dispatch alone as proof of success.

## UI architecture

Saeed's core is native C++20. The 3D companion remains rendered by WebView2/Three.js because the current avatar pipeline uses WebGL and GLB loading. The Chat and Settings utility windows are native Win32 C++ windows; the former `assets/chat.html` and `assets/settings.html` utility pages have been removed. Future utility UI work must extend the native C++ windows rather than reintroduce HTML utility pages.

### Latest UX hardening — September 23, 2026

- The desktop companion window now provides more vertical room for the full character.
- Avatar framing is calculated from the actual GLB bounds and current viewport aspect ratio, and is recalculated after resize so the full body remains visible.
- Native Settings now uses standard **OK / Apply / Cancel** behavior instead of closing on Apply.
