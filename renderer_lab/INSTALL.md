# Saeed Renderer Lab

The installer/build process creates a completely separate viewer. It does not start the
Saeed assistant and does not include chat, voice, AI, automation, accounts, or settings.

The setup must install/download:
- Electron runtime
- Three.js
- the same Saeed GLB used by the native build
- the native renderer runtimes once their backends are compiled

The seven windows are kept independent so a renderer failure cannot stop the other
windows.

Backend truth is enforced: a window is only marked with a backend after that backend
has successfully initialized and loaded the GLB.
