; Kaligula installer customizations (included by electron-builder's NSIS script).

!macro preInit
  ; Default folder: "Program Files (x86)\Kaligula". electron-builder picks the folder from the
  ; InstallLocation registry value and falls back to "Program Files" for 64-bit apps, so the default
  ; is written there first. A folder chosen in a previous installation is kept.
  SetRegView 64
  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $0 == ""
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$PROGRAMFILES32\${APP_FILENAME}"
  ${EndIf}
!macroend

!macro customInstall
  ; "Installed apps" shows the version as Kaligula names it (package.json needs semver: 0.1.0-A).
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion" "0.1A"
!macroend
