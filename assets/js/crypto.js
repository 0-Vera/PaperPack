(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.cryptoBox = {
    iterations: 180000,
    available: function(){ return !!(window.crypto && crypto.subtle && crypto.getRandomValues); },
    passwordScore: function(pw){
      pw = String(pw || '');
      var classes = 0;
      if(/[a-z]/.test(pw)) classes++;
      if(/[A-Z]/.test(pw)) classes++;
      if(/[0-9]/.test(pw)) classes++;
      if(/[^A-Za-z0-9]/.test(pw)) classes++;
      var score = pw.length * 4 + classes * 14;
      if(pw.length >= 20 && classes >= 3) return { level:'strong', text:'Güçlü şifre.', ok:true };
      if(pw.length >= 14 && classes >= 3) return { level:'medium', text:'Orta seviye. 20+ karakter daha güvenli olur.', ok:true };
      if(!pw) return { level:'none', text:'Şifre yok.', ok:true };
      return { level:'weak', text:'Zayıf şifre: A4 ele geçirilirse offline parola denemesi yapılabilir.', ok:false, score:score };
    },
    deriveKey: async function(password, salt, iterations){
      var raw = PP.utils.textToBytes(password);
      var baseKey = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey(
        { name:'PBKDF2', salt:salt, iterations: iterations || this.iterations, hash:'SHA-256' },
        baseKey,
        { name:'AES-GCM', length:256 },
        false,
        ['encrypt','decrypt']
      );
    },
    encrypt: async function(bytes, password){
      if(!this.available()) throw new Error('Web Crypto API kullanılamıyor. Şifreleme için HTTPS, localhost veya destekleyen file:// ortamı gerekir.');
      var salt = new Uint8Array(16);
      var iv = new Uint8Array(12);
      crypto.getRandomValues(salt); crypto.getRandomValues(iv);
      var key = await this.deriveKey(password, salt, this.iterations);
      var encrypted = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, key, bytes));
      return { bytes: encrypted, salt: salt, iv: iv, iterations: this.iterations };
    },
    decrypt: async function(bytes, password, salt, iv, iterations){
      if(!this.available()) throw new Error('Web Crypto API kullanılamıyor. Şifreli paket açılamıyor.');
      try{
        var key = await this.deriveKey(password, salt, iterations);
        var plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:iv }, key, bytes);
        return new Uint8Array(plain);
      }catch(err){
        throw new Error('Şifre hatalı veya veri bozuk.');
      }
    }
  };
})();
