#!/bin/bash
set -e

echo "Preparing dist dir..."

cd ../../

rm -r -f dist
mkdir dist

echo "Copy assets..."

cp -r assets dist/assets

echo "Build tailwind..."

tailwindcss -i ./assets/styles.css -o ./dist/assets/styles.css --minify

echo "Generate blog..."

node src/generator.js

echo "Hash assets..."

cd ops
python3 hash_assets.py;

echo "Package built!"