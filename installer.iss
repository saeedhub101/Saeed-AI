#define MyAppName "Saeed AI"
#ifndef SaeedVersion
#define SaeedVersion "0.3.0"
#endif
#define MyAppVersion SaeedVersion
#define MyAppPublisher "Saeed AI"

[Setup]
AppId={{B5D0F7A2-1A43-4B2B-9A3B-7C0E5E3C4A21}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Saeed AI
DefaultGroupName=Saeed AI
OutputDir=Output
OutputBaseFilename=Saeed-AI-Setup-x64
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
Uninstallable=yes
UninstallDisplayIcon={app}\Saeed.exe
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Files]
Source: "installer-input\Saeed.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\SaeedUpdater.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Saeed AI"; Filename: "{app}\Saeed.exe"
Name: "{autodesktop}\Saeed AI"; Filename: "{app}\Saeed.exe"

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\Saeed\WebView2Data"
Type: filesandordirs; Name: "{localappdata}\Saeed"
Type: filesandordirs; Name: "{app}"

[Run]
Filename: "{app}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "تجهيز Microsoft WebView2 Runtime..."; Flags: waituntilterminated
Filename: "{app}\Saeed.exe"; Description: "تشغيل Saeed AI"; Flags: nowait postinstall skipifsilent
