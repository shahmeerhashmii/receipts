#!/usr/bin/env node
// Generate PWA icons from logo.svg using sharp
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('./public/logo.svg');

// Full icon (logo fills entire canvas)
async function genIcon(size, outputPath) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputPath}`);
}

// Maskable icon (logo scaled to 80% with padding)
async function genMaskable(size, outputPath) {
  const innerSize = Math.round(size * 0.8);
  const padding = Math.round((size - innerSize) / 2);
  
  const inner = await sharp(Buffer.from(svg))
    .resize(innerSize, innerSize)
    .png()
    .toBuffer();
  
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 13, g: 15, b: 18, alpha: 1 }
    }
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputPath}`);
}

await genIcon(180, './public/apple-touch-icon.png');
await genIcon(192, './public/icon-192.png');
await genIcon(512, './public/icon-512.png');
await genMaskable(512, './public/icon-512-maskable.png');
await genIcon(32, './public/favicon-32x32.png');
await genIcon(16, './public/favicon-16x16.png');

// Also copy as favicon.ico placeholder (just use 32px png renamed)
const ico32 = readFileSync('./public/favicon-32x32.png');
writeFileSync('./public/favicon.ico', ico32);

console.log('All icons generated!');
