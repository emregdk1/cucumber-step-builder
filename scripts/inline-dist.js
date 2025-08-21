// Single-file inliner: replaces dist/index.html with fully inlined HTML (CSS + JS embedded)
// Usage: node scripts/inline-dist.js [--no-backup] [--clean-assets]
//  --no-backup     : Do not create index.original.html backup
//  --clean-assets  : After inlining, delete dist/assets directory (only if inline succeeded)
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const NO_BACKUP = args.includes('--no-backup');
const CLEAN_ASSETS = args.includes('--clean-assets');

const distDir = path.resolve('dist');
const htmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('dist/index.html not found. Run build first (e.g. npm run build).');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');

// Build a list of all match ranges we will replace (link + script) so we can do
// a single left->right reconstruction without temporary placeholders that could collide.
const linkRegex = /<link rel="stylesheet" href="(.*?)">/g;
const scriptRegex = /<script type="module" crossorigin src="(.*?)"><\/script>/g;

/** @typedef {{start:number,end:number,type:'css'|'js',ref:string}} Segment */
/** @type {Segment[]} */
const segments = [];

let m;
while ((m = linkRegex.exec(html))){
  segments.push({start:m.index,end:m.index + m[0].length,type:'css',ref:m[1]});
}
while ((m = scriptRegex.exec(html))){
  segments.push({start:m.index,end:m.index + m[0].length,type:'js',ref:m[1]});
}

segments.sort((a,b)=>a.start-b.start);

let out = '';
let cursor = 0;
for(const seg of segments){
  // append preceding static chunk
  if(cursor < seg.start) out += html.slice(cursor, seg.start);
  const filePath = path.join(distDir, seg.ref);
  if(seg.type==='css'){
    if(fs.existsSync(filePath)){
      const css = fs.readFileSync(filePath,'utf8');
      out += `<style>${css}</style>`;
    } else {
      out += `<!-- missing css ${seg.ref} -->`;
    }
  } else {
    if(fs.existsSync(filePath)){
      let js = fs.readFileSync(filePath,'utf8');
      js = js.replace(/<\/script/gi,'<\\/script');
      out += `<script type="module">${js}</script>`;
    } else {
      out += `<!-- missing js ${seg.ref} -->`;
    }
  }
  cursor = seg.end;
}
// tail
out += html.slice(cursor);
html = out;

// Final safety: ensure no external module script tags remain
if (/<script type="module" crossorigin src=.*><\/script>/.test(html)) {
  console.warn('[inline-dist] Warning: Not all module scripts were inlined.');
}

// Overwrite index.html directly (single deliverable). Keep one-time backup as index.original.html if absent.
try {
  const originalBackup = path.join(distDir, 'index.original.html');
  if(!NO_BACKUP) {
    if(!fs.existsSync(originalBackup)) {
      const orig = fs.readFileSync(htmlPath,'utf8');
      fs.writeFileSync(originalBackup, orig, 'utf8');
      console.log('[inline-dist] Created backup -> index.original.html');
    } else {
      console.log('[inline-dist] Backup exists (skipped)');
    }
  } else {
    console.log('[inline-dist] --no-backup active (skipping backup)');
  }
  fs.writeFileSync(htmlPath, html, 'utf8');
  const size2 = (fs.statSync(htmlPath).size / 1024).toFixed(1);
  console.log(`[inline-dist] Inlined dist/index.html (${size2} kB)`);

  if(CLEAN_ASSETS) {
    const assetsDir = path.join(distDir, 'assets');
    if(fs.existsSync(assetsDir)) {
      // Recursive remove
      fs.rmSync(assetsDir, {recursive:true, force:true});
      console.log('[inline-dist] Removed assets directory (--clean-assets)');
    } else {
      console.log('[inline-dist] No assets directory to remove');
    }
  }
} catch (e) {
  console.warn('[inline-dist] Failed to write inlined index.html:', e.message);
  process.exit(1);
}
