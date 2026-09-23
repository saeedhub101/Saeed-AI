# Saeed Renderer Lab

This is an isolated visual test application. It contains only the renderer comparison surface.

Target windows:
1. DirectX 11 — current native reference
2. OpenGL
3. Filament
4. bgfx
5. Three.js + WebGL
6. Three.js + WebGPU
7. Electron + Chromium

The same GLB must be used for every backend. Electron is a runtime/container, not a graphics API,
so its actual graphics backend must be recorded separately.

A backend is not considered complete until it actually renders the GLB with that technology.
