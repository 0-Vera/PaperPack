(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  var $ = function(id){ return document.getElementById(id); };
  var manualPoints = [];

  function getSettings(){
    var densityValue = $('densitySelect').value;
    return {
      mode: $('appMode').value,
      densityMode: densityValue,
      gridSize: densityValue === 'auto' ? null : parseInt(densityValue, 10),
      pageMode: $('pageMode').value,
      showFrame: $('showFrame').checked,
      includeReaderLink: $('includeReaderLink').checked,
      readerLink: $('readerLink').value.trim(),
      useCompression: $('useCompression').checked,
      globalPassword: $('globalPassword').value
    };
  }
  function saveMode(){ localStorage.setItem('paperpack.mode', $('appMode').value); }
  function loadMode(){
    var m = localStorage.getItem('paperpack.mode');
    if(m === 'local' || m === 'online') $('appMode').value = m;
    applyModeDefaults(false);
  }
  function applyModeDefaults(force){
    var isLocal = $('appMode').value === 'local';
    if(force || isLocal){ $('includeReaderLink').checked = !isLocal; }
    if(isLocal && !$('readerLink').value.trim()) $('readerLink').value = PP.config.readerLinkDefault;
  }
  function updateCapacityHint(){
    var v = $('densitySelect').value;
    if(v === 'auto'){
      $('capacityHint').textContent = 'Otomatik mod küçük dosyada rahat okunur grid seçer; dosya sığmazsa boşluk doldurmadan aynı dosyayı birden fazla veri karesine böler.';
      return;
    }
    var g = parseInt(v, 10);
    $('capacityHint').textContent = 'Tek kare güvenli kapasitesi yaklaşık ' + PP.utils.formatBytes(PP.encoder.capacityBytes(g)) + '. Daha büyük paketler aynı grid ile parçalara ayrılır.';
  }
  function updatePasswordHint(){
    var score = PP.cryptoBox.passwordScore($('globalPassword').value);
    var el = $('passwordHint');
    el.className = score.level === 'strong' ? 'strong' : (score.level === 'weak' ? 'weak' : (score.level === 'medium' ? 'medium' : ''));
    el.textContent = score.text + (score.level === 'weak' ? ' A4 ele geçirilirse offline parola denemesi yapılabilir.' : '');
  }
  function resetOutput(){
    PP.state.generated = null;
    $('outputPanel').classList.add('hidden');
    $('downloadPngBtn').disabled = true;
    $('downloadSvgBtn').disabled = true;
    $('printBtn').disabled = true;
    $('squareDownloads').innerHTML = '';
    if($('extraPages')) $('extraPages').innerHTML = '';
    $('testStatus').textContent = 'İç test bekleniyor.';
    $('testStatus').className = 'muted';
  }
  function renderFileList(){
    var box = $('fileList');
    if(!PP.state.items.length){ box.className = 'file-list empty'; box.textContent = 'Henüz dosya eklenmedi.'; resetOutput(); return; }
    box.className = 'file-list'; box.innerHTML = '';
    PP.state.items.forEach(function(item, index){
      var card = document.createElement('div');
      card.className = 'file-card';
      card.innerHTML = ''+
        '<div class="file-card-head">'+
          '<div><h3>'+(index+1)+'. '+PP.utils.escapeHtml(item.name)+'</h3><span class="badge">'+PP.utils.escapeHtml(item.mime || 'text/plain')+' · '+PP.utils.formatBytes(item.bytes.length)+'</span></div>'+ 
          '<button class="btn ghost" data-remove="'+item.id+'">Kaldır</button>'+ 
        '</div>'+ 
        '<div class="field"><label>Açıklama</label><input type="text" data-field="description" data-id="'+item.id+'" value="'+PP.utils.escapeHtml(item.description)+'" placeholder="Opsiyonel açıklama"></div>'+ 
        '<div class="file-options">'+
          '<label class="check"><input type="checkbox" data-field="showName" data-id="'+item.id+'" '+(item.showName?'checked':'')+'> Dosya adını göster</label>'+ 
          '<label class="check"><input type="checkbox" data-field="showDescription" data-id="'+item.id+'" '+(item.showDescription?'checked':'')+'> Açıklamayı göster</label>'+ 
          '<label class="check"><input type="checkbox" data-field="showTech" data-id="'+item.id+'" '+(item.showTech?'checked':'')+'> Teknik bilgi göster</label>'+ 
          '<div class="field" style="margin:0"><label>Şifre</label><select data-field="passwordMode" data-id="'+item.id+'"><option value="none">Şifresiz</option><option value="global">Genel şifreyi kullan</option><option value="custom">Bu dosyaya özel</option></select></div>'+ 
        '</div>'+ 
        '<div class="field custom-pw '+(item.passwordMode==='custom'?'':'hidden')+'"><label>Özel şifre</label><input type="password" data-field="customPassword" data-id="'+item.id+'" value="'+PP.utils.escapeHtml(item.customPassword)+'" autocomplete="new-password"></div>';
      box.appendChild(card);
      card.querySelector('[data-field="passwordMode"]').value = item.passwordMode;
    });
  }
  function findItem(id){ return PP.state.items.find(function(x){ return x.id === id; }); }
  function wireFileList(){
    $('fileList').addEventListener('click', function(e){
      var id = e.target.getAttribute('data-remove');
      if(id){ PP.state.removeItem(id); renderFileList(); }
    });
    $('fileList').addEventListener('input', function(e){
      var id = e.target.getAttribute('data-id');
      var field = e.target.getAttribute('data-field');
      if(!id || !field) return;
      var item = findItem(id); if(!item) return;
      if(e.target.type === 'text' || e.target.type === 'password') { item[field] = e.target.value; resetOutput(); }
    });
    $('fileList').addEventListener('change', function(e){
      var id = e.target.getAttribute('data-id');
      var field = e.target.getAttribute('data-field');
      if(!id || !field) return;
      var item = findItem(id); if(!item) return;
      if(e.target.type === 'checkbox') item[field] = e.target.checked;
      else item[field] = e.target.value;
      resetOutput();
      renderFileList();
    });
  }
  async function addFiles(files){
    PP.utils.clearStatus($('createStatus'));
    for(var i=0;i<files.length;i++){
      if(PP.state.items.length >= PP.config.maxFiles){ PP.utils.logStatus($('createStatus'), '9 dosya sınırına ulaşıldı. Kalan dosyalar eklenmedi.', 'warn'); break; }
      var f = files[i];
      var ab = await f.arrayBuffer();
      PP.state.addItem({ name: f.name, mime: PP.utils.inferMime(f.name, f.type), bytes: new Uint8Array(ab) });
    }
    renderFileList();
  }
  function addManual(){
    var name = $('manualName').value.trim() || 'manuel.txt';
    var mime = $('manualMime').value || PP.utils.inferMime(name);
    var text = $('manualText').value || '';
    try{ PP.state.addItem({ name:name, mime:mime, bytes:PP.utils.textToBytes(text) }); renderFileList(); }
    catch(err){ PP.utils.logStatus($('createStatus'), err.message, 'err'); }
  }
  function rawModulePx(gridSize){ return Math.max(3, Math.floor(1280 / (gridSize + PP.config.quietModules*2))); }
  function renderPreviewPages(a4){
    var extra = $('extraPages');
    if(!extra) return;
    extra.innerHTML = '';
    if(!a4 || !a4.canvases || a4.canvases.length <= 1) return;
    for(var i=1;i<a4.canvases.length;i++){
      var note = document.createElement('div');
      note.className = 'page-note';
      note.textContent = 'A4 sayfa ' + (i+1) + '/' + a4.canvases.length;
      var c = document.createElement('canvas');
      c.width = a4.canvases[i].width;
      c.height = a4.canvases[i].height;
      c.getContext('2d').drawImage(a4.canvases[i], 0, 0);
      extra.appendChild(note);
      extra.appendChild(c);
    }
  }
  async function generate(){
    var status = $('createStatus'); PP.utils.clearStatus(status); resetOutput();
    if(!PP.state.items.length){ PP.utils.logStatus(status, 'Önce dosya veya manuel metin ekleyin.', 'warn'); return; }
    var settings = getSettings();
    if(!settings.showFrame) PP.utils.logStatus(status, 'Siyah çerçeve kapalı. Otomatik telefon okuması belirgin şekilde zorlaşabilir.', 'warn');
    if(settings.globalPassword){
      var score = PP.cryptoBox.passwordScore(settings.globalPassword);
      if(score.level === 'weak') PP.utils.logStatus(status, score.text, 'warn');
    }
    try{
      PP.utils.logStatus(status, 'paketler hazırlanıyor');
      var prepared = [];
      var logicalCount = PP.state.items.length;
      for(var i=0;i<PP.state.items.length;i++){
        var item = PP.state.items[i];
        var password = item.passwordMode === 'custom' ? item.customPassword : (item.passwordMode === 'global' ? settings.globalPassword : '');
        if(password){
          var s = PP.cryptoBox.passwordScore(password);
          if(s.level === 'weak') PP.utils.logStatus(status, item.name + ': zayıf şifre kullanılıyor. A4 ele geçirilirse offline parola denemesi yapılabilir.', 'warn');
        }
        var pkg = await PP.encoder.makePackage(item, settings);
        PP.utils.logStatus(status, item.name + ': ' + pkg.note + ' · paket ' + PP.utils.formatBytes(pkg.envelope.length));
        var transports = PP.encoder.makeTransportPackages(pkg.envelope, settings);
        if(transports.length > 1){
          PP.utils.logStatus(status, item.name + ': tek kareye sığmadı, otomatik ' + transports.length + ' parçaya bölündü. Boş doldurma karesi üretilmedi.', 'warn');
        }
        for(var t=0;t<transports.length;t++){
          var tr = transports[t];
          var matrix = PP.encoder.createMatrix(tr.bytes, tr.gridSize, settings.showFrame);
          var rawCanvas = PP.renderer.drawMatrixToCanvas(matrix.matrix, matrix.gridSize, rawModulePx(matrix.gridSize));
          PP.tests.verifyRawSquare(rawCanvas, tr.bytes, matrix.gridSize);
          prepared.push({ source:item, pkg:pkg, transport:tr, matrix:matrix, rawCanvas:rawCanvas });
          var label = tr.type === 'chunk' ? ('parça ' + tr.index + '/' + tr.total) : 'tek kare';
          PP.utils.logStatus(status, item.name + ': ' + label + ' ham iç test başarılı · grid ' + matrix.gridSize + ' · ' + PP.utils.formatBytes(tr.bytes.length) + ' / ' + PP.utils.formatBytes(matrix.capacity), 'ok');
        }
      }
      if(prepared.length > logicalCount) PP.utils.logStatus(status, 'Toplam ' + logicalCount + ' dosya için ' + prepared.length + ' veri karesi oluştu. Çok parçalı dosyada okurken tüm parçaların okutulması gerekir.', 'warn');
      if(prepared.length > 9) PP.utils.logStatus(status, prepared.length + ' veri karesi 9’dan fazla olduğu için çıktı ' + Math.ceil(prepared.length/9) + ' A4 sayfasına bölünecek.', 'warn');
      if(prepared.some(function(p){ return p.matrix.gridSize >= 289; })) PP.utils.logStatus(status, 'Ultra yoğun grid kullanılıyor. PNG okuyabilir ama telefon kamerası için net baskı, iyi ışık ve yakın çekim gerekir.', 'warn');
      if(prepared.length > 18) PP.utils.logStatus(status, 'Çok fazla veri karesi oluştu. Sistem çıktı verebilir; fakat kamerayla okutma pratik olmayabilir. Daha küçük dosya veya daha yüksek yoğunluk daha mantıklı olabilir.', 'warn');

      PP.utils.logStatus(status, 'A4 sayfası çiziliyor');
      var a4 = PP.renderer.makeA4(prepared, settings);
      renderPreviewPages(a4);
      $('outputPanel').classList.remove('hidden');
      $('testStatus').textContent = 'A4 otomatik okuma iç testi çalışıyor...';
      PP.utils.logStatus(status, 'A4 üzerindeki kareler uygulama içinde tekrar okunuyor');
      var autoRes = PP.tests.verifyA4PagesByPlacements(a4, function(msg){ PP.utils.logStatus(status, msg); });
      $('testStatus').textContent = 'İç test başarılı: ham kareler ve A4 çıktısı tekrar okunabiliyor. Okunan veri karesi: ' + autoRes.results.length + '/' + prepared.length + (a4.canvases.length > 1 ? ' · sayfa: ' + a4.canvases.length : '');
      $('testStatus').className = 'muted strong';
      $('downloadPngBtn').disabled = false; $('downloadSvgBtn').disabled = false; $('printBtn').disabled = false;
      renderSquareDownloads(prepared, a4);
      PP.state.generated = { settings:settings, items:prepared, a4:a4, auto:autoRes };
      PP.utils.logStatus(status, 'Çıktı hazır. PNG/SVG/yazdırma butonları açıldı.', 'ok');
    }catch(err){
      $('testStatus').textContent = 'İç test başarısız. Çıktı butonları kapalı.';
      $('testStatus').className = 'muted weak';
      PP.utils.logStatus(status, err.message, 'err');
      console.error(err);
    }
  }
  function renderSquareDownloads(prepared, a4){
    var box = $('squareDownloads'); box.innerHTML = '';
    if(a4 && a4.canvases && a4.canvases.length > 1){
      a4.canvases.forEach(function(canvas, i){
        var pageBtn = document.createElement('button'); pageBtn.className = 'btn'; pageBtn.textContent = 'A4 sayfa ' + (i+1) + ' PNG indir';
        pageBtn.addEventListener('click', async function(){
          var blob = await PP.utils.canvasToBlob(canvas, 'image/png');
          PP.utils.downloadBlob(blob, 'paperpack-a4-sayfa-' + String(i+1).padStart(2,'0') + '.png');
        });
        box.appendChild(pageBtn);
      });
    }
    prepared.forEach(function(p, i){
      var btn = document.createElement('button'); btn.className = 'btn';
      btn.textContent = 'Kare PNG indir · ' + (i+1) + (p.transport && p.transport.type === 'chunk' ? ' / parça ' + p.transport.index + '-' + p.transport.total : '');
      btn.addEventListener('click', async function(){
        var blob = await PP.utils.canvasToBlob(p.rawCanvas, 'image/png');
        PP.utils.downloadBlob(blob, 'paperpack-kare-' + String(i+1).padStart(2,'0') + '.png');
      });
      box.appendChild(btn);
    });
  }
  async function downloadPng(){
    if(!PP.state.generated) return;
    var canvases = PP.state.generated.a4.canvases || [PP.state.generated.a4.canvas];
    for(var i=0;i<canvases.length;i++){
      var blob = await PP.utils.canvasToBlob(canvases[i], 'image/png');
      var name = canvases.length === 1 ? PP.utils.nowName('paperpack-a4','png') : 'paperpack-a4-sayfa-' + String(i+1).padStart(2,'0') + '.png';
      PP.utils.downloadBlob(blob, name);
      if(canvases.length > 1) await PP.utils.sleep(220);
    }
  }
  function downloadSvg(){
    if(!PP.state.generated) return;
    var canvases = PP.state.generated.a4.canvases || [PP.state.generated.a4.canvas];
    var svg = PP.renderer.makeSvgPages(canvases);
    PP.utils.downloadBlob(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}), PP.utils.nowName('paperpack-a4','svg'));
  }
  function printA4(){
    if(!PP.state.generated) return;
    var canvases = PP.state.generated.a4.canvases || [PP.state.generated.a4.canvas];
    var imgs = canvases.map(function(c){ return '<img src="'+c.toDataURL('image/png')+'" alt="PaperPack A4">'; }).join('');
    var w = window.open('', '_blank');
    if(!w){ alert('Pop-up engellendi. Yazdırma için tarayıcıda pop-up izni verin.'); return; }
    w.document.write('<!doctype html><html><head><title>PaperPack Yazdır</title><style>@page{size:A4;margin:0}body{margin:0;background:#fff}img{width:210mm;height:297mm;display:block;break-after:page;page-break-after:always}</style></head><body>'+imgs+'</body></html>');
    w.document.close();
    setTimeout(function(){ w.focus(); w.print(); }, 400);
  }
  function renderDecodedFileCard(box, parsed, gridSize, note){
    var card = document.createElement('div'); card.className='result-card';
    var title = parsed.name || 'paperpack-dosya.txt';
    card.innerHTML = '<h3>'+PP.utils.escapeHtml(title)+'</h3>'+ 
      '<div class="result-meta">'+PP.utils.escapeHtml(parsed.mime)+' · '+PP.utils.formatBytes(parsed.originalSize)+' · grid '+(gridSize || '-')+(parsed.encrypted?' · şifreli':' · şifresiz')+(parsed.compressed?' · sıkıştırılmış':'')+'</div>'+ 
      (note ? '<p class="muted">'+PP.utils.escapeHtml(note)+'</p>' : '')+
      (parsed.description ? '<p>'+PP.utils.escapeHtml(parsed.description)+'</p>' : '')+
      (parsed.encrypted ? '<div class="field"><label>Şifre</label><input type="password" class="result-password" autocomplete="current-password" placeholder="Şifreyi gir"></div>' : '')+
      '<div class="result-actions"><button class="btn primary open-btn">Aç</button><button class="btn save-btn">Dosya indir</button></div><div class="status mini-status"></div>';
    box.appendChild(card);
    var mini = card.querySelector('.mini-status');
    async function getFile(){
      var pwInput = card.querySelector('.result-password');
      var pw = pwInput ? pwInput.value : '';
      return PP.encoder.openDecodedFile(parsed, pw);
    }
    card.querySelector('.open-btn').addEventListener('click', async function(){
      mini.innerHTML='';
      try{
        var file = await getFile();
        var blob = new Blob([file.bytes], {type:file.mime || 'text/plain'});
        var url = URL.createObjectURL(blob);
        var opened = window.open(url, '_blank');
        if(!opened){ PP.utils.logStatus(mini, 'Pop-up engellendi. Açma işlemi kullanıcı butonuna bağlı olduğu halde tarayıcı engelledi.', 'warn'); }
        setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
      }catch(err){ PP.utils.logStatus(mini, err.message || 'Şifre hatalı veya veri bozuk.', 'err'); }
    });
    card.querySelector('.save-btn').addEventListener('click', async function(){
      mini.innerHTML='';
      try{
        var file = await getFile();
        PP.utils.downloadBlob(new Blob([file.bytes], {type:file.mime || 'application/octet-stream'}), file.name || 'paperpack-dosya.txt');
      }catch(err){ PP.utils.logStatus(mini, err.message || 'Şifre hatalı veya veri bozuk.', 'err'); }
    });
  }
  function storeChunk(chunk){
    if(!PP.state.chunkStore[chunk.id]) PP.state.chunkStore[chunk.id] = { total:chunk.total, chunks:{}, lastGrid:null };
    var slot = PP.state.chunkStore[chunk.id];
    slot.total = chunk.total;
    slot.chunks[chunk.index] = chunk;
    return slot;
  }
  function chunkArray(slot){
    var arr = [];
    for(var k in slot.chunks){ if(Object.prototype.hasOwnProperty.call(slot.chunks,k)) arr.push(slot.chunks[k]); }
    arr.sort(function(a,b){ return a.index-b.index; });
    return arr;
  }
  function renderReadResults(packages){
    var box = $('readResults');
    if(!packages.length){ box.className='read-results empty'; box.textContent='Paket okunamadı.'; return; }
    box.className = 'read-results'; box.innerHTML = '';
    var directCount = 0, completed = {}, progress = [];
    packages.forEach(function(pkg, idx){
      var transport;
      try{ transport = PP.encoder.parseTransportPackage(pkg.packageBytes); }
      catch(err){
        var bad = document.createElement('div'); bad.className='result-card'; bad.textContent='Paket başlığı okunamadı: ' + err.message; box.appendChild(bad); return;
      }
      if(transport.type === 'file'){
        try{ renderDecodedFileCard(box, PP.encoder.parseEnvelope(transport.envelopeBytes), pkg.gridSize, 'Tek kareden okundu.'); directCount++; }
        catch(err2){ var bad2 = document.createElement('div'); bad2.className='result-card'; bad2.textContent='Dosya paketi okunamadı: ' + err2.message; box.appendChild(bad2); }
        return;
      }
      var slot = storeChunk(transport);
      slot.lastGrid = pkg.gridSize;
      var arr = chunkArray(slot);
      if(arr.length === slot.total){
        try{
          var envelope = PP.encoder.assembleChunks(arr);
          var parsed = PP.encoder.parseEnvelope(envelope);
          completed[transport.id] = true;
          renderDecodedFileCard(box, parsed, pkg.gridSize, 'Parçalı dosya tamamlandı: ' + arr.length + '/' + slot.total + ' parça.');
        }catch(err3){
          var bad3 = document.createElement('div'); bad3.className='result-card'; bad3.textContent='Parçalar birleştirilemedi: ' + err3.message; box.appendChild(bad3);
        }
      }else{
        progress.push({ id:transport.id, count:arr.length, total:slot.total });
      }
    });
    Object.keys(PP.state.chunkStore).forEach(function(id){
      if(completed[id]) return;
      var slot = PP.state.chunkStore[id];
      var arr = chunkArray(slot);
      if(!arr.length) return;
      if(arr.length === slot.total){
        try{
          var envelope = PP.encoder.assembleChunks(arr);
          var parsed = PP.encoder.parseEnvelope(envelope);
          completed[id] = true;
          renderDecodedFileCard(box, parsed, slot.lastGrid || '-', 'Parçalı dosya tamamlandı: ' + arr.length + '/' + slot.total + ' parça.');
        }catch(err4){
          var bad4 = document.createElement('div'); bad4.className='result-card'; bad4.textContent='Parçalar birleştirilemedi: ' + err4.message; box.appendChild(bad4);
        }
      }else if(!progress.some(function(p){ return p.id === id; })){
        progress.push({ id:id, count:arr.length, total:slot.total });
      }
    });
    progress.forEach(function(p){
      var card = document.createElement('div'); card.className = 'result-card';
      card.innerHTML = '<h3>Parçalı dosya bekleniyor</h3><div class="result-meta">'+PP.utils.escapeHtml(p.id)+' · '+p.count+'/'+p.total+' parça okundu</div><p class="muted">Bu dosya için eksik A4 sayfasını veya eksik kareleri de okut. Tamamlanınca açma/indirme butonları burada çıkacak.</p>';
      box.appendChild(card);
    });
    if(!directCount && !Object.keys(completed).length && !progress.length){ box.className='read-results empty'; box.textContent='Paket okunamadı.'; }
  }
  function drawReaderPreview(canvas){
    var out = $('readerCanvas');
    var maxW = 900;
    var scale = Math.min(1, maxW / canvas.width);
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    var ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    out.dataset.scale = String(scale);
    $('readerPreview').classList.remove('hidden');
  }
  async function loadReadImage(file){
    PP.utils.clearStatus($('readStatus'));
    try{
      var canvas = await PP.reader.loadImageFileToCanvas(file, 2600);
      PP.state.readImageCanvas = canvas;
      drawReaderPreview(canvas);
      $('readBtn').disabled = false; $('manualModeBtn').disabled = false;
      manualPoints = [];
      PP.utils.logStatus($('readStatus'), 'Görsel yüklendi: ' + canvas.width + '×' + canvas.height + ' px', 'ok');
    }catch(err){ PP.utils.logStatus($('readStatus'), err.message, 'err'); }
  }
  async function readAuto(){
    var status = $('readStatus'); PP.utils.clearStatus(status);
    $('readResults').className='read-results empty'; $('readResults').textContent='Okunuyor...';
    try{
      var res = await PP.decoder.decodeCanvasAuto(PP.state.readImageCanvas, function(msg){ PP.utils.logStatus(status, msg); });
      if(!res.results.length){
        var msg = PP.reader.explainFailure(res);
        PP.utils.logStatus(status, msg, 'err');
        $('readResults').className='read-results empty'; $('readResults').textContent=msg;
        return;
      }
      PP.utils.logStatus(status, 'Okuma tamamlandı. Veri karesi sayısı: ' + res.results.length, 'ok');
      renderReadResults(res.results);
    }catch(err){
      PP.utils.logStatus(status, err.message, 'err');
      $('readResults').className='read-results empty'; $('readResults').textContent=err.message;
    }
  }
  function startManualMode(){
    manualPoints = [];
    PP.utils.clearStatus($('readStatus'));
    PP.utils.logStatus($('readStatus'), '4 köşe seçme modu: sol üst, sağ üst, sağ alt, sol alt sırasıyla tıklayın.', 'warn');
    drawReaderPreview(PP.state.readImageCanvas);
  }
  function onManualCanvasClick(e){
    if(!PP.state.readImageCanvas) return;
    if(!manualPoints) manualPoints=[];
    var rect = $('readerCanvas').getBoundingClientRect();
    var scale = parseFloat($('readerCanvas').dataset.scale || '1');
    var x = (e.clientX - rect.left) / scale;
    var y = (e.clientY - rect.top) / scale;
    manualPoints.push({x:x,y:y});
    var c = $('readerCanvas'), ctx = c.getContext('2d');
    ctx.fillStyle = '#e11d48'; ctx.beginPath();
    ctx.arc((e.clientX - rect.left), (e.clientY - rect.top), 6, 0, Math.PI*2); ctx.fill();
    ctx.font = '700 18px Arial'; ctx.fillText(String(manualPoints.length), (e.clientX - rect.left)+8, (e.clientY - rect.top)+8);
    if(manualPoints.length === 4){
      try{
        var res = PP.decoder.decodeManual(PP.state.readImageCanvas, manualPoints);
        PP.utils.logStatus($('readStatus'), 'Manuel köşe seçimiyle paket okundu.', 'ok');
        renderReadResults([res]);
      }catch(err){ PP.utils.logStatus($('readStatus'), err.message + ' Köşeleri tam dış çerçevenin üzerinden seçmeyi deneyin.', 'err'); }
      manualPoints = [];
    }
  }
  function wireTabs(){
    document.querySelectorAll('.tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
        btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
      });
    });
  }
  function init(){
    wireTabs(); wireFileList(); loadMode(); updateCapacityHint(); updatePasswordHint();
    $('appMode').addEventListener('change', function(){ saveMode(); applyModeDefaults(true); });
    $('densitySelect').addEventListener('change', function(){ updateCapacityHint(); resetOutput(); });
    $('globalPassword').addEventListener('input', function(){ updatePasswordHint(); resetOutput(); });
    $('fileInput').addEventListener('change', function(e){ addFiles(e.target.files); e.target.value=''; });
    $('addManualBtn').addEventListener('click', addManual);
    ['pageMode','showFrame','includeReaderLink','readerLink','useCompression'].forEach(function(id){ $(id).addEventListener('change', resetOutput); });
    $('generateBtn').addEventListener('click', generate);
    $('clearBtn').addEventListener('click', function(){ PP.state.clear(); renderFileList(); PP.utils.clearStatus($('createStatus')); });
    $('downloadPngBtn').addEventListener('click', downloadPng);
    $('downloadSvgBtn').addEventListener('click', downloadSvg);
    $('printBtn').addEventListener('click', printA4);
    $('readImageInput').addEventListener('change', function(e){ if(e.target.files && e.target.files[0]) loadReadImage(e.target.files[0]); });
    $('readBtn').addEventListener('click', readAuto);
    $('manualModeBtn').addEventListener('click', startManualMode);
    $('readerCanvas').addEventListener('click', onManualCanvasClick);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
