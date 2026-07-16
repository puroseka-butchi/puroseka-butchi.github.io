'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const publicImagesDir = path.join(publicDir, 'images', 'translations');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== publicImagesDir && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function normalizeUrl(value) {
  return decodeURIComponent(String(value || '').split(/[?#]/)[0]).replace(/\\/g, '/');
}

const htmlFiles = walk(publicDir).filter(file => file.toLowerCase().endsWith('.html'));
const referenced = new Set();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const matches = html.matchAll(/(?:src|href|content)=["']([^"']*\/images\/translations\/[^"']+)["']/gi);
  for (const match of matches) {
    referenced.add(normalizeUrl(match[1]));
  }
}

let removed = 0;
for (const file of walk(publicImagesDir)) {
  const relativeUrl = `/${path.relative(publicDir, file).replace(/\\/g, '/')}`;
  if (referenced.has(relativeUrl)) continue;
  fs.rmSync(file, { force: true });
  removed += 1;
}
removeEmptyDirs(publicImagesDir);

console.log(`Pruned ${removed} unreferenced translation asset(s) from public/.`);
