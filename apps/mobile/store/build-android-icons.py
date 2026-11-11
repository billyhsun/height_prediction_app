"""Android adaptive-icon layers and the Play Store icon, from assets/icon.png.

usage: python build-android-icons.py <icon.png> <assetsDir> <storeDir>

The source is a white glyph on a flat blue square. Whiteness becomes alpha, so
the glyph lifts off cleanly as a transparent foreground (and as the monochrome
layer Android 13+ tints for themed icons). The glyph is scaled to sit inside
the adaptive icon's 66dp safe circle, since launchers crop to many shapes.
"""
import sys
import numpy as np
from PIL import Image

src, assets, store = sys.argv[1:4]
icon = Image.open(src).convert("RGB")
a = np.asarray(icon).astype(np.float32)

# Background: median of the border pixels.
border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
bg = np.median(border, axis=0)
print("background #%02X%02X%02X" % tuple(int(round(v)) for v in bg))

# Alpha: how far each pixel has moved from the background toward white.
t = ((a - bg) / (255 - bg)).mean(axis=2)
alpha = np.clip((t - 0.08) / 0.84, 0, 1)
glyph = Image.fromarray((alpha * 255).astype(np.uint8))
box = glyph.point(lambda v: 255 if v > 40 else 0).getbbox()
glyph = glyph.crop(box)
gw, gh = glyph.size

N = 1024
safe = N * 66 / 108 * 0.96           # diameter of the safe circle, small margin
s = safe / np.hypot(gw, gh)          # fit the glyph's bounding box in it
glyph = glyph.resize((round(gw * s), round(gh * s)), Image.LANCZOS)

out = Image.new("RGBA", (N, N), (255, 255, 255, 0))
white = Image.new("RGBA", glyph.size, (255, 255, 255, 255))
out.paste(white, ((N - glyph.width) // 2, (N - glyph.height) // 2), glyph)
# One file serves as both the foreground and the monochrome layer.
out.save(f"{assets}/adaptive-icon.png")

# Play listing icon: 512x512, opaque 32-bit PNG. Google applies the rounded mask.
icon.resize((512, 512), Image.LANCZOS).convert("RGBA").save(f"{store}/play-icon-512.png")
