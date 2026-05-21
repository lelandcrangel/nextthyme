import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const recipeImagesDir = path.resolve('public/images/recipes');

const recipeSlugs = [
  'pot-roast',
  'cows-in-a-blanket',
  'brisket-deviled-eggs',
  'beef-brisket-taquitos',
  'barbacoa-empanadas',
];

await Promise.all(
  recipeSlugs.flatMap((slug) => {
    const sourcePath = path.join(recipeImagesDir, `${slug}-1200.webp`);

    return [
      sharp(sourcePath)
        .resize({ width: 1200, height: 630, fit: 'cover' })
        .webp({ quality: 78 })
        .toFile(path.join(recipeImagesDir, `${slug}-1200.tmp.webp`)),
      sharp(sourcePath)
        .resize({ width: 640, height: 336, fit: 'cover' })
        .webp({ quality: 74 })
        .toFile(path.join(recipeImagesDir, `${slug}-640.tmp.webp`)),
    ];
  }),
);

await Promise.all(
  recipeSlugs.flatMap((slug) => [
    fs.rename(path.join(recipeImagesDir, `${slug}-1200.tmp.webp`), path.join(recipeImagesDir, `${slug}-1200.webp`)),
    fs.rename(path.join(recipeImagesDir, `${slug}-640.tmp.webp`), path.join(recipeImagesDir, `${slug}-640.webp`)),
  ]),
);
