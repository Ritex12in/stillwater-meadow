"""Paint the autumn leaf-litter texture: public/assets/ground/leaves.png.

    python3 tools/paint_leaves.py

Needs Pillow. A seamless 512 px tile of fallen leaves (oval and maple-ish shapes in orange, red,
gold and brown, each with a darker midrib), on a transparent background so the grass shows
between them. Drawn at 2x and scaled down for smooth edges; leaves that cross an edge are drawn
again on the other side, so the tile repeats without seams. Fixed seed: the same picture each time.
"""
import math
import os
import random

from PIL import Image, ImageDraw

SIZE, SCALE = 512, 2
COLOURS = [(214, 106, 38), (196, 72, 34), (232, 160, 52), (178, 52, 36), (240, 190, 70), (150, 92, 48), (205, 128, 60)]


def leaf(cx, cy, length, angle, colour, maple):
    """Polygon points of one leaf, pointing along `angle`."""
    pts = []
    n = 28
    for i in range(n):
        t = i / n * 2 * math.pi
        r = length * (0.5 + 0.5 * math.cos(t)) ** 0.9 if not maple else length * (0.55 + 0.25 * abs(math.sin(t * 2.5)))
        w = 0.42 if not maple else 0.95
        x, y = r * math.cos(t), r * math.sin(t) * w
        pts.append((cx + x * math.cos(angle) - y * math.sin(angle), cy + x * math.sin(angle) + y * math.cos(angle)))
    return pts


def main():
    rnd = random.Random(1031)
    S = SIZE * SCALE
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for _ in range(520):
        cx, cy = rnd.random() * S, rnd.random() * S
        length = (14 + rnd.random() * 16) * SCALE
        angle = rnd.random() * 2 * math.pi
        base = rnd.choice(COLOURS)
        shade = 0.75 + rnd.random() * 0.4
        colour = tuple(min(255, int(c * shade)) for c in base) + (255,)
        rib = tuple(int(c * 0.6) for c in colour[:3]) + (255,)
        maple = rnd.random() < 0.35
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                x, y = cx + ox, cy + oy
                if -length * 2 < x < S + length * 2 and -length * 2 < y < S + length * 2:
                    d.polygon(leaf(x, y, length, angle, colour, maple), fill=colour)
                    back = 0.6 if maple else 0.05  # oval leaves grow from their stalk at the centre
                    d.line([(x - math.cos(angle) * length * back, y - math.sin(angle) * length * back),
                            (x + math.cos(angle) * length * 0.85, y + math.sin(angle) * length * 0.85)], fill=rib, width=SCALE)
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "ground", "leaves.png")
    im.save(out, optimize=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
