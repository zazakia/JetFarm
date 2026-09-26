import os
from PIL import Image, ImageDraw

src_path = r'C:\Users\HI\.gemini\antigravity\brain\db9d56f4-e6d1-4ca0-b0c9-45d0d0431de4\agri_one_icon_1790313760913.jpg'
if not os.path.exists(src_path):
    print("Source image not found, skipping regeneration.")
    exit(0)

im = Image.open(src_path).convert('RGB')
w, h = im.size

# Extract pure white emblem with anti-aliasing
emblem = Image.new('RGBA', (w, h), (0, 0, 0, 0))
for y in range(160, 865):
    for x in range(230, 795):
        r, g, b = im.getpixel((x, y))
        if r > 35:
            alpha = int(min(255, max(0, (r - 28) / (255 - 28) * 255)))
            if alpha > 0:
                emblem.putpixel((x, y), (255, 255, 255, alpha))

bbox = emblem.getbbox()
cropped = emblem.crop(bbox)
cw, ch = cropped.size

# Base green color
BG_COLOR = (21, 95, 46, 255)

# 1. android-icon-background.png (1024x1024)
bg_img = Image.new('RGBA', (1024, 1024), BG_COLOR)
bg_img.save('assets/android-icon-background.png', 'PNG')

# 2. android-icon-foreground.png (1024x1024)
fg_img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
target_h = 520
target_w = int(cw * (target_h / ch))
resized_fg = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
pos_x = (1024 - target_w) // 2
pos_y = (1024 - target_h) // 2
fg_img.paste(resized_fg, (pos_x, pos_y), resized_fg)
fg_img.save('assets/android-icon-foreground.png', 'PNG')

# 3. android-icon-monochrome.png (432x432)
mono_img = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
mono_h = 220
mono_w = int(cw * (mono_h / ch))
resized_mono = cropped.resize((mono_w, mono_h), Image.Resampling.LANCZOS)
mono_x = (432 - mono_w) // 2
mono_y = (432 - mono_h) // 2
mono_img.paste(resized_mono, (mono_x, mono_y), resized_mono)
mono_img.save('assets/android-icon-monochrome.png', 'PNG')

# 4. icon.png (1024x1024)
icon_img = Image.new('RGBA', (1024, 1024), BG_COLOR)
icon_h = 600
icon_w = int(cw * (icon_h / ch))
resized_icon = cropped.resize((icon_w, icon_h), Image.Resampling.LANCZOS)
icon_x = (1024 - icon_w) // 2
icon_y = (1024 - icon_h) // 2
icon_img.paste(resized_icon, (icon_x, icon_y), resized_icon)
icon_img.save('assets/icon.png', 'PNG')

# 5. splash-icon.png (512x512)
splash_img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(splash_img)
draw.rounded_rectangle([(32, 32), (480, 480)], radius=96, fill=BG_COLOR)
sp_h = 280
sp_w = int(cw * (sp_h / ch))
resized_sp = cropped.resize((sp_w, sp_h), Image.Resampling.LANCZOS)
sp_x = (512 - sp_w) // 2
sp_y = (512 - sp_h) // 2
splash_img.paste(resized_sp, (sp_x, sp_y), resized_sp)
splash_img.save('assets/splash-icon.png', 'PNG')

# 6. favicon.png (48x48)
fav_img = Image.new('RGBA', (48, 48), BG_COLOR)
fav_h = 36
fav_w = int(cw * (fav_h / ch))
resized_fav = cropped.resize((fav_w, fav_h), Image.Resampling.LANCZOS)
fav_x = (48 - fav_w) // 2
fav_y = (48 - fav_h) // 2
fav_img.paste(resized_fav, (fav_x, fav_y), resized_fav)
fav_img.save('assets/favicon.png', 'PNG')

print('All Agri-One icons successfully generated.')
