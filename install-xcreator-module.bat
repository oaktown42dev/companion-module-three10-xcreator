@echo off
echo Installing three10-xcreator-1.0.0 module into Companion...
if not exist "%APPDATA%\companion\modules\three10-xcreator-1.0.0\companion" (
    mkdir "%APPDATA%\companion\modules\three10-xcreator-1.0.0\companion"
)
xcopy /E /I /Y "%~dp0three10-xcreator-1.0.0\*" "%APPDATA%\companion\modules\three10-xcreator-1.0.0\"
echo.
echo Done! Please restart Companion (or use Modules -> Import module package with three10-xcreator-1.0.0.tgz).
pause
