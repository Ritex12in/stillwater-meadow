"""Copy the few built things the meadow uses out of two more Quaternius kits (both CC0):
the bench from the Fantasy Props MegaKit, and the wooden fence and climbing vines from the
Medieval Village MegaKit, into public/assets/props.

    python3 tools/prepare_props.py "<Fantasy Props MegaKit folder>" "<Medieval Village MegaKit[Standard] folder>"

Needs Pillow. Like prepare_nature.py: texture references are dropped from the models (the game
builds its own materials) and the colour textures are downscaled.
"""
import json
import os
import shutil
import sys

from PIL import Image

# (kit, model)
MODELS = [
    ("props", "Bench"),
    ("village", "Prop_WoodenFence_Single"), ("village", "Prop_WoodenFence_Extension1"),
    ("village", "Prop_Vine1"), ("village", "Prop_Vine4"),
]
# output name: (kit, source texture, size)
TEXTURES = {
    "furniture.png": ("props", "T_Trim_Furniture_BaseColor.png", 512),
    "woodtrim.png": ("village", "T_WoodTrim_BaseColor.png", 512),
    "vine.png": ("village", "T_VineLeaf.png", 256),
}


def main(props, village):
    roots = {"props": (os.path.join(props, "Exports", "glTF"), os.path.join(props, "Textures"), props),
             "village": (os.path.join(village, "glTF"), os.path.join(village, "Textures"), village)}
    out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "props")
    os.makedirs(out, exist_ok=True)
    for kit, name in MODELS:
        src = roots[kit][0]
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
    for dst, (kit, srcname, size) in TEXTURES.items():
        im = Image.open(os.path.join(roots[kit][1], srcname)).convert("RGBA")
        im.resize((size, size), Image.LANCZOS).save(os.path.join(out, dst), optimize=True)
    shutil.copyfile(os.path.join(roots["props"][2], "License_Standard.txt"), os.path.join(out, "LICENSE-FantasyProps.txt"))
    shutil.copyfile(os.path.join(roots["village"][2], "License_Standard.txt"), os.path.join(out, "LICENSE-MedievalVillage.txt"))
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
