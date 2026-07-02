(() => {
  'use strict';

  const MAGIC = [0x50,0x50,0x4b,0x32]; // PPK2
  const VERSION = 2;
  const ITERATIONS = 160000;
  const GRID_OPTIONS = { safe:128, standard:176, dense:224 };
  const TRY_GRIDS = [224,176,128];
  const FRAME = 6;
  const QUIET = 10;
  const FILLER_SEED = 0x9e3779b9;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const $ = id => document.getElementById(id);
  const els = {
    filePicker:$('filePicker'), addManualBtn:$('addManualBtn'), itemsPanel:$('itemsPanel'), itemTemplate:$('itemTemplate'),
    layoutMode:$('layoutMode'), density:$('density'), pagePreset:$('pagePreset'), readerLink:$('readerLink'), showPageHeader:$('showPageHeader'), includeReaderLink:$('includeReaderLink'), showGlobalTech:$('showGlobalTech'), fitNineGrid:$('fitNineGrid'), includeCodeFrame:$('includeCodeFrame'), useCompression:$('useCompression'), globalDescription:$('globalDescription'), capacityInfo:$('capacityInfo'), encodeBtn:$('encodeBtn'), printBtn:$('printBtn'), downloadPngBtn:$('downloadPngBtn'), downloadSvgBtn:$('downloadSvgBtn'), encodeStatus:$('encodeStatus'), paper:$('paper'),
    decodeMode:$('decodeMode'), decodeImage:$('decodeImage'), decodeBtn:$('decodeBtn'), clearDecodeBtn:$('clearDecodeBtn'), decodeStatus:$('decodeStatus'), decodeResults:$('decodeResults'), resultTemplate:$('resultTemplate')
  };
  const state = { items:[], lastCards:[] };

  els.filePicker.addEventListener('change', addFiles);
  els.addManualBtn.addEventListener('click', addManualItem);
  els.encodeBtn.addEventListener('click', encodeAll);
  els.printBtn.addEventListener('click', () => window.print());
  els.downloadPngBtn.addEventListener('click', downloadPng);
  els.downloadSvgBtn.addEventListener('click', downloadSvg);
  els.decodeBtn.addEventListener('click', decodeImageInput);
  els.clearDecodeBtn.addEventListener('click', () => { els.decodeResults.innerHTML=''; els.decodeStatus.textContent=''; });
  ['layoutMode','density','pagePreset','showPageHeader','includeReaderLink','showGlobalTech','fitNineGrid','includeCodeFrame','useCompression'].forEach(id => $(id).addEventListener('change', updateCapacity));
  updateCapacity();

  async function addFiles(){
    const files = Array.from(els.filePicker.files || []);
    for(const f of files){
      if(state.items.length >= 9) break;
      state.items.push({
        name:sanitizeName(f.name || 'paperpack.html'), mime:f.type || mimeFromName(f.name), bytes:new Uint8Array(await f.arrayBuffer()),
        password:'', description:'', showName:true, showDesc:true, showTech:false
      });
    }
    els.filePicker.value = '';
    renderItems(); updateCapacity();
  }

  function addManualItem(){
    if(state.items.length >= 9){ setEncodeStatus('En fazla 9 kart eklenebilir.'); return; }
    const html = '<!doctype html><html lang="tr"><meta charset="utf-8"><title>PaperPack</title><body><h1>Merhaba</h1><p>Manuel içerik.</p></body></html>';
    state.items.push({name:'manuel.html', mime:'text/html', bytes:enc.encode(html), password:'', description:'', showName:true, showDesc:true, showTech:false, manual:true});
    renderItems(); updateCapacity();
  }

  function renderItems(){
    els.itemsPanel.innerHTML = '';
    if(!state.items.length){ els.itemsPanel.innerHTML = '<div class="empty-items">Henüz veri eklenmedi.</div>'; return; }
    state.items.forEach((item, idx) => {
      const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.item-title').textContent = `${idx+1}. ${item.name} • ${(item.bytes.length/1024).toFixed(2)} KB`;
      node.querySelector('.item-name').value = item.name;
      node.querySelector('.item-password').value = item.password || '';
      node.querySelector('.item-description').value = item.description || '';
      node.querySelector('.item-show-name').checked = item.showName;
      node.querySelector('.item-show-desc').checked = item.showDesc;
      node.querySelector('.item-show-tech').checked = item.showTech;
      node.querySelector('.remove-item').onclick = () => { state.items.splice(idx,1); renderItems(); updateCapacity(); };
      node.querySelector('.item-name').oninput = e => { item.name = sanitizeName(e.target.value); };
      node.querySelector('.item-password').oninput = e => { item.password = e.target.value; updateCapacity(); };
      node.querySelector('.item-description').oninput = e => { item.description = e.target.value; };
      node.querySelector('.item-show-name').onchange = e => { item.showName = e.target.checked; };
      node.querySelector('.item-show-desc').onchange = e => { item.showDesc = e.target.checked; };
      node.querySelector('.item-show-tech').onchange = e => { item.showTech = e.target.checked; };
      els.itemsPanel.appendChild(node);
    });
  }

  function chooseGrid(count){
    const dens = els.density.value;
    if(dens !== 'auto') return GRID_OPTIONS[dens];
    return count <= 1 ? 176 : 128;
  }

  function updateCapacity(){
    const count = Math.max(1, state.items.length || 1);
    const n = chooseGrid(count);
    const cap = Math.floor((n*n)/8) - 350;
    els.capacityInfo.textContent = `Seçili grid: ${n}×${n}. Yaklaşık kart kapasitesi: ${(Math.max(0,cap)/1024).toFixed(1)} KB. Güvenilir okuma için yüksek kapasite yerine büyük hücre önerilir.`;
  }

  async function encodeAll(){
    try{
      if(!state.items.length) throw new Error('Önce dosya ekle veya manuel kart oluştur.');
      setEncodeStatus('Paketler hazırlanıyor...');
      const items = state.items.slice(0,9);
      const grid = chooseGrid(items.length);
      const cards = [];
      for(const item of items){
        const packet = await buildPacket(item);
        const capacity = Math.floor((grid*grid)/8);
        if(packet.length > capacity) throw new Error(`${item.name} büyük. Paket ${(packet.length/1024).toFixed(2)} KB, kapasite ${(capacity/1024).toFixed(2)} KB.`);
        const canvas = drawCodeCanvas(packet, grid, 4);
        cards.push({item, packet, canvas, grid});
      }
      state.lastCards = cards;
      renderPaper(cards);
      els.printBtn.disabled = false; els.downloadPngBtn.disabled = false; els.downloadSvgBtn.disabled = false;
      setEncodeStatus('A4 hazır. İlk test: PNG indir → okuma bölümüne aynı PNG dosyasını yükle.');
    }catch(e){ console.error(e); setEncodeStatus('Hata: '+e.message); }
  }

  async function buildPacket(item){
    let payload = item.bytes;
    const header = {v:VERSION, name:sanitizeName(item.name), mime:item.mime || mimeFromName(item.name), encrypted:false, compressed:false, created:new Date().toISOString()};
    if(els.useCompression.checked && 'CompressionStream' in window){
      try{ payload = await gzipBytes(payload); header.compressed = true; }catch(e){ header.compressed = false; }
    }
    if(item.password){
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(item.password, salt);
      payload = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, payload));
      Object.assign(header,{encrypted:true,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-GCM-256',salt:bytesToBase64(salt),iv:bytesToBase64(iv)});
    }
    const hb = enc.encode(JSON.stringify(header));
    const total = 17 + hb.length + payload.length;
    const out = new Uint8Array(total); let o=0;
    out.set(MAGIC,o); o+=4; out[o++]=VERSION; writeU32(out,o,hb.length); o+=4; writeU32(out,o,payload.length); o+=4; writeU32(out,o,crc32Concat(hb,payload)); o+=4; out.set(hb,o); o+=hb.length; out.set(payload,o);
    return out;
  }

  async function gzipBytes(bytes){
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter(); writer.write(bytes); writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  }
  async function gunzipBytes(bytes){
    if(!('DecompressionStream' in window)) throw new Error('Bu tarayıcı gzip çözmeyi desteklemiyor.');
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter(); writer.write(bytes); writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }

  async function deriveKey(password, salt){
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  }

  function drawCodeCanvas(packet, n, scale){
    const total = n + 2*(QUIET+FRAME);
    const c = document.createElement('canvas'); c.width=total*scale; c.height=total*scale;
    const ctx=c.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
    const ox=QUIET+FRAME, oy=QUIET+FRAME;
    if(els.includeCodeFrame.checked){
      ctx.fillStyle='#000';
      ctx.fillRect(QUIET*scale,QUIET*scale,(n+2*FRAME)*scale,FRAME*scale);
      ctx.fillRect(QUIET*scale,(QUIET+FRAME+n)*scale,(n+2*FRAME)*scale,FRAME*scale);
      ctx.fillRect(QUIET*scale,QUIET*scale,FRAME*scale,(n+2*FRAME)*scale);
      ctx.fillRect((QUIET+FRAME+n)*scale,QUIET*scale,FRAME*scale,(n+2*FRAME)*scale);
    }
    const bits = bytesToBits(packet, n*n);
    for(let i=0;i<n*n;i++){
      const x=i%n, y=Math.floor(i/n);
      ctx.fillStyle = bits[i] ? '#000' : '#fff';
      ctx.fillRect((ox+x)*scale,(oy+y)*scale,scale,scale);
    }
    return c;
  }

  function bytesToBits(bytes, bitCount){
    const bits = new Uint8Array(bitCount);
    for(let i=0;i<bitCount;i++){
      const bi=i>>3; let byte;
      if(bi<bytes.length) byte=bytes[bi]; else byte = fillerByte(bi);
      bits[i]=(byte>>(7-(i&7)))&1;
    }
    return bits;
  }
  function fillerByte(i){ let x=(i^FILLER_SEED)>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; return x&255; }
  function bitsToBytes(bits){ const len=Math.floor(bits.length/8), out=new Uint8Array(len); for(let i=0;i<len*8;i++) if(bits[i]) out[i>>3]|=1<<(7-(i&7)); return out; }

  function renderPaper(cards){
    els.paper.innerHTML='';
    const preset=els.pagePreset.value;
    if(els.showPageHeader.checked && preset !== 'minimal'){
      const head=document.createElement('div'); head.className='paper-header';
      head.innerHTML=`<div><h2>PaperPack</h2><p>${cards.length} dosya • ${new Date().toLocaleString('tr-TR')}</p>${els.globalDescription.value.trim()?`<p>${escapeHtml(els.globalDescription.value.trim())}</p>`:''}</div>${els.includeReaderLink.checked?`<div class="reader-link"><strong>Okuyucu:</strong><br>${escapeHtml(els.readerLink.value)}</div>`:''}`;
      els.paper.appendChild(head);
    }
    const count = cards.length;
    let cls='grid1';
    if(count<=1 && els.layoutMode.value !== 'grid') cls='grid1'; else if(count<=2) cls='grid2'; else if(count<=4) cls='grid4'; else if(count<=6) cls='grid6'; else cls='grid9';
    const wrap=document.createElement('div'); wrap.className=`cards ${cls}`;
    const targetCount = els.fitNineGrid.checked ? 9 : count;
    for(let i=0;i<targetCount;i++){
      const card=document.createElement('div'); card.className='code-card'+(preset==='minimal'?' minimal':'');
      const c=cards[i];
      if(c){
        if(preset==='full' || c.item.showName || c.item.showTech){
          const meta=document.createElement('div'); meta.className='code-meta';
          const left=c.item.showName?`${i+1}. ${escapeHtml(c.item.name)}`:`${i+1}.`;
          const right=(c.item.showTech||els.showGlobalTech.checked)?`${c.grid}×${c.grid} • ${(c.packet.length/1024).toFixed(2)} KB`:'';
          meta.innerHTML=`<span>${left}</span><span>${right}</span>`; card.appendChild(meta);
        }
        c.canvas.className='code-canvas'; card.appendChild(c.canvas);
        if((preset==='note'||preset==='full') && c.item.showDesc && c.item.description.trim()){
          const d=document.createElement('div'); d.className='code-desc'; d.textContent=c.item.description.trim(); card.appendChild(d);
        }
      }
      wrap.appendChild(card);
    }
    els.paper.appendChild(wrap);
  }

  async function downloadPng(){
    const rect=els.paper.getBoundingClientRect(); const scale=2;
    const c=document.createElement('canvas'); c.width=Math.ceil(rect.width*scale); c.height=Math.ceil(rect.height*scale);
    const ctx=c.getContext('2d',{alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.scale(scale,scale);
    drawPaperToCanvas(ctx, rect);
    c.toBlob(blob=>downloadBlob(blob,'paperpack-a4.png'),'image/png');
  }

  function drawPaperToCanvas(ctx, rootRect){
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,rootRect.width,rootRect.height);
    ctx.fillStyle='#111'; ctx.font='14px Arial';
    const header=els.paper.querySelector('.paper-header');
    if(header){ ctx.fillText('PaperPack', 28, 28); if(els.includeReaderLink.checked) {ctx.font='9px Arial'; ctx.fillText(els.readerLink.value, rootRect.width-220, 28);} }
    for(const card of els.paper.querySelectorAll('.code-card')){
      const r=card.getBoundingClientRect(); const x=r.left-rootRect.left, y=r.top-rootRect.top;
      ctx.strokeStyle='#ddd'; ctx.lineWidth=1; if(!card.classList.contains('minimal')) ctx.strokeRect(x,y,r.width,r.height);
      const can=card.querySelector('canvas'); if(can){ const cr=can.getBoundingClientRect(); ctx.imageSmoothingEnabled=false; ctx.drawImage(can, cr.left-rootRect.left, cr.top-rootRect.top, cr.width, cr.height); }
      const desc=card.querySelector('.code-desc'); if(desc){ const dr=desc.getBoundingClientRect(); ctx.fillStyle='#333'; ctx.font='8px Arial'; wrapText(ctx, desc.textContent, dr.left-rootRect.left, dr.top-rootRect.top+8, dr.width, 10); }
    }
  }
  function wrapText(ctx,text,x,y,maxWidth,lineHeight){ const words=text.split(/\s+/); let line=''; for(const w of words){ const test=line?line+' '+w:w; if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,y); y+=lineHeight; line=w; }else line=test;} if(line) ctx.fillText(line,x,y); }

  function downloadSvg(){
    const cards = state.lastCards; if(!cards.length) return;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="white"/>`;
    let x=20,y=30, size=160;
    if(cards.length>1){ size = cards.length<=4?80:52; }
    cards.forEach((card,i)=>{
      if(cards.length>1){ const cols=cards.length<=4?2:3; x=12+(i%cols)*(size+8); y=25+Math.floor(i/cols)*(size+16); }
      svg += canvasToSvg(card.canvas,x,y,size,size);
    });
    svg += `</svg>`;
    downloadBlob(new Blob([svg],{type:'image/svg+xml'}),'paperpack-a4.svg');
  }
  function canvasToSvg(canvas,x,y,w,h){
    const ctx=canvas.getContext('2d'); const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const sx=w/canvas.width, sy=h/canvas.height; let out=`<g shape-rendering="crispEdges">`;
    for(let yy=0;yy<canvas.height;yy++) for(let xx=0;xx<canvas.width;xx++){ const i=(yy*canvas.width+xx)*4; if(img[i]+img[i+1]+img[i+2]<382) out+=`<rect x="${(x+xx*sx).toFixed(3)}" y="${(y+yy*sy).toFixed(3)}" width="${sx.toFixed(3)}" height="${sy.toFixed(3)}" fill="#000"/>`; }
    return out+'</g>';
  }

  async function decodeImageInput(){
    try{
      els.decodeResults.innerHTML=''; const f=els.decodeImage.files&&els.decodeImage.files[0]; if(!f) throw new Error('Görsel seç.');
      setDecodeStatus('Okunuyor...');
      const img=await loadImage(f); const base=imageToCanvas(img);
      const packets=[];
      const mode=els.decodeMode.value;
      const candidates=[];
      if(mode==='single'||mode==='auto') candidates.push(base);
      if(mode==='multi'||mode==='auto') candidates.push(...makeCrops(base));
      let tried=0;
      for(const c of candidates){ tried++; try{ const p=decodeFromCanvas(c); if(p && !packets.some(q=>q._key===p._key)) packets.push(p); }catch(e){} }
      if(!packets.length) throw new Error(`PaperPack verisi bulunamadı. Denenen alan: ${tried}. PNG çıktısı bile okunmuyorsa aynı sürümle yeniden A4 üret.`);
      setDecodeStatus(`${packets.length} paket bulundu.`); packets.forEach(addResultCard);
    }catch(e){ console.error(e); setDecodeStatus('Hata: '+e.message); }
  }

  function makeCrops(canvas){
    const out=[]; const patterns=[[2,1],[1,2],[2,2],[3,2],[3,3]];
    for(const [cols,rows] of patterns){ for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) out.push(cropCanvas(canvas,c*canvas.width/cols,r*canvas.height/rows,canvas.width/cols,canvas.height/rows)); }
    return out;
  }
  async function loadImage(file){ const url=URL.createObjectURL(file); const img=new Image(); img.decoding='async'; await new Promise((res,rej)=>{img.onload=res; img.onerror=()=>rej(new Error('Görsel yüklenemedi.')); img.src=url;}); setTimeout(()=>URL.revokeObjectURL(url),1000); return img; }
  function imageToCanvas(img){ const max=1800; const s=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)); const c=document.createElement('canvas'); c.width=Math.round((img.naturalWidth||img.width)*s); c.height=Math.round((img.naturalHeight||img.height)*s); const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); return c; }
  function cropCanvas(src,x,y,w,h){ const c=document.createElement('canvas'); c.width=Math.round(w); c.height=Math.round(h); c.getContext('2d',{willReadFrequently:true,alpha:false}).drawImage(src,x,y,w,h,0,0,c.width,c.height); return c; }

  function decodeFromCanvas(canvas){
    const bboxes = findLikelyBoxes(canvas);
    for(const bbox of bboxes){
      for(const n of TRY_GRIDS){
        const attempts = [
          {total:n+2*(QUIET+FRAME), off:QUIET+FRAME, name:'full'},
          {total:n+2*FRAME, off:FRAME, name:'frame'},
          {total:n, off:0, name:'data'}
        ];
        for(const a of attempts){
          try{ const bits=sampleGrid(canvas,bbox,n,a.total,a.off); const p=parsePacket(bitsToBytes(bits)); if(p){ p._key=p.header.name+':'+p.payload.length+':'+p.header.created; return p; } }catch(e){}
        }
      }
    }
    return null;
  }

  function findLikelyBoxes(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const w=canvas.width,h=canvas.height; const data=ctx.getImageData(0,0,w,h).data;
    const row=new Uint32Array(h), col=new Uint32Array(w);
    for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const i=(y*w+x)*4; const dark=data[i]+data[i+1]+data[i+2]<420; if(dark){row[y]++; col[x]++;} } }
    const boxes=[];
    for(const den of [0.12,0.08,0.18]){
      const xi=largestInterval(col,h,den), yi=largestInterval(row,w,den);
      if(xi&&yi){ const bw=xi[1]-xi[0]+1,bh=yi[1]-yi[0]+1; if(bw>80&&bh>80) boxes.push({x0:xi[0],y0:yi[0],x1:xi[1],y1:yi[1],w:bw,h:bh}); }
    }
    boxes.push({x0:0,y0:0,x1:w-1,y1:h-1,w,h});
    // de-duplicate
    return boxes.filter((b,i,a)=>i===a.findIndex(q=>Math.abs(q.x0-b.x0)<5&&Math.abs(q.y0-b.y0)<5&&Math.abs(q.w-b.w)<10&&Math.abs(q.h-b.h)<10));
  }
  function largestInterval(counts,denom,density){ const min=Math.max(4,Math.floor(denom*density)); let best=null,start=-1; for(let i=0;i<counts.length;i++){ const ok=counts[i]>=min; if(ok&&start<0) start=i; if((!ok||i===counts.length-1)&&start>=0){ const end=ok&&i===counts.length-1?i:i-1; if(!best||end-start>best[1]-best[0]) best=[start,end]; start=-1; }} return best; }

  function sampleGrid(canvas,bbox,n,totalCells,offsetCells){
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); const img=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const bits=new Uint8Array(n*n); const cw=bbox.w/totalCells, ch=bbox.h/totalCells; const ox=bbox.x0+offsetCells*cw, oy=bbox.y0+offsetCells*ch;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const cx=ox+(x+0.5)*cw, cy=oy+(y+0.5)*ch; let sum=0,count=0;
      const rad=Math.max(1,Math.floor(Math.min(cw,ch)*0.22));
      for(let yy=-rad;yy<=rad;yy++) for(let xx=-rad;xx<=rad;xx++){ const sx=Math.max(0,Math.min(canvas.width-1,Math.round(cx+xx))), sy=Math.max(0,Math.min(canvas.height-1,Math.round(cy+yy))); const i=(sy*canvas.width+sx)*4; sum+=img[i]+img[i+1]+img[i+2]; count++; }
      bits[y*n+x]=(sum/count)<382?1:0;
    }
    return bits;
  }

  function parsePacket(bytes){
    if(bytes[0]!==MAGIC[0]||bytes[1]!==MAGIC[1]||bytes[2]!==MAGIC[2]||bytes[3]!==MAGIC[3]) return null;
    if(bytes[4]!==VERSION) return null;
    const hl=readU32(bytes,5), pl=readU32(bytes,9), crc=readU32(bytes,13), start=17;
    if(hl<=0||hl>4000||pl<0||start+hl+pl>bytes.length) return null;
    const hb=bytes.slice(start,start+hl), payload=bytes.slice(start+hl,start+hl+pl);
    if(crc32Concat(hb,payload)!==crc) return null;
    const header=JSON.parse(dec.decode(hb)); return {header,payload};
  }

  function addResultCard(packet){
    const node=els.resultTemplate.content.firstElementChild.cloneNode(true); const h=node.querySelector('h3'), meta=node.querySelector('.meta'), dz=node.querySelector('.decrypt-zone'), oz=node.querySelector('.open-zone'), err=node.querySelector('.error');
    h.textContent=packet.header.name||'paperpack.html'; meta.textContent=`${packet.header.mime||'application/octet-stream'} • ${packet.header.encrypted?'şifreli':'şifresiz'} • ${packet.header.compressed?'gzip • ':''}${(packet.payload.length/1024).toFixed(2)} KB`;
    if(packet.header.encrypted){ dz.classList.remove('hidden'); node.querySelector('.decrypt-open-btn').onclick=async()=>{ const win=window.open('about:blank','_blank'); try{ const pass=node.querySelector('.result-password').value; let clear=await decryptPayload(packet,pass); if(packet.header.compressed) clear=await gunzipBytes(clear); const url=createBlobUrl(clear,packet.header); if(win) win.location.href=url; addOpenDownload(node,clear,packet.header); dz.classList.add('hidden'); oz.classList.remove('hidden'); }catch(e){ if(win) win.close(); err.textContent='Açılamadı: '+e.message; err.classList.remove('hidden'); }};
    }else{ (async()=>{ let clear=packet.payload; if(packet.header.compressed) clear=await gunzipBytes(clear); addOpenDownload(node,clear,packet.header); oz.classList.remove('hidden'); })().catch(e=>{err.textContent='Açılamadı: '+e.message; err.classList.remove('hidden');}); }
    els.decodeResults.appendChild(node);
  }
  async function decryptPayload(packet,password){ if(!password) throw new Error('Şifre girilmedi.'); const h=packet.header; const key=await deriveKey(password,base64ToBytes(h.salt)); return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(h.iv)},key,packet.payload)); }
  function addOpenDownload(node,bytes,header){ node.querySelector('.open-btn').onclick=()=>window.open(createBlobUrl(bytes,header),'_blank'); node.querySelector('.download-btn').onclick=()=>downloadBlob(new Blob([bytes],{type:header.mime||'application/octet-stream'}),header.name||'paperpack.bin'); }
  function createBlobUrl(bytes,header){ return URL.createObjectURL(new Blob([bytes],{type:header.mime||'application/octet-stream'})); }

  function sanitizeName(n){ return (n||'paperpack.html').replace(/[\\/\0]/g,'_').slice(0,120); }
  function mimeFromName(n){ n=(n||'').toLowerCase(); if(n.endsWith('.html')||n.endsWith('.htm'))return'text/html'; if(n.endsWith('.css'))return'text/css'; if(n.endsWith('.js'))return'text/javascript'; if(n.endsWith('.json'))return'application/json'; if(n.endsWith('.svg'))return'image/svg+xml'; return'text/plain'; }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function downloadBlob(blob,name){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); }
  function writeU32(a,o,v){a[o]=(v>>>24)&255;a[o+1]=(v>>>16)&255;a[o+2]=(v>>>8)&255;a[o+3]=v&255;} function readU32(a,o){return((a[o]<<24)|(a[o+1]<<16)|(a[o+2]<<8)|a[o+3])>>>0;}
  const CRC_TABLE=(()=>{const t=new Uint32Array(256); for(let i=0;i<256;i++){let c=i; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[i]=c>>>0;} return t;})();
  function crc32Concat(a,b){let crc=0xffffffff; for(const arr of [a,b]) for(let i=0;i<arr.length;i++) crc=CRC_TABLE[(crc^arr[i])&255]^(crc>>>8); return(crc^0xffffffff)>>>0;}
  function bytesToBase64(bytes){let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s);} function base64ToBytes(b64){const s=atob(b64); const out=new Uint8Array(s.length); for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i); return out;}
  function setEncodeStatus(s){els.encodeStatus.textContent=s;} function setDecodeStatus(s){els.decodeStatus.textContent=s;}
})();
