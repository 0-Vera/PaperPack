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
  function cloneCanvasSize(target){
    target.width = PP.config.a4.width;
    target.height = PP.config.a4.height;
    return target;
  }
  function drawA4Page(pageItems, settings, pageIndex, totalPages, targetCanvas){
    var canvas = cloneCanvasSize(targetCanvas || document.createElement('canvas'));
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
      if(totalPages > 1){
        ctx.textAlign = 'right';
        ctx.fillText('Sayfa ' + (pageIndex+1) + '/' + totalPages, canvas.width - margin, 132);
        ctx.textAlign = 'left';
      }
      top = 205;
    }else if(settings.pageMode === 'title-desc'){
      ctx.font = '700 44px Arial, sans-serif';
      ctx.fillText('PaperPack veri çıktısı', margin, 82);
      if(totalPages > 1){
        ctx.font = '24px Arial, sans-serif';
        ctx.fillStyle = '#667085';
        ctx.textAlign = 'right';
        ctx.fillText('Sayfa ' + (pageIndex+1) + '/' + totalPages, canvas.width - margin, 96);
        ctx.textAlign = 'left';
      }
      top = 170;
    }
    var layout = layoutForCount(pageItems.length);
    var gap = 50;
    var usableW = canvas.width - margin*2;
    var usableH = canvas.height - top - margin;
    var cellW = (usableW - gap*(layout.cols-1)) / layout.cols;
    var cellH = (usableH - gap*(layout.rows-1)) / layout.rows;
    var placements = [];
    for(var i=0;i<pageItems.length;i++){
      var col = i % layout.cols;
      var row = Math.floor(i / layout.cols);
      var x = margin + col*(cellW+gap);
      var y = top + row*(cellH+gap);
      var metaH = 0;
      var item = pageItems[i];
      var source = item.source || {};
      var showName = source.showName && (settings.pageMode === 'title-desc' || settings.pageMode === 'full');
      var showDesc = source.showDescription && source.description && (settings.pageMode === 'desc' || settings.pageMode === 'title-desc' || settings.pageMode === 'full');
      var showTech = source.showTech && settings.pageMode === 'full';
      if(showName) metaH += 44;
      if(showDesc) metaH += 66;
      if(showTech) metaH += 44;
      var squareSize = Math.min(cellW, cellH - metaH - 8);
      if(squareSize < 160) squareSize = Math.min(cellW, cellH);
      var sx = x + (cellW - squareSize)/2;
      var sy = y;
      drawMatrix(ctx, item.matrix.matrix, item.matrix.gridSize, sx, sy, squareSize);
      var ty = sy + squareSize + 18;
      ctx.fillStyle = '#101828';
      if(showName){
        ctx.font = '700 27px Arial, sans-serif';
        var name = source.name || 'dosya';
        if(item.transport && item.transport.type === 'chunk') name += ' · parça ' + item.transport.index + '/' + item.transport.total;
        ty = wrapText(ctx, name, x, ty, cellW, 34, 1);
      }
      if(showDesc){ ctx.fillStyle = '#475467'; ctx.font = '23px Arial, sans-serif'; ty = wrapText(ctx, source.description, x, ty + 2, cellW, 29, 2); }
      if(showTech){
        ctx.fillStyle = '#667085'; ctx.font = '19px Arial, sans-serif';
        var t = (source.mime || 'text/plain') + ' · ' + PP.utils.formatBytes(source.bytes ? source.bytes.length : 0) + ' · grid ' + item.matrix.gridSize + (item.pkg && item.pkg.meta.encrypted ? ' · şifreli' : '');
        if(item.transport && item.transport.type === 'chunk') t += ' · parça ' + item.transport.index + '/' + item.transport.total;
        wrapText(ctx, t, x, ty + 3, cellW, 24, 1);
      }
      placements.push({ x:sx, y:sy, size:squareSize, gridSize:item.matrix.gridSize, name:source.name || '', page:pageIndex });
    }
    return { canvas: canvas, placements: placements, items: pageItems };
  }
  function splitPages(items){
    var pages = [];
    for(var i=0;i<items.length;i+=9) pages.push(items.slice(i, i+9));
    return pages;
  }
  PP.renderer = {
    drawMatrix: drawMatrix,
    drawMatrixToCanvas: drawMatrixToCanvas,
    layoutForCount: layoutForCount,
    makeA4: function(items, settings){
      var pageGroups = splitPages(items);
      var canvases = [];
      var pages = [];
      var placements = [];
      for(var i=0;i<pageGroups.length;i++){
        var target = i === 0 ? (document.getElementById('a4Canvas') || document.createElement('canvas')) : document.createElement('canvas');
        var page = drawA4Page(pageGroups[i], settings, i, pageGroups.length, target);
        pages.push(page);
        canvases.push(page.canvas);
        placements = placements.concat(page.placements);
      }
      return { canvas: canvases[0], canvases: canvases, pages: pages, placements: placements };
    },
    makeSvgFromCanvas: function(canvas){
      var png = canvas.toDataURL('image/png');
      return '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 '+canvas.width+' '+canvas.height+'"><image width="'+canvas.width+'" height="'+canvas.height+'" href="'+png+'"/></svg>';
    },
    makeSvgPages: function(canvases){
      canvases = canvases || [];
      if(canvases.length <= 1) return this.makeSvgFromCanvas(canvases[0]);
      var w = canvases[0].width, h = canvases[0].height;
      var parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="'+(297*canvases.length)+'mm" viewBox="0 0 '+w+' '+(h*canvases.length)+'">'];
      for(var i=0;i<canvases.length;i++){
        parts.push('<image width="'+w+'" height="'+h+'" y="'+(i*h)+'" href="'+canvases[i].toDataURL('image/png')+'"/>');
      }
      parts.push('</svg>');
      return parts.join('');
    }
  };
})();
