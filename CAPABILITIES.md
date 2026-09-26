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
Default permission mode is full_access. Saeed may perform requested operations without routine permission prompts. Only critical operations require Allow/Deny by default. Users can optionally add operations to Ask Always or Denied from the Permissions settings page.

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

Protected Windows locations include C:\Windows, C:\Program Files and C:\Program Files (x86). Approval is never permanent. Deny must stop that operation and allow a safe alternative when one exists.

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
Build capability is part of Saeed's eventual Agent capability, but **no Saeed production Build/EXE/Release is to be executed during the current capability-completion phase**.

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

## 18. Verification and Reporting
Saeed must never claim an operation succeeded merely because a tool returned without throwing an exception.

For important actions:
1. execute;
2. inspect the result;
3. verify the expected state;
4. report success only when evidence supports it;
5. otherwise report the exact failure and continue safely where possible.

## 19. Current Development Gate
- Modify code and documentation only.
- Do not create a new EXE.
- Do not publish a new Release.
- Do not treat an old EXE as evidence that the current source is complete.
- Complete the capability set first.
- Perform one complete project review after all capability changes.
- Only then open the final Build/EXE/Release phase.
