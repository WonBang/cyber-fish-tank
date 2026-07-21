#!/bin/zsh
# Build Cyber Fish Tank menubar app.
# Usage: ./build.sh            -> builds CyberFishTank.app next to this script
#        ./build.sh run        -> builds then launches
#        ./build.sh release    -> builds then zips CyberFishTank-vX.Y.Z.zip for GitHub Releases
#
# Signing (optional): set both env vars to produce a notarized release build.
#   SIGN_IDENTITY="Developer ID Application: ..."  codesign identity
#   NOTARY_PROFILE="my-notary-profile"             `xcrun notarytool store-credentials` profile
# Without them the app is ad-hoc signed (users must right-click -> Open on first launch).
set -e
cd "$(dirname "$0")"

VERSION=0.1.0
APP=CyberFishTank.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

swiftc -O CyberFishTank.swift -o "$APP/Contents/MacOS/CyberFishTank"

cp ../index.html "$APP/Contents/Resources/index.html"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Cyber Fish Tank</string>
    <key>CFBundleIdentifier</key><string>com.wonjun.cyberfishtank</string>
    <key>CFBundleExecutable</key><string>CyberFishTank</string>
    <key>CFBundleVersion</key><string>$VERSION</string>
    <key>CFBundleShortVersionString</key><string>$VERSION</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>12.0</string>
    <key>LSUIElement</key><true/>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

if [[ -n "$SIGN_IDENTITY" ]]; then
    codesign --force --options runtime --sign "$SIGN_IDENTITY" "$APP"
else
    codesign --force --sign - "$APP" 2>/dev/null || true
fi

echo "built: $PWD/$APP"

if [[ "$1" == "run" ]]; then
    open "$APP"
elif [[ "$1" == "release" ]]; then
    ZIP="CyberFishTank-v$VERSION.zip"
    rm -f "$ZIP"
    ditto -c -k --keepParent "$APP" "$ZIP"
    if [[ -n "$SIGN_IDENTITY" && -n "$NOTARY_PROFILE" ]]; then
        xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait
        xcrun stapler staple "$APP"
        rm -f "$ZIP"
        ditto -c -k --keepParent "$APP" "$ZIP"   # re-zip with the stapled ticket
    else
        echo "note: unsigned release — set SIGN_IDENTITY and NOTARY_PROFILE to notarize"
    fi
    echo "release: $PWD/$ZIP"
fi
