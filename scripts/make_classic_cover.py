#!/usr/bin/env python3
"""Genera portadas tipográficas estilo serie TintaJunta (600x900 webp).
Uso: python3 make_classic_cover.py ID "Título" "Autor" "#colorfondo" salida.webp
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 600, 900
GOLD = (216, 181, 109)
CREAM = (247, 241, 227)

SERIF_B = "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf"
SERIF_R = "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf"
SERIF_SB = "/usr/share/fonts/truetype/noto/NotoSerif-SemiBold.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def letterspaced(draw, xy, text, fnt, fill, spacing=6):
    x, y = xy
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x -= total / 2
    for ch, wch in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += wch + spacing
    return total

def wrap(draw, text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines

def diamond(draw, cx, cy, r, fill):
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)

def hexcol(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

def make(ident, title, author, bg_hex, out):
    bg = hexcol(bg_hex)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    # viñeta sutil: oscurecer bordes con rectángulos concéntricos
    for i in range(60):
        a = int(22 * (i / 60))
        c = tuple(max(0, v - a) for v in bg)
        d.rectangle([i, i, W - 1 - i, H - 1 - i], outline=c)
    # marco dorado doble
    d.rectangle([26, 26, W - 27, H - 27], outline=GOLD, width=2)
    d.rectangle([40, 40, W - 41, H - 41], outline=GOLD, width=1)
    for cx, cy in [(26, 26), (W - 27, 26), (26, H - 27), (W - 27, H - 27)]:
        diamond(d, cx, cy, 9, GOLD)
    # marca superior
    f_brand = font(SERIF_SB, 30)
    letterspaced(d, (W / 2, 92), "TINTAJUNTA", f_brand, GOLD, spacing=10)
    d.line([(W / 2 - 170, 148), (W / 2 + 170, 148)], fill=GOLD, width=2)
    # título (auto-ajuste)
    size = 72
    lines = [title]
    while size > 34:
        f_t = font(SERIF_B, size)
        lines = wrap(d, title, f_t, W - 160)
        if len(lines) <= 3 and max(d.textlength(l, font=f_t) for l in lines) <= W - 150:
            break
        size -= 4
    f_t = font(SERIF_B, size)
    th = sum(d.textbbox((0, 0), l, font=f_t)[3] for l in lines) + 14 * (len(lines) - 1)
    y = 400 - th / 2
    for l in lines:
        lw = d.textlength(l, font=f_t)
        d.text((W / 2 - lw / 2, y), l, font=f_t, fill=CREAM)
        y += d.textbbox((0, 0), l, font=f_t)[3] + 14
    # divisor dorado
    dy = y + 26
    d.line([(W / 2 - 150, dy), (W / 2 - 24, dy)], fill=GOLD, width=2)
    d.line([(W / 2 + 24, dy), (W / 2 + 150, dy)], fill=GOLD, width=2)
    diamond(d, W / 2, dy, 10, GOLD)
    # autor
    f_a = font(SERIF_R, 36)
    alines = wrap(d, author, f_a, W - 170)
    ay = dy + 44
    for l in alines:
        lw = d.textlength(l, font=f_a)
        d.text((W / 2 - lw / 2, ay), l, font=f_a, fill=CREAM)
        ay += d.textbbox((0, 0), l, font=f_a)[3] + 10
    # pie
    f_f = font(SERIF_SB, 23)
    letterspaced(d, (W / 2, H - 108), "CLÁSICO · DOMINIO PÚBLICO", f_f, GOLD, spacing=4)
    img.save(out, "WEBP", quality=88)
    print("ok", out)

if __name__ == "__main__":
    _, ident, title, author, bg, out = sys.argv
    make(ident, title, author, bg, out)
