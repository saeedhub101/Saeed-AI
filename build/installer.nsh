!macro customUnInstall
  ; Remove Saeed per-user data created by Electron.
  RMDir /r "$APPDATA\Saeed AI"
  RMDir /r "$LOCALAPPDATA\Saeed AI"
  RMDir /r "$APPDATA\ai.saeed.desktop"
  RMDir /r "$LOCALAPPDATA\ai.saeed.desktop"
!macroend
