#!/usr/bin/env node
// build.js — walks ./root and emits root/manifest.json so the static-site
// terminal knows the filesystem tree shape (it can't list directories over HTTP).
//
// Node classifies each file into a node type; file CONTENTS are not inlined —
// the terminal fetches them on demand via `cat`.
//
//   README.txt -> { type: "readme" }
//   *.sh       -> { type: "exec", url: <parsed from the `open "URL"` line> }
//   else       -> { type: "file" }
//
// Run `node build.js` after editing anything under ./root, before committing.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, 'root');
const MANIFEST = path.join(ROOT_DIR, 'manifest.json');

// pull the URL out of a shell script's `open "..."` line
function execUrl(filePath, name) {
  const text = fs.readFileSync(filePath, 'utf8');
  const m = text.match(/open\s+["']([^"']+)["']/);
  if (!m) {
    console.warn('  ! ' + name + ': no `open "URL"` line found — url will be empty');
    return '';
  }
  return m[1];
}

function classify(filePath, name) {
  if (name === 'README.txt') return { type: 'readme' };
  if (name.endsWith('.sh')) return { type: 'exec', url: execUrl(filePath, name) };
  return { type: 'file' };
}

function walk(dir) {
  const children = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.name !== 'manifest.json' && e.name !== '.DS_Store')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const full = path.join(dir, e.name);
    children[e.name] = e.isDirectory() ? { type: 'dir', children: walk(full) } : classify(full, e.name);
  }
  return children;
}

if (!fs.existsSync(ROOT_DIR)) {
  console.error('build.js: ./root does not exist. Nothing to build.');
  process.exit(1);
}

const manifest = { type: 'dir', children: walk(ROOT_DIR) };
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log('build.js: wrote ' + path.relative(__dirname, MANIFEST));
