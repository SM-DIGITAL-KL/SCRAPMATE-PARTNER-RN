#!/usr/bin/env python3
"""
Generate Play Store App Icon for Scrapmate
Creates a professional 512x512px icon for Google Play Store
"""

from PIL import Image, ImageDraw, ImageFont
import os
import sys

def create_scrapmate_icon():
    """Create a professional Scrapmate app icon"""
    
    # Play Store requires 512x512px icon
    size = 512
    icon = Image.new('RGB', (size, size), color='#4A90E2')  # Blue background
    draw = ImageDraw.Draw(icon)
    
    # Create a modern gradient background
    for i in range(size):
        # Gradient from #4A90E2 (blue) to #2E7D32 (green) - representing recycling/scrap
        ratio = i / size
        r = int(74 + (46 - 74) * ratio)  # Blue to darker blue-green
        g = int(144 + (125 - 144) * ratio)
        b = int(226 + (50 - 226) * ratio)
        draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b))
    
    # Add circular background for the logo
    center = size // 2
    circle_radius = int(size * 0.4)
    circle_margin = int(size * 0.1)
    
    # Draw white circle background
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        fill='white',
        outline='#FFFFFF',
        width=5
    )
    
    # Draw recycling symbol (simplified)
    # Three arrows in a triangle formation
    arrow_size = circle_radius * 0.6
    arrow_thickness = int(size * 0.03)
    
    # Arrow 1 (top)
    arrow1_points = [
        (center, center - circle_radius * 0.3),
        (center - arrow_size * 0.3, center - arrow_size * 0.1),
        (center - arrow_size * 0.15, center - arrow_size * 0.1),
        (center - arrow_size * 0.15, center + arrow_size * 0.2),
        (center + arrow_size * 0.15, center + arrow_size * 0.2),
        (center + arrow_size * 0.15, center - arrow_size * 0.1),
        (center + arrow_size * 0.3, center - arrow_size * 0.1),
    ]
    draw.polygon(arrow1_points, fill='#2E7D32')
    
    # Arrow 2 (bottom left)
    arrow2_points = [
        (center - circle_radius * 0.4, center + circle_radius * 0.2),
        (center - circle_radius * 0.1, center + circle_radius * 0.05),
        (center - circle_radius * 0.05, center + circle_radius * 0.05),
        (center - circle_radius * 0.05, center - circle_radius * 0.25),
        (center - circle_radius * 0.2, center - circle_radius * 0.25),
        (center - circle_radius * 0.2, center + circle_radius * 0.05),
        (center - circle_radius * 0.35, center + circle_radius * 0.2),
    ]
    draw.polygon(arrow2_points, fill='#4A90E2')
    
    # Arrow 3 (bottom right)
    arrow3_points = [
        (center + circle_radius * 0.4, center + circle_radius * 0.2),
        (center + circle_radius * 0.1, center + circle_radius * 0.05),
        (center + circle_radius * 0.05, center + circle_radius * 0.05),
        (center + circle_radius * 0.05, center - circle_radius * 0.25),
        (center + circle_radius * 0.2, center - circle_radius * 0.25),
        (center + circle_radius * 0.2, center + circle_radius * 0.05),
        (center + circle_radius * 0.35, center + circle_radius * 0.2),
    ]
    draw.polygon(arrow3_points, fill='#FF9800')
    
    # Add "S" text in the center
    try:
        # Try to use a system font
        font_size = int(size * 0.25)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Draw "S" text
    text = "S"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center - text_width // 2
    text_y = center - text_height // 2 - int(size * 0.05)
    
    draw.text((text_x, text_y), text, fill='#2E7D32', font=font)
    
    return icon

def create_feature_graphic():
    """Create a feature graphic for Play Store (1024x500px)"""
    width, height = 1024, 500
    graphic = Image.new('RGB', (width, height), color='#4A90E2')
    draw = ImageDraw.Draw(graphic)
    
    # Gradient background
    for i in range(height):
        ratio = i / height
        r = int(74 + (46 - 74) * ratio)
        g = int(144 + (125 - 144) * ratio)
        b = int(226 + (50 - 226) * ratio)
        draw.rectangle([(0, i), (width, i+1)], fill=(r, g, b))
    
    # Add text "SCRAPMATE" in the center
    try:
        font_size = 120
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    text = "SCRAPMATE"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (width - text_width) // 2
    text_y = (height - text_height) // 2
    
    # Draw text with shadow
    shadow_offset = 5
    draw.text((text_x + shadow_offset, text_y + shadow_offset), text, fill='#000000', font=font)
    draw.text((text_x, text_y), text, fill='#FFFFFF', font=font)
    
    # Add tagline
    tagline = "Smart Scrap Management"
    try:
        tagline_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except:
        try:
            tagline_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 40)
        except:
            tagline_font = ImageFont.load_default()
    
    tagline_bbox = draw.textbbox((0, 0), tagline, font=tagline_font)
    tagline_width = tagline_bbox[2] - tagline_bbox[0]
    tagline_x = (width - tagline_width) // 2
    tagline_y = text_y + text_height + 30
    
    draw.text((tagline_x, tagline_y), tagline, fill='#FFFFFF', font=tagline_font)
    
    return graphic

def main():
    print("🎨 Generating Scrapmate Play Store Assets...")
    
    # Create output directory
    output_dir = "playstore-assets"
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate app icon (512x512)
    print("📱 Creating app icon (512x512px)...")
    icon = create_scrapmate_icon()
    icon_path = os.path.join(output_dir, "app-icon-512x512.png")
    icon.save(icon_path, "PNG", optimize=True)
    print(f"✅ Saved: {icon_path}")
    
    # Generate feature graphic (1024x500)
    print("🖼️  Creating feature graphic (1024x500px)...")
    graphic = create_feature_graphic()
    graphic_path = os.path.join(output_dir, "feature-graphic-1024x500.png")
    graphic.save(graphic_path, "PNG", optimize=True)
    print(f"✅ Saved: {graphic_path}")
    
    # Generate all Android launcher icon sizes
    print("📲 Generating Android launcher icons...")
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
        
        # Regular icon
        regular_path = os.path.join(folder_path, "ic_launcher.png")
        resized_icon.save(regular_path, "PNG", optimize=True)
        
        # Round icon (same for now, can be customized)
        round_path = os.path.join(folder_path, "ic_launcher_round.png")
        resized_icon.save(round_path, "PNG", optimize=True)
        
        print(f"✅ Generated {folder} icons ({size}x{size}px)")
    
    print("\n✨ All assets generated successfully!")
    print(f"\n📁 Output directory: {output_dir}/")
    print("\n📋 Files created:")
    print("   - app-icon-512x512.png (Play Store icon)")
    print("   - feature-graphic-1024x500.png (Play Store feature graphic)")
    print("   - Android launcher icons in all densities")
    print("\n💡 Next steps:")
    print("   1. Upload app-icon-512x512.png to Google Play Console")
    print("   2. Upload feature-graphic-1024x500.png as feature graphic")
    print("   3. Copy launcher icons to android/app/src/main/res/")

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

