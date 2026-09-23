## Current status — 2026-09-23


## Native utility UI migration — 2026-09-23

Chat and Settings have been migrated from WebView2 HTML pages to native Win32 C++ top-level windows in `src/main.cpp`. `assets/chat.html` and `assets/settings.html` are obsolete and were removed. WebView2/Three.js remains the rendering layer for the 3D avatar only. Native Chat sends text directly to the existing local-command/Agent pipeline and receives Agent status, tool, answer, error, and native-command messages through the existing native message bridge. Native Settings preserves AI provider/base URL/model/API key/voice mode controls plus account-provider buttons and update checking. This is the first native-utility phase; future controller/account/update UI expansion must extend the native window implementation rather than recreate HTML utility overlays.

## Avatar framing and native Settings behavior — 2026-09-23

- The companion window was enlarged to provide practical vertical room for the complete body while remaining a compact desktop companion.
- The 3D camera now calculates distance from the loaded GLB's actual bounding dimensions and the current horizontal/vertical field of view, then recalculates on viewport resize. This prevents the character from being cropped when aspect ratio or character dimensions change.
- Native Settings now follows the standard action contract: **OK** saves and closes, **Apply** saves and stays open, and **Cancel** closes without applying edits.

## Full-body controller expansion — 2026-09-23

The centralized avatar controller now exposes manual controls for thighs, shins and feet in addition to eyes, head, neck, spine, shoulders, arms, forearms and wrists. The Agent `character_control` schema and native bridge can send and verify these lower-body values, while procedural walking remains additive to the manual leg pose.

## Native Chat visual polish — 2026-09-23

- Native Chat remains a real Win32 C++ window; no HTML chat surface was reintroduced.
- Added a consistent dark utility theme for Chat and Settings child controls, including readable text, dark edit/history fields, dark list controls and native background painting.
- Chat layout now has explicit Conversation/Message areas and resizes without overlapping the status or action controls.
- The latest source commit is `80bc8b942fb0b01845152bdbf61418d0e7bb6d6e`; it must pass the Windows build/smoke workflow before being called release-ready.
