#!/bin/bash

# Build Release AAB (Android App Bundle) for Google Play Store
# This script builds a signed release AAB file ready for Play Store upload

set -e

echo "🚀 Building Release AAB for Google Play Store..."
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if keystore exists
KEYSTORE_PATH="android/scrapmate-partner.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ Error: Keystore file not found at $KEYSTORE_PATH"
    echo "   Please ensure the keystore file exists."
    exit 1
fi

echo "✅ Keystore found: $KEYSTORE_PATH"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean

# Build release AAB
echo ""
echo "📦 Building release AAB..."
./gradlew bundleRelease

# Check if build was successful
if [ $? -eq 0 ]; then
    AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
    
    if [ -f "$AAB_PATH" ]; then
        AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
        echo ""
        echo "✅ Build successful!"
        echo ""
        echo "📱 AAB file location:"
        echo "   $(pwd)/$AAB_PATH"
        echo ""
        echo "📊 File size: $AAB_SIZE"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Go to Google Play Console: https://play.google.com/console"
        echo "   2. Select your app (Scrapmate Partner)"
        echo "   3. Go to: Production → Testing → Closed testing"
        echo "   4. Click 'Create new release'"
        echo "   5. Upload the AAB file: $AAB_PATH"
        echo "   6. Add release notes"
        echo "   7. Review and roll out to testers"
        echo ""
        echo "💡 Tip: You can also use the Play Console app to upload directly from your device"
    else
        echo "❌ Error: AAB file not found at expected location: $AAB_PATH"
        exit 1
    fi
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

