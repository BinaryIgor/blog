import os
from os import path
from PIL import Image

MAX_IMAGE_WIDTH = 750
MAX_IMAGE_HEIGHT = 750

IMAGES_DIR = os.path.join(os.getcwd(), "..", "assets", "images")


def resize_images(input_path):
    if os.path.isdir(input_path):
        images = images_of_dir(input_path)
    else:
        images = [input_path]

    for i in images:
        print(i)
        _, name = os.path.split(i)
        old_name = name.split('.')[0]
        new_name = f'{old_name}_resized'

        print(f'Taking image from {i}')

        output_path = i.replace(old_name, new_name)

        img = Image.open(i)

        if img.width <= MAX_IMAGE_WIDTH and img.height <= MAX_IMAGE_HEIGHT:
            scale = 1
        elif img.width > img.height:
            scale = MAX_IMAGE_WIDTH / img.width
        else:
            scale = MAX_IMAGE_HEIGHT / img.height

        print(
            f"Applying scale: {scale} to get max_width: {MAX_IMAGE_WIDTH} and max_height: {MAX_IMAGE_HEIGHT}")

        new_width = int(scale * img.width)
        new_height = int(scale * img.height)

        if scale < 1:
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        img.save(output_path)

        print(f"Saving it to {output_path}")


def images_of_dir(dir):
    return [path.join(dir, i) for i in os.listdir(dir)]


resize_images(IMAGES_DIR)
