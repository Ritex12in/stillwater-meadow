"""Copy the models the meadow uses out of Quaternius' Stylized Nature MegaKit (CC0) into
public/assets/nature, ready for the browser.

    python3 tools/prepare_nature.py "<unzipped Stylized Nature MegaKit folder>"

Needs Pillow. What it does:
  * models: copies the .gltf/.bin pairs, dropping every texture reference (the game builds its
    own materials, and the pack's .gltf files point at some textures that aren't in the zip);
  * leaf and grass textures become grey, keeping only their light-and-shade detail, so the
    game's colours (and the season palettes) tint them;
  * everything is downscaled; at the distances the meadow is seen from, 512 px is plenty.
"""
import json
import os
import shutil
import sys

from PIL import Image

MODELS = [
    *[f"CommonTree_{i}" for i in range(1, 6)], *[f"Pine_{i}" for i in range(1, 6)],
    "Grass_Common_Short", "Grass_Common_Tall", "Flower_3_Single", "Flower_4_Single",
    "Bush_Common", "Bush_Common_Flowers", "Fern_1", "Clover_1", "Mushroom_Common",
    "Rock_Medium_1", "Rock_Medium_2", "Rock_Medium_3",
]
# output name: (source texture, size, grey?)
TEXTURES = {
    "leaves_round.png": ("Leaves_NormalTree_C.png", 512, True),
    "leaves_pine.png": ("Leaf_Pine_C.png", 512, True),
    "leaves_bush.png": ("Leaves_TwistedTree_C.png", 512, True),
    "bark.png": ("Bark_NormalTree.png", 512, False),
    "flowers.png": ("Flowers.png", 512, False),
    "leaves.png": ("Leaves.png", 512, False),
    "rocks.png": ("Rocks_Diffuse.png", 512, False),
    "mushrooms.png": ("Mushrooms.png", 256, False),
}


def grey(im):
    """Luminance only, scaled so the visible parts average about 0.85: a tint then reads true."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    lum = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 128:
                lum.append(0.299 * r + 0.587 * g + 0.114 * b)
    k = (0.85 * 255) / (sum(lum) / len(lum)) if lum else 1
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            v = min(255, int((0.299 * r + 0.587 * g + 0.114 * b) * k))
            op[x, y] = (v, v, v, a)
    return out


def main(src):
    out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "nature")
    os.makedirs(out, exist_ok=True)
    for name in MODELS:
        with open(os.path.join(src, "glTF", name + ".gltf")) as f:
            j = json.load(f)
        for key in ("images", "textures", "samplers"):
            j.pop(key, None)
        for m in j.get("materials", []):
            m.pop("normalTexture", None)
            m.pop("occlusionTexture", None)
            m.pop("emissiveTexture", None)
            pbr = m.get("pbrMetallicRoughness", {})
            pbr.pop("baseColorTexture", None)
            pbr.pop("metallicRoughnessTexture", None)
        with open(os.path.join(out, name + ".gltf"), "w") as f:
            json.dump(j, f, separators=(",", ":"))
        shutil.copyfile(os.path.join(src, "glTF", j["buffers"][0]["uri"]), os.path.join(out, j["buffers"][0]["uri"]))
    for dst, (srcname, size, make_grey) in TEXTURES.items():
        im = Image.open(os.path.join(src, "Textures", srcname))
        im = im.resize((size, size), Image.LANCZOS)
        if make_grey:
            im = grey(im)
        im.save(os.path.join(out, dst), optimize=True)
    shutil.copyfile(os.path.join(src, "License_Standard.txt"), os.path.join(out, "LICENSE.txt"))
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
