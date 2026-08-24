"""Generates PWA icon PNGs from a simple drawn mark - no external assets.
Run with: python3 scripts/generate_icons.py
"""
from PIL import Image, ImageDraw, ImageFont

BG = (15, 23, 42)  # slate-900, matches Layout.tsx's bg-slate-900 nav accent
FG = (255, 255, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

OUT_DIR = "public/icons"


def draw_icon(size: int, corner_ratio: float = 0.22) -> Image.Image:
    scale = 4  # supersample for clean edges, then downsample
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(s * corner_ratio)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=BG)

    glyph = "$"
    font_size = int(s * 0.56)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), glyph, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pos = ((s - w) / 2 - bbox[0], (s - h) / 2 - bbox[1])
    draw.text(pos, glyph, font=font, fill=FG)

    return img.resize((size, size), Image.LANCZOS)


def draw_maskable(size: int) -> Image.Image:
    # Maskable icons need extra safe-zone padding (~20%) since OS shapes may crop
    # the outer edge into a circle/squircle - keep the glyph well inside that.
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, s - 1, s - 1], fill=BG)

    glyph = "$"
    font_size = int(s * 0.38)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), glyph, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pos = ((s - w) / 2 - bbox[0], (s - h) / 2 - bbox[1])
    draw.text(pos, glyph, font=font, fill=FG)

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    import os

    os.makedirs(OUT_DIR, exist_ok=True)

    draw_icon(192).save(f"{OUT_DIR}/icon-192.png")
    draw_icon(512).save(f"{OUT_DIR}/icon-512.png")
    # apple-touch-icon should be fully opaque (no transparency) and square, no
    # rounded corners baked in - iOS applies its own corner mask.
    apple = Image.new("RGB", (180, 180), BG)
    apple.paste(draw_icon(180, corner_ratio=0).convert("RGBA"), (0, 0), draw_icon(180, corner_ratio=0).convert("RGBA"))
    apple.save(f"{OUT_DIR}/apple-touch-icon.png")
    draw_maskable(512).save(f"{OUT_DIR}/icon-maskable-512.png")

    print("Generated icons in", OUT_DIR)
