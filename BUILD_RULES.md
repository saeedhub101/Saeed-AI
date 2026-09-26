# Saeed AI — Build Rules

These rules are mandatory for the official Windows build.

## Architecture
- Production is Windows Electron.
- Avatar is GLB + Three.js; VRM is forbidden.
- Existing Saeed window architecture remains in use.
- Target window size is 760x480 unless deliberately changed in the product specification.

## Voice
- Microphone mode is Always Listening.
- Push-to-Talk must not replace Always Listening.
- Realtime API key remains separate from ordinary LLM/STT/TTS keys.

## Mandatory build gates
1. Required source files and GLB exist.
2. Direct production dependencies are pinned to exact versions.
3. npm install completes without dependency errors.
4. npm test passes.
5. Always Listening contract passes.
6. GLB/Three.js contract passes.
7. Electron build passes.
8. Exactly one Windows installer EXE exists.
9. Installer is not suspiciously small.
10. Installer blockmap exists.
11. SHA-256 checksum is generated.
12. Verified files are uploaded as the workflow artifact.
13. The same verified files are published to the GitHub Release.

Any failed gate fails the workflow.

## Workflow policy
- Only .github/workflows/build-windows-electron.yml is the official build workflow.
- C++ builds are retired.
- GitHub Pages/preview builds are retired.
- Temporary repair workflows are forbidden.
- Concurrent main builds are cancelled so stale builds cannot publish releases.
- Node.js is pinned.
- Direct production dependencies are pinned.
- No release may be published from an unverified build.

## Repository hygiene
Do not add duplicate build workflows, repair workflows, preview deployment workflows, native C++ build files, obsolete installer definitions, or generated dist output.

The retired C++ workflow, preview workflow/page, repair workflow, CMake build definition, and legacy installer definition have been removed.

## Release identity
Official releases use v<package version>-build.<GitHub Actions run number> and point to the exact tested commit.
