(function(){
  'use strict';
  var PP = window.PP = window.PP || {};

  function sampleGray(data, w, h, x, y){
    var ix = Math.round(PP.utils.clamp(x, 0, w-1));
    var iy = Math.round(PP.utils.clamp(y, 0, h-1));
    var o = (iy*w + ix)*4;
    return 0.2126*data[o] + 0.7152*data[o+1] + 0.0722*data[o+2];
  }
  function otsu(gray){
    var hist = new Uint32Array(256), i;
    for(i=0;i<gray.length;i++) hist[gray[i]]++;
    var total = gray.length, sum = 0;
    for(i=0;i<256;i++) sum += i * hist[i];
    var sumB=0,wB=0,max=0,threshold=128;
    for(i=0;i<256;i++){
      wB += hist[i]; if(wB===0) continue;
      var wF = total - wB; if(wF===0) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if(between > max){ max = between; threshold = i; }
    }
    return threshold;
  }
  function downscaleCanvas(canvas, maxDim){
    var scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
    if(scale >= 1) return { canvas: canvas, scale: 1 };
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(canvas.width * scale));
    c.height = Math.max(1, Math.round(canvas.height * scale));
    var ctx = c.getContext('2d', { willReadFrequently:true });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return { canvas: c, scale: scale };
  }
  function canvasToGray(canvas){
    var ctx = canvas.getContext('2d', { willReadFrequently:true });
    var img = ctx.getImageData(0,0,canvas.width,canvas.height);
    var src = img.data, gray = new Uint8Array(canvas.width*canvas.height);
    for(var i=0,p=0;i<src.length;i+=4,p++) gray[p] = Math.round(0.2126*src[i] + 0.7152*src[i+1] + 0.0722*src[i+2]);
    return { gray: gray, imageData: img };
  }
  function findComponents(gray, w, h, threshold){
    var total = w*h;
    var visited = new Uint8Array(total);
    var queue = new Int32Array(total);
    var candidates = [];
    var minDim = Math.max(42, Math.floor(Math.min(w,h)*0.035));
    var minArea = Math.max(80, Math.floor(total*0.00006));
    for(var start=0; start<total; start++){
      if(visited[start] || gray[start] > threshold) continue;
      var head=0, tail=0;
      queue[tail++] = start; visited[start]=1;
      var count=0, minX=w, minY=h, maxX=0, maxY=0;
      var tl={x:w,y:h}, tr={x:0,y:h}, br={x:0,y:0}, bl={x:w,y:0};
      while(head<tail){
        var idx = queue[head++]; count++;
        var y = (idx / w) | 0, x = idx - y*w;
        if(x<minX) minX=x; if(x>maxX) maxX=x; if(y<minY) minY=y; if(y>maxY) maxY=y;
        var s=x+y, d=x-y;
        if(s < tl.x+tl.y) tl={x:x,y:y};
        if(d > tr.x-tr.y) tr={x:x,y:y};
        if(s > br.x+br.y) br={x:x,y:y};
        if(d < bl.x-bl.y) bl={x:x,y:y};
        var n;
        if(x>0){ n=idx-1; if(!visited[n] && gray[n] <= threshold){ visited[n]=1; queue[tail++]=n; } }
        if(x<w-1){ n=idx+1; if(!visited[n] && gray[n] <= threshold){ visited[n]=1; queue[tail++]=n; } }
        if(y>0){ n=idx-w; if(!visited[n] && gray[n] <= threshold){ visited[n]=1; queue[tail++]=n; } }
        if(y<h-1){ n=idx+w; if(!visited[n] && gray[n] <= threshold){ visited[n]=1; queue[tail++]=n; } }
      }
      var bw=maxX-minX+1, bh=maxY-minY+1, boxArea=bw*bh;
      if(count < minArea || bw < minDim || bh < minDim) continue;
      var aspect=bw/bh, fill=count/boxArea;
      if(aspect < .45 || aspect > 2.2) continue;
      if(fill < .012 || fill > .72) continue;
      var corners = PP.perspective.orderCorners([tl,tr,br,bl]);
      var polyArea = PP.perspective.polygonArea(corners);
      if(polyArea < minDim*minDim*.35) continue;
      candidates.push({ x:minX, y:minY, w:bw, h:bh, area:count, fill:fill, corners:corners, score:bw*bh });
    }
    candidates.sort(function(a,b){ return b.score - a.score; });
    return candidates.slice(0, PP.config.maxDecodeCandidates);
  }
  function sampleMatrixFromQuad(imageData, corners, gridSize, threshold){
    var data = imageData.data, w = imageData.width, h = imageData.height;
    var matrix = new Uint8Array(gridSize*gridSize);
    for(var y=0;y<gridSize;y++){
      for(var x=0;x<gridSize;x++){
        var u = (x + .5) / gridSize;
        var v = (y + .5) / gridSize;
        var p = PP.perspective.mapUnitToQuad(corners, u, v);
        matrix[y*gridSize+x] = sampleGray(data, w, h, p.x, p.y) <= threshold ? 1 : 0;
      }
    }
    return matrix;
  }
  function decodeKnownSquare(canvas, gridSize){
    var q = PP.config.quietModules;
    var ctx = canvas.getContext('2d', { willReadFrequently:true });
    var img = ctx.getImageData(0,0,canvas.width,canvas.height);
    var data = img.data;
    var samples = [];
    var totalModules = gridSize + q*2;
    for(var y=0;y<gridSize;y++){
      for(var x=0;x<gridSize;x++){
        var px = ((q + x + .5) / totalModules) * canvas.width;
        var py = ((q + y + .5) / totalModules) * canvas.height;
        samples.push(sampleGray(data, canvas.width, canvas.height, px, py));
      }
    }
    var gray = new Uint8Array(samples.length);
    for(var i=0;i<samples.length;i++) gray[i]=Math.round(samples[i]);
    var th = otsu(gray);
    var matrix = new Uint8Array(gridSize*gridSize);
    for(var j=0;j<samples.length;j++) matrix[j] = samples[j] <= th ? 1 : 0;
    return PP.encoder.decodeMatrixAnyRotation(matrix, gridSize).packageBytes;
  }

  PP.decoder = {
    otsu: otsu,
    downscaleCanvas: downscaleCanvas,
    decodeKnownSquare: decodeKnownSquare,
    tryDecodeImageData: function(imageData, corners, gridSize, thresholds){
      var lastErr = null;
      for(var i=0;i<thresholds.length;i++){
        var matrix = sampleMatrixFromQuad(imageData, corners, gridSize, thresholds[i]);
        try{ return PP.encoder.decodeMatrixAnyRotation(matrix, gridSize); }
        catch(err){ lastErr = err; }
      }
      throw lastErr || new Error('Bu aday kare okunamadı.');
    },
    tryDecodeQuad: function(canvas, corners, gridSize, thresholds){
      var ctx = canvas.getContext('2d', { willReadFrequently:true });
      var img = ctx.getImageData(0,0,canvas.width,canvas.height);
      return this.tryDecodeImageData(img, corners, gridSize, thresholds);
    },
    findCandidates: function(canvas){
      var cg = canvasToGray(canvas);
      var th = otsu(cg.gray);
      var thresholds = [th, Math.max(70, th-25), Math.min(210, th+25), 128, 160, 100];
      var all = [];
      for(var i=0;i<Math.min(3,thresholds.length);i++){
        var comps = findComponents(cg.gray, canvas.width, canvas.height, thresholds[i]);
        for(var j=0;j<comps.length;j++) all.push(comps[j]);
      }
      // Basit tekrar temizliği: merkezleri çok yakın olanları ele.
      var unique = [];
      for(var k=0;k<all.length;k++){
        var c=all[k], cx=c.x+c.w/2, cy=c.y+c.h/2, duplicate=false;
        for(var u=0;u<unique.length;u++){
          var e=unique[u], ex=e.x+e.w/2, ey=e.y+e.h/2;
          if(Math.abs(cx-ex)<Math.min(c.w,e.w)*.2 && Math.abs(cy-ey)<Math.min(c.h,e.h)*.2){ duplicate=true; break; }
        }
        if(!duplicate) unique.push(c);
      }
      unique.sort(function(a,b){ return b.score-a.score; });
      return { candidates: unique.slice(0, PP.config.maxDecodeCandidates), threshold: th };
    },
    decodeCanvasAuto: async function(canvas, onStatus){
      var prep = downscaleCanvas(canvas, 1600);
      var work = prep.canvas;
      if(onStatus) onStatus('görsel hazırlanıyor · ' + work.width + '×' + work.height + ' px');
      await PP.utils.sleep(20);
      var found = this.findCandidates(work);
      var candidates = found.candidates;
      if(onStatus) onStatus('veri karesi aranıyor · ' + candidates.length + ' aday bulundu');
      await PP.utils.sleep(20);
      var grids = PP.config.densities.slice().sort(function(a,b){ return b-a; });
      var thresholds = [found.threshold, Math.max(60,found.threshold-30), Math.min(220,found.threshold+30), 128, 155, 100, 185];
      var results = [], seen = {}, errors = [];
      for(var i=0;i<candidates.length;i++){
        var cand = candidates[i];
        for(var g=0;g<grids.length;g++){
          try{
            var res = this.tryDecodeQuad(work, cand.corners, grids[g], thresholds);
            var crc = PP.crc32(res.packageBytes).toString(16) + ':' + res.packageBytes.length;
            if(!seen[crc]){
              seen[crc] = true;
              results.push({ packageBytes: res.packageBytes, gridSize: grids[g], candidate: cand, rotation: res.rotation });
              if(onStatus) onStatus('paket okundu · grid ' + grids[g]);
            }
            break;
          }catch(err){ if(errors.length < 5) errors.push(err.message); }
        }
      }
      if(!results.length){
        // Son çare: görselin tamamını kare varsayarak dene. PNG doğrudan kare olarak yüklenirse işe yarar.
        var full = [{x:0,y:0},{x:work.width-1,y:0},{x:work.width-1,y:work.height-1},{x:0,y:work.height-1}];
        for(var fg=0;fg<grids.length;fg++){
          try{
            var r = this.tryDecodeQuad(work, full, grids[fg], thresholds);
            results.push({ packageBytes:r.packageBytes, gridSize:grids[fg], candidate:null, rotation:r.rotation });
            break;
          }catch(e){}
        }
      }
      return { results: results, candidates: candidates, errors: errors, workCanvas: work };
    },
    decodeManual: function(canvas, points){
      var ordered = PP.perspective.orderCorners(points);
      var cg = canvasToGray(canvas);
      var th = otsu(cg.gray);
      var thresholds = [th, Math.max(60,th-30), Math.min(220,th+30), 128, 155, 100, 185];
      var grids = PP.config.densities.slice().sort(function(a,b){ return b-a; });
      var lastErr = null;
      for(var i=0;i<grids.length;i++){
        try{
          var res = this.tryDecodeQuad(canvas, ordered, grids[i], thresholds);
          return { packageBytes: res.packageBytes, gridSize: grids[i], rotation: res.rotation };
        }catch(err){ lastErr = err; }
      }
      throw lastErr || new Error('Seçilen köşelerden veri okunamadı.');
    }
  };
})();
