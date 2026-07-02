(() => {
  'use strict';

  const MAGIC = [0x50,0x50,0x4b,0x31]; // PPK1
  const VERSION = 1;
  const DEFAULT_READER_URL = 'https://0-vera.github.io/PaperPack/';
  const DEFAULT_READER_QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADGCAIAAAAG+WgKAAAECklEQVR4nO3dWYrcMBRA0VTI/rdcWYChEeJqcHPOd03pXAQP29Ln+/3+gc7f0z+A30ZSxCRFTFLEJEVMUsQkRUxSxCRFTFLEJEXs38iLPp/P6t/xg5GrkHO/cO6Tb/s9O438QqsUMUkRkxQxSRGTFLGhie9p3b2gIxPNuqlnbr4b8fyc6l9x9v/iySpFTFLEJEVMUsQkRWxy4ntad1Vr7l1zs1v1yWefjtz5f/FklSImKWKSIiYpYpIilk18bzQyGVXT3Lqrh7exShGTFDFJEZMUMUkRe+XENzep7bwXtHrXG6dCqxQxSRGTFDFJEZMUsWzi2zmbjExz1TW16g7JnfPd2TnRKkVMUsQkRUxSxCRFbHLiO7tj5Mg0N7cDzNyzfuumwvt373yyShGTFDFJEZMUMUkR+7zxvsHKbdcBfwerFDFJEZMUMUkRkxSxyfP45q5PVa+ZU10Lu/9siOpa4dy3W6WISYqYpIhJipikiA1d41t3ctxts+TZHTXX/cKd77JKEZMUMUkRkxQxSRFbuFfnzrns6ewMuO40wJHvGvnkdVcqrVLEJEVMUsQkRUxSxCYnvurK4M5z0kfcdoLDiOoUe3d1cilJEZMUMUkRkxSxoYlv3RWinZ88966Rcx+qb39a9+yhuzp5DUkRkxQxSRGTFLFs55aRd404e5LdiHVT4dlzFqrfY5UiJilikiImKWKSIpZd43u+Zuf1srNP7d02/86pPtkqRUxSxCRFTFLEJEUsO49v3X2DO6987fxr7NwXdOfvsUoRkxQxSRGTFDFJEZvcuaXaF6Wa787OiTuftjv7FKHn+DhAUsQkRUxSxCRFLDud4exZ4ZWd193O7hKzbvq2ShGTFDFJEZMUMUkRy3ZuqZ6Aq2acnU//rdv38mndX8xzfFxKUsQkRUxSxCRFbPI5vrNnKKzzxntKqxnQc3xcSlLEJEVMUsQkRWxo4tu5E+bZ+zyr3zzyyU+3ndI+xypFTFLEJEVMUsQkRWzydIazrzl7DWvOunMfRr5r7jVPdm7hAEkRkxQxSRGTFLHJ5/h2Wvfc3Lp9UapdWZ7uPwXDKkVMUsQkRUxSxCRFbHKvzp0nx+208x7XkU9+Ort36AirFDFJEZMUMUkRkxSx7HSGdXcJjnzX2d0y13njDjlWKWKSIiYpYpIiJili2cS307o7Ld+4v0p1d2jFKkVMUsQkRUxSxCRF7JUT39k9WG7bE2bumcF1s61VipikiEmKmKSISYpYNvGdnXFGXrNuL5d1u6Ds3JXFeXxcSlLEJEVMUsQkRWxy4ju7v0r17Tt3sFw3ha37zXMzoFWKmKSISYqYpIhJitjQCewwzipFTFLEJEVMUsQkRUxSxCRFTFLEJEVMUsQkRew/xloyueRfs0gAAAAASUVORK5CYII=';
  const ITERATIONS = 120000;
  const DENSITIES = {
    single: { safe: 180, standard: 256, dense: 320, max: 384 },
    nine: { safe: 72, standard: 96, dense: 112, max: 128 }
  };
  const GRID_ORDER = {
    single: ['safe','standard','dense','max'],
    nine: ['safe','standard','dense','max']
  };
  const TRY_GRIDS = [180,256,128,96,72,112,320,384];

  const $ = id => document.getElementById(id);
  const els = {
    encodeMode: $('encodeMode'), density: $('density'), singleInputs: $('singleInputs'), nineInputs: $('nineInputs'),
    fileInput: $('fileInput'), multiFileInput: $('multiFileInput'), textInput: $('textInput'), manualName: $('manualName'),
    password: $('password'), hideNames: $('hideNames'), includeReaderQr: $('includeReaderQr'), readerLink: $('readerLink'),
    encodeBtn: $('encodeBtn'), printBtn: $('printBtn'), downloadPngBtn: $('downloadPngBtn'), downloadSvgBtn: $('downloadSvgBtn'),
    encodeStatus: $('encodeStatus'), capacityInfo: $('capacityInfo'), paper: $('paper'),
    decodeMode: $('decodeMode'), decodeArea: $('decodeArea'), decodeImage: $('decodeImage'), decodeBtn: $('decodeBtn'),
    clearDecodeBtn: $('clearDecodeBtn'), resetSelectionBtn: $('resetSelectionBtn'), decodeStatus: $('decodeStatus'),
    decodeResults: $('decodeResults'), resultTemplate: $('resultTemplate'), imagePreview: $('imagePreview'), selectionInfo: $('selectionInfo')
  };

  let lastPaperBlobUrl = null;
  let currentCards = [];
  let currentMode = 'single';
  let preview = { img:null, canvas:null, selection:null, scaleX:1, scaleY:1, drag:false, start:null };

  init();

  function init(){
    els.readerLink.value = DEFAULT_READER_URL;
    els.encodeMode.addEventListener('change', () => { toggleMode(); updateCapacityInfo(); });
    els.density.addEventListener('change', updateCapacityInfo);
    els.includeReaderQr.addEventListener('change', updateCapacityInfo);
    els.encodeBtn.addEventListener('click', encodeCurrent);
    els.printBtn.addEventListener('click', () => window.print());
    els.downloadPngBtn.addEventListener('click', downloadPaperPng);
    els.downloadSvgBtn.addEventListener('click', downloadPaperSvg);
    els.decodeImage.addEventListener('change', preparePreview);
    els.decodeBtn.addEventListener('click', decodeImageInput);
    els.clearDecodeBtn.addEventListener('click', () => { els.decodeResults.innerHTML=''; setDecodeStatus(''); });
    els.resetSelectionBtn.addEventListener('click', () => { preview.selection=null; drawPreview(); });
    setupPreviewSelection();
    toggleMode(); updateCapacityInfo();
    if(location.protocol === 'file:'){
      setEncodeStatus('Uyarı: Dosyaya çift tıklayarak açtın. GitHub Pages veya localhost üzerinde çalıştırınca PWA/manifest hataları kaybolur.');
    }
  }

  function toggleMode(){
    const nine = els.encodeMode.value === 'nine';
    els.singleInputs.classList.toggle('hidden', nine);
    els.nineInputs.classList.toggle('hidden', !nine);
  }

  function updateCapacityInfo(){
    const mode = els.encodeMode.value;
    if(els.density.value === 'auto'){
      const opts = GRID_ORDER[mode].map(k => DENSITIES[mode][k]);
      const min = opts[0], max = opts[opts.length-1];
      els.capacityInfo.textContent = mode === 'nine'
        ? `Otomatik mod: Her kutu için gereken en küçük okunabilir yoğunluk seçilir (${min}×${min} - ${max}×${max}). Küçük dosyada daha büyük hücre = daha kolay okuma.`
        : `Otomatik mod: Dosya için gereken en küçük okunabilir yoğunluk seçilir (${min}×${min} - ${max}×${max}). Küçük dosyada daha büyük hücre = daha kolay okuma.`;
      return;
    }
    const n = DENSITIES[mode][els.density.value];
    const cap = Math.floor(n*n/8);
    const reserve = mode === 'nine' ? 180 : 220;
    const practical = Math.max(0, cap - reserve);
    const txt = mode === 'nine'
      ? `Seçili yoğunluk: ${n}×${n}. Kutu başı ham kapasite yaklaşık ${(cap/1024).toFixed(1)} KB, pratik dosya alanı yaklaşık ${(practical/1024).toFixed(1)} KB.`
      : `Seçili yoğunluk: ${n}×${n}. Ham kapasite yaklaşık ${(cap/1024).toFixed(1)} KB, pratik dosya alanı yaklaşık ${(practical/1024).toFixed(1)} KB.`;
    els.capacityInfo.textContent = txt + ' HTML/metin dosyası gzip ile daha küçük basılabilir.';
  }

  async function encodeCurrent(){
    try{
      setEncodeStatus('Hazırlanıyor...');
      await tick();
      const mode = els.encodeMode.value;
      const selectedDensity = els.density.value;
      const password = els.password.value || '';
      const files = mode === 'nine' ? await getNineFiles() : [await getSingleFile()];
      if(!files.length) throw new Error('Dosya veya metin girilmedi.');
      const cards = [];
      for(const file of files.slice(0, mode === 'nine' ? 9 : 1)){
        const packet = await buildPacket(file, password);
        const gridSize = chooseGridForPacket(mode, selectedDensity, packet.length);
        if(!gridSize){
          const max = DENSITIES[mode].max;
          throw new Error(`${file.name} çok büyük. Paket ${(packet.length/1024).toFixed(1)} KB, maksimum alan kapasitesi ${(Math.floor(max*max/8)/1024).toFixed(1)} KB.`);
        }
        const canvas = drawCodeCanvas(packet, gridSize, mode === 'nine' ? 4 : 5);
        cards.push({file, packet, canvas, gridSize});
      }
      renderPaper(cards, mode, Boolean(password));
      els.printBtn.disabled = false; els.downloadPngBtn.disabled = false; els.downloadSvgBtn.disabled = false;
      currentCards = cards; currentMode = mode;
      const summary = cards.map((c,i)=>`${i+1}. ${c.file.name}: ${(c.packet.length/1024).toFixed(2)} KB / ${(Math.floor(c.gridSize*c.gridSize/8)/1024).toFixed(2)} KB`).join('\n');
      setEncodeStatus(`A4 hazır.\n${summary}\nOtomatik yoğunluk açıksa küçük dosyalarda daha düşük grid seçilir; okuma kolaylaşır.\nOkuma notu: Otomatik mod önce kalın siyah çerçeveyi bulmaya çalışır. Manuel seçmen gerekirse sadece kalın siyah çerçeveli veri karesini seç; dıştaki ince sayfa/kart çizgisini ve başlığı alma.`);
    }catch(err){ console.error(err); setEncodeStatus('Hata: ' + err.message); }
  }


  function chooseGridForPacket(mode, selectedDensity, packetLength){
    if(selectedDensity !== 'auto'){
      const n = DENSITIES[mode][selectedDensity];
      return packetLength <= Math.floor(n*n/8) ? n : null;
    }
    for(const key of GRID_ORDER[mode]){
      const n = DENSITIES[mode][key];
      if(packetLength <= Math.floor(n*n/8)) return n;
    }
    return null;
  }

  async function getSingleFile(){
    const file = els.fileInput.files && els.fileInput.files[0];
    if(file){
      return { name: sanitizeName(els.manualName.value.trim() || file.name || 'paperpack.html'), mime: file.type || mimeFromName(file.name), bytes: new Uint8Array(await file.arrayBuffer()) };
    }
    const text = els.textInput.value;
    if(!text.trim()) throw new Error('Dosya seç veya metin/HTML yapıştır.');
    const name = sanitizeName(els.manualName.value.trim() || 'paperpack.html');
    return { name, mime: mimeFromName(name), bytes: new TextEncoder().encode(text) };
  }

  async function getNineFiles(){
    const list = Array.from(els.multiFileInput.files || []).slice(0,9);
    if(!list.length) throw new Error('9 modunda en az 1 dosya seçmelisin.');
    const out=[];
    for(const f of list) out.push({ name:sanitizeName(f.name), mime:f.type || mimeFromName(f.name), bytes:new Uint8Array(await f.arrayBuffer()) });
    return out;
  }

  function sanitizeName(name){ return (name || 'paperpack.html').replace(/[\\/\0]/g,'_').slice(0,120); }
  function mimeFromName(name){
    const n=(name||'').toLowerCase();
    if(n.endsWith('.html')||n.endsWith('.htm')) return 'text/html';
    if(n.endsWith('.css')) return 'text/css';
    if(n.endsWith('.js')) return 'text/javascript';
    if(n.endsWith('.json')) return 'application/json';
    if(n.endsWith('.svg')) return 'image/svg+xml';
    return 'text/plain';
  }

  async function buildPacket(file, password){
    let payload = file.bytes;
    const header = { v:VERSION, name:file.name, mime:file.mime, encrypted:false, compressed:false, created:new Date().toISOString() };
    const compressed = await gzipIfUseful(payload);
    if(compressed && compressed.length + 8 < payload.length){ payload = compressed; header.compressed = 'gzip'; }
    if(password){
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt, ITERATIONS);
      payload = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, payload));
      header.encrypted = true; header.kdf='PBKDF2-SHA256'; header.iterations=ITERATIONS; header.cipher='AES-GCM-256';
      header.salt = bytesToBase64(salt); header.iv = bytesToBase64(iv);
    }
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const packet = new Uint8Array(17 + headerBytes.length + payload.length);
    let o=0; packet.set(MAGIC,o); o+=4; packet[o++]=VERSION;
    writeU32(packet,o,headerBytes.length); o+=4; writeU32(packet,o,payload.length); o+=4;
    writeU32(packet,o,crc32Concat(headerBytes,payload)); o+=4; packet.set(headerBytes,o); o+=headerBytes.length; packet.set(payload,o);
    return packet;
  }

  async function gzipIfUseful(bytes){
    if(!('CompressionStream' in window)) return null;
    try{
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }catch(e){ return null; }
  }
  async function gunzip(bytes){
    if(!('DecompressionStream' in window)) throw new Error('Bu tarayıcı gzip çözmeyi desteklemiyor.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function deriveKey(password, salt, iterations){
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations, hash:'SHA-256'}, baseKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }

  function drawCodeCanvas(packet, n, scale){
    const quiet=8, border=4, total=n+(quiet+border)*2;
    const canvas=document.createElement('canvas'); canvas.width=total*scale; canvas.height=total*scale;
    const ctx=canvas.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    const ox=quiet+border, oy=quiet+border;
    ctx.fillStyle='#000';
    ctx.fillRect(quiet*scale, quiet*scale, (n+border*2)*scale, border*scale);
    ctx.fillRect(quiet*scale, (quiet+border+n)*scale, (n+border*2)*scale, border*scale);
    ctx.fillRect(quiet*scale, quiet*scale, border*scale, (n+border*2)*scale);
    ctx.fillRect((quiet+border+n)*scale, quiet*scale, border*scale, (n+border*2)*scale);
    const bits=bytesToBits(packet,n*n);
    for(let i=0;i<n*n;i++){
      if(bits[i]){
        const x=i%n, y=Math.floor(i/n);
        ctx.fillRect((ox+x)*scale,(oy+y)*scale,scale,scale);
      }
    }
    return canvas;
  }

  function bytesToBits(bytes, bitCount){
    const bits=new Uint8Array(bitCount);
    for(let i=0;i<bitCount;i++){
      const bi=i>>3; let byte;
      if(bi<bytes.length) byte=bytes[bi];
      else { let x=(bi*1103515245+12345)>>>0; byte=(x>>>16)&255; }
      bits[i]=(byte>>(7-(i&7)))&1;
    }
    return bits;
  }
  function bitsToBytes(bits){
    const len=Math.floor(bits.length/8), bytes=new Uint8Array(len);
    for(let i=0;i<len*8;i++) if(bits[i]) bytes[i>>3]|=1<<(7-(i&7));
    return bytes;
  }

  function renderPaper(cards, mode, encrypted){
    els.paper.innerHTML='';
    const title=document.createElement('div'); title.className='paper-title';
    const qrEnabled = els.includeReaderQr.checked;
    title.innerHTML = `<div><strong>PaperPack v1</strong><span>${mode==='nine'?'9 dosya modu':'tek dosya modu'} • ${encrypted?'şifreli':'şifresiz'} • ${new Date().toLocaleString('tr-TR')}</span><span class="reader-url">${qrEnabled ? escapeHtml(els.readerLink.value || DEFAULT_READER_URL) : ''}</span></div>`;
    if(qrEnabled){ const img=document.createElement('img'); img.className='reader-qr'; img.alt='PaperPack okuyucu linki'; img.src=DEFAULT_READER_QR; title.appendChild(img); }
    els.paper.appendChild(title);
    if(mode==='nine'){
      const grid=document.createElement('div'); grid.className='nine-grid';
      for(let i=0;i<9;i++){
        const item=cards[i], card=document.createElement('div'); card.className='code-card';
        if(item){ card.appendChild(metaLine(item.file.name,i+1,item.packet.length,item.gridSize)); item.canvas.className='code-canvas'; card.appendChild(item.canvas); }
        else card.innerHTML='<div class="code-meta"><span>Boş</span><span></span></div>';
        grid.appendChild(card);
      }
      els.paper.appendChild(grid);
    }else{
      const card=document.createElement('div'); card.className='code-card single-card';
      card.appendChild(metaLine(cards[0].file.name,1,cards[0].packet.length,cards[0].gridSize)); cards[0].canvas.className='code-canvas'; card.appendChild(cards[0].canvas); els.paper.appendChild(card);
    }
  }

  function metaLine(name,index,bytes,grid){
    const div=document.createElement('div'); div.className='code-meta';
    div.innerHTML=`<span>${index}. ${els.hideNames.checked?'gizli':escapeHtml(name)}</span><span>${grid}×${grid} • ${(bytes/1024).toFixed(2)} KB</span>`;
    return div;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function downloadPaperPng(){
    const scale=2, w=els.paper.offsetWidth, h=els.paper.offsetHeight;
    const out=document.createElement('canvas'); out.width=w*scale; out.height=h*scale;
    const ctx=out.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,out.width,out.height); ctx.scale(scale,scale);
    ctx.fillStyle='#111'; ctx.font='18px Arial'; ctx.fillText('PaperPack v1',30,32);
    if(els.includeReaderQr.checked){ await drawImageData(ctx, DEFAULT_READER_QR, w-120, 20, 84, 84); ctx.font='9px Arial'; ctx.fillText('Okuyucu', w-116, 112); }
    const parent=els.paper.getBoundingClientRect();
    for(const card of Array.from(els.paper.querySelectorAll('.code-card'))){
      const r=card.getBoundingClientRect(); const x=r.left-parent.left, y=r.top-parent.top;
      ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.strokeRect(x,y,r.width,r.height);
      const meta=card.querySelector('.code-meta'); if(meta){ ctx.fillStyle='#111'; ctx.font='9px Arial'; ctx.fillText(meta.innerText.slice(0,100),x+6,y+13); }
      const can=card.querySelector('canvas'); if(can){ const cr=can.getBoundingClientRect(); ctx.drawImage(can, cr.left-parent.left, cr.top-parent.top, cr.width, cr.height); }
    }
    out.toBlob(blob=>{ if(lastPaperBlobUrl) URL.revokeObjectURL(lastPaperBlobUrl); lastPaperBlobUrl=URL.createObjectURL(blob); downloadUrl(lastPaperBlobUrl,'paperpack-a4.png'); },'image/png');
  }
  function drawImageData(ctx,src,x,y,w,h){ return new Promise(res=>{ const im=new Image(); im.onload=()=>{ctx.drawImage(im,x,y,w,h);res();}; im.src=src; }); }
  function downloadUrl(url,name){ const a=document.createElement('a'); a.href=url; a.download=name; a.click(); }

  function downloadPaperSvg(){
    if(!currentCards.length) return;
    const W=210, H=297;
    let s=`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><text x="8" y="10" font-family="Arial" font-size="5">PaperPack v1</text>`;
    if(els.includeReaderQr.checked) s += `<image href="${DEFAULT_READER_QR}" x="178" y="5" width="22" height="22"/>`;
    if(currentMode==='single') s += svgCard(currentCards[0],20,32,170,170,1);
    else { let i=0; for(let r=0;r<3;r++) for(let c=0;c<3;c++){ if(currentCards[i]) s+=svgCard(currentCards[i],8+c*66,26+r*88,60,60,i+1); i++; } }
    s += '</svg>';
    const url=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'})); downloadUrl(url,'paperpack-a4.svg'); setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function svgCard(card,x,y,w,h,index){
    const n=card.gridSize, quiet=8, border=4, total=n+(quiet+border)*2, cell=w/total, bits=bytesToBits(card.packet,n*n);
    let s=`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="0.2"/><text x="${x}" y="${y-1.5}" font-family="Arial" font-size="2.4">${index}. ${escapeXml(card.file.name)} ${n}x${n}</text>`;
    s += `<rect x="${x+quiet*cell}" y="${y+quiet*cell}" width="${(n+border*2)*cell}" height="${border*cell}" fill="#000"/>`;
    s += `<rect x="${x+quiet*cell}" y="${y+(quiet+border+n)*cell}" width="${(n+border*2)*cell}" height="${border*cell}" fill="#000"/>`;
    s += `<rect x="${x+quiet*cell}" y="${y+quiet*cell}" width="${border*cell}" height="${(n+border*2)*cell}" fill="#000"/>`;
    s += `<rect x="${x+(quiet+border+n)*cell}" y="${y+quiet*cell}" width="${border*cell}" height="${(n+border*2)*cell}" fill="#000"/>`;
    const ox=x+(quiet+border)*cell, oy=y+(quiet+border)*cell;
    for(let i=0;i<bits.length;i++) if(bits[i]){ const xx=i%n, yy=Math.floor(i/n); s += `<rect x="${(ox+xx*cell).toFixed(3)}" y="${(oy+yy*cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" fill="#000"/>`; }
    return s+'</g>';
  }
  function escapeXml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  async function preparePreview(){
    const file=els.decodeImage.files && els.decodeImage.files[0];
    preview.selection=null;
    if(!file){ drawPreview(); return; }
    try{ preview.img=await loadImageFromFile(file); drawPreview(); autoSelectPreview(); }
    catch(e){ setDecodeStatus('Görsel önizlenemedi: '+e.message); }
  }
  function autoSelectPreview(){
    if(!preview.img) return;
    const bbox = findCodeBoundingBox(els.imagePreview);
    if(bbox && bbox.w > 40 && bbox.h > 40){
      preview.selection = { x:bbox.x0, y:bbox.y0, w:bbox.w, h:bbox.h, auto:true };
      drawPreview();
      els.selectionInfo.textContent = 'Otomatik alan bulundu. Yeşil çerçeve kalın siyah veri karesini kapsıyorsa doğrudan Oku diyebilirsin.';
    }
  }

  function setupPreviewSelection(){
    const c=els.imagePreview;
    const pos=e=>{ const r=c.getBoundingClientRect(); const p=e.touches?e.touches[0]:e; return {x:(p.clientX-r.left)*(c.width/r.width), y:(p.clientY-r.top)*(c.height/r.height)}; };
    const down=e=>{ if(!preview.img) return; preview.drag=true; preview.start=pos(e); preview.selection={x:preview.start.x,y:preview.start.y,w:1,h:1}; drawPreview(); e.preventDefault(); };
    const move=e=>{ if(!preview.drag) return; const p=pos(e); preview.selection=rectFromPoints(preview.start,p); drawPreview(); e.preventDefault(); };
    const up=()=>{ preview.drag=false; normalizeSelection(); drawPreview(); };
    c.addEventListener('mousedown',down); window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
    c.addEventListener('touchstart',down,{passive:false}); window.addEventListener('touchmove',move,{passive:false}); window.addEventListener('touchend',up);
  }
  function rectFromPoints(a,b){ return {x:Math.min(a.x,b.x), y:Math.min(a.y,b.y), w:Math.abs(a.x-b.x), h:Math.abs(a.y-b.y)}; }
  function normalizeSelection(){ if(!preview.selection || preview.selection.w<10 || preview.selection.h<10) preview.selection=null; }
  function drawPreview(){
    const c=els.imagePreview, ctx=c.getContext('2d');
    if(!preview.img){ c.width=1;c.height=1;ctx.clearRect(0,0,1,1); els.selectionInfo.textContent='Görsel yükleyince burada önizleme çıkar.'; return; }
    const maxW=Math.min(900, c.parentElement.clientWidth || 900), scale=Math.min(1,maxW/(preview.img.naturalWidth||preview.img.width));
    c.width=Math.round((preview.img.naturalWidth||preview.img.width)*scale); c.height=Math.round((preview.img.naturalHeight||preview.img.height)*scale);
    preview.scaleX=(preview.img.naturalWidth||preview.img.width)/c.width; preview.scaleY=(preview.img.naturalHeight||preview.img.height)/c.height;
    ctx.drawImage(preview.img,0,0,c.width,c.height);
    if(preview.selection){
      ctx.save();
      ctx.strokeStyle=preview.selection.auto ? '#009b48' : '#e00000';
      ctx.lineWidth=3; ctx.setLineDash([8,4]);
      ctx.strokeRect(preview.selection.x,preview.selection.y,preview.selection.w,preview.selection.h);
      ctx.restore();
      els.selectionInfo.textContent = preview.selection.auto
        ? 'Otomatik seçim aktif. Yeşil çerçeve kalın siyah veri karesini kapsıyorsa doğrudan Oku diyebilirsin.'
        : 'Manuel seçim aktif. En iyi seçim: sadece kalın siyah çerçeveli veri karesi; dıştaki ince kart çizgisi ve başlık dahil olmasın.';
    }
    else els.selectionInfo.textContent='Otomatik seçim bulunamadıysa kalın siyah çerçeveli veri karesini seç. Siyah kalın çerçeve dahil, başlık ve dış ince çerçeve hariç.';
  }

  async function decodeImageInput(){
    try{
      els.decodeResults.innerHTML='';
      const file=els.decodeImage.files && els.decodeImage.files[0];
      if(!file) throw new Error('Önce bir görsel yükle veya fotoğraf çek.');
      setDecodeStatus('Görsel hazırlanıyor...'); await tick();
      const img=preview.img || await loadImageFromFile(file);
      const full=imageToCanvas(img,1600);
      const canvases=[];
      if(preview.selection && els.decodeArea.value!=='full') canvases.push({name:'seçili alan', canvas:cropFromPreviewSelection(img)});
      if(els.decodeArea.value!=='selected') canvases.push({name:'tam görsel', canvas:full});
      const packets=[]; let attempts=0;
      for(const item of canvases){
        setDecodeStatus(`${item.name} taranıyor...`); await tick();
        const found = els.decodeMode.value==='nine' ? decodeNineFromCanvas(item.canvas) : decodeAutoFromCanvas(item.canvas);
        attempts += found.attempts; packets.push(...found.packets);
        if(packets.length && els.decodeMode.value!=='nine') break;
      }
      if(!packets.length) throw new Error(`PaperPack verisi bulunamadı. Denenen alan: ${attempts}. Manuel seçimde kalın siyah çerçeveyi dahil et, dış ince kart çerçevesini alma.`);
      setDecodeStatus(`${packets.length} paket bulundu. Deneme: ${attempts}.`);
      const unique=[]; const keys=new Set();
      for(const p of packets){ const k=(p.header.name||'')+':'+p.payload.length+':'+(p.header.created||''); if(!keys.has(k)){keys.add(k); unique.push(p);} }
      unique.forEach(addResultCard);
    }catch(err){ console.error(err); setDecodeStatus('Hata: '+err.message); }
  }

  function cropFromPreviewSelection(img){
    const sel=preview.selection; const sx=sel.x*preview.scaleX, sy=sel.y*preview.scaleY, sw=sel.w*preview.scaleX, sh=sel.h*preview.scaleY;
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(sw)); c.height=Math.max(1,Math.round(sh));
    c.getContext('2d',{willReadFrequently:true,alpha:false}).drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
    return c;
  }

  function decodeAutoFromCanvas(canvas){
    const packets=[], candidates=buildCandidates(canvas); let attempts=0;
    for(const bbox0 of candidates){
      const bboxList = expandBboxVariants(canvas, bbox0);
      for(const bbox of bboxList){
        for(const n of TRY_GRIDS){
          for(const mode of ['border','direct']){
            for(const phase of [0, -0.18, 0.18]){
              attempts++;
              try{ const p=parsePacket(bitsToBytes(sampleGrid(canvas,bbox,n,mode,phase))); if(p) return {packets:[p], attempts}; }
              catch(e){ /* try next */ }
            }
          }
        }
      }
    }
    return {packets, attempts};
  }
  function decodeNineFromCanvas(canvas){
    const packets=[]; let attempts=0;
    // First try auto as a whole, then 3x3 cells. This handles both full A4 and a manually selected cell.
    const a=decodeAutoFromCanvas(canvas); attempts+=a.attempts; packets.push(...a.packets);
    for(let r=0;r<3;r++) for(let c=0;c<3;c++){
      const crop=cropCanvas(canvas,c*canvas.width/3,r*canvas.height/3,canvas.width/3,canvas.height/3);
      const b=decodeAutoFromCanvas(crop); attempts+=b.attempts; packets.push(...b.packets);
    }
    return {packets, attempts};
  }

  function buildCandidates(canvas){
    const out=[]; const bbox=findCodeBoundingBox(canvas); if(bbox) out.push(bbox);
    // If the image is already a close crop, full area is useful.
    out.push({x0:0,y0:0,x1:canvas.width-1,y1:canvas.height-1,w:canvas.width,h:canvas.height});
    return out;
  }

  function imageToCanvas(img,max){
    const scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const c=document.createElement('canvas'); c.width=Math.round((img.naturalWidth||img.width)*scale); c.height=Math.round((img.naturalHeight||img.height)*scale);
    const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); return c;
  }
  function cropCanvas(src,x,y,w,h){ const c=document.createElement('canvas'); c.width=Math.round(w); c.height=Math.round(h); c.getContext('2d',{willReadFrequently:true,alpha:false}).drawImage(src,x,y,w,h,0,0,c.width,c.height); return c; }
  async function loadImageFromFile(file){ const url=URL.createObjectURL(file); try{ const img=new Image(); img.decoding='async'; await new Promise((res,rej)=>{img.onload=res; img.onerror=()=>rej(new Error('Görsel yüklenemedi.')); img.src=url;}); return img; } finally { setTimeout(()=>URL.revokeObjectURL(url),1000); } }

  function findCodeBoundingBox(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const w=canvas.width,h=canvas.height; const data=ctx.getImageData(0,0,w,h).data;
    const row=new Uint32Array(h), col=new Uint32Array(w);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=(y*w+x)*4; if((data[i]+data[i+1]+data[i+2])<420){ row[y]++; col[x]++; } }
    const yi=largestDenseInterval(row,w,0.18), xi=largestDenseInterval(col,h,0.18); if(!xi||!yi) return null;
    let [x0,x1]=xi, [y0,y1]=yi; const bw=x1-x0+1,bh=y1-y0+1; if(bw<70||bh<70) return null;
    const pad=Math.round(Math.min(bw,bh)*0.01);
    x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad); x1=Math.min(w-1,x1+pad); y1=Math.min(h-1,y1+pad);
    return {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1};
  }
  function largestDenseInterval(counts,denom,density){
    const min=Math.max(4,Math.floor(denom*density)); let best=null,start=-1;
    for(let i=0;i<counts.length;i++){
      const ok=counts[i]>=min;
      if(ok&&start<0) start=i;
      if((!ok||i===counts.length-1)&&start>=0){ const end=ok&&i===counts.length-1?i:i-1; if(!best||end-start>best[1]-best[0]) best=[start,end]; start=-1; }
    }
    return best;
  }


  function expandBboxVariants(canvas,bbox){
    const out=[];
    const add=(b)=>{
      const x0=clamp(Math.round(b.x0),0,canvas.width-2), y0=clamp(Math.round(b.y0),0,canvas.height-2);
      const x1=clamp(Math.round(b.x1),x0+1,canvas.width-1), y1=clamp(Math.round(b.y1),y0+1,canvas.height-1);
      const key=[x0,y0,x1,y1].join(',');
      if(!out.some(v=>v.key===key)) out.push({x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1,key});
    };
    add(bbox);
    const pad=Math.round(Math.min(bbox.w,bbox.h)*0.01);
    add({x0:bbox.x0-pad,y0:bbox.y0-pad,x1:bbox.x1+pad,y1:bbox.y1+pad});
    add({x0:bbox.x0+pad,y0:bbox.y0+pad,x1:bbox.x1-pad,y1:bbox.y1-pad});
    return out;
  }

  function sampleGrid(canvas,bbox,n,mode,phase=0){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let cellW,cellH,ox,oy;
    if(mode==='border'){
      const total=n+8; cellW=bbox.w/total; cellH=bbox.h/total; ox=bbox.x0+cellW*4; oy=bbox.y0+cellH*4;
    }else{
      cellW=bbox.w/n; cellH=bbox.h/n; ox=bbox.x0; oy=bbox.y0;
    }
    const values=new Uint8Array(n*n);
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const cx=ox+(x+0.5+phase)*cellW;
      const cy=oy+(y+0.5+phase)*cellH;
      values[y*n+x]=sampleAverageGray(img,canvas.width,canvas.height,cx,cy,cellW,cellH);
    }
    const threshold=otsuThreshold(values);
    const bits=new Uint8Array(n*n);
    for(let i=0;i<values.length;i++) bits[i]=values[i]<threshold?1:0;
    return bits;
  }

  function sampleAverageGray(img,w,h,cx,cy,cellW,cellH){
    const rX=Math.max(0.5, Math.min(2.5, cellW*0.22));
    const rY=Math.max(0.5, Math.min(2.5, cellH*0.22));
    const xs=[cx, cx-rX, cx+rX, cx, cx];
    const ys=[cy, cy, cy, cy-rY, cy+rY];
    let sum=0,count=0;
    for(let k=0;k<xs.length;k++){
      const x=clamp(Math.round(xs[k]),0,w-1), y=clamp(Math.round(ys[k]),0,h-1);
      const i=(y*w+x)*4;
      sum += (img[i]+img[i+1]+img[i+2])/3;
      count++;
    }
    return Math.round(sum/count);
  }

  function otsuThreshold(values){
    const hist=new Uint32Array(256);
    for(let i=0;i<values.length;i++) hist[values[i]]++;
    const total=values.length;
    let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
    let sumB=0,wB=0,maxVar=-1,thr=128;
    for(let t=0;t<256;t++){
      wB+=hist[t]; if(!wB) continue;
      const wF=total-wB; if(!wF) break;
      sumB+=t*hist[t];
      const mB=sumB/wB, mF=(sum-sumB)/wF;
      const between=wB*wF*(mB-mF)*(mB-mF);
      if(between>maxVar){ maxVar=between; thr=t; }
    }
    return Math.max(40, Math.min(220, thr));
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function parsePacket(bytes){
    if(bytes[0]!==MAGIC[0]||bytes[1]!==MAGIC[1]||bytes[2]!==MAGIC[2]||bytes[3]!==MAGIC[3]) return null;
    if(bytes[4]!==VERSION) throw new Error('Desteklenmeyen PaperPack sürümü.');
    const headerLen=readU32(bytes,5), payloadLen=readU32(bytes,9), crcStored=readU32(bytes,13), start=17;
    if(headerLen<=0||headerLen>4000||payloadLen<0||start+headerLen+payloadLen>bytes.length) return null;
    const headerBytes=bytes.slice(start,start+headerLen), payload=bytes.slice(start+headerLen,start+headerLen+payloadLen);
    if(crc32Concat(headerBytes,payload)!==crcStored) throw new Error('Checksum uyuşmadı.');
    return {header:JSON.parse(new TextDecoder().decode(headerBytes)), payload};
  }

  function addResultCard(packet){
    const node=els.resultTemplate.content.firstElementChild.cloneNode(true), h=node.querySelector('h3'), meta=node.querySelector('.meta'), dec=node.querySelector('.decrypt-zone'), open=node.querySelector('.open-zone'), err=node.querySelector('.error');
    h.textContent=packet.header.name||'paperpack.html';
    meta.textContent=`${packet.header.mime||'application/octet-stream'} • ${packet.header.encrypted?'şifreli':'şifresiz'} • ${packet.header.compressed?'gzip • ':''}${(packet.payload.length/1024).toFixed(2)} KB`;
    if(packet.header.encrypted){
      dec.classList.remove('hidden');
      node.querySelector('.decrypt-open-btn').onclick=async()=>{
        const win=window.open('about:blank','_blank');
        try{ const pass=node.querySelector('.result-password').value; if(!pass) throw new Error('Şifre girilmedi.'); const clear=await prepareClearPayload(packet,pass); const url=createBlobUrl(clear,packet.header); if(win) win.location.href=url; addOpenHandler(node,clear,packet.header); addDownloadHandler(node,clear,packet.header); open.classList.remove('hidden'); dec.classList.add('hidden'); }
        catch(e){ if(win) win.close(); err.textContent='Açılamadı: '+e.message; err.classList.remove('hidden'); }
      };
    }else{
      open.classList.remove('hidden');
      prepareClearPayload(packet,'').then(clear=>{ addOpenHandler(node,clear,packet.header); addDownloadHandler(node,clear,packet.header); }).catch(e=>{err.textContent='Açılamadı: '+e.message; err.classList.remove('hidden');});
    }
    els.decodeResults.appendChild(node);
  }

  async function prepareClearPayload(packet,password){
    let bytes=packet.payload;
    if(packet.header.encrypted){ const salt=base64ToBytes(packet.header.salt), iv=base64ToBytes(packet.header.iv), key=await deriveKey(password,salt,packet.header.iterations||ITERATIONS); bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes)); }
    if(packet.header.compressed==='gzip') bytes=await gunzip(bytes);
    return bytes;
  }
  function addOpenHandler(node,bytes,header){ node.querySelector('.open-btn').onclick=()=>{ window.open(createBlobUrl(bytes,header),'_blank'); }; }
  function addDownloadHandler(node,bytes,header){ node.querySelector('.download-btn').onclick=()=>{ const url=createBlobUrl(bytes,header); downloadUrl(url,header.name||'paperpack.bin'); setTimeout(()=>URL.revokeObjectURL(url),30000); }; }
  function createBlobUrl(bytes,header){ return URL.createObjectURL(new Blob([bytes],{type:header.mime||'application/octet-stream'})); }

  function writeU32(arr,o,v){ arr[o]=(v>>>24)&255; arr[o+1]=(v>>>16)&255; arr[o+2]=(v>>>8)&255; arr[o+3]=v&255; }
  function readU32(arr,o){ return ((arr[o]<<24)|(arr[o+1]<<16)|(arr[o+2]<<8)|arr[o+3])>>>0; }
  const CRC_TABLE=(()=>{ const t=new Uint32Array(256); for(let i=0;i<256;i++){ let c=i; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[i]=c>>>0; } return t; })();
  function crc32Concat(a,b){ let crc=0xffffffff; for(const arr of [a,b]) for(let i=0;i<arr.length;i++) crc=CRC_TABLE[(crc^arr[i])&255]^(crc>>>8); return (crc^0xffffffff)>>>0; }
  function bytesToBase64(bytes){ let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]); return btoa(s); }
  function base64ToBytes(b64){ const s=atob(b64); const out=new Uint8Array(s.length); for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i); return out; }
  function tick(){ return new Promise(r=>setTimeout(r,0)); }
  function setEncodeStatus(s){ els.encodeStatus.textContent=s; }
  function setDecodeStatus(s){ els.decodeStatus.textContent=s; }
})();
