#ifndef SourceDir
  #define SourceDir "..\..\release\windows\CareApp"
#endif

#ifndef OutputDir
  #define OutputDir "..\..\release\windows\installer"
#endif

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{BBD8D662-DFB6-44E4-B1F2-93654B1E5E0A}
AppName=CareApp
AppVersion={#AppVersion}
AppPublisher=OWBRHE
DefaultDirName={localappdata}\Programs\CareApp
DefaultGroupName=CareApp
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=CareApp-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\CareApp.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\CareApp"; Filename: "{app}\CareApp.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\CareApp"; Filename: "{app}\CareApp.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\CareApp.exe"; Description: "Launch CareApp"; Flags: nowait postinstall skipifsilent
