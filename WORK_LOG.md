# Saeed AI — Engineering Work Log

This file is the mandatory handoff record for the production project.

## Rules

- Every contributor must append a factual entry after each coherent change.
- The next contributor must verify the previous entry against the repository before making new changes.
- Never record an unverified claim as completed.
- If a change alters architecture or project rules, update `README.md` in the same change.
- Keep entries append-only. Do not rewrite history to hide failed attempts or regressions.
- Use UTC timestamps.
- Include the commit SHA when it is known.

## Entry 001 — New production architecture baseline

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Commit:** `8a617f5246715f2d1ced8a69c3775fd7a0723227`
- **Change:** Established the mandatory architecture and contributor handoff protocol in the authoritative README.
- **Architecture:** Electron shell → secure preload → UI/renderer → Three.js character runtime → Agent orchestrator → Tool Registry → OS/Web/AI providers.
- **Documentation changed:** `README.md`
- **Rules added:** read and verify previous work before coding; log every change; document architecture changes; do not assume previous agent claims are correct; maintain dependency boundaries.
- **Acceptance criteria added:** startup without an API key, independent compact character window, canonical GLB, WebGPU/WebGL2 fallback, capability detection, secure IPC, real tool results, confirmations, graceful optional-capability handling, and mandatory validation/build before declaring completion.
- **Verification:** README update was written successfully to GitHub.
- **Not yet verified:** full application build/runtime and all acceptance criteria. This entry records the architecture baseline, not a completed release.
- **Next contributor must inspect first:** current source files, production workflow, and then implement/verify the acceptance criteria one by one.
- **Known risk:** existing implementation is an early production baseline and may contain inconsistencies between the documented architecture and source. Those inconsistencies must be fixed before adding unrelated features.


## Entry 002 — Desktop window sizing foundation fix

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Commit:** `7e571ef52f0af70d55351b794c7f1d678345bdb7`
- **Changed:** `src/main.js`
- **What changed:** Window fitting now uses the actual current avatar/chat dimensions instead of undefined window dimensions.
- **Why:** The previous implementation referenced `WINDOW.width`/`WINDOW.height`, while the configuration defines separate avatar and chat sizes.
- **Verification:** Source change written successfully. Full Windows build/runtime still pending.
- **Next contributor:** Verify avatar mode and chat mode on different display sizes before adding window UX features.
- **Known risk:** Runtime behavior still needs an actual packaged Windows run.

## Entry 003 — Character renderer startup hardening

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Commit:** `541e1ea737a68d68e18da9c0d4f052a93a24b03e`
- **Changed:** `src/avatar.js`
- **What changed:** Added renderer-ready gating so the animation frame cannot render before WebGPU/WebGL initialization; added left/right eye bone aliases; exposed the detected renderer backend.
- **Why:** The first architecture baseline must tolerate asynchronous renderer initialization and must inspect available character capabilities instead of assuming them.
- **Verification:** Source change written successfully. Full build/runtime verification still pending.
- **Next contributor:** Validate WebGPU initialization and WebGL2 fallback with the real GLB.
- **Known risk:** WebGPU/WebGL compatibility still requires CI/package validation on Windows.

## Entry 004 — Version 0.5.0 architecture baseline

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Commits:** `e6288148a8927762cc08f6cf60b08c1cc5160daa`, `9849232b70409ca0567224427366d59ea4a07952`
- **Changed:** `package.json`, `VERSION`
- **What changed:** Aligned the application and VERSION file to `0.5.0`.
- **Why:** This marks the beginning of the new production architecture baseline and separates it from the previous 0.4.x implementation state.
- **Verification:** Version files were updated successfully. Build/release verification is still pending.
- **Next contributor:** Treat 0.5.0 as the current development baseline and verify the complete acceptance list in README.
- **Known risk:** 0.5.0 is a development baseline, not yet a release claim.


## Entry 005 — Character controller, GLB replacement, quick actions and notifications

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Changes:** Character rig/pose analysis, T-pose→A-pose calibration, replaceable GLB loading, controller API, exact-idle preference, settings UI removal, quick companion menu, microphone controls, notification infrastructure and update checking.
- **Main commits:** `89cfc4b1ce2761a2499852db033d6077d3a77812`, `6b63c4c7dbfc4e76480f228116dc388e3be3a084`, `bd6f48b2e30c84e53fe191bd5717f2dd8d50a568`, `6c8874afb996e8cc6cf80fb9137fe8ac9d54b42b`, `595d2a30f6ee34566bc0489c6ada2625cdb4aa20`, `0715d7b98751ad56ef83836a985ad7ef2957a112`, `5544b12a19032bba00af40bdcb60721094fad552`, `341fe19296af18b5093c28d95c5e909581328f34`, `d335e641caf88983a60a476890c4c98832bcc1f9`, `3f2ec4ac21020085966162b310e69e2e0aeca34f`, `f3f7cae1bb9f8a4394799d3317f59d8331533911`
- **Character:** Runtime now measures hips/head/neck/hands, detects a T-pose using normalized hand heights and arm extension, and applies an A-pose correction when a rig is available. It also grounds the model from its actual bounding box and supports dropping a replacement GLB.
- **Animation:** An exact `idle` clip is preferred when present. Missing rig/animation/facial capabilities remain non-fatal.
- **Controller:** Central controller API exposes analysis, GLB replacement, pose reset/set, bone rotation, animation registration/playback and gestures.
- **UI:** Removed the settings screen from the current companion UI. Added compact Chat/Mute/Mic/Screen/Update/Exit actions.
- **Notifications:** Added tray/context actions, in-app badge/bubble, native Windows notification where supported, notification history and update checking. Email is not fabricated; a real email connector is still required before email notifications can be claimed.
- **Microphone:** Added browser SpeechRecognition integration when the Electron runtime exposes it, with graceful unavailability.
- **Verification:** GitHub source writes succeeded. Full Windows npm test/build has not yet been verified after these changes.
- **Next contributor MUST inspect:** run `npm test`, build Windows installer, launch it, test the built-in GLB, drop a second GLB, verify T-pose/A-pose detection, exact Idle behavior, microphone availability, tray actions and notification behavior.
- **Known risks:** Web Speech recognition availability varies by Chromium/Electron runtime; the A-pose correction uses a generalized shoulder rotation and must be visually validated with multiple rigs; native notification support depends on Windows packaging/runtime.


## Entry 006 — CI build blocker fixed

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Commit:** `8aa384503946a2b3752336b32e4d40445d0ab6fc`
- **Finding:** Production workflow run #80 reached Windows runner setup but failed before installing dependencies because `actions/setup-node@v4` had `cache: npm` while the repository intentionally has no lockfile.
- **Fix:** Removed npm cache configuration from `.github/workflows/build-saeed.yml`. Dependency installation remains `npm install`.
- **Verification:** Failure cause confirmed directly from workflow job logs. New workflow run is expected from this commit.
- **Next contributor:** Inspect the new run through dependency installation, JavaScript validation and Windows installer build. Do not declare the application built until the installer verification step succeeds.


## Entry 007 — Windows build verified

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Workflow:** Build Saeed AI Desktop #82
- **Commit built:** `7d54295c7e056b735cdf186f9f5fc77cf449c861`
- **Result:** SUCCESS.
- **Validation:** dependency installation succeeded; JavaScript validation succeeded; Windows installer build succeeded; installer verification succeeded; artifact upload succeeded.
- **Artifact:** `Saeed-AI-Windows-x64-82` (143,493,963 bytes).
- **Important limitation:** This proves the source packages successfully. It does not replace physical runtime testing of the installer on Windows with the built-in and replacement GLBs, microphone, notifications and tray behavior.


## 2026-09-24 — UX correction pass
- English is now the default UI and agent response language; remaining Arabic runtime strings were removed from the current agent path.
- Chat close handling is wired end-to-end and the panel uses a WhatsApp-style header, message bubbles, and composer.
- Windows taskbar presence is enabled and Saeed.png is configured for the app/tray icon and Windows build.
- Installer desktop/start-menu shortcuts remain enabled.
- Microphone uses en-US speech recognition, shows a small Listening indicator, auto-sends recognized speech, and reports when speech is not understood.
- Added Change character action for GLB replacement.
- Added automatic camera framing after a GLB loads.

## Entry 008 — 1.0.0 lifecycle, update and AI connection pass

- **Date:** 2026-09-24 UTC
- **Contributor:** ChatGPT / Saeed AI engineering agent
- **Changes:** Added single-instance locking; removed the background lifecycle behavior that prevented full process shutdown; changed update comparison to semantic version comparison so an older release such as 0.3.9 is never presented as newer than the installed version; set application/package VERSION to 1.0.0; added secure AI provider connection UI and provider catalog; added GitHub Release automation for semantic VERSION tags.
- **Files changed:** src/main.js, src/agent.js, src/preload.js, src/index.html, src/renderer.js, src/style.css, package.json, VERSION, .github/workflows/build-saeed.yml, README.md.
- **Provider scope:** OpenAI, Claude via OpenRouter, Gemini, xAI/Grok, Groq, Mistral, DeepSeek, OpenRouter, Together AI, Fireworks AI, Cerebras, Perplexity, MiniMax, Ollama and Custom OpenAI-compatible. API keys remain local and are encrypted with Electron safeStorage when available.
- **Verification:** GitHub source writes succeeded. Provider defaults and official key URLs were checked against current provider documentation where available. Full Windows build and physical runtime verification of the new 1.0.0 build remain pending.
- **Release status:** The repository's currently published release is still v0.3.9 at the time of this entry. The workflow now creates v1.0.0 from VERSION when the production build succeeds and publishes the installer as the release asset; this must be verified from GitHub Actions before claiming the release is live.
- **Next contributor MUST inspect:** the first build triggered after the workflow change, the v1.0.0 release/tag, installer, single-instance behavior, full process shutdown, provider connection panel, and real API calls for at least Gemini/OpenAI/Grok/Groq.
- **Known risks:** the provider catalog is intentionally explicit rather than claiming every AI service on the internet. Claude is currently routed through OpenRouter and labeled accordingly. Web/CI cannot physically prove Windows Task Manager disappearance or provider credentials without a real key.
## Entry 009 — uninstall cleanup, character visibility, icon and professional updater

- **Date:** 2026-09-24 UTC
- **Changes:** Added custom NSIS uninstall cleanup for Saeed Electron roaming/local application data; added generated Windows ICO support from Saeed.png and wired the ICO to the packaged app/tray/installer; normalized arbitrary GLB height before framing and expanded camera near/far ranges to prevent scale-related invisibility; added a Windows-style update panel with checking/downloading/installing states, percentage and byte progress, release notes, and automatic installer launch after download.
- **Files changed:** package.json, scripts/make-ico.js, build/installer.nsh, src/main.js, src/avatar.js, src/preload.js, src/index.html, src/style.css, src/renderer.js.
- **Uninstall scope:** `%APPDATA%\\Saeed AI`, `%LOCALAPPDATA%\\Saeed AI`, and app-ID folders are explicitly removed by the custom NSIS uninstall macro. This targets Saeed-owned paths only.
- **Character visibility:** Every loaded GLB is normalized to approximately 3.15 scene units in height, grounded, camera-framed from its actual bounds, and mesh visibility/frustum culling is normalized. This is intended to address the observed shadow-without-character symptom.
- **Update flow:** Check for updates now opens a dedicated progress panel; a newer release can be downloaded with progress and the installer is launched after completion. The current release comparison remains semantic-version based.
- **Icon:** Build now generates Saeed.ico from Saeed.png before electron-builder runs, because Windows app/taskbar identity should use an ICO rather than relying only on the installer image.
- **Verification:** Source commits succeeded. Physical Windows verification of uninstall data removal, taskbar icon rendering, character visibility, and update installation remains pending until the new Windows build is tested.