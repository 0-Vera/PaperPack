(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.reader = {
    loadImageFileToCanvas: function(file, maxDim){
      maxDim = maxDim || 2600;
      return new Promise(function(resolve, reject){
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function(){
          try{
            var scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            var ctx = canvas.getContext('2d', { willReadFrequently:true });
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas);
          }catch(err){ reject(err); }
        };
        img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('Görsel yüklenemedi.')); };
        img.src = url;
      });
    },
    explainFailure: function(result){
      if(!result || !result.candidates || !result.candidates.length) return 'Veri karesi bulunamadı. Çerçeve kesilmiş, fotoğraf çok soluk ya da kare çok küçük olabilir.';
      if(result.candidates.length && !result.results.length) return 'Aday kare bulundu ama paket okunamadı. Fotoğraf bulanık, fazla perspektifli, parlak/gölgeli veya baskı yoğunluğu fazla olabilir. 4 köşe seçme modunu deneyin.';
      return 'Okuma başarısız.';
    }
  };
})();
