# Builds the TALVO fox app icons, iPhone/iPad start-up images and the launch animation from Ian's artwork.
# Usage: python3 web/scripts/build-fox.py <head.png (transparent)> <fox.gif (animated)> web/public
import sys
from PIL import Image, ImageFilter, ImageDraw

head_src, gif_src, out = sys.argv[1:4]
BG = (171, 203, 249)  # #abcbf9, the launch screen and manifest background

# ---- Icons: the fox's head on the background colour.
head = Image.open(head_src).convert('RGBA')
head = head.crop(head.getbbox())
def icon(size, fill):
    c = Image.new('RGBA', (size, size), BG + (255,))
    w = int(size * fill); r = head.width / head.height
    hw, hh = (w, int(w / r)) if r >= 1 else (int(w * r), w)
    c.alpha_composite(head.resize((hw, hh), Image.LANCZOS), ((size - hw) // 2, (size - hh) // 2 + int(size * 0.03)))
    return c.convert('RGB')
icon(180, 0.9).save(f'{out}/icons/apple-touch-icon.png')
icon(192, 0.9).save(f'{out}/icons/icon-192.png')
icon(512, 0.9).save(f'{out}/icons/icon-512.png')
icon(192, 0.72).save(f'{out}/icons/maskable-192.png')  # head inside the 80% safe zone
icon(512, 0.72).save(f'{out}/icons/maskable-512.png')
icon(64, 0.95).save(f'{out}/icons/favicon-64.png')

# ---- Animation frames with their edges faded to transparent: GIF colours are dithered, so a flat GIF background
# never matches the screen exactly. Saved as an animated WebP.
gif = Image.open(gif_src)
fm = Image.new('L', gif.size, 0)
ImageDraw.Draw(fm).rectangle([28, 28, gif.width - 28, gif.height - 28], fill=255)
fm = fm.filter(ImageFilter.GaussianBlur(14))
frames, durs = [], []
for i in range(gif.n_frames):
    gif.seek(i)
    f = gif.convert('RGBA'); f.putalpha(fm)
    frames.append(f); durs.append(gif.info.get('duration', 160))
frames[0].save(f'{out}/img/talvo-fox.webp', save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=82, method=6)

# The first frame, still: shown instead of the animation with Reduce Motion on.
still = Image.new('RGBA', gif.size, BG + (255,)); still.alpha_composite(frames[0])
still.convert('RGB').save(f'{out}/img/talvo-fox.jpg', quality=88, optimize=True)

# ---- Start-up images (iPhone/iPad home-screen app): the first frame at exactly the size and place the launch
# screen shows it (width: min(70vw, 50vh, 420px)), so the start-up image hands over to the animation seamlessly.
for (w, h), dpr in {(1170, 2532): 3, (1179, 2556): 3, (1290, 2796): 3, (1620, 2160): 2, (1640, 2360): 2,
                    (1668, 2388): 2, (2048, 2732): 2, (750, 1334): 2}.items():
    px = int(min(0.7 * w / dpr, 0.5 * h / dpr, 420) * dpr)
    c = Image.new('RGBA', (w, h), BG + (255,))
    c.alpha_composite(frames[0].resize((px, px), Image.LANCZOS), ((w - px) // 2, (h - px) // 2))
    c.convert('RGB').save(f'{out}/icons/splash-{w}x{h}.jpg', quality=86, optimize=True, progressive=True)
