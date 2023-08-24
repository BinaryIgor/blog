#!/bin/bash
echo "Preparing previous dist dist..."

rm -r -f dist
mkdir dist

echo "Copy assets..."

cp -r assets dist/assets

echo "Build tailwind..."

npx tailwindcss -i ./assets/styles.css -o ./dist/assets/styles.css

echo "Generate blog..."

node src/generator.js

echo "Package built!"