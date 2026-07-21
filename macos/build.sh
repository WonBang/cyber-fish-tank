#!/bin/zsh
# Build Cyber Fish Tank menubar app prototype.
# Usage: ./build.sh        -> builds CyberFishTank.app next to this script
#        ./build.sh run    -> builds then launches
set -e
cd "$(dirname "$0")"

APP=CyberFishTank.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O CyberFishTank.swift -o "$APP/Contents/MacOS/CyberFishTank"

cp ../index.html "$APP/Contents/Resources/index.html"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Cyber Fish Tank</string>
    <key>CFBundleIdentifier</key><string>com.wonjun.cyberfishtank</string>
    <key>CFBundleExecutable</key><string>CyberFishTank</string>
    <key>CFBundleVersion</key><string>0.1.0</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>LSUIElement</key><true/>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

codesign --force --sign - "$APP" 2>/dev/null || true

echo "built: $PWD/$APP"
if [[ "$1" == "run" ]]; then
    open "$APP"
fi
