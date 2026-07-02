(function(){
  'use strict';
  var PP = window.PP = window.PP || {};
  PP.perspective = {
    mapUnitToQuad: function(corners, u, v){
      var p0=corners[0], p1=corners[1], p2=corners[2], p3=corners[3];
      var x0=p0.x, y0=p0.y, x1=p1.x, y1=p1.y, x2=p2.x, y2=p2.y, x3=p3.x, y3=p3.y;
      var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
      var dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      var a,b,c,d,e,f,g,h;
      if(Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9){
        a = x1 - x0; b = x3 - x0; c = x0;
        d = y1 - y0; e = y3 - y0; f = y0;
        g = 0; h = 0;
      }else{
        var den = dx1 * dy2 - dx2 * dy1;
        if(Math.abs(den) < 1e-9){
          a = x1 - x0; b = x3 - x0; c = x0;
          d = y1 - y0; e = y3 - y0; f = y0;
          g = 0; h = 0;
        }else{
          g = (dx3 * dy2 - dx2 * dy3) / den;
          h = (dx1 * dy3 - dx3 * dy1) / den;
          a = x1 - x0 + g * x1;
          b = x3 - x0 + h * x3;
          c = x0;
          d = y1 - y0 + g * y1;
          e = y3 - y0 + h * y3;
          f = y0;
        }
      }
      var z = g * u + h * v + 1;
      return { x:(a*u + b*v + c) / z, y:(d*u + e*v + f) / z };
    },
    orderCorners: function(points){
      var tl=points[0], tr=points[0], br=points[0], bl=points[0];
      for(var i=0;i<points.length;i++){
        var p=points[i], sum=p.x+p.y, diff=p.x-p.y;
        if(sum < tl.x+tl.y) tl=p;
        if(sum > br.x+br.y) br=p;
        if(diff > tr.x-tr.y) tr=p;
        if(diff < bl.x-bl.y) bl=p;
      }
      return [tl,tr,br,bl];
    },
    polygonArea: function(c){
      var area = 0;
      for(var i=0;i<c.length;i++){
        var j=(i+1)%c.length;
        area += c[i].x*c[j].y - c[j].x*c[i].y;
      }
      return Math.abs(area/2);
    }
  };
})();
