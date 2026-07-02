(function(){
  'use strict';
  var PP = window.PP = window.PP || {};

  function assertMagic(bytes, off, magic){
    for(var i=0;i<magic.length;i++) if(bytes[off+i] !== magic[i]) return false;
    return true;
  }
  function rotateMatrix(matrix, n){
    var out = new Uint8Array(n*n);
    for(var y=0;y<n;y++) for(var x=0;x<n;x++) out[y*n+x] = matrix[(n-1-x)*n+y];
    return out;
  }

  PP.encoder = {
    capacityBytes: function(gridSize){
      var dataBits = (gridSize - 8) * (gridSize - 8);
      return Math.floor(dataBits / 8) - 16;
    },
    buildEnvelope: function(meta, storedBytes){
      var nameBytes = PP.utils.textToBytes(meta.name || 'dosya.txt');
      var mimeBytes = PP.utils.textToBytes(meta.mime || 'text/plain');
      var descBytes = PP.utils.textToBytes(meta.description || '');
      var salt = meta.salt || new Uint8Array(0);
      var iv = meta.iv || new Uint8Array(0);
      if(nameBytes.length > 65535 || mimeBytes.length > 65535 || descBytes.length > 65535) throw new Error('Dosya adı, tür veya açıklama çok uzun.');
      var fixed = 32;
      var total = fixed + nameBytes.length + mimeBytes.length + descBytes.length + salt.length + iv.length + storedBytes.length;
      var out = new Uint8Array(total);
      out.set(PP.config.magicFile, 0);
      var view = new DataView(out.buffer);
      view.setUint8(4, 1);
      var flags = 0;
      if(meta.compression === 'gzip') flags |= 1;
      if(meta.encrypted) flags |= 2;
      view.setUint8(5, flags);
      PP.utils.writeU32(view, 6, meta.iterations || 0);
      PP.utils.writeU32(view, 10, meta.originalSize || 0);
      PP.utils.writeU32(view, 14, storedBytes.length);
      PP.utils.writeU16(view, 18, nameBytes.length);
      PP.utils.writeU16(view, 20, mimeBytes.length);
      PP.utils.writeU16(view, 22, descBytes.length);
      view.setUint8(24, salt.length);
      view.setUint8(25, iv.length);
      PP.utils.writeU16(view, 26, 0);
      PP.utils.writeU32(view, 28, PP.crc32(storedBytes));
      var off = fixed;
      out.set(nameBytes, off); off += nameBytes.length;
      out.set(mimeBytes, off); off += mimeBytes.length;
      out.set(descBytes, off); off += descBytes.length;
      out.set(salt, off); off += salt.length;
      out.set(iv, off); off += iv.length;
      out.set(storedBytes, off);
      return out;
    },
    parseEnvelope: function(bytes){
      if(bytes.length < 32 || !assertMagic(bytes, 0, PP.config.magicFile)) throw new Error('PaperPack dosya paketi değil.');
      var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      var version = view.getUint8(4);
      if(version !== 1) throw new Error('Desteklenmeyen dosya paket sürümü: ' + version);
      var flags = view.getUint8(5);
      var iterations = PP.utils.readU32(view, 6);
      var originalSize = PP.utils.readU32(view, 10);
      var storedSize = PP.utils.readU32(view, 14);
      var nameLen = PP.utils.readU16(view, 18);
      var mimeLen = PP.utils.readU16(view, 20);
      var descLen = PP.utils.readU16(view, 22);
      var saltLen = view.getUint8(24);
      var ivLen = view.getUint8(25);
      var storedCrc = PP.utils.readU32(view, 28);
      var off = 32;
      var need = off + nameLen + mimeLen + descLen + saltLen + ivLen + storedSize;
      if(need > bytes.length) throw new Error('Paket eksik veya kesilmiş.');
      var name = PP.utils.bytesToText(bytes.subarray(off, off+nameLen)); off += nameLen;
      var mime = PP.utils.bytesToText(bytes.subarray(off, off+mimeLen)); off += mimeLen;
      var description = PP.utils.bytesToText(bytes.subarray(off, off+descLen)); off += descLen;
      var salt = bytes.slice(off, off+saltLen); off += saltLen;
      var iv = bytes.slice(off, off+ivLen); off += ivLen;
      var storedBytes = bytes.slice(off, off+storedSize);
      if(PP.crc32(storedBytes) !== storedCrc) throw new Error('Dosya verisi CRC kontrolünden geçmedi.');
      return {
        version: version,
        name: name || 'paperpack-dosya.txt',
        mime: mime || PP.utils.inferMime(name),
        description: description,
        compressed: !!(flags & 1),
        compression: (flags & 1) ? 'gzip' : 'none',
        encrypted: !!(flags & 2),
        iterations: iterations,
        originalSize: originalSize,
        storedBytes: storedBytes,
        salt: salt,
        iv: iv
      };
    },
    makePackage: async function(item, settings){
      var bytes = item.bytes;
      var compression = 'none';
      var note = 'Sıkıştırmasız';
      if(settings.useCompression){
        var comp = await PP.compression.compress(bytes);
        bytes = comp.bytes;
        compression = comp.algorithm;
        note = comp.used ? ('Sıkıştırıldı: ' + PP.utils.formatBytes(item.bytes.length) + ' → ' + PP.utils.formatBytes(bytes.length)) : comp.reason;
      }
      var password = '';
      if(item.passwordMode === 'global') password = settings.globalPassword || '';
      if(item.passwordMode === 'custom') password = item.customPassword || '';
      var encrypted = false, salt = new Uint8Array(0), iv = new Uint8Array(0), iterations = 0;
      if(password){
        var encryptedPack = await PP.cryptoBox.encrypt(bytes, password);
        bytes = encryptedPack.bytes;
        encrypted = true; salt = encryptedPack.salt; iv = encryptedPack.iv; iterations = encryptedPack.iterations;
      }
      var meta = {
        name: item.name,
        mime: item.mime || PP.utils.inferMime(item.name),
        description: item.description || '',
        compression: compression,
        encrypted: encrypted,
        salt: salt,
        iv: iv,
        iterations: iterations,
        originalSize: item.bytes.length
      };
      var envelope = this.buildEnvelope(meta, bytes);
      return { envelope: envelope, meta: meta, note: note, passwordUsed: !!password };
    },
    createMatrix: function(packageBytes, gridSize, showFrame){
      var capacity = this.capacityBytes(gridSize);
      if(packageBytes.length > capacity) throw new Error('Bu dosya seçilen yoğunluğa sığmıyor. Paket: ' + PP.utils.formatBytes(packageBytes.length) + ', güvenli kapasite: ' + PP.utils.formatBytes(capacity) + '. Daha yüksek yoğunluk seçin veya dosyayı küçültün.');
      var dataBits = (gridSize - 8) * (gridSize - 8);
      var dataBytes = Math.floor(dataBits / 8);
      var stream = new Uint8Array(dataBytes);
      stream.set(PP.config.magicSquare, 0);
      var view = new DataView(stream.buffer);
      view.setUint8(4, PP.config.version);
      view.setUint8(5, gridSize);
      view.setUint8(6, 0);
      view.setUint8(7, 0);
      PP.utils.writeU32(view, 8, packageBytes.length);
      PP.utils.writeU32(view, 12, PP.crc32(packageBytes));
      stream.set(packageBytes, 16);
      var matrix = new Uint8Array(gridSize * gridSize);
      if(showFrame){
        for(var y=0;y<gridSize;y++){
          for(var x=0;x<gridSize;x++){
            if(x<2 || y<2 || x>=gridSize-2 || y>=gridSize-2) matrix[y*gridSize+x] = 1;
          }
        }
      }
      var bitIndex = 0;
      for(var yy=4; yy<gridSize-4; yy++){
        for(var xx=4; xx<gridSize-4; xx++){
          var byte = stream[bitIndex >> 3] || 0;
          var bit = (byte >> (7 - (bitIndex & 7))) & 1;
          matrix[yy*gridSize + xx] = bit;
          bitIndex++;
        }
      }
      return { matrix: matrix, gridSize: gridSize, packageBytes: packageBytes, capacity: capacity };
    },
    decodeMatrix: function(matrix, gridSize){
      var dataBits = (gridSize - 8) * (gridSize - 8);
      var dataBytes = Math.floor(dataBits / 8);
      var stream = new Uint8Array(dataBytes);
      var bitIndex = 0;
      for(var y=4; y<gridSize-4; y++){
        for(var x=4; x<gridSize-4; x++){
          if(matrix[y*gridSize+x]) stream[bitIndex >> 3] |= (1 << (7 - (bitIndex & 7)));
          bitIndex++;
        }
      }
      if(stream.length < 16 || !assertMagic(stream, 0, PP.config.magicSquare)) throw new Error('PPCS başlığı bulunamadı.');
      var view = new DataView(stream.buffer);
      var version = view.getUint8(4);
      if(version !== PP.config.version) throw new Error('Desteklenmeyen veri karesi sürümü: ' + version);
      var declaredGrid = view.getUint8(5);
      if(declaredGrid !== gridSize) throw new Error('Grid boyutu uyuşmuyor.');
      var len = PP.utils.readU32(view, 8);
      var crc = PP.utils.readU32(view, 12);
      if(len < 1 || len > stream.length - 16) throw new Error('Paket uzunluğu geçersiz.');
      var pack = stream.slice(16, 16 + len);
      if(PP.crc32(pack) !== crc) throw new Error('Paket CRC kontrolünden geçmedi.');
      return pack;
    },
    decodeMatrixAnyRotation: function(matrix, gridSize){
      var m = matrix;
      var lastErr = null;
      for(var r=0;r<4;r++){
        try{ return { packageBytes: this.decodeMatrix(m, gridSize), rotation: r }; }
        catch(err){ lastErr = err; m = rotateMatrix(m, gridSize); }
      }
      throw lastErr || new Error('Veri karesi okunamadı.');
    },
    openDecodedFile: async function(parsed, password){
      var bytes = parsed.storedBytes;
      if(parsed.encrypted) bytes = await PP.cryptoBox.decrypt(bytes, password || '', parsed.salt, parsed.iv, parsed.iterations);
      bytes = await PP.compression.decompress(bytes, parsed.compression);
      return { name: parsed.name, mime: parsed.mime, description: parsed.description, bytes: bytes };
    }
  };
})();
