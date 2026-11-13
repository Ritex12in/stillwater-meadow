"""Copy the meadow's grass and flower clumps from Quaternius' Ultimate Stylized Nature Pack
(CC0, https://quaternius.com/packs/ultimatestylizednature.html) into public/assets/meadow.

    python3 tools/prepare_meadow.py "<folder with the pack's glTF files and textures>"

Needs Pillow. Texture references are dropped from the models (the game builds its own
materials) and the two textures are downscaled to 512 px.
"""
import json
import os
import shutil
import sys

from PIL import Image

MODELS = ["Grass_Small", "Grass_Large", "Flower_1_Clump", "Flower_2_Clump", "Flower_3_Clump", "Flower_4_Clump", "Flower_5_Clump"]
TEXTURES = {"meadow_grass.png": "Grass.png", "meadow_flowers.png": "Flowers.png"}


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
    for dst, srcname in TEXTURES.items():
        Image.open(os.path.join(src, srcname)).convert("RGBA").resize((512, 512), Image.LANCZOS).save(os.path.join(out, dst), optimize=True)
    with open(os.path.join(out, "LICENSE.txt"), "w") as f:
        f.write("Ultimate Stylized Nature Pack by Quaternius, CC0 1.0 (public domain).\n"
                "https://quaternius.com/packs/ultimatestylizednature.html\n")
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
