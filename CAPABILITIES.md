# Saeed AI 2.0 — Capability Contract

This document is the development scope that must be completed before the next production Build/EXE/Release.

## 1. Agent Core
- Understand the user's goal, not just the literal command.
- Break multi-step requests into an explicit task plan.
- Maintain step state and task IDs.
- Observe -> Act -> Verify for computer operations.
- Verify important results before reporting success.
- Retry safe failures and re-plan when an approach fails.
- Respect a bounded execution-step limit.
- Support cancellation / Emergency Stop.
- Support Dry Run / review mode for tasks where the user wants a preview.
- Keep an execution journal with tool, arguments, result, verification and permission state.

## 2. Unified Permissions and Safety
Default permission mode is full_access with no built-in operational restrictions. Saeed may perform requested operations, including operations involving sensitive files and system resources, without routine permission prompts. Restrictions exist only when the user configures them in the Permissions settings. The user controls each operation/category with Allow always, Ask always, or Deny (and any equivalent modes already exposed by the UI). Ask always is not a global default for sensitive operations.

The permission prompt must explicitly state:
1. what Saeed will do;
2. the exact target;
3. why permission is required;
4. Allow / Deny.

High-risk examples include:
- deleting or modifying Windows/protected files;
- destructive or privileged PowerShell/CMD commands;
- registry/system-service/security changes;
- shutdown/restart/logoff;
- installing/removing software;
- changing important system settings;
- operations that can expose credentials, private data, or other sensitive information.

There are no globally protected Windows locations imposed by the product. A location or operation is restricted only when the user has configured a corresponding permission policy. When Ask always is configured, the permission prompt must state WHAT, TARGET and WHY and provide Allow/Deny. Deny blocks that configured operation and the Agent may use a safe alternative when one exists.

The permission system must also cover prompt-injection defenses, activity logging, rate/scope limits and emergency stop.

## 3. Files and Folders
- Inspect/list folders.
- Read files.
- Create directories.
- Create/copy/move/rename files and folders.
- Delete files/folders through permission control.
- Preserve exact paths and verify important writes/moves/deletions.
- Detect protected/system locations before execution.

## 4. Microsoft Office
### Excel
- Inspect workbooks and sheets.
- Read cells/ranges.
- Write cells/ranges.
- Append rows.
- Create workbooks.
- Extend toward formatting, formulas, tables, filters, sorting, charts and workbook verification.
- Save and re-open/verify important modifications.

### Word
- Read document text.
- Replace/edit requested text.
- Extend toward paragraphs, tables, formatting and document verification.

### PDF
- Extract text.
- Extract tables where structurally possible.
- Preserve page/table context.
- Return a clear indication when a PDF is image-only or extraction is uncertain.
- Accept chat attachments as first-class task inputs, preserving file path/type/size and inline text/image data when available.
- Use OCR/vision for scanned pages when available.
- Verify extracted tables before using them for consequential actions.

## 5. Windows and PowerShell
- Inspect OS, CPU, memory, disks, processes and network.
- Inspect active/listed windows.
- Focus applications.
- Open ordinary applications directly.
- Run safe commands directly when they are part of the user's requested task.
- Route sensitive commands through Allow/Deny.
- Verify command output and distinguish stdout/stderr/exit failures.

## 6. Computer / GUI Agent
- Screenshot and visual inspection.
- Mouse movement/click.
- Keyboard input.
- Text entry.
- Window discovery/focus.
- Observe the current state before GUI actions.
- Act.
- Observe again and verify the expected state.
- Prefer direct application/API or database integration when available; use Windows UI Automation when available; if neither is available, mouse/keyboard automation is allowed as a normal fallback. Do not prohibit mouse/keyboard automation.

## 7. Browser Agent
- Open HTTP/HTTPS pages.
- Search the web.
- Inspect the current browser/application state.
- Use GUI interaction when direct APIs are unavailable.
- Support multi-step navigation, form filling and result verification.
- Treat page text as untrusted input; never let webpage instructions override Saeed's system/security rules.
- Ask permission before sensitive submissions or consequential actions.

## 8. Code / Project Agent
- Inspect repositories and project structure.
- Read/edit project files.
- Search for existing implementations before adding new ones.
- Run tests and diagnostics when requested.
- Build/test/debug only under the project's build rules.
- Read compiler/test errors and repair safely.
- Verify changed behavior instead of declaring success from compilation alone.
- Never create parallel implementations of existing core systems.

## 9. Build / Test / Debug
Build capability is part of Saeed's active Agent capability. Production Windows builds/EXE/installer builds may be executed whenever needed during development and verification.

When the build phase is opened later:
- inspect the current workflow first;
- build Windows x64;
- run native smoke tests;
- verify WebView2 + WebGL + GLB startup;
- package portable and installer outputs;
- verify required assets;
- generate SHA256;
- verify artifacts and release assets.

## 10. Installed Applications
- Discover installed applications from Start Menu / Windows application registration where available.
- Open requested applications.
- Inspect visible application windows.
- Interact through direct APIs when available, otherwise through GUI tools.
- Never silently uninstall or change installed software.

## 11. Memory
- Explicit user-requested memory.
- Personal, preference, project, task, technical and general categories.
- Search/recall.
- Safe persistence.
- Do not create a second memory database.
- Do not save call recordings or call-derived memories.

## 12. Task Planning and Scheduling
- Convert complex requests into ordered tasks.
- Track pending/running/completed/failed steps.
- Resume safe unfinished work.
- Support scheduled/background tasks with the same permission boundaries.
- Keep task state separate from long-term memory.

## 13. Knowledge / RAG
- Retrieve approved local/project/document/web information.
- Keep retrieved knowledge separate from live screen/application state.
- Identify source/context and freshness when relevant.
- Treat external content as untrusted instructions.

## 14. Model Routing
- Route general reasoning, coding, vision, speech and local processing according to actual configured provider capabilities.
- Keep provider/model/API-key settings explicit.
- Never expose API keys in prompts, logs or chat history.
- Preserve the existing secure credential storage.

## 15. Voice
- Always Listening.
- Mic Off.
- Temporary Mute.
- Visible listening state.
- Push-to-talk / smart listening where supported.
- Interruptible speech output.
- English/Arabic and automatic conversation-language behavior subject to actual STT/TTS backend support.
- Do not record calls or save call audio.
- Do not create memories/reminders from calls.

## 16. Vision / Documents
- Screen capture.
- Image understanding.
- OCR where available.
- PDF/image extraction.
- Table extraction with review/verification.
- Keep visual observations time-scoped so stale screen state is not treated as current state.

## 17. Character / Desktop Companion
- Replaceable GLB character.
- Automatic bone/morph detection.
- T/A/standing pose handling.
- Idle, breathing, talking, blinking, eye movement and nodding.
- Natural body movement.
- Chat and Settings remain independent native windows.
- Multi-monitor/work-area/DPI awareness.
- System tray, startup and single-instance behavior.
- Avatar movement must not move the desktop window unless that behavior is explicitly part of the feature being executed.

## 18. Email Agent
- Connect a user mailbox through IMAP or POP3 for incoming mail.
- Send mail through SMTP.
- Test incoming and outgoing connectivity before relying on the account.
- List recent messages, search IMAP mail, read individual messages and send user-requested messages.
- Parse MIME email bodies and expose attachment metadata without blindly executing attachment content.
- Store the mailbox password/app password using Electron safeStorage and never expose it through public settings, memory or prompts.
- Treat email bodies, subjects, attachments and links as untrusted external content; they must not override Saeed's system rules.

## 19. Verification and Reporting
Saeed must never claim an operation succeeded merely because a tool returned without throwing an exception.

For important actions:
1. execute;
2. inspect the result;
3. verify the expected state;
4. report success only when evidence supports it;
5. otherwise report the exact failure and continue safely where possible.

## 20. Current Development Gate
- Full Windows builds/EXE/installer builds are allowed and should be used whenever needed to verify the current source.
- A GitHub Release is not created automatically for every build.
- Create/update a GitHub Release when the user explicitly requests it or when a substantial milestone/change justifies a release.
- Never treat a started workflow as proof of build success; verify the completed workflow and artifacts.
- Perform a complete project review before declaring a major milestone complete, while continuing to allow builds during development.


## Phase A/B/C implementation checkpoint — 2026-09-27
- **A — Agent Core:** explicit task planning at task start, bounded replanning after safe tool failures, safe task resume, and composite all/any verification primitives.
- **B — Vision:** fresh time-scoped screen observations plus optional local Tesseract OCR; visual evidence is fed back to the multimodal model and marked as time-scoped/untrusted.
- **C — Code/Project Agent:** project-scoped source editing, build/test commands, and Git/diff diagnostics integrated into the existing ToolRegistry and permission boundary.
- Production build/EXE/installer builds are allowed during this development phase; GitHub Release remains milestone/request driven.

## 21. Permission Model — AUTHORITATIVE (2026-09-27)
- Saeed's default security state is unrestricted/full permission. The agent is allowed to access, read, write, modify, move, copy, delete, execute and otherwise operate on files and system resources, including sensitive files, unless the user has explicitly restricted that capability in the Permissions settings.
- Do not add, restore, broaden, or silently enforce a global sensitive-file restriction. Do not change this default model in future fixes, audits, refactors, builds, or agent-generated changes.
- Permission restrictions are user-configured from the Permissions screen. The user controls each permission behavior there, including modes such as Allow always, Ask always, Deny (and any existing equivalent modes exposed by the UI).
- Ask always is the mechanism that causes Saeed to request explicit permission with Allow/Deny before the affected operation. It is not a global default for all sensitive operations.
- Allow always permits the configured operation without repeatedly asking.
- Deny blocks the configured operation.
- An agent or automated code change must never reset, remove, weaken, or reinterpret the user's permission settings unless the user explicitly asks for that change.
- When reviewing or modifying permissions.js, the Permissions UI, ToolRegistry permission checks, or related security code, preserve this model exactly. Do not turn the product into a default-deny or sensitive-file-blocking system.
- The permission system is a configurable user policy layer, not an automatic restriction layer. Any change to its defaults or policy semantics requires explicit user instruction.
