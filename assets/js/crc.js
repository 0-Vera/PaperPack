(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  var table = new Uint32Array(256);
  for(var n=0;n<256;n++){
    var c = n;
    for(var k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  PP.crc32 = function(bytes){
    var crc = 0xFFFFFFFF;
    for(var i=0;i<bytes.length;i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };
})();
