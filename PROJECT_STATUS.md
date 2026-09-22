# Saeed AI — Project Status

Last updated: 2026-09-22

## UI / desktop hardening — 0.3.6 development

- Compact native companion window: 320x420 default, constrained to a smaller desktop footprint and kept at the bottom-right of the active work area.
- Settings is now a scrollable desktop-style screen with Back and Close controls; settings default to English with an English/Arabic UI switch.
- Account screen renamed to **Sign in / Connect your account** with Google, Microsoft/Hotmail, Facebook and Email & Password entry points. Provider buttons never claim an account is connected until a real OAuth/account service is configured and verified.
- Microphone state is no longer displayed as a persistent badge/status over the character. Microphone control is available from the right-click menu; microphone permission is checked before speech recognition starts, with explicit error states.
- Recognition language can be selected as English (US) or Arabic (Jordan). The microphone is ready by default, and the right-click menu provides a direct off/on control.
- Windows startup is repaired/enabled on launch and the installer creates the HKCU Run entry.
- Uninstall now removes both `%APPDATA%\\Saeed` (Roaming) and `%LOCALAPPDATA%\\Saeed` (Local) user data, including WebView2 data, settings, logs and custom-character data.
- Custom GLB characters are served through a WebView2 virtual host (`https://saeed-characters.local/...`) instead of `file:///`, preventing the previous `Failed to fetch` character-selection failure.

Repository: saeedhub101/Saeed-AI

## Mission

Saeed AI is being built as a real native C++ Windows desktop AI agent with a floating 3D companion. It is not intended to remain a simple chatbot or Electron-only application. Windows is the current priority; Android and Apple are later targets.

## Current architecture

- Native C++20 Win32 application: src/main.cpp
- WebView2 hosts assets/avatar.html
- Three.js renders assets/saeed.ai.glb
- CMake builds the native executable
- GitHub Actions builds Windows x64, smoke-tests the EXE, creates portable ZIP and Inno Setup installer
- Local runtime data is under %LOCALAPPDATA%\\Saeed

## Agent capabilities implemented

- Multi-step LLM agent loop; maxSteps 1–32, default 12
- Tool calling and tool-result loop
- Confirmation gate for sensitive actions
- Confirmation requests serialized with request IDs
- Active-window inspection
- Window listing and focus/close/minimize/maximize with verification
- window_geometry: exact window rectangle, monitor, PID and minimized/maximized state
- Monitor information and multi-monitor awareness
- Screen capture with optional visual feedback to the model
- Open applications and URLs with post-launch foreground-window verification
- Mouse movement with actual cursor-position verification
- Mouse click with cursor-position verification before input
- Text input and key presses with SendInput verification
- File listing/read/write and file copy/move/rename/delete
- Process listing
- Wait tool
- Native tray lifecycle controls
- Windows startup option
- Ctrl+Shift+S global visibility hotkey
- Single-instance protection
- DPI/work-area/display-change handling
- Native crash logging

## Memory system

- Persistent local JSON memory
- Categories: personal, preference, project, task, technical, general
- Importance 1–5
- Relevance-ranked recall
- Automatic relevant-memory injection before the user message
- Arabic-aware tokenization in recall and automatic injection
- New memories receive persistent IDs
- forget tool removes a memory by ID or matching fact only when the user requests deletion
- Memory timestamps use UTC ISO-8601 wall-clock time, and IDs include a request serial to avoid relying on process uptime

## Character controller

Central controller lives in assets/avatar.html.

Bones currently discovered/controlled include head, neck, spine, shoulders/clavicles, upper arms, forearms, hands/wrists and eyes.

Limits:
- Eyes X/Z: ±15°
- Head X/Y/Z: ±15°
- Neck X/Y/Z: ±15°
- Spine: ±8°
- Arms: ±20°
- Forearms/wrists: ±25°

Behavior:
- Breathing
- Idle micro-motion
- Eye saccades
- Automatic blink
- Speech gestures
- Nod, wave, agree, disagree, think, greet

Facial system:
- Smooth facial target interpolation
- Smile, brow and blink controls
- Neutral, happy, sad, surprised, angry, thinking, greeting and speaking profiles
- Live character_state request/response bridge

Important animation rule: manual controller state must remain authoritative; procedural motion uses separate offsets so sliders do not drift.

## Native desktop lifecycle

- Transparent/borderless topmost avatar window
- Native dragging from avatar canvas/body
- Tray menu: show, hide, startup, reset position, exit
- Closing the window hides it to tray rather than immediately terminating
- Ctrl+Shift+S toggles visibility
- Single-instance mutex prevents duplicate Saeed processes
- Current monitor/work area keeps Saeed visible across monitor and DPI changes

## Important commits / milestones

- 447ec67 — expanded controller, forearms/neck Z and pose persistence
- 98435ef — separated procedural motion offsets from manual controller state
- b0a8ed3 — facial targets/profiles and smoothing
- 1789b0e — expanded facial controls and behavior persistence
- d08f6be — live character state verification tool
- 966a8c1 — validated character-state response IDs
- 8c3b66a — hardened native agent IO and Windows input verification
- 32ccb0e — improved memory recall relevance ranking
- 767f581 — structured long-term memory metadata
- 8109dfd — fixed memory save/build error
- fb9ca1b — automatic relevant-memory injection
- b026fe1 — hardened Windows window-operation verification
- 5f47e20 — recursive directory creation hardening
- 9289c80 — fixed tray reset declarations; Native build #117 succeeded
- latest development line — serialized agent confirmations, verified text input, window geometry, launch verification, cursor verification, Arabic memory matching, memory IDs and forget tool

## Build verification

Never call a feature release-ready only because a commit exists. A relevant GitHub Actions run must succeed first.

Known verified checkpoint:
- Native build #117: success; artifact Saeed-Windows-x64-117
- Preview #170: success before the newest native changes
- Newer commits have their own Actions runs and must be checked before claiming verification

## Latest lifecycle hardening

- **Agent task lifecycle:** one active Agent task at a time; concurrent requests return `busy`, and the active task can be cancelled from the UI or native handler.

## Current development queue

1. Check the newest Native/Preview Actions runs after every significant commit.
2. Add agent task cancellation and a persistent task/status UI.
3. Improve memory timestamps to real wall-clock ISO timestamps.
4. Add safer structured memory update/delete flows.
5. Continue improving GUI verification and failure recovery.
6. Continue natural body/hand/head motion and facial realism.
7. Continue controller expansion without allowing procedural animation to overwrite manual state.
8. Keep README.md and this file updated whenever architecture or milestones change.
9. Provider OAuth integration remains a real external-credential task: Gmail, Microsoft/Outlook, and Yahoo require provider application/client credentials and approved redirect/scopes before a live OAuth flow can be verified. Saeed must not fabricate account data or pretend a provider is connected.

## Continuation rule

When continuing development, inspect this file, README.md, the latest main branch commits, and the newest Actions runs before making the next change. Do not restart the project from zero and do not discard existing architecture unless a concrete technical reason requires it.

- **Cancellation responsiveness:** the Agent `wait` tool now checks cancellation in short intervals and stops promptly.
- **Cancellation state correctness:** `cancel_agent` now reports `cancelling` until the active Agent loop actually stops; the final `cancelled` state is emitted by the Agent lifecycle.
- **Agent task release:** successful Agent completion now releases the single-task mutex, allowing later Agent requests to start normally.
- **Memory persistence:** JSON array saves now verify directory creation, file opening, flushing and stream health before reporting success.
- **Confirmation lifecycle:** active confirmation requests expose `waiting_confirmation`; a 60-second timeout reports `confirmation_timeout`, while cancellation leaves final task cancellation to the Agent lifecycle.
- **Thread startup safety:** failure to create an Agent worker thread now releases the task mutex and reports a structured error.

- **Confirmation decisions:** approval and denial now emit explicit task states so the Agent lifecycle records the user's decision.

- **File-operation verification:** destructive delete/copy/move/rename actions now verify source/destination state before reporting success; missing sources and unverifiable results are explicit failures.
- **Speech presentation:** avatar runtime now drives a procedural mouth/jaw morph layer while speech synthesis is active and synchronizes the speaking facial profile with voice playback.
- **Agent networking:** AI-provider HTTP requests now use bounded WinHTTP timeouts and check the cancellation flag while reading responses, preventing stalled provider calls from holding a task indefinitely.
- **Agent execution journal:** task lifecycle events are now persisted to `%APPDATA%\\Saeed\\agent_tasks.json` (bounded to the latest 300 events), including task ID, state, step and tool. This provides durable execution history for later recovery and diagnostics.

## Account / identity data boundary (2026-09-22)

Saeed now treats linked-account imports as **account-scoped session data**, separate from persistent Saeed memory and separate from device-imported data.

- Linked-account session storage is under `%APPDATA%\\Saeed\\accounts\\<provider>_<accountId>\\`.
- Imported account data is stored in that session directory and is removed when that account is signed out.
- `linked_accounts.json` tracks active linked-account sessions only.
- Signing out one account removes only that account's session/imported data.
- Signing out all accounts removes all linked-account session data.
- Device-imported data and explicit persistent Saeed memory are not deleted by email-account sign-out.
- The UI now exposes an account/session manager and a desktop-style right-click menu.
- OAuth provider adapters still need to be connected for Gmail, Outlook/Microsoft, and Yahoo so that their Calendar, Contacts, profile, and permitted mail data can be imported into these session boundaries. No fake provider data is generated.

### Product rules captured from the current design

- Calendar and Contacts come from the currently linked email account.
- User profile information imported from that account is account-scoped.
- Account-derived information is not lifetime memory.
- After Sign Out, Saeed must not use that account's imported Calendar/Contacts/profile/mail-derived information.
- Device Import is an independent source and survives email-account sign-out.
- OAuth tokens/refresh tokens must be stored separately and securely; account sign-out must revoke/delete the local session/token material according to the provider flow.
- Persistent memory may only contain information deliberately promoted to Saeed memory by the user/system memory policy; it must not silently copy an entire email account into lifetime memory.
