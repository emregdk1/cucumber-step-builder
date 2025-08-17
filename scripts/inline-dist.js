// Single-file inliner: packs Vite build output into dist/index.inline.html
// Usage: node scripts/inline-dist.js  (run AFTER vite build)
import fs from 'fs';
import path from 'path';

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

const outPath = path.join(distDir, 'index.inline.html');
fs.writeFileSync(outPath, html, 'utf8');
const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`[inline-dist] Created ${outPath} (${sizeKB} kB)`);
