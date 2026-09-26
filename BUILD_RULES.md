# Saeed AI — Build Rules

These rules are mandatory for the official Windows build.

## Architecture
- Production is Windows Electron.
- Avatar is GLB + Three.js.
- Official workflow: .github/workflows/build-windows-electron.yml.
- C++ builds are retired and must not be reintroduced.
- The current source-only roadmap must reach completion before the production build gate is opened.
- VERSION is the official product version source.

## Capability build gates
The final build must validate the completed Phase 1–9 roadmap and A–I engineering gates, including Agent Core, computer-use verification, documents/Office, project/code workflows, browser/integrations, memory/knowledge, proactive events, character behavior integration and centralized security.

## Mandatory production build gates
1. Required source files and canonical GLB exist.
2. Direct production dependencies are pinned.
3. npm install completes without dependency errors.
4. Automated tests pass.
5. Always Listening contract passes.
6. GLB/Three.js contract passes.
7. Electron build passes.
8. Exactly one Windows installer exists.
9. Installer version matches VERSION.
10. Installer is not suspiciously small.
11. Required blockmap/checksum outputs exist where packaging provides them.
12. Verified files are uploaded as workflow artifacts.
13. GitHub Release is created only when explicitly requested.

## Workflow policy
- Only .github/workflows/build-windows-electron.yml is the official production build workflow.
- Do not create C++/CMake, preview, repair or parallel release workflows.
- Normal pushes may create verified CI artifacts but must not silently publish production releases.
- Release tags must match VERSION.
- Never claim build/release success without checking the actual workflow, jobs, packaging, smoke test, artifacts and release assets.

## Source-only gate
No EXE, installer or Release is created while capability phases or A–I gates are still under source review.

Current official release: v2.1
