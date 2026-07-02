(() => {
  'use strict';

  const MAGIC = [0x50,0x50,0x4b,0x31]; // PPK1
  const VERSION = 1;
  const ITERATIONS = 220000;
  const DENSITIES = {
    single: {
      safe: 180,
      standard: 256,
      dense: 320,
      max: 384
    },
    nine: {
      safe: 72,
      standard: 96,
      dense: 112,
      max: 128
    }
  };
  const TRY_GRIDS = [384, 320, 256, 180, 128, 112, 96, 72];
  const CODE_QUIET_CELLS = 8;
  const CODE_BORDER_CELLS = 4;
  const CODE_DATA_OFFSET_CELLS = CODE_QUIET_CELLS + CODE_BORDER_CELLS;
  const CODE_TOTAL_EXTRA_CELLS = CODE_DATA_OFFSET_CELLS * 2;
  const els = {
    encodeMode: document.getElementById('encodeMode'),
    density: document.getElementById('density'),
    singleInputs: document.getElementById('singleInputs'),
    nineInputs: document.getElementById('nineInputs'),
    fileInput: document.getElementById('fileInput'),
    multiFileInput: document.getElementById('multiFileInput'),
    textInput: document.getElementById('textInput'),
    manualName: document.getElementById('manualName'),
    password: document.getElementById('password'),
    hideNames: document.getElementById('hideNames'),
    encodeBtn: document.getElementById('encodeBtn'),
    printBtn: document.getElementById('printBtn'),
    downloadPngBtn: document.getElementById('downloadPngBtn'),
    downloadSvgBtn: document.getElementById('downloadSvgBtn'),
    capacityInfo: document.getElementById('capacityInfo'),
    encodeStatus: document.getElementById('encodeStatus'),
    paper: document.getElementById('paper'),
    decodeMode: document.getElementById('decodeMode'),
    decodeArea: document.getElementById('decodeArea'),
    decodeImage: document.getElementById('decodeImage'),
    decodeBtn: document.getElementById('decodeBtn'),
    clearDecodeBtn: document.getElementById('clearDecodeBtn'),
    decodeStatus: document.getElementById('decodeStatus'),
    decodeResults: document.getElementById('decodeResults'),
    imagePreview: document.getElementById('imagePreview'),
    resetSelectionBtn: document.getElementById('resetSelectionBtn'),
    selectionInfo: document.getElementById('selectionInfo'),
    resultTemplate: document.getElementById('resultTemplate')
  };
  let lastPaperBlobUrl = null;
  let lastCards = [];
  let lastMode = 'single';
  let decodeSourceCanvas = null;
  let previewScale = 1;
  let selection = null;
  let dragStart = null;

  els.encodeMode.addEventListener('change', () => {
    const nine = els.encodeMode.value === 'nine';
    els.singleInputs.classList.toggle('hidden', nine);
    els.nineInputs.classList.toggle('hidden', !nine);
  });
  els.encodeBtn.addEventListener('click', encodeCurrent);
  els.printBtn.addEventListener('click', () => window.print());
  els.downloadPngBtn.addEventListener('click', downloadPaperPng);
  els.downloadSvgBtn.addEventListener('click', downloadPaperSvg);
  els.encodeMode.addEventListener('change', updateCapacityInfo);
  els.density.addEventListener('change', updateCapacityInfo);
  updateCapacityInfo();
  els.decodeBtn.addEventListener('click', decodeImageInput);
  els.decodeImage.addEventListener('change', prepareDecodePreview);
  els.resetSelectionBtn.addEventListener('click', () => { selection = null; drawDecodePreview(); });
  initPreviewSelection();
  els.clearDecodeBtn.addEventListener('click', () => {
    els.decodeResults.innerHTML = '';
    els.decodeStatus.textContent = '';
  });

  async function encodeCurrent(){
    try{
      setEncodeStatus('Hazırlanıyor...');
      const mode = els.encodeMode.value;
      const files = mode === 'nine' ? await getNineFiles() : [await getSingleFile()];
      if(!files.length) throw new Error('Dosya veya metin girilmedi.');
      const password = els.password.value || '';
      const gridSize = DENSITIES[mode][els.density.value];
      const cards = [];
      for(const file of files.slice(0, mode === 'nine' ? 9 : 1)){
        const packet = await buildPacket(file, password);
        const capacity = Math.floor((gridSize * gridSize) / 8);
        if(packet.length > capacity){
          const kb = (packet.length/1024).toFixed(1);
          const cap = (capacity/1024).toFixed(1);
          throw new Error(`${file.name} çok büyük. Paket ${kb} KB, seçili kutu kapasitesi ${cap} KB. Daha düşük içerik veya daha yüksek yoğunluk dene.`);
        }
        const canvas = drawCodeCanvas(packet, gridSize, mode === 'nine' ? 4 : 5);
        cards.push({file, packet, canvas, gridSize});
      }
      renderPaper(cards, mode, Boolean(password));
      els.printBtn.disabled = false;
      els.downloadPngBtn.disabled = false;
      els.downloadSvgBtn.disabled = false;
      lastCards = cards;
      lastMode = mode;
      const summary = cards.map((c,i) => `${i+1}. ${c.file.name}: ${(c.packet.length/1024).toFixed(2)} KB / ${(Math.floor(c.gridSize*c.gridSize/8)/1024).toFixed(2)} KB`).join('\n');
      setEncodeStatus(`A4 hazır.\n${summary}\nNot: Baskı sonrası ilk test için çıktı görselini veya net A4 fotoğrafını okut.`);
    }catch(err){
      console.error(err);
      setEncodeStatus('Hata: ' + err.message);
    }
  }

  async function getSingleFile(){
    const file = els.fileInput.files && els.fileInput.files[0];
    if(file){
      return {
        name: sanitizeName(els.manualName.value.trim() || file.name || 'paperpack.html'),
        mime: file.type || mimeFromName(file.name),
        bytes: new Uint8Array(await file.arrayBuffer())
      };
    }
    const text = els.textInput.value;
    if(!text.trim()) throw new Error('Dosya seç veya metin/HTML yapıştır.');
    const name = sanitizeName(els.manualName.value.trim() || 'paperpack.html');
    return { name, mime: mimeFromName(name), bytes: new TextEncoder().encode(text) };
  }

  async function getNineFiles(){
    const list = Array.from(els.multiFileInput.files || []).slice(0,9);
    if(!list.length) throw new Error('9 modunda en az 1 dosya seçmelisin.');
    const out = [];
    for(const f of list){
      out.push({ name: sanitizeName(f.name), mime: f.type || mimeFromName(f.name), bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    return out;
  }

  function sanitizeName(name){
    return (name || 'paperpack.html').replace(/[\\/\0]/g,'_').slice(0,120);
  }

  function mimeFromName(name){
    const n = (name || '').toLowerCase();
    if(n.endsWith('.html') || n.endsWith('.htm')) return 'text/html';
    if(n.endsWith('.css')) return 'text/css';
    if(n.endsWith('.js')) return 'text/javascript';
    if(n.endsWith('.json')) return 'application/json';
    if(n.endsWith('.svg')) return 'image/svg+xml';
    return 'text/plain';
  }

  async function buildPacket(file, password){
    let payload = file.bytes;
    const header = {
      v: VERSION,
      name: file.name,
      mime: file.mime,
      encrypted: false,
      compressed: false,
      created: new Date().toISOString()
    };

    const compressed = await maybeCompress(payload);
    if(compressed && compressed.length + 20 < payload.length){
      payload = compressed;
      header.compressed = true;
      header.compression = 'gzip';
      header.originalSize = file.bytes.length;
    }

    if(password){
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);
      const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, payload);
      payload = new Uint8Array(encrypted);
      header.encrypted = true;
      header.kdf = 'PBKDF2-SHA256';
      header.iterations = ITERATIONS;
      header.cipher = 'AES-GCM-256';
      header.salt = bytesToBase64(salt);
      header.iv = bytesToBase64(iv);
    }
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const totalLen = 4+1+4+4+4+headerBytes.length+payload.length;
    const packet = new Uint8Array(totalLen);
    let o = 0;
    packet.set(MAGIC, o); o += 4;
    packet[o++] = VERSION;
    writeU32(packet, o, headerBytes.length); o += 4;
    writeU32(packet, o, payload.length); o += 4;
    const crc = crc32Concat(headerBytes, payload);
    writeU32(packet, o, crc); o += 4;
    packet.set(headerBytes, o); o += headerBytes.length;
    packet.set(payload, o);
    return packet;
  }

  async function maybeCompress(bytes){
    if(!('CompressionStream' in window)) return null;
    try{
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    }catch(e){
      return null;
    }
  }

  async function maybeDecompress(bytes, header){
    if(!header.compressed) return bytes;
    if(header.compression !== 'gzip') throw new Error('Desteklenmeyen sıkıştırma türü.');
    if(!('DecompressionStream' in window)) throw new Error('Bu tarayıcı gzip çözmeyi desteklemiyor. Farklı tarayıcı dene.');
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function deriveKey(password, salt){
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2', salt, iterations: ITERATIONS, hash:'SHA-256'},
      baseKey,
      {name:'AES-GCM', length:256},
      false,
      ['encrypt','decrypt']
    );
  }

  function drawCodeCanvas(packet, n, scale){
    const quiet = CODE_QUIET_CELLS;
    const border = CODE_BORDER_CELLS;
    const total = n + CODE_TOTAL_EXTRA_CELLS;
    const canvas = document.createElement('canvas');
    canvas.width = total * scale;
    canvas.height = total * scale;
    const ctx = canvas.getContext('2d', {alpha:false});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const drawCell = (x,y,black) => {
      ctx.fillStyle = black ? '#000' : '#fff';
      ctx.fillRect(x*scale,y*scale,scale,scale);
    };
    const ox = quiet + border;
    const oy = quiet + border;
    // Outer black border and inner white quiet frame.
    ctx.fillStyle = '#000';
    ctx.fillRect(quiet*scale, quiet*scale, (n+border*2)*scale, border*scale);
    ctx.fillRect(quiet*scale, (quiet+border+n)*scale, (n+border*2)*scale, border*scale);
    ctx.fillRect(quiet*scale, quiet*scale, border*scale, (n+border*2)*scale);
    ctx.fillRect((quiet+border+n)*scale, quiet*scale, border*scale, (n+border*2)*scale);
    // Corner finder blocks inside data area; these are deliberately outside packet capacity because they occupy cells too.
    // To keep packet decode simple, finder cells are only in margin/border, data grid remains pure data.
    const bits = bytesToBits(packet, n*n);
    for(let i=0;i<n*n;i++){
      const x = i % n;
      const y = Math.floor(i / n);
      drawCell(ox+x, oy+y, bits[i]);
    }
    return canvas;
  }

  function bytesToBits(bytes, bitCount){
    const bits = new Uint8Array(bitCount);
    for(let i=0;i<bitCount;i++){
      const bi = i >> 3;
      let byte;
      if(bi < bytes.length){
        byte = bytes[bi];
      }else{
        // Filler keeps the whole grid visually dense so the reader can find the full data area.
        // It is outside the packet length and ignored during parsing.
        let x = (bi * 1103515245 + 12345) >>> 0;
        byte = (x >>> 16) & 255;
      }
      bits[i] = (byte >> (7 - (i & 7))) & 1;
    }
    return bits;
  }

  function bitsToBytes(bits){
    const len = Math.floor(bits.length / 8);
    const bytes = new Uint8Array(len);
    for(let i=0;i<len*8;i++){
      if(bits[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
    }
    return bytes;
  }

  function renderPaper(cards, mode, encrypted){
    els.paper.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'paper-title';
    title.innerHTML = `<div><strong>PaperPack v1</strong><span>${mode === 'nine' ? '9 dosya modu' : 'tek dosya modu'} • ${encrypted ? 'şifreli' : 'şifresiz'}</span></div><div>${new Date().toLocaleString('tr-TR')}</div>`;
    els.paper.appendChild(title);
    if(mode === 'nine'){
      const grid = document.createElement('div');
      grid.className = 'nine-grid';
      for(let i=0;i<9;i++){
        const item = cards[i];
        const card = document.createElement('div');
        card.className = 'code-card';
        if(item){
          card.appendChild(metaLine(item.file.name, i+1, item.packet.length, item.gridSize));
          card.appendChild(item.canvas);
          item.canvas.className = 'code-canvas';
        }else{
          card.innerHTML = '<div class="code-meta"><span>Boş</span><span></span></div>';
        }
        grid.appendChild(card);
      }
      els.paper.appendChild(grid);
    }else{
      const card = document.createElement('div');
      card.className = 'code-card single-card';
      card.appendChild(metaLine(cards[0].file.name, 1, cards[0].packet.length, cards[0].gridSize));
      cards[0].canvas.className = 'code-canvas';
      card.appendChild(cards[0].canvas);
      els.paper.appendChild(card);
    }
  }

  function metaLine(name, index, bytes, grid){
    const div = document.createElement('div');
    div.className = 'code-meta';
    const visibleName = els.hideNames.checked ? 'gizli' : escapeHtml(name);
    div.innerHTML = `<span>${index}. ${visibleName}</span><span>${grid}×${grid} • ${(bytes/1024).toFixed(2)} KB</span>`;
    return div;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function downloadPaperPng(){
    const exportCanvas = renderPaperToCanvas(2);
    exportCanvas.toBlob(blob => {
      if(lastPaperBlobUrl) URL.revokeObjectURL(lastPaperBlobUrl);
      lastPaperBlobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = lastPaperBlobUrl;
      a.download = 'paperpack-a4.png';
      a.click();
    }, 'image/png');
  }

  function downloadPaperSvg(){
    if(!lastCards.length){
      setEncodeStatus('Önce A4 oluştur.');
      return;
    }
    const svg = buildPaperSvg(lastCards, lastMode, Boolean(els.password.value));
    const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paperpack-a4.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function buildPaperSvg(cards, mode, encrypted){
    const W = 794;
    const H = 1123;
    const esc = escapeXml;
    const now = new Date().toLocaleString('tr-TR');
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`);
    parts.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
    parts.push(`<text x="30" y="34" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#111">PaperPack v1</text>`);
    parts.push(`<text x="30" y="50" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#111">${mode === 'nine' ? '9 dosya modu' : 'tek dosya modu'} • ${encrypted ? 'şifreli' : 'şifresiz'}</text>`);
    parts.push(`<text x="764" y="50" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="#111">${esc(now)}</text>`);
    parts.push(`<line x1="30" y1="62" x2="764" y2="62" stroke="#111" stroke-width="1"/>`);

    if(mode === 'nine'){
      const marginX = 30;
      const top = 82;
      const gap = 10;
      const cardW = (W - marginX*2 - gap*2) / 3;
      const cardH = (H - top - 30 - gap*2) / 3;
      for(let i=0;i<9;i++){
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = marginX + col * (cardW + gap);
        const y = top + row * (cardH + gap);
        parts.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(cardW)}" height="${fmt(cardH)}" fill="#fff" stroke="#111" stroke-width="1"/>`);
        const item = cards[i];
        if(!item){
          parts.push(`<text x="${fmt(x+7)}" y="${fmt(y+14)}" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#111">${i+1}. Boş</text>`);
          continue;
        }
        const labelName = els.hideNames.checked ? 'gizli' : item.file.name;
        const meta = `${i+1}. ${labelName}`;
        const meta2 = `${item.gridSize}×${item.gridSize} • ${(item.packet.length/1024).toFixed(2)} KB`;
        parts.push(`<text x="${fmt(x+7)}" y="${fmt(y+14)}" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#111">${esc(meta.slice(0,38))}</text>`);
        parts.push(`<text x="${fmt(x+cardW-7)}" y="${fmt(y+14)}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#111">${esc(meta2)}</text>`);
        const symbolSize = Math.min(cardW - 16, cardH - 30);
        const sx = x + (cardW - symbolSize) / 2;
        const sy = y + 22;
        parts.push(buildSymbolSvg(item.packet, item.gridSize, sx, sy, symbolSize));
      }
    }else{
      const cardW = 690;
      const x = (W - cardW) / 2;
      const y = 84;
      const cardH = 760;
      const item = cards[0];
      parts.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${cardW}" height="${cardH}" fill="#fff" stroke="#111" stroke-width="1"/>`);
      const labelName = els.hideNames.checked ? 'gizli' : item.file.name;
      parts.push(`<text x="${fmt(x+7)}" y="${fmt(y+14)}" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#111">1. ${esc(labelName.slice(0,70))}</text>`);
      parts.push(`<text x="${fmt(x+cardW-7)}" y="${fmt(y+14)}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#111">${item.gridSize}×${item.gridSize} • ${(item.packet.length/1024).toFixed(2)} KB</text>`);
      const symbolSize = cardW - 16;
      parts.push(buildSymbolSvg(item.packet, item.gridSize, x+8, y+24, symbolSize));
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function buildSymbolSvg(packet, n, x, y, size){
    const total = n + CODE_TOTAL_EXTRA_CELLS;
    const cell = size / total;
    const q = CODE_QUIET_CELLS;
    const b = CODE_BORDER_CELLS;
    const dataOffset = CODE_DATA_OFFSET_CELLS;
    const bits = bytesToBits(packet, n*n);
    const parts = [];
    parts.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" fill="#fff" stroke="#111" stroke-width="1"/>`);
    // Black alignment border. The data area itself stays pure packet bits.
    parts.push(`<rect x="${fmt(x+q*cell)}" y="${fmt(y+q*cell)}" width="${fmt((n+b*2)*cell)}" height="${fmt(b*cell)}" fill="#000"/>`);
    parts.push(`<rect x="${fmt(x+q*cell)}" y="${fmt(y+(q+b+n)*cell)}" width="${fmt((n+b*2)*cell)}" height="${fmt(b*cell)}" fill="#000"/>`);
    parts.push(`<rect x="${fmt(x+q*cell)}" y="${fmt(y+q*cell)}" width="${fmt(b*cell)}" height="${fmt((n+b*2)*cell)}" fill="#000"/>`);
    parts.push(`<rect x="${fmt(x+(q+b+n)*cell)}" y="${fmt(y+q*cell)}" width="${fmt(b*cell)}" height="${fmt((n+b*2)*cell)}" fill="#000"/>`);
    // Merge horizontal runs so the SVG remains reasonably small even at max density.
    for(let row=0; row<n; row++){
      let col=0;
      while(col<n){
        while(col<n && !bits[row*n+col]) col++;
        if(col>=n) break;
        const start=col;
        while(col<n && bits[row*n+col]) col++;
        const len=col-start;
        parts.push(`<rect x="${fmt(x+(dataOffset+start)*cell)}" y="${fmt(y+(dataOffset+row)*cell)}" width="${fmt(len*cell)}" height="${fmt(cell)}" fill="#000"/>`);
      }
    }
    return `<g>${parts.join('')}</g>`;
  }

  function fmt(n){ return Number(n).toFixed(3).replace(/\.?0+$/,''); }
  function escapeXml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }

  function renderPaperToCanvas(scale){
    const w = 794;
    const h = 1123;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w * scale;
    exportCanvas.height = h * scale;
    const ctx = exportCanvas.getContext('2d', {alpha:false});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,exportCanvas.width,exportCanvas.height);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#111';
    ctx.font = '18px Arial';
    ctx.fillText('PaperPack v1', 30, 32);
    ctx.font = '10px Arial';
    ctx.fillText(`${lastMode === 'nine' ? '9 dosya modu' : 'tek dosya modu'} • ${new Date().toLocaleString('tr-TR')}`, 30, 48);
    const cards = Array.from(els.paper.querySelectorAll('.code-card'));
    const parent = els.paper.getBoundingClientRect();
    for(const card of cards){
      const rect = card.getBoundingClientRect();
      const x = rect.left - parent.left;
      const y = rect.top - parent.top;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, rect.width, rect.height);
      const meta = card.querySelector('.code-meta');
      if(meta){
        ctx.fillStyle = '#111';
        ctx.font = '9px Arial';
        const label = meta.textContent.trim().replace(/\s+/g,' ').slice(0,90);
        ctx.fillText(label, x+5, y+12);
      }
      const can = card.querySelector('canvas');
      if(can){
        const cRect = can.getBoundingClientRect();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(can, cRect.left-parent.left, cRect.top-parent.top, cRect.width, cRect.height);
      }
    }
    return exportCanvas;
  }

  function updateCapacityInfo(){
    if(!els.capacityInfo) return;
    const mode = els.encodeMode.value;
    const grid = DENSITIES[mode][els.density.value];
    const cap = Math.floor(grid * grid / 8);
    const usable = Math.max(0, cap - 450);
    const label = mode === 'nine' ? 'kutu başı' : 'tek A4 alanı';
    els.capacityInfo.textContent = `Seçili yoğunluk: ${grid}×${grid}. Yaklaşık ham kapasite ${label} ${(cap/1024).toFixed(1)} KB; pratik dosya alanı header/şifre payı sonrası yaklaşık ${(usable/1024).toFixed(1)} KB. Metin/HTML destekleyen tarayıcılarda otomatik gzip ile daha fazla sığabilir.`;
  }

  async function decodeImageInput(){
    try{
      els.decodeResults.innerHTML = '';
      const file = els.decodeImage.files && els.decodeImage.files[0];
      if(!file) throw new Error('Önce bir görsel yükle veya fotoğraf çek.');
      setDecodeStatus('Görsel okunuyor...');
      if(!decodeSourceCanvas) await prepareDecodePreview();
      if(!decodeSourceCanvas) throw new Error('Görsel hazırlanamadı.');

      const canvases = getDecodeCanvases();
      const packets = [];
      const seen = new Set();
      let attempts = 0;
      for(const item of canvases){
        const modes = els.decodeMode.value === 'auto' ? ['single','nine'] : [els.decodeMode.value];
        for(const mode of modes){
          attempts++;
          try{
            const found = mode === 'nine' ? await decodeNineCanvas(item.canvas) : [await decodeSingleCanvas(item.canvas)];
            for(const p of found.filter(Boolean)){
              const key = `${p.header.name}|${p.header.mime}|${p.payload.length}|${p.header.created || ''}`;
              if(!seen.has(key)){ seen.add(key); packets.push(p); }
            }
          }catch(e){ /* other candidates can still work */ }
        }
      }
      if(!packets.length) throw new Error('Okunabilir PaperPack verisi bulunamadı. Manuel alan seçimiyle sadece kod kutusunu seçip tekrar dene.');
      setDecodeStatus(`${packets.length} paket bulundu. Denenen alan/mod: ${attempts}.`);
      for(const p of packets) addResultCard(p);
    }catch(err){
      console.error(err);
      setDecodeStatus('Hata: ' + err.message);
    }
  }

  async function prepareDecodePreview(){
    const file = els.decodeImage.files && els.decodeImage.files[0];
    if(!file) return;
    const img = await loadImageFromFile(file);
    decodeSourceCanvas = imageToCanvas(img);
    selection = null;
    drawDecodePreview();
    setDecodeStatus('Görsel hazır. İstersen kod alanını sürükleyerek seç, sonra Oku butonuna bas.');
  }

  function drawDecodePreview(){
    const canvas = els.imagePreview;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!decodeSourceCanvas){
      canvas.width = 1; canvas.height = 1;
      if(els.selectionInfo) els.selectionInfo.textContent = 'Görsel yükleyince burada önizleme çıkar. Gerekirse kodun etrafını sürükleyerek seç.';
      return;
    }
    const maxW = Math.min(900, Math.max(320, canvas.parentElement ? canvas.parentElement.clientWidth - 24 : 760));
    previewScale = Math.min(1, maxW / decodeSourceCanvas.width);
    canvas.width = Math.round(decodeSourceCanvas.width * previewScale);
    canvas.height = Math.round(decodeSourceCanvas.height * previewScale);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(decodeSourceCanvas, 0, 0, canvas.width, canvas.height);
    if(selection){
      const s = normalizeRect(selection);
      ctx.save();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 3;
      ctx.setLineDash([8,5]);
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.restore();
      if(els.selectionInfo) els.selectionInfo.textContent = `Seçili alan: ${Math.round(s.w)}×${Math.round(s.h)} px. Oku dediğinde bu alan ayrıca denenecek.`;
    }else if(els.selectionInfo){
      els.selectionInfo.textContent = `Önizleme hazır: ${decodeSourceCanvas.width}×${decodeSourceCanvas.height} px. Gerekirse kodun etrafını sürükleyerek seç.`;
    }
  }

  function initPreviewSelection(){
    const canvas = els.imagePreview;
    if(!canvas) return;
    const pointer = ev => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(canvas.width, (ev.clientX - rect.left) * (canvas.width / rect.width))),
        y: Math.max(0, Math.min(canvas.height, (ev.clientY - rect.top) * (canvas.height / rect.height)))
      };
    };
    canvas.addEventListener('pointerdown', ev => {
      if(!decodeSourceCanvas) return;
      canvas.setPointerCapture(ev.pointerId);
      dragStart = pointer(ev);
      selection = {x:dragStart.x, y:dragStart.y, w:0, h:0};
      drawDecodePreview();
    });
    canvas.addEventListener('pointermove', ev => {
      if(!dragStart) return;
      const p = pointer(ev);
      selection = {x:dragStart.x, y:dragStart.y, w:p.x-dragStart.x, h:p.y-dragStart.y};
      drawDecodePreview();
    });
    canvas.addEventListener('pointerup', ev => {
      if(!dragStart) return;
      const p = pointer(ev);
      selection = {x:dragStart.x, y:dragStart.y, w:p.x-dragStart.x, h:p.y-dragStart.y};
      selection = normalizeRect(selection);
      if(selection.w < 20 || selection.h < 20) selection = null;
      dragStart = null;
      drawDecodePreview();
    });
  }

  function normalizeRect(r){
    const x = r.w < 0 ? r.x + r.w : r.x;
    const y = r.h < 0 ? r.y + r.h : r.y;
    return {x, y, w:Math.abs(r.w), h:Math.abs(r.h)};
  }

  function getDecodeCanvases(){
    const out = [];
    const areaMode = els.decodeArea ? els.decodeArea.value : 'auto';
    if(selection && areaMode !== 'full'){
      const s = normalizeRect(selection);
      const x = s.x / previewScale;
      const y = s.y / previewScale;
      const w = s.w / previewScale;
      const h = s.h / previewScale;
      out.push({label:'seçili alan', canvas:cropCanvas(decodeSourceCanvas, x, y, w, h)});
    }
    if(areaMode !== 'selected') out.push({label:'tam görsel', canvas:decodeSourceCanvas});
    return out;
  }

  async function loadImageFromFile(file){
    const url = URL.createObjectURL(file);
    try{
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
        img.src = url;
      });
      return img;
    }finally{
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function decodeNineCanvas(canvas){
    const out = [];
    for(let row=0; row<3; row++){
      for(let col=0; col<3; col++){
        const crop = cropCanvas(canvas, col*canvas.width/3, row*canvas.height/3, canvas.width/3, canvas.height/3);
        try{
          const p = decodeFromCanvas(crop);
          if(p) out.push(p);
        }catch(e){ /* ignore empty/failed cell */ }
      }
    }
    // If the user selected a single card while still in 9 mode, try it as one symbol too.
    try{
      const p = decodeFromCanvas(canvas);
      if(p) out.push(p);
    }catch(e){}
    return out;
  }

  async function decodeSingleCanvas(canvas){
    const result = decodeFromCanvas(canvas);
    if(!result) throw new Error('Paket çözülemedi.');
    return result;
  }

  function imageToCanvas(img){
    const max = 2200;
    const scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((img.naturalWidth || img.width) * scale);
    canvas.height = Math.round((img.naturalHeight || img.height) * scale);
    const ctx = canvas.getContext('2d', {willReadFrequently:true, alpha:false});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas;
  }

  function cropCanvas(src, x, y, w, h){
    const c = document.createElement('canvas');
    c.width = Math.round(w);
    c.height = Math.round(h);
    const ctx = c.getContext('2d', {willReadFrequently:true, alpha:false});
    ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
    return c;
  }

  function decodeFromCanvas(canvas){
    const boxes = findCandidateBoxes(canvas);
    if(!boxes.length) return null;
    let lastError = null;
    for(const bbox of boxes){
      for(const n of TRY_GRIDS){
        const variants = bboxVariants(bbox, n);
        for(const variant of variants){
          try{
            const bits = sampleGrid(canvas, variant, n);
            const bytes = bitsToBytes(bits);
            const p = parsePacket(bytes);
            if(p) return p;
          }catch(e){ lastError = e; }
        }
      }
    }
    if(lastError && /Checksum|sürümü/.test(lastError.message)) throw lastError;
    return null;
  }

  function findCandidateBoxes(canvas){
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    const {width:w, height:h} = canvas;
    const img = ctx.getImageData(0,0,w,h).data;
    const dark = new Uint8Array(w*h);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i = (y*w+x)*4;
        const r=img[i], g=img[i+1], b=img[i+2];
        // Print photos often become gray; use a permissive luminance threshold here.
        dark[y*w+x] = (r+g+b) < 510 ? 1 : 0;
      }
    }

    const boxes = connectedDarkBoxes(dark, w, h)
      .filter(b => b.w > 90 && b.h > 90 && b.area > 3000)
      .sort((a,b) => b.area - a.area)
      .slice(0, 12)
      .map(b => ({x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1, w:b.x1-b.x0+1, h:b.y1-b.y0+1, source:'component'}));

    // Fallback: older row/column interval method. Useful for clean PNG exports.
    const row = new Uint32Array(h);
    const col = new Uint32Array(w);
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(dark[y*w+x]){ row[y]++; col[x]++; }
      }
    }
    const yInt = largestDenseInterval(row, w, 0.08);
    const xInt = largestDenseInterval(col, h, 0.08);
    if(xInt && yInt){
      const x0=xInt[0], x1=xInt[1], y0=yInt[0], y1=yInt[1];
      const bw=x1-x0+1, bh=y1-y0+1;
      if(bw>90 && bh>90) boxes.push({x0,y0,x1,y1,w:bw,h:bh,source:'interval'});
    }

    // Also try the full image; generated PNGs cropped by users can still decode this way.
    boxes.push({x0:0,y0:0,x1:w-1,y1:h-1,w,h,source:'full'});

    return uniqueBoxes(boxes, w, h);
  }

  function connectedDarkBoxes(dark, w, h){
    const visited = new Uint8Array(w*h);
    const boxes = [];
    const qx = new Int32Array(w*h > 1800000 ? 1800000 : w*h);
    const qy = new Int32Array(qx.length);
    for(let sy=0; sy<h; sy+=2){
      for(let sx=0; sx<w; sx+=2){
        const start = sy*w+sx;
        if(visited[start] || !dark[start]) continue;
        let head=0, tail=0, x0=sx, x1=sx, y0=sy, y1=sy, area=0;
        qx[tail]=sx; qy[tail]=sy; tail++; visited[start]=1;
        while(head<tail && tail<qx.length-4){
          const x=qx[head], y=qy[head]; head++; area++;
          if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
          const neigh = [[x+2,y],[x-2,y],[x,y+2],[x,y-2]];
          for(const [nx,ny] of neigh){
            if(nx<0||ny<0||nx>=w||ny>=h) continue;
            const ni=ny*w+nx;
            if(!visited[ni] && dark[ni]){ visited[ni]=1; qx[tail]=nx; qy[tail]=ny; tail++; }
          }
        }
        if(area>80) boxes.push({x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1,area});
      }
    }
    return boxes;
  }

  function uniqueBoxes(boxes, w, h){
    const out=[];
    for(const b of boxes){
      const pad = Math.max(4, Math.round(Math.min(b.w,b.h)*0.015));
      const bb = {
        x0: Math.max(0, b.x0-pad),
        y0: Math.max(0, b.y0-pad),
        x1: Math.min(w-1, b.x1+pad),
        y1: Math.min(h-1, b.y1+pad)
      };
      bb.w = bb.x1-bb.x0+1; bb.h = bb.y1-bb.y0+1;
      const dup = out.some(o => Math.abs(o.x0-bb.x0)<8 && Math.abs(o.y0-bb.y0)<8 && Math.abs(o.w-bb.w)<16 && Math.abs(o.h-bb.h)<16);
      if(!dup) out.push(bb);
    }
    return out.slice(0,16);
  }

  function bboxVariants(bbox, n){
    // The generated symbol has a quiet zone + border + data. Camera photos can crop a few pixels,
    // so try a few small expansions/shrinks around the detected box.
    const list=[];
    const base = Math.min(bbox.w, bbox.h);
    for(const pct of [0, -0.015, 0.015, -0.03, 0.03]){
      const d = Math.round(base*pct);
      list.push({x0:bbox.x0+d, y0:bbox.y0+d, x1:bbox.x1-d, y1:bbox.y1-d, w:bbox.w-2*d, h:bbox.h-2*d});
    }
    return list.filter(b => b.w>80 && b.h>80);
  }

  function largestDenseInterval(counts, denom, density){
    const min = Math.max(6, Math.floor(denom * density));
    let best=null, start=-1;
    for(let i=0;i<counts.length;i++){
      const ok = counts[i] >= min;
      if(ok && start<0) start=i;
      if((!ok || i===counts.length-1) && start>=0){
        const end = ok && i===counts.length-1 ? i : i-1;
        if(!best || end-start > best[1]-best[0]) best=[start,end];
        start=-1;
      }
    }
    return best;
  }

  function sampleGrid(canvas, bbox, n){
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    const img = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const grays = new Uint16Array(n*n);
    const totalCells = n + CODE_TOTAL_EXTRA_CELLS;
    const cellW = bbox.w / totalCells;
    const cellH = bbox.h / totalCells;
    const ox = bbox.x0 + cellW*CODE_DATA_OFFSET_CELLS;
    const oy = bbox.y0 + cellH*CODE_DATA_OFFSET_CELLS;
    for(let y=0;y<n;y++){
      for(let x=0;x<n;x++){
        const cx = Math.max(0, Math.min(canvas.width-1, Math.round(ox + (x+0.5)*cellW)));
        const cy = Math.max(0, Math.min(canvas.height-1, Math.round(oy + (y+0.5)*cellH)));
        let sum=0, count=0;
        const rad = Math.max(1, Math.floor(Math.min(cellW,cellH)*0.18));
        for(let yy=-rad; yy<=rad; yy++){
          for(let xx=-rad; xx<=rad; xx++){
            const sx = Math.max(0, Math.min(canvas.width-1, cx+xx));
            const sy = Math.max(0, Math.min(canvas.height-1, cy+yy));
            const i = (sy*canvas.width+sx)*4;
            sum += img[i]+img[i+1]+img[i+2];
            count++;
          }
        }
        grays[y*n+x] = Math.round(sum/count);
      }
    }
    const threshold = adaptiveThreshold(grays);
    const bits = new Uint8Array(n*n);
    for(let i=0;i<grays.length;i++) bits[i] = grays[i] < threshold ? 1 : 0;
    return bits;
  }

  function adaptiveThreshold(values){
    // Fast percentile-based threshold. More tolerant than a fixed threshold for phone photos.
    const sample = Array.from(values);
    sample.sort((a,b)=>a-b);
    const p10 = sample[Math.floor(sample.length*0.10)] || 0;
    const p90 = sample[Math.floor(sample.length*0.90)] || 765;
    return Math.round((p10+p90)/2);
  }

  function parsePacket(bytes){
    if(bytes[0]!==MAGIC[0] || bytes[1]!==MAGIC[1] || bytes[2]!==MAGIC[2] || bytes[3]!==MAGIC[3]) return null;
    const version = bytes[4];
    if(version !== VERSION) throw new Error('Desteklenmeyen PaperPack sürümü.');
    const headerLen = readU32(bytes,5);
    const payloadLen = readU32(bytes,9);
    const crcStored = readU32(bytes,13);
    const start = 17;
    if(headerLen <= 0 || headerLen > 2000 || payloadLen < 0 || start+headerLen+payloadLen > bytes.length) return null;
    const headerBytes = bytes.slice(start,start+headerLen);
    const payload = bytes.slice(start+headerLen,start+headerLen+payloadLen);
    const crc = crc32Concat(headerBytes, payload);
    if(crc !== crcStored) throw new Error('Checksum uyuşmadı. Görsel net değil veya yanlış yoğunluk okundu.');
    const header = JSON.parse(new TextDecoder().decode(headerBytes));
    return {header, payload};
  }

  function addResultCard(packet){
    const node = els.resultTemplate.content.firstElementChild.cloneNode(true);
    const h = node.querySelector('h3');
    const meta = node.querySelector('.meta');
    const decryptZone = node.querySelector('.decrypt-zone');
    const openZone = node.querySelector('.open-zone');
    const err = node.querySelector('.error');
    const name = packet.header.name || 'paperpack.html';
    h.textContent = name;
    meta.textContent = `${packet.header.mime || 'application/octet-stream'} • ${packet.header.encrypted ? 'şifreli' : 'şifresiz'}${packet.header.compressed ? ' • gzip' : ''} • ${(packet.payload.length/1024).toFixed(2)} KB`;
    if(packet.header.encrypted){
      decryptZone.classList.remove('hidden');
      node.querySelector('.decrypt-open-btn').addEventListener('click', async () => {
        const win = window.open('about:blank','_blank');
        try{
          const pass = node.querySelector('.result-password').value;
          if(!pass) throw new Error('Şifre girilmedi.');
          const decrypted = await decryptPayload(packet, pass);
          const clear = await maybeDecompress(decrypted, packet.header);
          const url = createBlobUrl(clear, packet.header);
          if(win) win.location.href = url;
          addOpenHandler(node, clear, packet.header);
          addDownloadHandler(node, clear, packet.header);
          openZone.classList.remove('hidden');
          decryptZone.classList.add('hidden');
        }catch(e){
          if(win) win.close();
          err.textContent = 'Açılamadı: ' + e.message;
          err.classList.remove('hidden');
        }
      });
    }else{
      openZone.classList.remove('hidden');
      let clearCache = null;
      const getClear = async () => clearCache || (clearCache = await maybeDecompress(packet.payload, packet.header));
      addOpenHandler(node, getClear, packet.header);
      addDownloadHandler(node, getClear, packet.header);
    }
    els.decodeResults.appendChild(node);
  }

  async function decryptPayload(packet, password){
    const header = packet.header;
    const salt = base64ToBytes(header.salt);
    const iv = base64ToBytes(header.iv);
    const key = await deriveKey(password, salt);
    const clear = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, packet.payload);
    return new Uint8Array(clear);
  }

  function addOpenHandler(node, bytesOrGetter, header){
    node.querySelector('.open-btn').addEventListener('click', async () => {
      const win = window.open('about:blank','_blank');
      try{
        const bytes = typeof bytesOrGetter === 'function' ? await bytesOrGetter() : bytesOrGetter;
        const url = createBlobUrl(bytes, header);
        if(win) win.location.href = url;
      }catch(e){
        if(win) win.close();
        alert('Açılamadı: ' + e.message);
      }
    });
  }

  function addDownloadHandler(node, bytesOrGetter, header){
    const btn = node.querySelector('.download-btn');
    btn.onclick = async () => {
      const bytes = typeof bytesOrGetter === 'function' ? await bytesOrGetter() : bytesOrGetter;
      const url = createBlobUrl(bytes, header);
      const a = document.createElement('a');
      a.href = url;
      a.download = header.name || 'paperpack.bin';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };
  }

  function createBlobUrl(bytes, header){
    const blob = new Blob([bytes], {type: header.mime || 'application/octet-stream'});
    return URL.createObjectURL(blob);
  }

  function writeU32(arr, offset, value){
    arr[offset] = (value >>> 24) & 255;
    arr[offset+1] = (value >>> 16) & 255;
    arr[offset+2] = (value >>> 8) & 255;
    arr[offset+3] = value & 255;
  }
  function readU32(arr, offset){
    return ((arr[offset]<<24) | (arr[offset+1]<<16) | (arr[offset+2]<<8) | arr[offset+3]) >>> 0;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++) c = c&1 ? 0xedb88320 ^ (c>>>1) : c>>>1;
      table[i]=c>>>0;
    }
    return table;
  })();
  function crc32Concat(a,b){
    let crc = 0xffffffff;
    for(const arr of [a,b]){
      for(let i=0;i<arr.length;i++) crc = CRC_TABLE[(crc ^ arr[i]) & 255] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function bytesToBase64(bytes){
    let s='';
    for(let i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function base64ToBytes(b64){
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i);
    return out;
  }

  function setEncodeStatus(s){ els.encodeStatus.textContent = s; }
  function setDecodeStatus(s){ els.decodeStatus.textContent = s; }
})();
