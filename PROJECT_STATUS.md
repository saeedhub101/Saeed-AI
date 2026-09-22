[object Object]

## Native utility UI migration — 2026-09-23

Chat and Settings have been migrated from WebView2 HTML pages to native Win32 C++ top-level windows in `src/main.cpp`. `assets/chat.html` and `assets/settings.html` are obsolete and were removed. WebView2/Three.js remains the rendering layer for the 3D avatar only. Native Chat sends text directly to the existing local-command/Agent pipeline and receives Agent status, tool, answer, error, and native-command messages through the existing native message bridge. Native Settings preserves AI provider/base URL/model/API key/voice mode controls plus account-provider buttons and update checking. This is the first native-utility phase; future controller/account/update UI expansion must extend the native window implementation rather than recreate HTML utility overlays.
