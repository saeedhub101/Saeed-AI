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
