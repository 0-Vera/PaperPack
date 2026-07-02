(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.config = {
    version: 1,
    magicSquare: [0x50,0x50,0x43,0x53], // PPCS
    magicFile: [0x50,0x50,0x46,0x31],   // PPF1
    magicChunk: [0x50,0x50,0x43,0x48],  // PPCH
    quietModules: 4,
    densities: [129,177,241,289],
    autoReadableDensities: [129,177,241],
    autoChunkGrid: 241,
    a4: { width: 2480, height: 3508, dpi: 300 },
    readerLinkDefault: 'https://0-vera.github.io/PaperPack/',
    maxFiles: 9,
    maxDecodeCandidates: 14
  };

  PP.utils = {
    enc: new TextEncoder(),
    dec: new TextDecoder('utf-8', { fatal: false }),
    textToBytes: function(text){ return PP.utils.enc.encode(text || ''); },
    bytesToText: function(bytes){ return PP.utils.dec.decode(bytes || new Uint8Array()); },
    concatBytes: function(parts){
      var total = 0, i;
      for(i=0;i<parts.length;i++) total += parts[i].length;
      var out = new Uint8Array(total), off = 0;
      for(i=0;i<parts.length;i++){ out.set(parts[i], off); off += parts[i].length; }
      return out;
    },
    writeU16: function(view, off, val){ view.setUint16(off, val >>> 0, false); },
    writeU32: function(view, off, val){ view.setUint32(off, val >>> 0, false); },
    readU16: function(view, off){ return view.getUint16(off, false); },
    readU32: function(view, off){ return view.getUint32(off, false); },
    bytesToBase64: function(bytes){
      var bin = '', chunk = 0x8000;
      for(var i=0;i<bytes.length;i+=chunk){ bin += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk)); }
      return btoa(bin);
    },
    base64ToBytes: function(b64){
      var bin = atob(b64), out = new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
      return out;
    },
    escapeHtml: function(str){
      return String(str == null ? '' : str).replace(/[&<>'"]/g, function(c){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]);
      });
    },
    fileExt: function(name){
      var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
      return m ? m[1] : '';
    },
    inferMime: function(name, fallback){
      var ext = PP.utils.fileExt(name);
      var map = { html:'text/html', htm:'text/html', txt:'text/plain', css:'text/css', js:'application/javascript', json:'application/json', xml:'application/xml', svg:'image/svg+xml', md:'text/markdown', csv:'text/csv' };
      return fallback || map[ext] || 'text/plain';
    },
    downloadBlob: function(blob, filename){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 500);
    },
    canvasToBlob: function(canvas, type, quality){
      return new Promise(function(resolve){ canvas.toBlob(resolve, type || 'image/png', quality || 0.96); });
    },
    formatBytes: function(bytes){
      bytes = Number(bytes || 0);
      if(bytes < 1024) return bytes + ' B';
      if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
      return (bytes/1024/1024).toFixed(2) + ' MB';
    },
    sleep: function(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); },
    clamp: function(v,min,max){ return Math.max(min, Math.min(max, v)); },
    nowName: function(prefix, ext){
      var d = new Date();
      var pad = function(n){ return String(n).padStart(2,'0'); };
      return prefix + '-' + d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.' + ext;
    },
    logStatus: function(el, text, type){
      if(!el) return;
      var div = document.createElement('div');
      div.className = 'line ' + (type || '');
      div.textContent = text;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    },
    clearStatus: function(el){ if(el) el.innerHTML = ''; }
  };
})();
