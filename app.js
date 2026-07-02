(() => {
  'use strict';

  const MAGIC = [0x50, 0x50, 0x4b, 0x32]; // PPK2
  const VERSION = 2;
  const ITERATIONS = 220000;
  const MAX_ITEMS = 9;
  const DENSITIES = {
    single: { safe: 180, standard: 220, dense: 256, max: 320 },
    multi:  { safe: 72,  standard: 88,  dense: 104, max: 120 }
  };
  const TRY_GRIDS = [320, 256, 220, 180, 120, 104, 88, 72];

  const $ = (id) => document.getElementById(id);
  const els = {
    layoutMode: $('layoutMode'), density: $('density'), filePicker: $('filePicker'), addManualBtn: $('addManualBtn'),
    itemsPanel: $('itemsPanel'), itemTemplate: $('itemTemplate'), pagePreset: $('pagePreset'), readerLink: $('readerLink'),
    showPageHeader: $('showPageHeader'), includeReaderLink: $('includeReaderLink'), showGlobalTech: $('showGlobalTech'), fitNineGrid: $('fitNineGrid'), includeCodeFrame: $('includeCodeFrame'),
    globalDescription: $('globalDescription'), capacityInfo: $('capacityInfo'), encodeBtn: $('encodeBtn'), printBtn: $('printBtn'),
    downloadPngBtn: $('downloadPngBtn'), downloadSvgBtn: $('downloadSvgBtn'), encodeStatus: $('encodeStatus'), paper: $('paper'),
    decodeMode: $('decodeMode'), decodeArea: $('decodeArea'), decodeImage: $('decodeImage'), decodeBtn: $('decodeBtn'), clearDecodeBtn: $('clearDecodeBtn'),
    decodeStatus: $('decodeStatus'), decodeResults: $('decodeResults'), resultTemplate: $('resultTemplate'), imagePreview: $('imagePreview'),
    selectionInfo: $('selectionInfo'), resetSelectionBtn: $('resetSelectionBtn'),
    cameraStage: $('cameraStage'), scanVideo: $('scanVideo'), startCameraBtn: $('startCameraBtn'), captureScanBtn: $('captureScanBtn'), autoScanBtn: $('autoScanBtn'), stopCameraBtn: $('stopCameraBtn'), scanHint: $('scanHint')
  };

  let items = [];
  let lastCards = [];
  let previewImageCanvas = null;
  let selection = null;
  let dragStart = null;
  let scanStream = null;
  let autoScanTimer = null;
  let autoScanBusy = false;

  bind();
  renderItems();
  updateCapacityInfo();

  function bind(){
    els.filePicker.addEventListener('change', addPickedFiles);
    els.addManualBtn.addEventListener('click', () => addManualItem());
    els.layoutMode.addEventListener('change', updateCapacityInfo);
    els.density.addEventListener('change', updateCapacityInfo);
    els.pagePreset.addEventListener('change', applyPreset);
    els.encodeBtn.addEventListener('click', encodeCurrent);
    els.printBtn.addEventListener('click', () => window.print());
    els.downloadPngBtn.addEventListener('click', downloadPaperPng);
    els.downloadSvgBtn.addEventListener('click', downloadPaperSvg);
    els.decodeImage.addEventListener('change', loadDecodePreview);
    els.decodeBtn.addEventListener('click', decodeImageInput);
    els.clearDecodeBtn.addEventListener('click', () => { els.decodeResults.innerHTML=''; setDecodeStatus(''); });
    els.resetSelectionBtn.addEventListener('click', () => { selection=null; redrawPreview(); });
    els.imagePreview.addEventListener('pointerdown', startSelection);
    els.imagePreview.addEventListener('pointermove', moveSelection);
    els.imagePreview.addEventListener('pointerup', endSelection);
    els.startCameraBtn.addEventListener('click', startCameraScan);
    els.captureScanBtn.addEventListener('click', captureAndDecodeFromCamera);
    els.autoScanBtn.addEventListener('click', toggleAutoScan);
    els.stopCameraBtn.addEventListener('click', stopCameraScan);
  }

  function applyPreset(){
    const p = els.pagePreset.value;
    if(p === 'minimal'){
      els.showPageHeader.checked = false; els.includeReaderLink.checked = false; els.showGlobalTech.checked = false;
    }else if(p === 'note'){
      els.showPageHeader.checked = false; els.includeReaderLink.checked = false;
    }else if(p === 'standard'){
      els.showPageHeader.checked = true; els.includeReaderLink.checked = true; els.showGlobalTech.checked = false;
    }else if(p === 'full'){
      els.showPageHeader.checked = true; els.includeReaderLink.checked = true; els.showGlobalTech.checked = true;
      for(const it of items){ it.showName = true; it.showDescription = true; it.showTech = true; }
      renderItems();
    }
  }

  async function addPickedFiles(){
    const selected = Array.from(els.filePicker.files || []);
    for(const file of selected){
      if(items.length >= MAX_ITEMS) break;
      const bytes = new Uint8Array(await file.arrayBuffer());
      items.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), kind:'file', name:sanitizeName(file.name), mime:file.type || mimeFromName(file.name), bytes, text:'', password:'', description:'', showName:true, showDescription:false, showTech:false });
    }
    els.filePicker.value = '';
    renderItems();
    updateCapacityInfo();
  }

  function addManualItem(){
    if(items.length >= MAX_ITEMS){ setEncodeStatus('En fazla 9 kare eklenebilir.'); return; }
    items.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), kind:'manual', name:`manual-${items.length+1}.html`, mime:'text/html', bytes:null, text:'', password:'', description:'', showName:true, showDescription:false, showTech:false });
    renderItems();
    updateCapacityInfo();
  }

  function renderItems(){
    els.itemsPanel.innerHTML = '';
    if(!items.length){ els.itemsPanel.innerHTML = '<div class="empty-items">Henüz veri eklenmedi. Dosya seç veya manuel kart ekle.</div>'; return; }
    items.forEach((item, idx) => {
      const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.item-title').textContent = `${idx+1}. ${item.kind === 'manual' ? 'Manuel veri' : 'Dosya'}`;
      const manual = node.querySelector('.manual-field');
      if(item.kind === 'manual') manual.classList.remove('hidden');
      const text = node.querySelector('.item-text');
      if(text){ text.value = item.text || ''; text.addEventListener('input', () => { item.text = text.value; item.bytes = new TextEncoder().encode(item.text); }); }
      const name = node.querySelector('.item-name'); name.value = item.name; name.addEventListener('input', () => { item.name=sanitizeName(name.value || 'paperpack.html'); item.mime=mimeFromName(item.name); });
      const pass = node.querySelector('.item-password'); pass.value = item.password || ''; pass.addEventListener('input', () => { item.password=pass.value; });
      const desc = node.querySelector('.item-description'); desc.value = item.description || ''; desc.addEventListener('input', () => { item.description=desc.value; });
      const sn = node.querySelector('.item-show-name'); sn.checked = item.showName; sn.addEventListener('change', () => { item.showName=sn.checked; });
      const sd = node.querySelector('.item-show-desc'); sd.checked = item.showDescription; sd.addEventListener('change', () => { item.showDescription=sd.checked; });
      const st = node.querySelector('.item-show-tech'); st.checked = item.showTech; st.addEventListener('change', () => { item.showTech=st.checked; });
      node.querySelector('.remove-item').addEventListener('click', () => { items.splice(idx,1); renderItems(); updateCapacityInfo(); });
      const meta = node.querySelector('.item-meta');
      const size = item.kind === 'manual' ? new TextEncoder().encode(item.text || '').length : (item.bytes ? item.bytes.length : 0);
      meta.textContent = `${item.mime || 'text/plain'} • ham boyut ${(size/1024).toFixed(2)} KB${item.password ? ' • şifreli basılacak' : ''}`;
      els.itemsPanel.appendChild(node);
    });
  }

  function getEffectiveLayout(){
    const mode = els.layoutMode.value;
    if(mode === 'single') return 'single';
    if(mode === 'grid') return 'multi';
    return items.length <= 1 ? 'single' : 'multi';
  }

  function chooseGrid(layout, payloadSize){
    const density = els.density.value;
    const d = DENSITIES[layout];
    if(density !== 'auto') return d[density];
    const candidates = layout === 'single' ? [180,220,256,320] : [72,88,104,120];
    for(const n of candidates){ if(payloadSize < Math.floor((n*n)/8) - 500) return n; }
    return candidates[candidates.length-1];
  }

  function updateCapacityInfo(){
    const layout = getEffectiveLayout();
    const n = chooseGrid(layout, 0);
    const cap = Math.floor((n*n)/8);
    if(layout === 'single') els.capacityInfo.textContent = `Tek büyük kare modu. Önerilen grid ${n}×${n}, ham kapasite yaklaşık ${(cap/1024).toFixed(1)} KB.`;
    else els.capacityInfo.textContent = `Çoklu kare modu. En fazla 9 kare. Önerilen grid ${n}×${n}, kare başı ham kapasite yaklaşık ${(cap/1024).toFixed(1)} KB.`;
  }

  async function encodeCurrent(){
    try{
      renderItems();
      setEncodeStatus('Hazırlanıyor...');
      if(!items.length) throw new Error('Önce dosya seç veya manuel kart ekle.');
      const prepared = [];
      for(const item of items){
        const bytes = await getItemBytes(item);
        if(!bytes.length) throw new Error(`${item.name} boş görünüyor.`);
        const packet = await buildPacket({...item, bytes}, item.password || '');
        const layout = getEffectiveLayout();
        const gridSize = chooseGrid(layout, packet.length);
        const capacity = Math.floor((gridSize*gridSize)/8);
        if(packet.length > capacity) throw new Error(`${item.name} çok büyük. Paket ${(packet.length/1024).toFixed(1)} KB, bu kare kapasitesi ${(capacity/1024).toFixed(1)} KB. Yoğunluğu artır veya içeriği küçült.`);
        const canvas = drawCodeCanvas(packet, gridSize, layout === 'single' ? 5 : 4, els.includeCodeFrame.checked);
        prepared.push({ item, packet, gridSize, canvas });
      }
      lastCards = prepared;
      renderPaper(prepared, getEffectiveLayout());
      els.printBtn.disabled = false; els.downloadPngBtn.disabled = false; els.downloadSvgBtn.disabled = false;
      setEncodeStatus(`A4 hazır. ${prepared.length} kare yerleştirildi.\n` + prepared.map((c,i)=>`${i+1}. ${c.item.name}: paket ${(c.packet.length/1024).toFixed(2)} KB / grid ${c.gridSize}×${c.gridSize}`).join('\n'));
    }catch(e){ console.error(e); setEncodeStatus('Hata: ' + e.message); }
  }

  async function getItemBytes(item){
    if(item.kind === 'manual') return new TextEncoder().encode(item.text || '');
    return item.bytes || new Uint8Array();
  }

  async function maybeCompress(bytes, mime){
    // Browser CompressionStream is native; no external dependency. Keep fallback uncompressed.
    if(!('CompressionStream' in window)) return {bytes, method:null};
    if(bytes.length < 1024) return {bytes, method:null};
    if(!String(mime||'').startsWith('text/') && mime !== 'application/json' && mime !== 'image/svg+xml') return {bytes, method:null};
    try{
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(bytes); writer.close();
      const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      if(compressed.length + 20 < bytes.length) return {bytes:compressed, method:'gzip'};
    }catch(_){}
    return {bytes, method:null};
  }

  async function maybeDecompress(bytes, method){
    if(method !== 'gzip') return bytes;
    if(!('DecompressionStream' in window)) throw new Error('Bu tarayıcı gzip çözmeyi desteklemiyor.');
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes); writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }

  async function buildPacket(file, password){
    const compressed = await maybeCompress(file.bytes, file.mime);
    let payload = compressed.bytes;
    const header = { v:VERSION, name:file.name, mime:file.mime || mimeFromName(file.name), encrypted:false, compression:compressed.method, created:new Date().toISOString() };
    if(password){
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);
      payload = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, payload));
      Object.assign(header, { encrypted:true, kdf:'PBKDF2-SHA256', iterations:ITERATIONS, cipher:'AES-GCM-256', salt:bytesToBase64(salt), iv:bytesToBase64(iv) });
    }
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const totalLen = 17 + headerBytes.length + payload.length;
    const packet = new Uint8Array(totalLen);
    let o=0; packet.set(MAGIC,o); o+=4; packet[o++]=VERSION;
    writeU32(packet,o,headerBytes.length); o+=4; writeU32(packet,o,payload.length); o+=4;
    writeU32(packet,o,crc32Concat(headerBytes,payload)); o+=4;
    packet.set(headerBytes,o); o+=headerBytes.length; packet.set(payload,o);
    return packet;
  }

  async function deriveKey(password, salt){
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:ITERATIONS, hash:'SHA-256'}, baseKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }

  function drawCodeCanvas(packet, n, scale, includeFrame=true){
    const quiet=8, border=5, total=n+(quiet+border)*2;
    const canvas=document.createElement('canvas'); canvas.width=total*scale; canvas.height=total*scale;
    const ctx=canvas.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#000';
    // Readability frame: helps camera detection. It can be disabled from page settings,
    // but the four corner targets remain because the decoder needs orientation anchors.
    if(includeFrame){
      ctx.fillRect(quiet*scale, quiet*scale, (n+border*2)*scale, border*scale);
      ctx.fillRect(quiet*scale, (quiet+border+n)*scale, (n+border*2)*scale, border*scale);
      ctx.fillRect(quiet*scale, quiet*scale, border*scale, (n+border*2)*scale);
      ctx.fillRect((quiet+border+n)*scale, quiet*scale, border*scale, (n+border*2)*scale);
    }
    // Corner targets are always printed; they are smaller than the full frame but
    // give the phone/camera a stable target without covering data cells.
    const anchor=border*2;
    for(const [ax,ay] of [[quiet,quiet],[quiet+n+border*2-anchor,quiet],[quiet,quiet+n+border*2-anchor],[quiet+n+border*2-anchor,quiet+n+border*2-anchor]]){
      ctx.fillRect(ax*scale, ay*scale, anchor*scale, anchor*scale);
    }
    const ox=quiet+border, oy=quiet+border; const bits=bytesToBits(packet,n*n);
    for(let i=0;i<n*n;i++){
      if(bits[i]){ const x=i%n, y=Math.floor(i/n); ctx.fillRect((ox+x)*scale,(oy+y)*scale,scale,scale); }
    }
    canvas.dataset.gridSize = String(n);
    return canvas;
  }

  function bytesToBits(bytes, bitCount){
    const bits=new Uint8Array(bitCount);
    for(let i=0;i<bitCount;i++){
      const bi=i>>3; let byte=0;
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

  function renderPaper(cards, layout){
    els.paper.innerHTML='';
    const preset = els.pagePreset.value;
    if(els.showPageHeader.checked && preset !== 'minimal'){
      const title=document.createElement('div'); title.className='paper-title clean-title';
      title.innerHTML=`<div><strong>PaperPack</strong><span>${layout==='single'?'tek kare':'çoklu kare'} • ${cards.length} veri</span></div>${els.includeReaderLink.checked ? `<div class="reader-top"><span>Okuyucu</span><strong>${escapeHtml(shortUrl(els.readerLink.value))}</strong></div>` : ''}`;
      els.paper.appendChild(title);
    }
    if(els.includeReaderLink.checked && preset !== 'minimal'){
      const link=document.createElement('div'); link.className='reader-strip';
      link.innerHTML=`<div class="mini-mark">PP</div><div><b>Okumak için:</b> ${escapeHtml(els.readerLink.value || location.href)}<br><span>Siteyi aç, bu sayfadaki veri karesini okut.</span></div>`;
      els.paper.appendChild(link);
    }
    if(els.globalDescription.value.trim() && (preset === 'note' || preset === 'full')){
      const g=document.createElement('div'); g.className='global-desc'; g.textContent=els.globalDescription.value.trim(); els.paper.appendChild(g);
    }
    const holder=document.createElement('div');
    if(layout==='single') holder.className='single-holder';
    else holder.className=`multi-holder count-${els.fitNineGrid.checked ? 9 : cards.length}`;
    const renderCount = els.fitNineGrid.checked && layout !== 'single' ? 9 : cards.length;
    for(let i=0;i<renderCount;i++){
      const c=cards[i]; const card=document.createElement('div'); card.className='code-card';
      if(c){
        if(c.item.showName || c.item.showTech || els.showGlobalTech.checked){
          const meta=document.createElement('div'); meta.className='code-meta';
          const left=c.item.showName ? `${i+1}. ${escapeHtml(c.item.name)}` : `${i+1}.`;
          const right=(c.item.showTech || els.showGlobalTech.checked) ? `${c.gridSize}×${c.gridSize} • ${(c.packet.length/1024).toFixed(2)} KB${c.item.password?' • şifreli':''}` : '';
          meta.innerHTML=`<span>${left}</span><span>${right}</span>`; card.appendChild(meta);
        }
        c.canvas.className='code-canvas'; card.appendChild(c.canvas);
        if((c.item.showDescription || preset === 'note' || preset === 'full') && c.item.description.trim()){
          const d=document.createElement('div'); d.className='card-desc'; d.textContent=c.item.description.trim(); card.appendChild(d);
        }
      }else card.className+=' empty-slot';
      holder.appendChild(card);
    }
    els.paper.appendChild(holder);
  }

  function shortUrl(u){ try{ const x=new URL(u); return x.hostname + x.pathname; }catch{ return u; } }

  async function downloadPaperPng(){
    const canvas = await renderPaperToCanvas(2);
    canvas.toBlob(blob => downloadBlob(blob, 'paperpack-a4.png'), 'image/png');
  }

  async function renderPaperToCanvas(scale){
    const w=794,h=1123; const c=document.createElement('canvas'); c.width=w*scale; c.height=h*scale;
    const ctx=c.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.scale(scale,scale);
    const paperRect=els.paper.getBoundingClientRect();
    ctx.fillStyle='#111'; ctx.font='16px Arial';
    const elems=Array.from(els.paper.querySelectorAll('.paper-title,.reader-strip,.global-desc,.code-card'));
    for(const el of elems){
      const r=el.getBoundingClientRect(); const x=r.left-paperRect.left, y=r.top-paperRect.top;
      if(el.classList.contains('code-card')){ ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.strokeRect(x,y,r.width,r.height); }
      const can=el.querySelector('canvas');
      if(can){ const cr=can.getBoundingClientRect(); ctx.drawImage(can, cr.left-paperRect.left, cr.top-paperRect.top, cr.width, cr.height); }
      if(!can){ ctx.fillStyle='#111'; ctx.font='12px Arial'; wrapText(ctx, el.innerText, x+4, y+14, Math.max(120,r.width-8), 14); }
      const desc=el.querySelector('.card-desc'); if(desc){ const dr=desc.getBoundingClientRect(); ctx.fillStyle='#333'; ctx.font='9px Arial'; wrapText(ctx, desc.innerText, dr.left-paperRect.left+2, dr.top-paperRect.top+10, dr.width-4, 10); }
      const meta=el.querySelector('.code-meta'); if(meta){ const mr=meta.getBoundingClientRect(); ctx.fillStyle='#111'; ctx.font='8px Arial'; ctx.fillText(meta.innerText.slice(0,120), mr.left-paperRect.left+2, mr.top-paperRect.top+8); }
    }
    return c;
  }
  function wrapText(ctx,text,x,y,maxWidth,lineHeight){
    const words=String(text).split(/\s+/); let line='';
    for(const word of words){ const test=line?line+' '+word:word; if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,y); line=word; y+=lineHeight; } else line=test; }
    if(line) ctx.fillText(line,x,y);
  }

  function downloadPaperSvg(){
    const width=794,height=1123; const paperRect=els.paper.getBoundingClientRect(); let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>`;
    for(const card of els.paper.querySelectorAll('.code-card')){
      const r=card.getBoundingClientRect(); const x=r.left-paperRect.left, y=r.top-paperRect.top; svg+=`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${r.width.toFixed(2)}" height="${r.height.toFixed(2)}" fill="white" stroke="#111" stroke-width="1"/>`;
      const can=card.querySelector('canvas'); if(can){ const cr=can.getBoundingClientRect(); svg += canvasToSvgRects(can, cr.left-paperRect.left, cr.top-paperRect.top, cr.width, cr.height); }
    }
    svg+='</svg>'; downloadBlob(new Blob([svg],{type:'image/svg+xml'}),'paperpack-a4.svg');
  }
  function canvasToSvgRects(canvas,x,y,w,h){
    const n=parseInt(canvas.dataset.gridSize||'0',10); if(!n) return '';
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let s=`<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" href="${canvas.toDataURL('image/png')}"/>`;
    // Use embedded image for SVG speed; readable and self-contained. Actual code canvas remains high-res.
    return s;
  }
  function downloadBlob(blob,name){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); }

  async function loadDecodePreview(){
    selection=null; const file=els.decodeImage.files&&els.decodeImage.files[0]; if(!file) return;
    const img=await loadImageFromFile(file); previewImageCanvas=imageToCanvas(img); autoSelection(); redrawPreview();
  }
  function autoSelection(){
    if(!previewImageCanvas) return; const box=findCodeBoundingBox(previewImageCanvas); if(box) selection={x:box.x0,y:box.y0,w:box.w,h:box.h};
  }
  function redrawPreview(){
    if(!previewImageCanvas){ const ctx=els.imagePreview.getContext('2d'); ctx.clearRect(0,0,els.imagePreview.width,els.imagePreview.height); return; }
    const maxW=els.imagePreview.parentElement.clientWidth||800; const sc=Math.min(1,maxW/previewImageCanvas.width);
    els.imagePreview.width=Math.round(previewImageCanvas.width*sc); els.imagePreview.height=Math.round(previewImageCanvas.height*sc);
    const ctx=els.imagePreview.getContext('2d'); ctx.drawImage(previewImageCanvas,0,0,els.imagePreview.width,els.imagePreview.height);
    if(selection){ ctx.strokeStyle='#18a058'; ctx.lineWidth=3; ctx.strokeRect(selection.x*sc,selection.y*sc,selection.w*sc,selection.h*sc); els.selectionInfo.textContent='Yeşil çerçeve doğru veri karesini kapsıyorsa Oku butonuna bas.'; }
  }
  function posFromEvent(e){ const r=els.imagePreview.getBoundingClientRect(); const scX=previewImageCanvas.width/r.width, scY=previewImageCanvas.height/r.height; return {x:(e.clientX-r.left)*scX, y:(e.clientY-r.top)*scY}; }
  function startSelection(e){ if(!previewImageCanvas) return; dragStart=posFromEvent(e); selection={x:dragStart.x,y:dragStart.y,w:1,h:1}; els.imagePreview.setPointerCapture(e.pointerId); }
  function moveSelection(e){ if(!dragStart||!previewImageCanvas) return; const p=posFromEvent(e); selection={x:Math.min(dragStart.x,p.x),y:Math.min(dragStart.y,p.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)}; redrawPreview(); }
  function endSelection(){ dragStart=null; redrawPreview(); }

  async function decodeImageInput(){
    try{
      els.decodeResults.innerHTML=''; const file=els.decodeImage.files&&els.decodeImage.files[0]; if(!file) throw new Error('Önce görsel yükle veya fotoğraf çek.');
      setDecodeStatus('Okunuyor...'); const img=await loadImageFromFile(file); const full=imageToCanvas(img);
      const packets = decodePacketsFromCanvas(full, true);
      if(!packets.length) throw new Error('PaperPack verisi bulunamadı. Fotoğrafı daha yakın, net ve kare görünür şekilde çek. Otomatik olmazsa veri karesinin 4 köşesi görünür olsun.');
      setDecodeStatus(`${packets.length} paket bulundu.`); packets.forEach(addResultCard);
    }catch(e){ console.error(e); setDecodeStatus('Hata: '+e.message); }
  }

  function decodePacketsFromCanvas(full, includeSelection){
    let candidates=[];
    if(els.decodeArea.value !== 'selected') candidates.push(full);
    if(includeSelection && selection && els.decodeArea.value !== 'full') candidates.push(cropCanvas(full,selection.x,selection.y,selection.w,selection.h));
    const packets=[]; let tries=0;
    for(const c of candidates){
      const mode=els.decodeMode.value;
      const list = mode==='multi' ? splitMultiCandidates(c) : mode==='single' ? [c] : [c,...splitMultiCandidates(c)];
      for(const part of list){ tries++; const found=decodeAllFromCanvas(part); for(const p of found){ if(!packets.some(x=>x.header.name===p.header.name && x.payload.length===p.payload.length)) packets.push(p); } }
    }
    packets._tries = tries;
    return packets;
  }
  async function startCameraScan(){
    try{
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Bu tarayıcı kamera erişimini desteklemiyor.');
      scanStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}, audio:false});
      els.scanVideo.srcObject = scanStream;
      await els.scanVideo.play();
      els.cameraStage.classList.remove('hidden');
      els.captureScanBtn.disabled=false; els.autoScanBtn.disabled=false; els.stopCameraBtn.disabled=false; els.startCameraBtn.disabled=true;
      els.scanHint.textContent='Kareyi kılavuz çerçevenin içine getir. Netleşince Şimdi tara veya Otomatik tara kullan.';
    }catch(e){ setDecodeStatus('Kamera açılamadı: '+e.message); }
  }
  function stopCameraScan(){
    if(autoScanTimer){ clearInterval(autoScanTimer); autoScanTimer=null; }
    if(scanStream){ for(const t of scanStream.getTracks()) t.stop(); scanStream=null; }
    els.scanVideo.srcObject=null; els.cameraStage.classList.add('hidden');
    els.captureScanBtn.disabled=true; els.autoScanBtn.disabled=true; els.stopCameraBtn.disabled=true; els.startCameraBtn.disabled=false; els.autoScanBtn.textContent='Otomatik tara';
  }
  async function captureAndDecodeFromCamera(){
    try{
      const canvas=cameraFrameToCanvas();
      if(!canvas) throw new Error('Kamera görüntüsü alınamadı.');
      setDecodeStatus('Kamera görüntüsü okunuyor...');
      els.decodeResults.innerHTML='';
      const packets=decodePacketsFromCanvas(canvas,false);
      if(!packets.length) throw new Error('Veri bulunamadı. Kareyi daha yakın, düz ve net tut. Işık/gölgeyi kontrol et.');
      setDecodeStatus(`${packets.length} paket bulundu.`); packets.forEach(addResultCard);
      if(autoScanTimer) toggleAutoScan();
    }catch(e){ setDecodeStatus('Hata: '+e.message); }
  }
  function toggleAutoScan(){
    if(autoScanTimer){ clearInterval(autoScanTimer); autoScanTimer=null; els.autoScanBtn.textContent='Otomatik tara'; return; }
    els.autoScanBtn.textContent='Taramayı durdur';
    autoScanTimer=setInterval(async()=>{
      if(autoScanBusy) return; autoScanBusy=true;
      try{
        const canvas=cameraFrameToCanvas();
        if(canvas){
          const packets=decodePacketsFromCanvas(canvas,false);
          if(packets.length){
            els.decodeResults.innerHTML=''; setDecodeStatus(`${packets.length} paket bulundu.`); packets.forEach(addResultCard); toggleAutoScan();
          }else setDecodeStatus('Canlı tarama sürüyor... Kareyi ortala, net ve büyük tut.');
        }
      }catch(_){ }
      finally{ autoScanBusy=false; }
    }, 1200);
  }
  function cameraFrameToCanvas(){
    const v=els.scanVideo; if(!v || !v.videoWidth) return null;
    const max=1800; const sc=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight));
    const c=document.createElement('canvas'); c.width=Math.round(v.videoWidth*sc); c.height=Math.round(v.videoHeight*sc);
    const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(v,0,0,c.width,c.height); return c;
  }

  function splitMultiCandidates(canvas){
    const out=[]; const sizes=[2,3];
    for(const s of sizes){ for(let y=0;y<s;y++) for(let x=0;x<s;x++) out.push(cropCanvas(canvas,x*canvas.width/s,y*canvas.height/s,canvas.width/s,canvas.height/s)); }
    return out;
  }
  async function loadImageFromFile(file){ const url=URL.createObjectURL(file); try{ const img=new Image(); img.decoding='async'; await new Promise((res,rej)=>{img.onload=res; img.onerror=()=>rej(new Error('Görsel yüklenemedi.')); img.src=url;}); return img; } finally{ setTimeout(()=>URL.revokeObjectURL(url),1000); } }
  function imageToCanvas(img){ const max=2400; const sw=img.naturalWidth||img.width, sh=img.naturalHeight||img.height; const sc=Math.min(1,max/Math.max(sw,sh)); const c=document.createElement('canvas'); c.width=Math.round(sw*sc); c.height=Math.round(sh*sc); const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); return c; }
  function cropCanvas(src,x,y,w,h){ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(src,x,y,w,h,0,0,c.width,c.height); return c; }

  function decodeAllFromCanvas(canvas){
    const out=[];
    const candidates=[];
    const quad=findCodeQuad(canvas);
    if(quad){
      try{ candidates.push({canvas:warpQuadToCanvas(canvas, quad.points, 1536), warped:true}); }catch(_){ }
    }
    candidates.push({canvas, warped:false});
    for(const cand of candidates){
      const boxes=findAllCodeBoxes(cand.canvas).slice(0,14);
      for(const bbox of boxes){
        for(const n of TRY_GRIDS){
          const variants=sampleGridVariants(cand.canvas,bbox,n);
          for(const bits of variants){
            try{ const p=parsePacket(bitsToBytes(bits)); if(p && !out.some(x=>x.header.name===p.header.name && x.payload.length===p.payload.length)) out.push(p); }
            catch(_){}
          }
        }
      }
      if(out.length) break;
    }
    return out;
  }
  function decodeFromCanvas(canvas){ const all=decodeAllFromCanvas(canvas); return all[0] || null; }
  function findCodeQuad(canvas){
    const box=findCodeBoundingBox(canvas); if(!box) return null;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const pts=[]; const step=Math.max(1,Math.floor(Math.min(box.w,box.h)/500));
    for(let y=box.y0;y<=box.y1;y+=step){ for(let x=box.x0;x<=box.x1;x+=step){ const i=(y*canvas.width+x)*4; if(img[i]+img[i+1]+img[i+2]<430) pts.push({x,y}); } }
    if(pts.length<40) return null;
    let tl=pts[0],tr=pts[0],br=pts[0],bl=pts[0];
    for(const p of pts){
      if(p.x+p.y < tl.x+tl.y) tl=p;
      if(p.x-p.y > tr.x-tr.y) tr=p;
      if(p.x+p.y > br.x+br.y) br=p;
      if(p.y-p.x > bl.y-bl.x) bl=p;
    }
    const area=Math.abs((tr.x-tl.x)*(bl.y-tl.y)-(tr.y-tl.y)*(bl.x-tl.x));
    if(area < 1000) return null;
    return {points:[tl,tr,br,bl], box};
  }
  function warpQuadToCanvas(src, pts, size){
    const dst=[{x:0,y:0},{x:size-1,y:0},{x:size-1,y:size-1},{x:0,y:size-1}];
    const H=homographyFromSquareToQuad(dst, pts);
    const out=document.createElement('canvas'); out.width=size; out.height=size;
    const sctx=src.getContext('2d',{willReadFrequently:true}); const simg=sctx.getImageData(0,0,src.width,src.height).data;
    const octx=out.getContext('2d',{willReadFrequently:true,alpha:false}); const oimg=octx.createImageData(size,size); const data=oimg.data;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const d=H[6]*x+H[7]*y+1; const sx=(H[0]*x+H[1]*y+H[2])/d; const sy=(H[3]*x+H[4]*y+H[5])/d;
      const col=sampleBilinear(simg,src.width,src.height,sx,sy); const idx=(y*size+x)*4; data[idx]=col[0]; data[idx+1]=col[1]; data[idx+2]=col[2]; data[idx+3]=255;
    }
    octx.putImageData(oimg,0,0); return out;
  }
  function homographyFromSquareToQuad(srcPts,dstPts){
    const A=[], b=[];
    for(let i=0;i<4;i++){
      const x=srcPts[i].x,y=srcPts[i].y,u=dstPts[i].x,v=dstPts[i].y;
      A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v);
    }
    return solve8(A,b).concat([1]);
  }
  function solve8(A,b){
    const n=8; const M=A.map((r,i)=>r.concat([b[i]]));
    for(let c=0;c<n;c++){
      let piv=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r;
      if(Math.abs(M[piv][c])<1e-9) throw new Error('Perspektif çözülemedi.');
      [M[c],M[piv]]=[M[piv],M[c]]; const div=M[c][c]; for(let k=c;k<=n;k++) M[c][k]/=div;
      for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; }
    }
    return M.map(r=>r[n]);
  }
  function sampleBilinear(img,w,h,x,y){
    x=Math.max(0,Math.min(w-1,x)); y=Math.max(0,Math.min(h-1,y));
    const x0=Math.floor(x), y0=Math.floor(y), x1=Math.min(w-1,x0+1), y1=Math.min(h-1,y0+1); const dx=x-x0,dy=y-y0;
    const i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4; const out=[0,0,0];
    for(let c=0;c<3;c++) out[c]=Math.round(img[i00+c]*(1-dx)*(1-dy)+img[i10+c]*dx*(1-dy)+img[i01+c]*(1-dx)*dy+img[i11+c]*dx*dy);
    return out;
  }

  function findAllCodeBoxes(canvas){
    const main=findCodeBoundingBox(canvas); const arr=[]; if(main) arr.push(main);
    arr.push({x0:0,y0:0,x1:canvas.width-1,y1:canvas.height-1,w:canvas.width,h:canvas.height});
    return arr;
  }
  function findCodeBoundingBox(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const {width:w,height:h}=canvas; const img=ctx.getImageData(0,0,w,h).data; const row=new Uint32Array(h), col=new Uint32Array(w);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=(y*w+x)*4; if(img[i]+img[i+1]+img[i+2]<430){ row[y]++; col[x]++; } }
    const yInt=largestDenseInterval(row,w,0.08), xInt=largestDenseInterval(col,h,0.08); if(!xInt||!yInt) return null;
    const x0=xInt[0],x1=xInt[1],y0=yInt[0],y1=yInt[1],bw=x1-x0+1,bh=y1-y0+1; if(bw<80||bh<80) return null; return {x0,y0,x1,y1,w:bw,h:bh};
  }
  function largestDenseInterval(counts,denom,density){
    const min=Math.max(5,Math.floor(denom*density)); let best=null,start=-1;
    for(let i=0;i<counts.length;i++){ const ok=counts[i]>=min; if(ok&&start<0)start=i; if((!ok||i===counts.length-1)&&start>=0){ const end=ok&&i===counts.length-1?i:i-1; if(!best||end-start>best[1]-best[0]) best=[start,end]; start=-1; } }
    return best;
  }
  function sampleGridVariants(canvas,bbox,n){
    // The detected bbox may be: exact data area, black frame area, full generated canvas,
    // or a hand-selected region. Try all valid geometry assumptions before giving up.
    const variants=[];
    const geom=[
      {total:n, pad:0, name:'data-only'},
      {total:n+10, pad:5, name:'frame-box'},
      {total:n+26, pad:13, name:'full-code'},
      {total:n+20, pad:10, name:'corner-targets'}
    ];
    for(const g of geom){
      if(bbox.w < g.total || bbox.h < g.total) continue;
      variants.push(sampleGrid(canvas,bbox,n,g.pad,g.total));
    }
    // If the region is not square, try a centered square crop too. This helps when the
    // user selects slightly too much whitespace on one side.
    const side=Math.min(bbox.w,bbox.h);
    if(side>80 && Math.abs(bbox.w-bbox.h)>side*0.05){
      const sq={x0:Math.round(bbox.x0+(bbox.w-side)/2), y0:Math.round(bbox.y0+(bbox.h-side)/2), x1:0,y1:0,w:side,h:side};
      sq.x1=sq.x0+side-1; sq.y1=sq.y0+side-1;
      for(const g of geom) variants.push(sampleGrid(canvas,sq,n,g.pad,g.total));
    }
    return variants;
  }
  function sampleGrid(canvas,bbox,n,pad,total){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const img=ctx.getImageData(0,0,canvas.width,canvas.height).data; const bits=new Uint8Array(n*n);
    const cellW=bbox.w/total, cellH=bbox.h/total; const ox=bbox.x0+cellW*pad, oy=bbox.y0+cellH*pad;
    // Estimate local threshold from the central data area, then clamp it.
    let minV=765,maxV=0;
    const probe=Math.max(4,Math.floor(n/16));
    for(let py=0;py<probe;py++) for(let px=0;px<probe;px++){
      const x=Math.max(0,Math.min(canvas.width-1,Math.round(ox+(px+.5)*(n/probe)*cellW)));
      const y=Math.max(0,Math.min(canvas.height-1,Math.round(oy+(py+.5)*(n/probe)*cellH)));
      const i=(y*canvas.width+x)*4; const v=img[i]+img[i+1]+img[i+2]; if(v<minV)minV=v; if(v>maxV)maxV=v;
    }
    const threshold=Math.max(300,Math.min(560,(minV+maxV)/2));
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const cx=Math.max(0,Math.min(canvas.width-1,Math.round(ox+(x+.5)*cellW))); const cy=Math.max(0,Math.min(canvas.height-1,Math.round(oy+(y+.5)*cellH)));
      let sum=0,count=0; const rad=Math.max(1,Math.floor(Math.min(cellW,cellH)*0.20));
      for(let yy=-rad;yy<=rad;yy++) for(let xx=-rad;xx<=rad;xx++){ const sx=Math.max(0,Math.min(canvas.width-1,cx+xx)); const sy=Math.max(0,Math.min(canvas.height-1,cy+yy)); const i=(sy*canvas.width+sx)*4; sum+=img[i]+img[i+1]+img[i+2]; count++; }
      bits[y*n+x]=(sum/count)<threshold?1:0;
    }
    return bits;
  }
  function parsePacket(bytes){
    if(bytes[0]!==MAGIC[0]||bytes[1]!==MAGIC[1]||bytes[2]!==MAGIC[2]||bytes[3]!==MAGIC[3]) return null;
    if(bytes[4]!==VERSION) throw new Error('Desteklenmeyen PaperPack sürümü.');
    const headerLen=readU32(bytes,5), payloadLen=readU32(bytes,9), crcStored=readU32(bytes,13), start=17;
    if(headerLen<=0||headerLen>4000||payloadLen<0||start+headerLen+payloadLen>bytes.length) return null;
    const headerBytes=bytes.slice(start,start+headerLen), payload=bytes.slice(start+headerLen,start+headerLen+payloadLen);
    if(crc32Concat(headerBytes,payload)!==crcStored) throw new Error('Checksum uyuşmadı. Görsel net değil veya kare yanlış okundu.');
    return {header:JSON.parse(new TextDecoder().decode(headerBytes)), payload};
  }

  function addResultCard(packet){
    const node=els.resultTemplate.content.firstElementChild.cloneNode(true); const h=node.querySelector('h3'), meta=node.querySelector('.meta'), dz=node.querySelector('.decrypt-zone'), oz=node.querySelector('.open-zone'), err=node.querySelector('.error');
    h.textContent=packet.header.name||'paperpack.html'; meta.textContent=`${packet.header.mime||'application/octet-stream'} • ${packet.header.encrypted?'şifreli':'şifresiz'} • ${packet.header.compression?'gzip':''} • ${(packet.payload.length/1024).toFixed(2)} KB`;
    if(packet.header.encrypted){ dz.classList.remove('hidden'); node.querySelector('.decrypt-open-btn').addEventListener('click',async()=>{ const win=window.open('about:blank','_blank'); try{ const pass=node.querySelector('.result-password').value; if(!pass) throw new Error('Şifre girilmedi.'); let clear=await decryptPayload(packet,pass); clear=await maybeDecompress(clear,packet.header.compression); const url=createBlobUrl(clear,packet.header); if(win) win.location.href=url; addOpenHandler(node,clear,packet.header); addDownloadHandler(node,clear,packet.header); oz.classList.remove('hidden'); dz.classList.add('hidden'); }catch(e){ if(win)win.close(); err.textContent='Açılamadı: '+e.message; err.classList.remove('hidden'); } }); }
    else { oz.classList.remove('hidden'); (async()=>{ const clear=await maybeDecompress(packet.payload,packet.header.compression); addOpenHandler(node,clear,packet.header); addDownloadHandler(node,clear,packet.header); })().catch(e=>{err.textContent=e.message;err.classList.remove('hidden');}); }
    els.decodeResults.appendChild(node);
  }
  async function decryptPayload(packet,password){ const salt=base64ToBytes(packet.header.salt), iv=base64ToBytes(packet.header.iv), key=await deriveKey(password,salt); return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,packet.payload)); }
  function addOpenHandler(node,bytes,header){ node.querySelector('.open-btn').onclick=()=>{ const url=createBlobUrl(bytes,header); window.open(url,'_blank'); }; }
  function addDownloadHandler(node,bytes,header){ node.querySelector('.download-btn').onclick=()=>{ const url=createBlobUrl(bytes,header); const a=document.createElement('a'); a.href=url; a.download=header.name||'paperpack.bin'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); }; }
  function createBlobUrl(bytes,header){ return URL.createObjectURL(new Blob([bytes],{type:header.mime||'application/octet-stream'})); }

  function sanitizeName(name){ return (name||'paperpack.html').replace(/[\\/\0]/g,'_').slice(0,120); }
  function mimeFromName(name){ const n=(name||'').toLowerCase(); if(n.endsWith('.html')||n.endsWith('.htm')) return 'text/html'; if(n.endsWith('.css')) return 'text/css'; if(n.endsWith('.js')) return 'text/javascript'; if(n.endsWith('.json')) return 'application/json'; if(n.endsWith('.svg')) return 'image/svg+xml'; return 'text/plain'; }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function writeU32(a,o,v){ a[o]=(v>>>24)&255; a[o+1]=(v>>>16)&255; a[o+2]=(v>>>8)&255; a[o+3]=v&255; }
  function readU32(a,o){ return ((a[o]<<24)|(a[o+1]<<16)|(a[o+2]<<8)|a[o+3])>>>0; }
  const CRC_TABLE=(()=>{ const t=new Uint32Array(256); for(let i=0;i<256;i++){ let c=i; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[i]=c>>>0; } return t; })();
  function crc32Concat(a,b){ let crc=0xffffffff; for(const arr of [a,b]) for(let i=0;i<arr.length;i++) crc=CRC_TABLE[(crc^arr[i])&255]^(crc>>>8); return (crc^0xffffffff)>>>0; }
  function bytesToBase64(bytes){ let s=''; for(let i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]); return btoa(s); }
  function base64ToBytes(b64){ const s=atob(b64), out=new Uint8Array(s.length); for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i); return out; }
  function setEncodeStatus(s){ els.encodeStatus.textContent=s; }
  function setDecodeStatus(s){ els.decodeStatus.textContent=s; }
})();
