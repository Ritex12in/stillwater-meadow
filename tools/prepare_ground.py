"""Copy the ground textures into public/assets/ground (all CC0, from OpenGameArt):

  grass_lush.jpg   <- Cethiel, "Tileable Grass Textures - Set 1", Grass_02.png
  grass_flowers.jpg <- Cethiel, "Tileable Grass Textures - Set 1", Grass_03.png
  grass_fine.jpg   <- Cethiel, "Tileable Grass Textures - Set 1", Grass_01.png
  soil.jpg         <- Cethiel, "Tileable Dirt Textures", Dirt_02.png
  bloom_violet.jpg <- Cethiel, "Tileable Grass Textures - Set 2", Grass_03_0.png
  bloom_orange.jpg <- Cethiel, "Tileable Grass Textures - Set 1", Grass_04.png

    python3 tools/prepare_ground.py <folder with those four files>

Needs Pillow. The files are 512 px and seamless; this re-encodes them as JPEG (a quarter of the size).
"""
import os
import sys

from PIL import Image

FILES = {"grass_lush.jpg": "Grass_02.png", "grass_flowers.jpg": "Grass_03.png", "grass_fine.jpg": "Grass_01.png", "soil.jpg": "Dirt_02.png",
         "bloom_violet.jpg": "Grass_03_0.png", "bloom_orange.jpg": "Grass_04.png"}


def main(src):
    out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "ground")
    os.makedirs(out, exist_ok=True)
    for dst, name in FILES.items():
        Image.open(os.path.join(src, name)).convert("RGB").save(os.path.join(out, dst), quality=90, optimize=True)
    with open(os.path.join(out, "LICENSE.txt"), "w") as f:
        f.write("Ground textures by Cethiel (opengameart.org/users/cethiel), CC0 1.0 (public domain).\n"
                "https://opengameart.org/content/tileable-grass-textures-set-1\n"
                "https://opengameart.org/content/tileable-grass-textures-set-2\n"
                "https://opengameart.org/content/tileable-dirt-textures\n")
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
