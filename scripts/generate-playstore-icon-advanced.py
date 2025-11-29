#!/usr/bin/env python3
"""
Generate Professional Play Store App Icon for Scrapmate
Uses existing logo and creates Play Store ready assets
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import sys

def create_icon_with_logo(logo_path=None):
    """Create a professional 512x512px icon, optionally using existing logo"""
    
    size = 512
    icon = Image.new('RGB', (size, size), color='#FFFFFF')
    draw = ImageDraw.Draw(icon)
    
    # Create modern gradient background (green to blue - recycling theme)
    for i in range(size):
        ratio = i / size
        # Gradient: #2E7D32 (green) to #4A90E2 (blue)
        r = int(46 + (74 - 46) * ratio)
        g = int(125 + (144 - 125) * ratio)
        b = int(50 + (226 - 50) * ratio)
        draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b))
    
    # Try to use existing logo if available
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert('RGBA')
            # Resize logo to fit in center (80% of icon size)
            logo_size = int(size * 0.7)
            logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
            
            # Create a white circle background for logo
            circle_radius = int(logo_size * 0.6)
            center = size // 2
            
            # Draw white circle with shadow effect
            shadow_offset = 8
            shadow_circle = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow_circle)
            shadow_draw.ellipse(
                [center - circle_radius + shadow_offset, center - circle_radius + shadow_offset,
                 center + circle_radius + shadow_offset, center + circle_radius + shadow_offset],
                fill=(0, 0, 0, 100)
            )
            shadow_circle = shadow_circle.filter(ImageFilter.GaussianBlur(radius=10))
            icon = Image.alpha_composite(icon.convert('RGBA'), shadow_circle).convert('RGB')
            draw = ImageDraw.Draw(icon)
            
            # Draw white circle
            draw.ellipse(
                [center - circle_radius, center - circle_radius,
                 center + circle_radius, center + circle_radius],
                fill='white',
                outline='#E0E0E0',
                width=3
            )
            
            # Paste logo in center
            logo_x = center - logo_size // 2
            logo_y = center - logo_size // 2
            icon.paste(logo, (logo_x, logo_y), logo)
            
            return icon
        except Exception as e:
            print(f"⚠️  Could not use existing logo: {e}")
            print("   Creating icon with default design...")
    
    # Fallback: Create icon with "S" and recycling symbol
    center = size // 2
    circle_radius = int(size * 0.35)
    
    # Draw white circle with shadow
    shadow_offset = 6
    draw.ellipse(
        [center - circle_radius + shadow_offset, center - circle_radius + shadow_offset,
         center + circle_radius + shadow_offset, center + circle_radius + shadow_offset],
        fill='#000000',
        outline='#000000'
    )
    
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        fill='white',
        outline='#E0E0E0',
        width=4
    )
    
    # Draw recycling arrows
    arrow_size = circle_radius * 0.5
    
    # Arrow 1 (top-right, green)
    arrow1 = [
        (center + circle_radius * 0.2, center - circle_radius * 0.3),
        (center + circle_radius * 0.5, center - circle_radius * 0.1),
        (center + circle_radius * 0.35, center - circle_radius * 0.1),
        (center + circle_radius * 0.35, center + circle_radius * 0.1),
        (center + circle_radius * 0.05, center + circle_radius * 0.1),
        (center + circle_radius * 0.05, center - circle_radius * 0.1),
        (center + circle_radius * 0.2, center - circle_radius * 0.1),
    ]
    draw.polygon(arrow1, fill='#2E7D32')
    
    # Arrow 2 (bottom-left, blue)
    arrow2 = [
        (center - circle_radius * 0.5, center + circle_radius * 0.3),
        (center - circle_radius * 0.2, center + circle_radius * 0.1),
        (center - circle_radius * 0.05, center + circle_radius * 0.1),
        (center - circle_radius * 0.05, center - circle_radius * 0.1),
        (center - circle_radius * 0.35, center - circle_radius * 0.1),
        (center - circle_radius * 0.35, center + circle_radius * 0.1),
        (center - circle_radius * 0.5, center + circle_radius * 0.1),
    ]
    draw.polygon(arrow2, fill='#4A90E2')
    
    # Arrow 3 (bottom-right, orange)
    arrow3 = [
        (center + circle_radius * 0.2, center + circle_radius * 0.3),
        (center + circle_radius * 0.5, center + circle_radius * 0.1),
        (center + circle_radius * 0.35, center + circle_radius * 0.1),
        (center + circle_radius * 0.35, center - circle_radius * 0.1),
        (center + circle_radius * 0.05, center - circle_radius * 0.1),
        (center + circle_radius * 0.05, center + circle_radius * 0.1),
        (center + circle_radius * 0.2, center + circle_radius * 0.1),
    ]
    draw.polygon(arrow3, fill='#FF9800')
    
    # Add "S" text
    try:
        font_size = int(size * 0.2)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    text = "S"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center - text_width // 2
    text_y = center - text_height // 2 - int(size * 0.02)
    
    # Draw text with shadow
    draw.text((text_x + 2, text_y + 2), text, fill='#000000', font=font)
    draw.text((text_x, text_y), text, fill='#2E7D32', font=font)
    
    return icon

def create_feature_graphic():
    """Create feature graphic for Play Store"""
    width, height = 1024, 500
    graphic = Image.new('RGB', (width, height), color='#4A90E2')
    draw = ImageDraw.Draw(graphic)
    
    # Gradient background
    for i in range(height):
        ratio = i / height
        r = int(46 + (74 - 46) * ratio)
        g = int(125 + (144 - 125) * ratio)
        b = int(50 + (226 - 50) * ratio)
        draw.rectangle([(0, i), (width, i+1)], fill=(r, g, b))
    
    # Add logo if available
    logo_path = "android/app/src/main/res/drawable/logo_dark.png"
    if os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert('RGBA')
            logo_height = int(height * 0.6)
            logo_aspect = logo.width / logo.height
            logo_width = int(logo_height * logo_aspect)
            logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
            
            logo_x = (width - logo_width) // 2
            logo_y = (height - logo_height) // 2 - 20
            
            # Create white background for logo
            bg_margin = 20
            draw.rounded_rectangle(
                [logo_x - bg_margin, logo_y - bg_margin,
                 logo_x + logo_width + bg_margin, logo_y + logo_height + bg_margin],
                radius=20,
                fill='white',
                outline='#E0E0E0',
                width=3
            )
            
            graphic.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            print(f"⚠️  Could not add logo to feature graphic: {e}")
    
    # Add tagline
    tagline = "Smart Scrap Management Partner"
    try:
        tagline_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
    except:
        try:
            tagline_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 36)
        except:
            tagline_font = ImageFont.load_default()
    
    tagline_bbox = draw.textbbox((0, 0), tagline, font=tagline_font)
    tagline_width = tagline_bbox[2] - tagline_bbox[0]
    tagline_x = (width - tagline_width) // 2
    tagline_y = height - 80
    
    # Draw tagline with shadow
    draw.text((tagline_x + 2, tagline_y + 2), tagline, fill='#000000', font=tagline_font)
    draw.text((tagline_x, tagline_y), tagline, fill='#FFFFFF', font=tagline_font)
    
    return graphic

def main():
    print("🎨 Generating Professional Scrapmate Play Store Assets...")
    
    output_dir = "playstore-assets"
    os.makedirs(output_dir, exist_ok=True)
    
    # Try to use existing logo
    logo_path = "android/app/src/main/res/drawable/logo_dark.png"
    if not os.path.exists(logo_path):
        logo_path = None
        print("ℹ️  No existing logo found, creating default design")
    else:
        print(f"✅ Using existing logo: {logo_path}")
    
    # Generate app icon
    print("\n📱 Creating app icon (512x512px)...")
    icon = create_icon_with_logo(logo_path)
    icon_path = os.path.join(output_dir, "app-icon-512x512.png")
    icon.save(icon_path, "PNG", optimize=True)
    print(f"✅ Saved: {icon_path}")
    
    # Generate feature graphic
    print("\n🖼️  Creating feature graphic (1024x500px)...")
    graphic = create_feature_graphic()
    graphic_path = os.path.join(output_dir, "feature-graphic-1024x500.png")
    graphic.save(graphic_path, "PNG", optimize=True)
    print(f"✅ Saved: {graphic_path}")
    
    # Generate Android launcher icons
    print("\n📲 Generating Android launcher icons...")
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    
    for folder, size in sizes.items():
        resized_icon = icon.resize((size, size), Image.Resampling.LANCZOS)
        folder_path = os.path.join(output_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        regular_path = os.path.join(folder_path, "ic_launcher.png")
        round_path = os.path.join(folder_path, "ic_launcher_round.png")
        
        resized_icon.save(regular_path, "PNG", optimize=True)
        resized_icon.save(round_path, "PNG", optimize=True)
        
        print(f"✅ Generated {folder} icons ({size}x{size}px)")
    
    print("\n✨ All assets generated successfully!")
    print(f"\n📁 Output directory: {output_dir}/")
    print("\n📋 Files created:")
    print("   ✅ app-icon-512x512.png - Upload to Google Play Console")
    print("   ✅ feature-graphic-1024x500.png - Upload as feature graphic")
    print("   ✅ Android launcher icons (all densities)")
    print("\n💡 Next steps:")
    print("   1. Review the icons in playstore-assets/")
    print("   2. Upload app-icon-512x512.png to Google Play Console")
    print("   3. Upload feature-graphic-1024x500.png as feature graphic")
    print("   4. (Optional) Copy launcher icons to android/app/src/main/res/")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("❌ Error: PIL/Pillow is required. Install it with:")
        print("   pip3 install Pillow")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

