# Scrapmate Play Store Assets

This directory contains all the assets needed to publish the Scrapmate app on Google Play Store.

## 📱 Files Generated

### Main Assets

1. **app-icon-512x512.png** (Required)
   - **Size**: 512x512 pixels
   - **Format**: PNG (32-bit with transparency)
   - **Usage**: Upload this as your app icon in Google Play Console
   - **Location**: Google Play Console → Store presence → App icon

2. **feature-graphic-1024x500.png** (Recommended)
   - **Size**: 1024x500 pixels
   - **Format**: PNG
   - **Usage**: Upload as feature graphic in Google Play Console
   - **Location**: Google Play Console → Store presence → Feature graphic

### Android Launcher Icons

All launcher icon sizes are generated in the following directories:
- `mipmap-mdpi/` - 48x48px (for mdpi screens)
- `mipmap-hdpi/` - 72x72px (for hdpi screens)
- `mipmap-xhdpi/` - 96x96px (for xhdpi screens)
- `mipmap-xxhdpi/` - 144x144px (for xxhdpi screens)
- `mipmap-xxxhdpi/` - 192x192px (for xxxhdpi screens)

Each directory contains:
- `ic_launcher.png` - Regular launcher icon
- `ic_launcher_round.png` - Round launcher icon (for devices that support round icons)

## 🚀 How to Use

### Step 1: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (Scrapmate Partner)
3. Navigate to **Store presence** → **Main store listing**
4. Upload `app-icon-512x512.png` as the **App icon**
5. Upload `feature-graphic-1024x500.png` as the **Feature graphic**

### Step 2: Update Android App Icons (Optional)

If you want to update the launcher icons in your app:

```bash
# Copy launcher icons to Android res directory
cp -r playstore-assets/mipmap-* android/app/src/main/res/
```

Or manually copy each density folder to:
```
android/app/src/main/res/mipmap-{density}/
```

## 📋 Google Play Store Requirements

### App Icon Requirements
- ✅ **Size**: 512x512 pixels (exactly)
- ✅ **Format**: PNG (32-bit with transparency)
- ✅ **Shape**: Square (no rounded corners - Google adds them)
- ✅ **Content**: Must not contain text, numbers, or version information
- ✅ **Background**: Can be transparent or solid color

### Feature Graphic Requirements
- ✅ **Size**: 1024x500 pixels (exactly)
- ✅ **Format**: PNG or JPG
- ✅ **File size**: Max 1 MB
- ✅ **Content**: Should represent your app visually

## 🎨 Design Details

The generated icons feature:
- **Color Scheme**: Green to blue gradient (representing recycling and sustainability)
- **Logo**: Uses your existing Scrapmate logo
- **Style**: Modern, clean, and professional
- **Compliance**: Meets all Google Play Store guidelines

## 🔄 Regenerating Icons

If you need to regenerate the icons:

```bash
cd scrapmatevendor
python3 scripts/generate-playstore-icon-advanced.py
```

This will:
1. Use your existing logo from `android/app/src/main/res/drawable/logo_dark.png`
2. Generate all required sizes
3. Create Play Store ready assets

## 📝 Notes

- The app icon uses your existing Scrapmate logo for brand consistency
- All icons are optimized for file size while maintaining quality
- The feature graphic includes your logo and tagline
- Launcher icons are automatically generated from the main icon

## ✅ Checklist Before Publishing

- [ ] Review `app-icon-512x512.png` - ensure it looks good
- [ ] Review `feature-graphic-1024x500.png` - ensure text is readable
- [ ] Upload app icon to Google Play Console
- [ ] Upload feature graphic to Google Play Console
- [ ] (Optional) Update launcher icons in the app
- [ ] Test the app icon appears correctly in Play Store listing

## 🆘 Troubleshooting

**Icon looks blurry?**
- Ensure you're using the 512x512px version for Play Store
- Don't resize the icon - use it at exact size

**Icon rejected by Play Store?**
- Check that it doesn't contain text or version numbers
- Ensure it's exactly 512x512 pixels
- Verify it's PNG format with transparency

**Need different design?**
- Edit `scripts/generate-playstore-icon-advanced.py`
- Or use a design tool to create custom icons
- Ensure they meet Google Play Store requirements

---

**Generated**: $(date)
**App**: Scrapmate Partner
**Package**: com.app.scrapmatepartner

