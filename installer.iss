#define MyAppName "Saeed AI"
#ifndef SaeedVersion
#define SaeedVersion "2.0"
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
Source: "installer-input\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\Saeed.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer-input\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; DestDir: "{app}"; Flags: ignoreversion
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
Filename: "{app}\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; Parameters: "/silent /install"; StatusMsg: "Checking and installing Microsoft WebView2 Runtime..."; Flags: waituntilterminated; AfterInstall: VerifyWebView2
Filename: "{app}\Saeed.exe"; Description: "Launch Saeed AI"; Flags: nowait postinstall skipifsilent

[Code]
function WebView2Installed: Boolean;
var
  Version: String;
begin
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) or
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) or
    RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
end;

procedure VerifyWebView2;
begin
  if not WebView2Installed then
  begin
    MsgBox(
      'Saeed AI cannot continue because Microsoft Edge WebView2 Runtime could not be installed.' + #13#10 + #13#10 +
      'The 3D interface requires WebView2 to render Three.js/WebGL.' + #13#10 + #13#10 +
      'Please check your Internet connection, Windows Update/security software, then run Setup again.',
      mbError, MB_OK);
    Abort;
  end;
end;
