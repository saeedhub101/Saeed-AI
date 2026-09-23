# Renderer Lab dependency policy

The lab is intentionally separate from the main Saeed assistant.

Runtime dependencies planned for the seven real comparison backends:
- DirectX 11: Windows graphics stack.
- OpenGL: Windows OpenGL runtime/driver.
- Filament: native Windows Filament + gltfio.
- bgfx: native bgfx + a glTF loading layer.
- Three.js WebGL: Three.js + Chromium WebGL.
- Three.js WebGPU: Three.js + Chromium WebGPU.
- Electron + Chromium: Electron runtime; the graphics API used by its renderer is reported separately.

The installer must not silently substitute one renderer for another. Missing native backend packages must be reported as missing rather than presenting a mislabeled Three.js render.
