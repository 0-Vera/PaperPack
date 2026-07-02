(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  function drawMatrix(ctx, matrix, gridSize, x, y, size){
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#000';
    var cell = size / gridSize;
    for(var yy=0; yy<gridSize; yy++){
      for(var xx=0; xx<gridSize; xx++){
        if(matrix[yy*gridSize+xx]){
          ctx.fillRect(x + xx*cell, y + yy*cell, Math.ceil(cell)+0.25, Math.ceil(cell)+0.25);
        }
      }
    }
    ctx.restore();
  }
  function drawMatrixToCanvas(matrix, gridSize, modulePx){
    modulePx = modulePx || 4;
    var q = PP.config.quietModules;
    var total = gridSize + q*2;
    var canvas = document.createElement('canvas');
    canvas.width = total * modulePx;
    canvas.height = total * modulePx;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    drawMatrix(ctx, matrix, gridSize, q*modulePx, q*modulePx, gridSize*modulePx);
    return canvas;
  }
  function layoutForCount(count){
    if(count <= 1) return { cols:1, rows:1 };
    if(count === 2) return { cols:1, rows:2 };
    if(count <= 4) return { cols:2, rows:2 };
    if(count <= 6) return { cols:2, rows:3 };
    return { cols:3, rows:3 };
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
    text = String(text || '').trim();
    if(!text) return y;
    var words = text.split(/\s+/), line = '', lines = [];
    for(var i=0;i<words.length;i++){
      var test = line ? line + ' ' + words[i] : words[i];
      if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = words[i]; }
      else line = test;
    }
    if(line) lines.push(line);
    if(maxLines && lines.length > maxLines){ lines = lines.slice(0,maxLines); lines[lines.length-1] += '…'; }
    for(var j=0;j<lines.length;j++){ ctx.fillText(lines[j], x, y); y += lineHeight; }
    return y;
  }
  PP.renderer = {
    drawMatrix: drawMatrix,
    drawMatrixToCanvas: drawMatrixToCanvas,
    layoutForCount: layoutForCount,
    makeA4: function(items, settings){
      var canvas = document.getElementById('a4Canvas') || document.createElement('canvas');
      canvas.width = PP.config.a4.width; canvas.height = PP.config.a4.height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#101828'; ctx.textBaseline = 'top';
      var margin = 120;
      var top = margin;
      if(settings.pageMode === 'full' || settings.includeReaderLink){
        ctx.font = '700 52px Arial, sans-serif';
        ctx.fillText('PaperPack', margin, 70);
        ctx.font = '28px Arial, sans-serif';
        ctx.fillStyle = '#475467';
        var link = settings.includeReaderLink ? (settings.readerLink || PP.config.readerLinkDefault) : '';
        if(link) ctx.fillText('Okuyucu: ' + link, margin, 132);
        top = 205;
      }else if(settings.pageMode === 'title-desc'){
        ctx.font = '700 44px Arial, sans-serif';
        ctx.fillText('PaperPack veri çıktısı', margin, 82);
        top = 170;
      }
      var layout = layoutForCount(items.length);
      var gap = 50;
      var usableW = canvas.width - margin*2;
      var usableH = canvas.height - top - margin;
      var cellW = (usableW - gap*(layout.cols-1)) / layout.cols;
      var cellH = (usableH - gap*(layout.rows-1)) / layout.rows;
      var placements = [];
      for(var i=0;i<items.length;i++){
        var col = i % layout.cols;
        var row = Math.floor(i / layout.cols);
        var x = margin + col*(cellW+gap);
        var y = top + row*(cellH+gap);
        var metaH = 0;
        var item = items[i];
        var showName = item.source.showName && (settings.pageMode === 'title-desc' || settings.pageMode === 'full');
        var showDesc = item.source.showDescription && item.source.description && (settings.pageMode === 'desc' || settings.pageMode === 'title-desc' || settings.pageMode === 'full');
        var showTech = item.source.showTech && settings.pageMode === 'full';
        if(showName) metaH += 44;
        if(showDesc) metaH += 66;
        if(showTech) metaH += 40;
        var squareSize = Math.min(cellW, cellH - metaH - 8);
        if(squareSize < 160) squareSize = Math.min(cellW, cellH);
        var sx = x + (cellW - squareSize)/2;
        var sy = y;
        drawMatrix(ctx, item.matrix.matrix, item.matrix.gridSize, sx, sy, squareSize);
        var ty = sy + squareSize + 18;
        ctx.fillStyle = '#101828';
        if(showName){ ctx.font = '700 27px Arial, sans-serif'; ty = wrapText(ctx, item.source.name, x, ty, cellW, 34, 1); }
        if(showDesc){ ctx.fillStyle = '#475467'; ctx.font = '23px Arial, sans-serif'; ty = wrapText(ctx, item.source.description, x, ty + 2, cellW, 29, 2); }
        if(showTech){
          ctx.fillStyle = '#667085'; ctx.font = '19px Arial, sans-serif';
          var t = item.source.mime + ' · ' + PP.utils.formatBytes(item.source.bytes.length) + ' · grid ' + item.matrix.gridSize + (item.pkg.meta.encrypted ? ' · şifreli' : '');
          wrapText(ctx, t, x, ty + 3, cellW, 24, 1);
        }
        placements.push({ x:sx, y:sy, size:squareSize, gridSize:item.matrix.gridSize, name:item.source.name });
      }
      return { canvas: canvas, placements: placements };
    },
    makeSvgFromCanvas: function(canvas){
      var png = canvas.toDataURL('image/png');
      return '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 '+canvas.width+' '+canvas.height+'"><image width="'+canvas.width+'" height="'+canvas.height+'" href="'+png+'"/></svg>';
    }
  };
})();
