// Single-file inliner: replaces dist/index.html with fully inlined HTML (CSS + JS embedded)
// Usage: node scripts/inline-dist.js [--no-backup] [--clean-assets] [--css-only] [--debug-overlay]
//  --no-backup       : Do not create index.original.html backup
//  --clean-assets    : After inlining, delete dist/assets directory (only if inline succeeded and JS fully inlined)
//  --css-only        : Only inline CSS (leave JS as external file) – useful if full JS inlining breaks dynamic imports
//  --debug-overlay   : Inject a tiny runtime error/log overlay for troubleshooting white screen issues
//  --chunk-js       : Break long inline bundle into shorter lines (editor friendliness)
//  --data-uri-js    : Encode JS into data: URI instead of giant inline body to silence editor false errors
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const NO_BACKUP = args.includes('--no-backup');
const CLEAN_ASSETS = args.includes('--clean-assets');
const CSS_ONLY = args.includes('--css-only');
const DEBUG_OVERLAY = args.includes('--debug-overlay');
const CHUNK_JS = args.includes('--chunk-js'); // optional: break long inline bundle into shorter lines (editor friendliness)
const DATA_URI_JS = args.includes('--data-uri-js'); // alternative: encode JS into data: URI instead of giant inline body to silence editor false errors
// Allow custom chunk size via --chunk-size=NUMBER (default 800)
let CUSTOM_CHUNK_SIZE = 800;
for (const a of args) {
  if (a.startsWith('--chunk-size=')) {
    const v = parseInt(a.split('=')[1], 10);
    if (!isNaN(v) && v > 50) { // guard against too tiny values
      CUSTOM_CHUNK_SIZE = Math.min(v, 10000); // clamp upper bound just in case
    }
  }
}

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
  if(cursor < seg.start) out += html.slice(cursor, seg.start);
  const filePath = path.join(distDir, seg.ref);
  if(seg.type==='css'){
    if(fs.existsSync(filePath)){
      const css = fs.readFileSync(filePath,'utf8');
      out += `<style>${css}</style>`;
    } else {
      out += `<!-- missing css ${seg.ref} -->`;
    }
  } else { // js
    if(CSS_ONLY){
      out += html.slice(seg.start, seg.end);
    } else {
      if(fs.existsSync(filePath)){
        let js = fs.readFileSync(filePath,'utf8');
        if(!DATA_URI_JS){
          js = js.replace(/<\/script/gi,'<\\/script');
        }
        if(CHUNK_JS && !DATA_URI_JS){
          // Safer chunking: only insert newlines at token boundaries (outside strings / comments)
          const maxChunk = CUSTOM_CHUNK_SIZE; // target max chars per line for editor performance (configurable)
          const breakChars = new Set([';','}','{',')',']',',']);
          let outJs = '';
          let sinceBreak = 0;
          let inSingle = false, inDouble = false, inTemplate = false;
          let inSLComment = false, inMLComment = false, escapeNext = false;
          for(let i=0;i<js.length;i++){
            const c = js[i];
            const next = js[i+1];
            outJs += c;
            if(inSLComment){
              if(c==='\n'){ inSLComment=false; sinceBreak=0; }
              continue;
            }
            if(inMLComment){
              if(c==='*' && next==='/' ){ inMLComment=false; outJs+=next; i++; }
              continue;
            }
            if(inSingle){
              if(!escapeNext && c==="'") inSingle=false;
              escapeNext = c==='\\' && !escapeNext;
            } else if(inDouble){
              if(!escapeNext && c==='"') inDouble=false;
              escapeNext = c==='\\' && !escapeNext;
            } else if(inTemplate){
              if(!escapeNext && c==='`') inTemplate=false;
              // template expression boundaries (${ ... }) handled as normal code
              escapeNext = c==='\\' && !escapeNext;
            } else { // not in string/comment
              if(c==='/' && next==='/' ){ inSLComment=true; outJs+=next; i++; continue; }
              if(c==='/' && next==='*' ){ inMLComment=true; outJs+=next; i++; continue; }
              if(c==="'") { inSingle=true; escapeNext=false; }
              else if(c==='"') { inDouble=true; escapeNext=false; }
              else if(c==='`') { inTemplate=true; escapeNext=false; }
              sinceBreak++;
              if(sinceBreak>=maxChunk && breakChars.has(c)){
                outJs += '\n';
                sinceBreak = 0;
              }
              continue;
            }
            if(!inSingle && !inDouble && !inTemplate) sinceBreak++;
          }
          js = outJs;
        }
        // Wrap & output either as inline script or data URI (to avoid massive script body in editor)
        const wrapped = `try{\n/*INLINE_BUNDLE_START*/${js}/*INLINE_BUNDLE_END*/\n}catch(e){\n  console.error('[boot-error]', e);\n  window.__BOOT_ERROR = e;\n  try{\n    const r=document.getElementById('root');\n    if(r){r.innerHTML='<div style=\\"font:14px monospace;padding:16px;color:#b91c1c;background:#fff5f5;border:1px solid #fca5a5;border-radius:4px;\\">'+\n      '<h2 style=\\"margin-top:0;font-size:16px;color:#991b1b;\\">Uygulama başlatılamadı</h2>'+\n      '<div>Hata: '+(e&&e.message?e.message:'(bilinmiyor)')+'</div>'+\n      '<div style=\\"margin-top:8px;\\">Detay için konsolu (F12) açın.</div>'+\n      '</div>'; }\n  }catch(_){}}`;
        if(DATA_URI_JS){
          const b64 = Buffer.from(wrapped,'utf8').toString('base64');
            out += `<script type=\"module\" src=\"data:text/javascript;base64,${b64}\"></script>`;
        } else {
          out += `<script type=\"module\">${wrapped}</script>`;
        }
      } else {
        out += `<!-- missing js ${seg.ref} -->`;
      }
    }
  }
  cursor = seg.end;
}
// tail
out += html.slice(cursor);
html = out;

if(!CSS_ONLY){
  // Final safety: ensure no external module script tags remain
  if (/<script type="module" crossorigin src=.*><\/script>/.test(html)) {
    console.warn('[inline-dist] Warning: Not all module scripts were inlined.');
  }
}

if(DEBUG_OVERLAY){
  const overlay = `\n<script>(function(){\n  const log=[];\n  const style='position:fixed;bottom:0;left:0;max-height:40%;width:100%;overflow:auto;background:#111;color:#0f0;font:12px monospace;z-index:99999;padding:6px;border-top:2px solid #0f0';\n  function ensure(){if(!window.__DBG){const d=document.createElement('div');d.id='__DBG';d.setAttribute('style',style);document.body.appendChild(d);window.__DBG=d;}return window.__DBG;}\n  ['log','error'].forEach(k=>{const orig=console[k];console[k]=function(...a){log.push({k,a});try{orig.apply(console,a);}catch(_){}const el=ensure();const line=document.createElement('div');line.textContent='['+k+'] '+a.join(' ');el.appendChild(line);};});\n  window.addEventListener('error',e=>{console.error('ERROR',e.message);});\n  window.addEventListener('unhandledrejection',e=>{console.error('REJECTION', e.reason);});\n  setTimeout(()=>{if(!document.getElementById('root')||!document.getElementById('root').children.length){console.log('root empty after 2s');}},2000);\n})();</script>`;
  html = html.replace(/<\/body>/i, overlay + '\n</body>');
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

  if(CLEAN_ASSETS && !CSS_ONLY) {
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
