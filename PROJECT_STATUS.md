## Unified 1–26 production integration — 2026-09-23

- Completed the unified character, native UI, voice, local-command, AI-agent, memory, screen-awareness, Windows-control and Office/browser integration pass as one development stage.
- Native Windows SAPI text-to-speech now speaks Agent answers asynchronously and follows the Settings voice mode; TTS absence is handled gracefully without blocking startup.
- Local commands now cover direct website URLs plus Word, Excel, PowerPoint and Outlook launch in addition to the existing Windows/browser commands.
- Native Agent already provides verified screen capture, monitor/window inspection, file operations, mouse/keyboard automation, memory remember/recall/forget, character control and multi-step AI tool execution.
- Character runtime retains capability-safe behavior: missing rig, animation, morphs or individual bones never produce a fatal error.
- DirectX avatar lighting now includes a subtle rim contribution while preserving the existing embedded base-color texture path.

## Account backend boundary

The native Accounts UI and provider buttons are implemented, but live Google/Microsoft/Facebook/email authentication still requires real OAuth/account-service credentials and redirect endpoints. No fake credentials or pretend-success login flow is introduced.

`status` updates are only considered complete after the Windows C++ workflow, native smoke test, artifact verification and CI provenance checks all pass.

## Character desktop travel, replacement and sizing — 2026-09-23

- Saeed's autonomous walking now moves the native companion window itself across the current Windows monitor work area; the 3D controller continues to animate the feet/body while the window travels over the desktop.
- Clicking Saeed stops travel immediately, returns the body to neutral/front-facing orientation, resets eye/head offsets, and temporarily pauses autonomous travel.
- Native Settings now includes **Choose New GLB**, **Restore Default**, and **Small / Medium / Large** Saeed size choices. Size changes resize the native companion window and adjust camera framing together.
- The avatar camera uses additional safety margin around the full GLB bounds to keep feet visible.
- `Saeed.png` is used as the source artwork for the Windows application/tray/installer icon; CI converts it to a multi-size ICO before the C++ build.

The implementation spans src/main.cpp, assets/avatar.html, .github/workflows/build-windows-cpp.yml, CMakeLists.txt, and installer.iss.

## Current status — 2026-09-23

- Avatar capability handling is now graceful: a GLB without a rig remains static; a GLB without animation keeps its authored/rest pose; a GLB without facial morph targets skips facial commands without producing an error.
- Native `character_state` now reads DirectX capability state directly instead of waiting for the removed WebView2 bridge, reporting mesh/rig/animation/facial-morph availability.
- The updater now compares official semantic versions only. CI build numbers are no longer treated as production versions.
- The Windows workflow now publishes the official release tag as `vX.Y.Z`, matching `VERSION`, rather than creating a release for every CI build.



## Native utility UI migration — 2026-09-23

Chat and Settings have been migrated from WebView2 HTML pages to native Win32 C++ top-level windows in `src/main.cpp`. `assets/chat.html` and `assets/settings.html` are obsolete and were removed. WebView2/Three.js remains the rendering layer for the 3D avatar only. Native Chat sends text directly to the existing local-command/Agent pipeline and receives Agent status, tool, answer, error, and native-command messages through the existing native message bridge. Native Settings preserves AI provider/base URL/model/API key/voice mode controls plus account-provider buttons and update checking. This is the first native-utility phase; future controller/account/update UI expansion must extend the native window implementation rather than recreate HTML utility overlays.

## Avatar framing and native Settings behavior — 2026-09-23

- The companion window was enlarged to provide practical vertical room for the complete body while remaining a compact desktop companion.
- The 3D camera now calculates distance from the loaded GLB's actual bounding dimensions and the current horizontal/vertical field of view, then recalculates on viewport resize. This prevents the character from being cropped when aspect ratio or character dimensions change.
- Native Settings now follows the standard action contract: **OK** saves and closes, **Apply** saves and stays open, and **Cancel** closes without applying edits.

## Full-body controller expansion — 2026-09-23

The centralized avatar controller now exposes manual controls for thighs, shins and feet in addition to eyes, head, neck, spine, shoulders, arms, forearms and wrists. The Agent `character_control` schema and native bridge can send and verify these lower-body values, while procedural walking remains additive to the manual leg pose.

## Native Chat visual polish — 2026-09-23

- Native Chat remains a real Win32 C++ window; no HTML chat surface was reintroduced.
- Added a consistent dark utility theme for Chat and Settings child controls, including readable text, dark edit/history fields, dark list controls and native background painting.
- Chat layout now has explicit Conversation/Message areas and resizes without overlapping the status or action controls.
- The latest source commit is `80bc8b942fb0b01845152bdbf61418d0e7bb6d6e`; it must pass the Windows build/smoke workflow before being called release-ready.


## Native avatar capability hardening — 2026-09-23

- Native DirectX GLB loading now treats rigging, animation, facial morphs, and individual bones as independent optional capabilities.
- Morph targets are actually imported and deformed on the CPU before skinning; facial commands now affect named glTF morph targets when semantic names are available.
- Characters without morph targets remain visually unchanged when facial commands are requested. Characters without rigs remain static for body commands. Characters without animations keep their authored/rest pose.
- Native capability reporting now exposes individual head/neck/spine/arms/forearms/wrists/legs/feet/eye bone availability and the eye X/Z limit of ±15 degrees.
- Native wrists, breathing and talking controls are routed through the same central controller.
- Native camera framing now accounts for both vertical and horizontal FOV, preventing narrow portrait companion windows from cropping the avatar.
- The Windows runtime architecture is now explicitly DirectX 11 + DirectComposition for the avatar; WebView/Three.js remains only for the Pages preview where applicable.

## Product-layer integration phase — 2026-09-23

- Added a centralized avatar behavior-state controller: idle, listening, thinking, speaking, walking and greeting.
- Native Agent/speech status now drives the same controller, so Chat/voice state and avatar behavior stay synchronized.
- Added automatic facial idle behavior when morph targets exist: periodic blinking and subtle eye saccades; characters without facial morphs remain static without errors.
- Added speech-mouth/viseme control hooks for future STT/TTS phoneme timing without creating a second facial controller.
- Reset now clears facial, wrist and behavior state as well as body pose.
- CI now generates an SPDX SBOM and GitHub artifact provenance attestations for the executable, installer and portable package. GitHub documents attestations as signed provenance linking artifacts to their workflow, repository and commit. 


## Avatar animation controller hardening — 2026-09-23

- Imported animation channels now cache their resolved skin-joint index at load time instead of repeatedly scanning every joint on every frame.
- Rotation channels using normal glTF linear interpolation now use quaternion slerp, avoiding component-wise quaternion lerp artifacts while preserving STEP and CUBICSPLINE behavior.
- Animation validation now requires every imported channel to resolve to a real loaded skin joint before the animation capability is exposed.
- The existing graceful fallback remains unchanged: invalid or unsupported animation data is discarded while the mesh/rig stays usable as a static character.
