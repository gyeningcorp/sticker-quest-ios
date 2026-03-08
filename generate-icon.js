#!/usr/bin/env node
/**
 * Generates a placeholder 1024x1024 PNG icon for Sticker Quest.
 * On macOS with ImageMagick: node generate-icon.js
 * Otherwise, manually place a 1024x1024 PNG at:
 *   Sources/StickerQuest/Assets.xcassets/AppIcon.appiconset/icon-1024.png
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = 'Sources/StickerQuest/Assets.xcassets/AppIcon.appiconset';
const outFile = path.join(outDir, 'icon-1024.png');

// Try ImageMagick
try {
  execSync(`convert -size 1024x1024 \
    gradient:'#FF6B9D-#845EC2' \
    -gravity center \
    -font "Apple-Color-Emoji" \
    -pointsize 600 \
    -annotate 0 "⭐" \
    "${outFile}"`, { stdio: 'pipe' });
  console.log('✅ Icon generated with ImageMagick');
} catch {
  // Fallback: create a minimal valid PNG using Buffer
  console.log('ImageMagick not found — creating placeholder pink PNG...');
  // Minimal 1x1 PNG, will be stretched by sips in CI
  // For a real icon, provide a proper 1024x1024 PNG
  const { createCanvas } = (() => { try { return require('canvas'); } catch { return null; } })() || {};
  if (createCanvas) {
    const canvas = createCanvas(1024, 1024);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#FF6B9D');
    grad.addColorStop(1, '#845EC2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.font = '600px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 512, 560);
    fs.writeFileSync(outFile, canvas.toBuffer('image/png'));
    console.log('✅ Icon generated with node-canvas');
  } else {
    console.log('⚠️  Please provide icon-1024.png manually at:', outFile);
  }
}
