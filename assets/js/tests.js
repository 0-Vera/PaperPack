(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.tests = {
    bytesEqual: function(a,b){
      if(!a || !b || a.length !== b.length) return false;
      for(var i=0;i<a.length;i++) if(a[i] !== b[i]) return false;
      return true;
    },
    verifyRawSquare: function(renderedCanvas, expectedBytes, gridSize){
      var read = PP.decoder.decodeKnownSquare(renderedCanvas, gridSize);
      if(!this.bytesEqual(read, expectedBytes)) throw new Error('Ham veri karesi iç testi başarısız: okunan veri beklenen paketle aynı değil.');
      return true;
    },
    verifyA4Auto: async function(a4Canvas, expectedCount, onStatus){
      var res = await PP.decoder.decodeCanvasAuto(a4Canvas, onStatus);
      if(res.results.length < expectedCount){
        throw new Error('A4 otomatik okuma iç testi başarısız. Beklenen paket: ' + expectedCount + ', okunan: ' + res.results.length + '.');
      }
      return res;
    },
    verifyA4PagesAuto: async function(a4, onStatus){
      var all = [];
      for(var i=0;i<a4.pages.length;i++){
        var page = a4.pages[i];
        if(onStatus) onStatus('A4 sayfa ' + (i+1) + '/' + a4.pages.length + ' otomatik iç test');
        var res = await this.verifyA4Auto(page.canvas, page.items.length, onStatus);
        for(var j=0;j<res.results.length;j++) all.push(res.results[j]);
      }
      return { results: all, pages: a4.pages.length };
    },
    verifyA4PagesByPlacements: function(a4, onStatus){
      var all = [];
      for(var i=0;i<a4.pages.length;i++){
        var page = a4.pages[i];
        if(onStatus) onStatus('A4 sayfa ' + (i+1) + '/' + a4.pages.length + ' yerleşim iç testi');
        var ctx = page.canvas.getContext('2d', { willReadFrequently:true });
        var imageData = ctx.getImageData(0,0,page.canvas.width,page.canvas.height);
        for(var j=0;j<page.items.length;j++){
          var item = page.items[j];
          var p = page.placements[j];
          var corners = [
            {x:p.x, y:p.y},
            {x:p.x + p.size, y:p.y},
            {x:p.x + p.size, y:p.y + p.size},
            {x:p.x, y:p.y + p.size}
          ];
          var res = PP.decoder.tryDecodeImageData(imageData, corners, item.matrix.gridSize, [128, 100, 160, 200, 60]);
          if(!this.bytesEqual(res.packageBytes, item.transport.bytes)){
            throw new Error('A4 yerleşim iç testi başarısız: sayfa ' + (i+1) + ', kare ' + (j+1) + ' beklenen veriyle aynı değil.');
          }
          all.push({ packageBytes:res.packageBytes, gridSize:item.matrix.gridSize, page:i+1, index:j+1 });
        }
      }
      return { results: all, pages: a4.pages.length };
    }
  };
})();
