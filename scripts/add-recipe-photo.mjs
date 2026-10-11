// Turns one source photo into the two files a recipe uses:
//
//   node scripts/add-recipe-photo.mjs <recipe-id> <path-to-photo> [position]
//
//   public/images/recipes/<recipe-id>-1200.webp   1200x630, the recipe page
//   public/images/recipes/<recipe-id>-640.webp     640x336, the list card
//
// Same sizes and quality as the existing photos. The source is cropped to
// fill (it is not stretched); `position` says which part to keep when the
// shape differs: centre (default), top, bottom, left, right, or attention,
// which lets sharp pick the busiest region.
//
// The source file is not kept: originals are megabytes each and do not belong
// in the repository. Record where a photo came from, and its licence, in the
// recipe's imageCredit and imageCreditUrl.

import path from 'node:path';
import sharp from 'sharp';

const [recipeId, source, position = 'centre'] = process.argv.slice(2);

if (!recipeId || !source || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipeId)) {
  console.error('usage: node scripts/add-recipe-photo.mjs <recipe-id> <path-to-photo> [centre|top|bottom|left|right|attention]');
  process.exit(2);
}

const outDir = path.resolve('public/images/recipes');
const sizes = [
  { suffix: '1200', width: 1200, height: 630, quality: 78 },
  { suffix: '640', width: 640, height: 336, quality: 74 },
];

for (const { suffix, width, height, quality } of sizes) {
  const outFile = path.join(outDir, `${recipeId}-${suffix}.webp`);
  const info = await sharp(source)
    // Apply the camera's orientation before cropping; the EXIF tag itself is
    // dropped with the rest of the metadata, which is sharp's default.
    .rotate()
    .resize({ width, height, fit: 'cover', position: position === 'attention' ? sharp.strategy.attention : position })
    .webp({ quality })
    .toFile(outFile);
  console.log(`${path.relative(process.cwd(), outFile)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
}
