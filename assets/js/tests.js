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
    }
  };
})();
