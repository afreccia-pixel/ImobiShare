const fs = require('fs');
const path = require('path');

try {
  // 1. Patch leaflet-src.js
  const srcPath = path.resolve(__dirname, '../node_modules/leaflet/dist/leaflet-src.js');
  if (fs.existsSync(srcPath)) {
    let content = fs.readFileSync(srcPath, 'utf8');
    let modified = false;

    if (!content.includes('if (!el) { return new Point(0, 0); }')) {
      content = content.replace(
        'function getPosition(el) {',
        'function getPosition(el) {\n\tif (!el) { return new Point(0, 0); }'
      );
      modified = true;
    }

    if (!content.includes('if (!el) { return; }')) {
      content = content.replace(
        'function setPosition(el, point) {',
        'function setPosition(el, point) {\n\tif (!el) { return; }'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(srcPath, content, 'utf8');
      console.log('[patch-leaflet] Successfully patched leaflet-src.js');
    }
  }

  // 2. Patch leaflet.js
  const distPath = path.resolve(__dirname, '../node_modules/leaflet/dist/leaflet.js');
  if (fs.existsSync(distPath)) {
    let distContent = fs.readFileSync(distPath, 'utf8');
    let distModified = false;

    if (distContent.includes('getPosition:function(t){return t._leaflet_pos||new p(0,0)}')) {
      distContent = distContent.replace(
        'getPosition:function(t){return t._leaflet_pos||new p(0,0)}',
        'getPosition:function(t){return(t&&t._leaflet_pos)||new p(0,0)}'
      );
      distModified = true;
    }

    if (distContent.includes('function(t,e){t._leaflet_pos=e')) {
      distContent = distContent.replace(
        'function(t,e){t._leaflet_pos=e',
        'function(t,e){if(!t)return;t._leaflet_pos=e'
      );
      distModified = true;
    }

    if (distModified) {
      fs.writeFileSync(distPath, distContent, 'utf8');
      console.log('[patch-leaflet] Successfully patched leaflet.js');
    }
  }
} catch (e) {
  console.warn('[patch-leaflet] Warning: Failed to patch leaflet files:', e);
}
