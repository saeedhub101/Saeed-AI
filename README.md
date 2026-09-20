# Saeed AI

**Saeed AI** is a Windows-first desktop AI agent and floating 3D companion. It is being built as a real computer-use agent rather than a simple chatbot: Saeed can inspect the computer, see the screen, use the mouse and keyboard, work with files and applications, search the web, keep memory and tasks, and verify the result of actions.

## What Saeed is designed to become

- **AI Agent:** plans and executes multi-step tasks instead of only explaining how to do them.
- **Computer control:** inspect Windows, active windows, processes, disks and network; move/click the mouse; type text; press keys; open applications and URLs; inspect and edit files.
- **Screen awareness:** capture the desktop so a vision-capable model can analyze what is actually on screen.
- **Persistent memory:** conversations, remembered facts and tasks are stored locally in the user's Windows profile.
- **Multiple AI providers:** OpenRouter, Groq, Ollama, MiniMax and a local Hermes-compatible gateway.
- **3D companion:** transparent, borderless, always-on-top Electron window with a replaceable GLB avatar.
- **Avatar independence:** the AI/agent layer is separate from the 3D character, so the temporary character can later be replaced by the user's fully rigged personal avatar.
- **Desktop interaction:** draggable character, compact chat panel, global summon and screenshot shortcuts, tray controls and settings.
- **Safety:** destructive, credential-sensitive, financial, privacy-sensitive and irreversible actions are intended to require confirmation rather than being silently executed.

## Current architecture

```
Saeed AI
├── Electron desktop shell
├── Agent loop / LLM provider layer
├── Tool registry
│   ├── Windows inspection
│   ├── Mouse / keyboard control
│   ├── Files / applications
│   ├── Web search
│   ├── Screen capture
│   ├── Memory
│   └── Persistent tasks
├── Local encrypted settings
├── Conversation history
└── Three.js avatar runtime
    └── assets/avatars/saeed.glb
```

## Current interface preview

A browser preview of the current interface is maintained in the `docs/` directory:

**GitHub Pages:** https://saeedhub101.github.io/Saeed-AI/

If GitHub Pages has not yet been activated for the repository, the same preview source is available at:

https://github.com/saeedhub101/Saeed-AI/blob/main/docs/index.html

The preview represents the current desktop UI layout. The actual Electron application additionally has native Windows capabilities that a normal web page cannot provide.

## Repository structure

- `src/main.js` — Electron main process, tray, shortcuts, IPC and screen capture.
- `src/agent.js` — persistent agent loop, provider configuration, conversation history and encrypted API-key storage.
- `src/tools.js` — AI tool registry and persistent task/memory integration.
- `src/computer.js` — Windows automation and system interaction.
- `src/memory.js` — local persistent memory.
- `src/index.html` — desktop UI.
- `src/renderer.js` — UI interaction and agent events.
- `src/avatar.js` — Three.js avatar renderer and GLB animation support.
- `assets/avatars/saeed.glb` — optional final user avatar; a temporary procedural character is used when the GLB is absent.
- `.github/workflows/build-windows.yml` — Windows build pipeline.
- `docs/index.html` — visual browser preview of the current interface.

## Windows build

GitHub Actions builds the Windows installer on `windows-latest` and uploads the generated files from `dist/` as the **Saeed-AI-Windows** artifact.

The project is intentionally kept in the GitHub repository so the complete source, build configuration and future changes remain recoverable without starting again from zero.

## Running locally

```bash
npm install
npm start
```

For a Windows installer:

```bash
npm run build
```

The AI provider and model are selected from **Settings** inside Saeed. Ollama can be used locally without an external API key; cloud providers require their own API credentials.

## Avatar replacement

When the final 3D character is ready, place the rigged model here:

```
assets/avatars/saeed.glb
```

Recommended avatar features:

- natural standing pose (not T-pose for the displayed idle state)
- visible hands
- humanoid skeleton
- facial bones and/or blendshapes
- idle, walk, talk, wave and sleep animations
- facial animation suitable for speech

The agent does not depend on the temporary avatar, so replacing the model does not require rebuilding the AI architecture from scratch.

## Project status

This repository is the **source of truth for Saeed AI**. Changes should be committed here so the project can always be recovered, built and continued from GitHub.

The Windows executable is produced by GitHub Actions; a successful Actions run is the verification point for the downloadable installer.