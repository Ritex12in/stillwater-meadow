"""Copy the meadow's grass, flower clumps, birches and maples from Quaternius' Ultimate Stylized Nature Pack
(CC0, https://quaternius.com/packs/ultimatestylizednature.html) into public/assets/meadow.

    node tools/obj_to_gltf.mjs <folder> <pack>/OBJ/NormalTree_*.obj <pack>/OBJ/PineTree_*.obj <pack>/OBJ/Rock_*.obj
    python3 tools/prepare_meadow.py "<folder with the pack's glTF files, the converted ones and the textures>"

Needs Pillow. Texture references are dropped from the models (the game builds its own
materials) and the two textures are downscaled to 512 px.
"""
import json
import os
import shutil
import sys

from PIL import Image

MODELS = ["Grass_Small", "Grass_Large", "Flower_1_Clump", "Flower_2_Clump", "Flower_3_Clump", "Flower_4_Clump", "Flower_5_Clump",
          # (birch, maple and the "normal" trees are grown from code now: src/world/proctrees.js)
          # these two only come as OBJ in the pack: convert them first with tools/obj_to_gltf.mjs
          *[f"PineTree_{i}" for i in range(1, 6)], *[f"Rock_{i}" for i in range(1, 6)]]
# output name: (source, grey?) -- leaves go grey so the seasons can tint them
TEXTURES = {"meadow_grass.png": ("Grass.png", False), "meadow_flowers.png": ("Flowers.png", False),
            "slimpine_bark.png": ("PineTree_Bark.png", False), "slimpine_leaves.png": ("PineTree_Leaves.png", True),
            "crag.png": ("Rocks.png", False)}


def grey(im):
    """Luminance only, scaled so the visible parts average about 0.85 (as in prepare_nature.py)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    lum = [0.299 * r + 0.587 * g + 0.114 * b for y in range(h) for x in range(w) for r, g, b, a in [px[x, y]] if a > 128]
    k = (0.85 * 255) / (sum(lum) / len(lum)) if lum else 1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            v = min(255, int((0.299 * r + 0.587 * g + 0.114 * b) * k))
            px[x, y] = (v, v, v, a)
    return im


def main(src):
    out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "meadow")
    os.makedirs(out, exist_ok=True)
    for name in MODELS:
        with open(os.path.join(src, name + ".gltf")) as f:
            j = json.load(f)
        for key in ("images", "textures", "samplers"):
            j.pop(key, None)
        for m in j.get("materials", []):
            for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                m.pop(k, None)
            pbr = m.get("pbrMetallicRoughness", {})
            pbr.pop("baseColorTexture", None)
            pbr.pop("metallicRoughnessTexture", None)
        with open(os.path.join(out, name + ".gltf"), "w") as f:
            json.dump(j, f, separators=(",", ":"))
        shutil.copyfile(os.path.join(src, j["buffers"][0]["uri"]), os.path.join(out, j["buffers"][0]["uri"]))
    for dst, (srcname, make_grey) in TEXTURES.items():
        im = Image.open(os.path.join(src, srcname)).convert("RGBA").resize((512, 512), Image.LANCZOS)
        (grey(im) if make_grey else im).save(os.path.join(out, dst), optimize=True)
    with open(os.path.join(out, "LICENSE.txt"), "w") as f:
        f.write("Ultimate Stylized Nature Pack by Quaternius, CC0 1.0 (public domain).\n"
                "https://quaternius.com/packs/ultimatestylizednature.html\n")
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
