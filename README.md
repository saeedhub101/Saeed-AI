# Saeed AI

Saeed AI is a Windows desktop AI companion built around a small transparent Electron window and a Three.js 3D character engine.

## Production architecture

```
Saeed AI
├── Electron Desktop Shell
│   ├── frameless transparent window
│   ├── always-on-top companion
│   ├── small character-only footprint
│   ├── click-through transparent area
│   └── chat/settings expansion when requested
├── Three.js Character Engine
│   ├── WebGPU backend when available
│   └── WebGL 2 fallback
├── Saeed Character Controller
│   ├── idle / walk / talk / dance / jump
│   ├── head / neck / spine / limbs
│   ├── eye movement and blinking
│   ├── facial morphs and visemes
│   └── replaceable GLB characters
└── AI Agent
    ├── computer control
    ├── screen capture
    ├── memory
    ├── tools
    └── configurable AI providers
```

Three.js documents WebGPURenderer as a modern renderer that can use WebGPU and fall back to a WebGL 2 backend when WebGPU is unavailable. citeturn1search0turn1search1

Electron provides frameless transparent windows, always-on-top behavior and click-through mouse handling, which are the desktop mechanisms used for Saeed's companion window. citeturn4search2turn4search0

## Character

The runtime loads `assets/Saeed_AI-3D.glb`. Rigging, animations and facial morphs are optional capabilities. If a replacement GLB lacks one of them, Saeed keeps the model visible and skips unsupported controls.

## Build

```powershell
npm install
npm test
npm run build:win
```

The Windows installer is produced under `dist/`.

## Repository direction

Renderer laboratories, experimental renderer workflows, native DirectX test code and the old native installer path are being retired from the production tree. The production renderer path is Electron + Three.js WebGPU/WebGL2 fallback.

The production GitHub Actions workflow is `.github/workflows/build-saeed.yml`.
