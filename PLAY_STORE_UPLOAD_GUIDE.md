# Google Play Store Upload Guide - Closed Testing

This guide will help you upload the Scrapmate Partner app to Google Play Store for closed testing.

## 📋 Prerequisites

1. **Google Play Console Account**
   - Access to Google Play Console (https://play.google.com/console)
   - Developer account ($25 one-time fee if not already paid)

2. **App Information Ready**
   - App name: Scrapmate Partner
   - Package name: `com.app.scrapmatepartner`
   - Version: 1.0.1 (versionCode: 2)

3. **Assets Ready**
   - App icon (512x512px) - Located in `playstore-assets/app-icon-512x512.png`
   - Feature graphic (1024x500px) - Located in `playstore-assets/feature-graphic-1024x500.png`

## 🔨 Step 1: Build Release AAB

### Option A: Using the Build Script (Recommended)

```bash
cd scrapmatevendor
./scripts/build-release-aab.sh
```

### Option B: Manual Build

```bash
cd scrapmatevendor/android
./gradlew clean
./gradlew bundleRelease
```

The AAB file will be located at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## 📤 Step 2: Upload to Google Play Console

### 2.1 Access Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Sign in with your Google account
3. Select or create your app: **Scrapmate Partner**

### 2.2 Set Up App (First Time Only)

If this is your first upload:

1. **App Access**
   - Go to: **Setup** → **App access**
   - Select: "All or some of your users" (for closed testing)

2. **Store Listing**
   - Go to: **Store presence** → **Main store listing**
   - Upload app icon: `playstore-assets/app-icon-512x512.png`
   - Upload feature graphic: `playstore-assets/feature-graphic-1024x500.png`
   - Fill in app description, screenshots, etc.

3. **Content Rating**
   - Go to: **Content rating**
   - Complete the questionnaire

4. **Privacy Policy**
   - Go to: **App content** → **Privacy policy**
   - Add your privacy policy URL

### 2.3 Create Closed Testing Track

1. Go to: **Testing** → **Closed testing**
2. Click **Create new track** (if you don't have one)
3. Name it: "Internal Testing" or "Alpha Testing"
4. Click **Create**

### 2.4 Upload Release

1. In your testing track, click **Create new release**
2. **Upload AAB file**:
   - Click "Upload" or drag and drop
   - Select: `android/app/build/outputs/bundle/release/app-release.aab`
   - Wait for upload to complete

3. **Release name** (optional):
   - Example: "1.0.1 - Initial Release"

4. **Release notes**:
   ```
   Version 1.0.1
   - Initial release for closed testing
   - B2B dealer dashboard
   - Document upload functionality
   - Approval workflow
   - B2C access for approved B2B users
   ```

5. Click **Save**

### 2.5 Add Testers

1. In your testing track, go to **Testers** tab
2. Click **Create email list** or use existing list
3. Add tester email addresses
4. Share the testing link with testers

### 2.6 Review and Roll Out

1. Review the release details
2. Click **Review release**
3. Accept the declarations
4. Click **Start rollout to Closed testing**

## ✅ Step 3: Verify Upload

1. Go to **Testing** → **Closed testing** → Your track
2. Check that the release shows as "Available to testers"
3. Testers will receive an email with the testing link

## 📱 Step 4: Testers Install the App

Testers can install the app by:
1. Clicking the testing link from email
2. Joining the Google Group (if using group-based testing)
3. Installing from Play Store (they'll see "You're a tester" badge)

## 🔄 Step 5: Update Version for Next Release

When you need to release a new version:

1. Update version in `android/app/build.gradle`:
   ```gradle
   versionCode 3        // Increment by 1
   versionName "1.0.2"  // Update version name
   ```

2. Build new AAB:
   ```bash
   ./scripts/build-release-aab.sh
   ```

3. Upload new AAB to the same testing track

## 📋 Checklist Before Upload

- [ ] Version code incremented (must be higher than previous)
- [ ] Version name updated
- [ ] App icon (512x512px) ready
- [ ] Feature graphic (1024x500px) ready
- [ ] Release AAB built successfully
- [ ] Keystore file secured and backed up
- [ ] App tested on device
- [ ] Release notes prepared

## 🚨 Common Issues

### Issue: "Upload failed - Invalid AAB"
- **Solution**: Ensure you're uploading `.aab` file, not `.apk`
- Check that the AAB was built with `bundleRelease`, not `assembleRelease`

### Issue: "Version code already exists"
- **Solution**: Increment `versionCode` in `build.gradle`
- Each upload must have a unique, higher version code

### Issue: "Keystore not found"
- **Solution**: Ensure `android/scrapmate-partner.keystore` exists
- Check `gradle.properties` has correct keystore path

### Issue: "App not appearing for testers"
- **Solution**: 
  - Verify testers are added to the testing track
  - Check that release is rolled out (not just saved)
  - Ensure testers are using the correct Google account

## 📞 Support

For Play Console issues:
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Play Console Community](https://support.google.com/googleplay/android-developer/community)

## 📝 Notes

- **AAB vs APK**: Play Store requires AAB (Android App Bundle) format, not APK
- **Version Code**: Must always increment (1, 2, 3, ...)
- **Version Name**: User-friendly version (1.0.1, 1.0.2, etc.)
- **Keystore**: Keep your keystore file safe! You'll need it for all future updates
- **Testing**: Closed testing allows up to 100 testers without review

---

**Current Version**: 1.0.1 (versionCode: 2)
**Package**: com.app.scrapmatepartner
**Last Updated**: $(date)

