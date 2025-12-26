#!/usr/bin/env node
/**
 * Image Optimization Script
 * Converts PNG images to WebP format with high quality compression.
 * WebP typically provides 30-50% smaller file sizes than PNG.
 * 
 * Usage: node scripts/convert-images-to-webp.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');

// Quality settings for WebP conversion
const WEBP_QUALITY = 85; // Good balance between quality and file size
const WEBP_LOSSLESS = false; // Use lossy for smaller files (still great quality for game sprites)

// Directories to process
const DIRECTORIES_TO_PROCESS = [
  ASSETS_DIR,
  path.join(ASSETS_DIR, 'buildings'),
];

async function convertToWebP(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== '.png') return null;

  const outputPath = inputPath.replace(/\.png$/i, '.webp');
  
  // Skip if WebP already exists and is newer than the source
  if (fs.existsSync(outputPath)) {
    const pngStat = fs.statSync(inputPath);
    const webpStat = fs.statSync(outputPath);
    if (webpStat.mtime >= pngStat.mtime) {
      return { skipped: true, path: outputPath };
    }
  }

  try {
    const inputBuffer = fs.readFileSync(inputPath);
    const originalSize = inputBuffer.length;

    const outputBuffer = await sharp(inputBuffer)
      .webp({
        quality: WEBP_QUALITY,
        lossless: WEBP_LOSSLESS,
        effort: 6, // Higher effort = better compression (0-6)
        smartSubsample: true, // Better color subsampling
      })
      .toBuffer();

    fs.writeFileSync(outputPath, outputBuffer);
    const newSize = outputBuffer.length;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    return {
      converted: true,
      path: outputPath,
      originalSize,
      newSize,
      savings,
    };
  } catch (error) {
    console.error(`Error converting ${inputPath}:`, error.message);
    return { error: true, path: inputPath, message: error.message };
  }
}

async function processDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return [];
  }

  const files = fs.readdirSync(dir);
  const results = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && /\.png$/i.test(file)) {
      const result = await convertToWebP(filePath);
      if (result) results.push(result);
    }
  }

  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function main() {
  console.log('🖼️  Converting PNG images to WebP...\n');
  
  const allResults = [];
  
  for (const dir of DIRECTORIES_TO_PROCESS) {
    console.log(`Processing: ${path.relative(PUBLIC_DIR, dir) || '.'}`);
    const results = await processDirectory(dir);
    allResults.push(...results);
  }

  console.log('\n📊 Results:\n');

  let totalOriginal = 0;
  let totalNew = 0;
  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const result of allResults) {
    if (result.converted) {
      converted++;
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      const filename = path.basename(result.path);
      console.log(`  ✅ ${filename}: ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (${result.savings}% smaller)`);
    } else if (result.skipped) {
      skipped++;
    } else if (result.error) {
      errors++;
      console.log(`  ❌ ${path.basename(result.path)}: ${result.message}`);
    }
  }

  console.log('\n📈 Summary:');
  console.log(`  Converted: ${converted} files`);
  console.log(`  Skipped (already up-to-date): ${skipped} files`);
  if (errors > 0) console.log(`  Errors: ${errors} files`);
  
  if (converted > 0) {
    const totalSavings = ((1 - totalNew / totalOriginal) * 100).toFixed(1);
    console.log(`\n  Total size reduction: ${formatBytes(totalOriginal)} → ${formatBytes(totalNew)} (${totalSavings}% smaller)`);
  }

  console.log('\n✨ Done! WebP images are ready for use.');
  console.log('   The image loader will automatically prefer WebP over PNG.\n');
}

main().catch(console.error);
