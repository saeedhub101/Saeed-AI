# Saeed AI

Saeed AI is a Windows desktop AI companion: a small transparent always-on-top desktop character, an AI agent that can use the computer with permission, and a 3D character engine that adapts to the capabilities of each GLB character.

## Single source of project truth

**This root README.md is the authoritative project specification and development instruction set.**

Do not create or maintain a second root instruction file such as AGENTS.md, ROADMAP_150.md, or PROJECT_STATUS.md. If an implementation detail changes, update this README so future agents do not receive conflicting instructions.

## Production architecture

The production Windows application uses:

1. **Electron** for the desktop shell and secure main/preload boundary.
2. **Three.js** for the 3D character runtime.
3. **WebGPU first**, with **WebGL2 fallback**, for broad Windows compatibility.
4. **Saeed Character Controller** for capability-aware animation and procedural movement.
5. **AI Agent + Tool Registry** for natural-language tasks, computer control, screen inspection, memory and tools.
6. **NSIS / electron-builder** for the Windows x64 installer.

The old native DirectX/OpenGL/Filament renderer laboratories and bgfx/Vulkan experiments are not part of the production runtime and must not be reintroduced unless the user explicitly changes the architecture.

## Desktop UX requirements

Saeed must behave as a compact desktop companion, not as a large application window.

- Transparent, frameless, always-on-top character window.
- Character-sized footprint by default.
- The transparent area should not block normal mouse interaction with other applications.
- When the user opens Chat or another interactive panel, the window may expand temporarily.
- Chat/settings must remain usable and must provide a clear way back to the character.
- Multi-monitor and different display resolutions must be handled safely.
- The character must never be cropped because of the companion window aspect ratio.
- Startup and rendering failures must degrade gracefully instead of crashing the application.

## Authoritative character asset

The production/default character is exactly:

`assets/Saeed_AI-3D.glb`

Do **not** rename or copy it to `saeed.ai.glb`. Do not add an old `saeed.ai.glb` alias.

The runtime must load the asset from the path above. The asset is approximately 76 MB in the repository and is the canonical Saeed character.

Replacement-character support remains part of the architecture: a future user-selected GLB may differ from the default and must never cause a fatal error merely because it lacks a rig, animation clips, facial morph targets, or specific bones.

## Character capability rules

The controller must inspect the loaded GLB and enable only capabilities that actually exist.

### If a skeleton/rig exists
Automatically detect useful humanoid bones, including when available:

- Hips/pelvis
- Spine/chest
- Neck
- Head
- Jaw
- Left/right upper arms
- Left/right forearms
- Left/right hands/wrists
- Left/right thighs
- Left/right shins/calves
- Left/right feet
- Left/right eyes

Bone names may vary. Detection must be alias-based and case/punctuation tolerant.

### If animation clips exist
Use compatible clips for idle, walking, talking, greeting, dance or other states. Invalid or unsupported clips must be ignored without disabling the mesh.

### If morph targets/blendshapes exist
Use them for:

- blinking
- eye/facial expressions when supported
- mouth/viseme movement for speech

If morph targets do not exist, facial commands must be skipped silently.

### If a capability does not exist
Keep the character visible and stable. Never fabricate a rig, animation or facial system that the model does not contain, and never throw a fatal runtime error simply because an optional capability is absent.

## Character behavior

The long-term production controller must support:

- neutral idle/breathing
- greeting
- listening
- thinking
- speaking/talking
- walking
- dancing
- jumping
- head and neck movement
- spine/body sway
- arm/forearm/hand gestures
- thigh/shin/foot movement
- eye movement where eye bones exist
- blinking where facial controls exist
- speech visemes/lip-sync where facial controls exist
- reset to the authored/default pose

Procedural movement must preserve each model's authored rest pose rather than assuming a universal T-pose.

The eye controller target range is **-15° to +15°** on supported X/Z axes.

## AI agent

The Agent is not a mock UI. It is the execution layer behind Saeed's assistant behavior.

Current tool categories include:

- Windows/system inspection
- active/listed windows and process information
- file and directory operations
- application launching
- browser/URL opening
- web search
- screenshots
- mouse and keyboard automation with user confirmation where required
- persistent memory
- task storage
- character control hooks

Potentially destructive actions must require user confirmation. Credentials and secrets must never be hard-coded into source code or committed to GitHub.

The Agent must not claim an action succeeded until the underlying tool reports success.

## UI and security rules

- Keep Electron context isolation enabled.
- Keep Node integration disabled in the renderer.
- Use the preload bridge for privileged main-process operations.
- Do not expose arbitrary Node.js APIs to page content.
- Do not store API keys in Git.
- Do not invent successful OAuth/account connections; real providers require real credentials and redirect configuration.
- Do not add a standalone updater unless the architecture is deliberately changed later.
- Do not reintroduce the removed native C++ desktop UI path into this production branch.

## Repository rules

Keep the repository focused on the production application.

Production source areas:

- `src/` — Electron main/preload, renderer, avatar engine, agent, tools, computer integration and memory.
- `assets/Saeed_AI-3D.glb` — authoritative default character.
- `docs/` — optional GitHub Pages product preview only.
- `.github/workflows/build-saeed.yml` — production Windows build.
- `package.json` — application/build configuration.

Do not add renderer laboratories, temporary test applications, experimental native renderer workflows, duplicate character files, generated build output, secrets, or obsolete project plans to the production tree.

## Build and release

Local development:

```powershell
npm install
npm test
npm start
```

Windows installer:

```powershell
npm test
npm run build:win
```

The installer is produced as:

`dist/Saeed-AI-Setup-x64.exe`

The GitHub Actions production workflow is:

`.github/workflows/build-saeed.yml`

A release/build is only considered valid after:

1. JavaScript validation passes.
2. electron-builder completes successfully.
3. The installer exists and is a realistic non-empty Windows installer.
4. The artifact is uploaded successfully.
5. The packaged app contains `assets/Saeed_AI-3D.glb`.
6. Runtime code references the authoritative asset name and does not reference the removed `saeed.ai.glb`.

## Development workflow for future agents

Before changing code:

1. Read this README completely.
2. Inspect the current repository tree and the actual current source files.
3. Do not rely on old commits, old chat messages, or deleted experimental implementations as the current architecture.
4. Make changes against the current production code.
5. Search for references to removed files/assets after significant cleanup.
6. Run validation/build before claiming completion.
7. Inspect failed CI logs and fix the actual cause.
8. Never report an artifact as ready unless its current workflow run confirms it.

When implementing a feature, prefer one centralized production implementation over parallel competing implementations.

## Current implementation priorities

1. Make the production Electron + Three.js desktop shell reliable.
2. Load `assets/Saeed_AI-3D.glb` as the real character.
3. Make WebGPU initialization robust and fall back cleanly to WebGL2.
4. Build capability detection for rig, bones, animations and morph targets.
5. Implement the full character controller without breaking models with fewer capabilities.
6. Polish the compact desktop UX, chat and settings behavior.
7. Connect voice/STT/TTS and AI providers through clean boundaries.
8. Harden computer-control permissions and confirmation flows.
9. Add reliable packaging, installer metadata and release automation.
10. Expand later to Android/iOS without compromising the Windows architecture.

## Important non-goals

The following are not production requirements right now:

- DirectX 11 native avatar rendering.
- Native OpenGL/WGL renderer.
- Google Filament renderer.
- bgfx renderer.
- Vulkan-specific renderer.
- Renderer-lab launchers or benchmark windows.
- Keeping multiple competing avatar assets under different names.

These were experiments and are intentionally retired.

## Definition of done

A change is complete only when the source tree, runtime behavior, documentation and build configuration agree with each other.

The default Saeed character is `assets/Saeed_AI-3D.glb`, the production renderer is Three.js WebGPU/WebGL2 fallback, and this README is the single project specification for future development.
