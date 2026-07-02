(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.compression = {
    supported: function(){ return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'; },
    compress: async function(bytes){
      if(!this.supported()) return { bytes: bytes, algorithm: 'none', used: false, reason: 'Tarayıcı CompressionStream desteklemiyor.' };
      try{
        var cs = new CompressionStream('gzip');
        var stream = new Blob([bytes]).stream().pipeThrough(cs);
        var ab = await new Response(stream).arrayBuffer();
        var compressed = new Uint8Array(ab);
        if(compressed.length >= bytes.length) return { bytes: bytes, algorithm: 'none', used: false, reason: 'Sıkıştırma dosyayı küçültmedi.' };
        return { bytes: compressed, algorithm: 'gzip', used: true, reason: 'gzip' };
      }catch(err){
        return { bytes: bytes, algorithm: 'none', used: false, reason: 'Sıkıştırma başarısız: ' + err.message };
      }
    },
    decompress: async function(bytes, algorithm){
      if(!algorithm || algorithm === 'none') return bytes;
      if(algorithm !== 'gzip') throw new Error('Bilinmeyen sıkıştırma türü: ' + algorithm);
      if(!this.supported()) throw new Error('Bu tarayıcı DecompressionStream desteklemediği için sıkıştırılmış paket açılamıyor.');
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([bytes]).stream().pipeThrough(ds);
      var ab = await new Response(stream).arrayBuffer();
      return new Uint8Array(ab);
    }
  };
})();
