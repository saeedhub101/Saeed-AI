#define MyAppName "Saeed AI"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Saeed AI"
#define MyAppExeName "Saeed.exe"

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
UninstallDisplayIcon={app}\Saeed.exe
WizardStyle=modern

[Files]
Source: "installer-input\Saeed.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Saeed AI"; Filename: "{app}\Saeed.exe"
Name: "{autodesktop}\Saeed AI"; Filename: "{app}\Saeed.exe"

[Run]
Filename: "{app}\Saeed.exe"; Description: "تشغيل Saeed AI"; Flags: nowait postinstall skipifsilent
