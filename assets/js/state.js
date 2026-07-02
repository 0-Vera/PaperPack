(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.state = {
    items: [],
    generated: null,
    readImageCanvas: null,
    chunkStore: {},
    addItem: function(item){
      if(this.items.length >= PP.config.maxFiles) throw new Error('En fazla 9 dosya eklenebilir.');
      item.id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
      item.description = item.description || '';
      item.showName = true;
      item.showDescription = true;
      item.showTech = false;
      item.passwordMode = 'none';
      item.customPassword = '';
      this.items.push(item);
    },
    removeItem: function(id){ this.items = this.items.filter(function(x){ return x.id !== id; }); },
    clear: function(){ this.items = []; this.generated = null; },
    clearReadChunks: function(){ this.chunkStore = {}; }
  };
})();
