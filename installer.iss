#define MyAppName "Saeed AI"
#ifndef SaeedVersion
#define SaeedVersion "0.3.6"
#endif
#define MyAppVersion SaeedVersion
#define MyAppPublisher "Saeed O. Almansour"

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
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
PrivilegesRequired=lowest
Uninstallable=yes
UninstallDisplayIcon={app}\Saeed.ico
WizardStyle=modern
SetupIconFile=installer-input\Saeed.ico
CloseApplications=yes
RestartApplications=no

[Files]
Source: "installer-input\Saeed.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\Saeed.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Saeed AI"; Filename: "{app}\Saeed.exe"
Name: "{autodesktop}\Saeed AI"; Filename: "{app}\Saeed.exe"

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\Saeed"
Type: filesandordirs; Name: "{localappdata}\Saeed"
Type: filesandordirs; Name: "{app}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SaeedAI"; ValueData: """{app}\Saeed.exe"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\Saeed.exe"; Description: "Launch Saeed AI"; Flags: nowait postinstall skipifsilent
