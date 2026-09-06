/* ------------------------------------------------------------------
   PRIMITIVAS DE MALLA
   Ninguna de estas funciones conoce el teatro: reciben una polilínea,
   unas alturas y un material, y devuelven una malla. Sólo dependen de
   THREE y de la pendiente del patio (FALLA.geo), así que pueden usarse
   desde cualquier pieza sin arrastrar el resto de la sala.

   Se publican en FALLA.piezas; geometria.js las recoge como alias
   locales, de modo que allí se siguen llamando por su nombre de
   siempre.
-------------------------------------------------------------------*/
(function(){
'use strict';
window.FALLA = window.FALLA || {};
var FALLA = window.FALLA;
var geo = FALLA.geo;

/* Cinta vertical siguiendo una polilínea. */
function cinta(pts, yb, yt, mat){
  var g=new THREE.BufferGeometry(), pos=[], uv=[], idx=[], i, dist=0;
  for(i=0;i<pts.length;i++){
    var p=pts[i];
    if(i>0) dist+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z);
    var b=(typeof yb==='function')?yb(p):yb, t=(typeof yt==='function')?yt(p):yt;
    pos.push(p.x,b,p.z, p.x,t,p.z);
    uv.push(dist*0.5,0, dist*0.5,1);
  }
  for(i=0;i<pts.length-1;i++){
    var a=i*2;
    idx.push(a,a+1,a+2, a+1,a+3,a+2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

/* Banda horizontal entre dos polilíneas (suelos de palco, cornisas). */
function banda(pA, pB, yA, yB, mat){
  var g=new THREE.BufferGeometry(), pos=[], uv=[], idx=[], i, dist=0;
  for(i=0;i<pA.length;i++){
    var a=pA[i], b=pB[i];
    if(i>0) dist+=Math.hypot(a.x-pA[i-1].x,a.z-pA[i-1].z);
    pos.push(a.x,(typeof yA==='function')?yA(a):yA,a.z, b.x,(typeof yB==='function')?yB(b):yB,b.z);
    uv.push(dist*0.5,0, dist*0.5,Math.hypot(b.x-a.x,b.z-a.z)*0.5);
  }
  for(i=0;i<pA.length-1;i++){
    var o=i*2;
    idx.push(o,o+1,o+2, o+1,o+3,o+2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

/* Redistribuye una polilínea por longitud acumulada. Resulta útil para
   construir una banda limpia entre dos curvas con distinto número de
   muestras: cada par de puntos representa el mismo avance y los quads
   no pueden cruzarse ni convertirse en diagonales largas. */
function remuestreaLinea(pts,cantidad){
  if(pts.length<2 || cantidad<2)return pts.slice();
  var acumulada=[0],total=0,i;
  for(i=1;i<pts.length;i++){
    total+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
    acumulada.push(total);
  }
  if(total<1e-6)return Array(cantidad).fill(null).map(function(){return {x:pts[0].x,z:pts[0].z};});
  var salida=[],segmento=0;
  for(i=0;i<cantidad;i++){
    var objetivo=total*i/(cantidad-1);
    while(segmento<acumulada.length-2 && acumulada[segmento+1]<objetivo)segmento++;
    var tramo=acumulada[segmento+1]-acumulada[segmento];
    var t=tramo?(objetivo-acumulada[segmento])/tramo:0;
    salida.push({
      x:pts[segmento].x+(pts[segmento+1].x-pts[segmento].x)*t,
      z:pts[segmento].z+(pts[segmento+1].z-pts[segmento].z)*t
    });
  }
  return salida;
}

/* Alfombra: una cinta de ancho fijo siguiendo una polilínea (el eje de un
   pasillo), apoyada sobre el suelo ya inclinado. La coordenada V del UV
   sigue la distancia recorrida, así la textura no se estira al alargar
   o acortar el pasillo. */
function alfombra(pts, ancho, mat){
  var g=new THREE.BufferGeometry(), pos=[], uv=[], idx=[], i, dist=0;
  for(i=0;i<pts.length;i++){
    var p=pts[i], a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)];
    var tx=b.x-a.x, tz=b.z-a.z, L=Math.hypot(tx,tz)||1; tx/=L; tz/=L;
    var nx=-tz, nz=tx;
    var anchoLocal=typeof ancho==='function'?ancho(p):ancho;
    var yr=geo.alturaRampaTrasera?geo.alturaRampaTrasera(p.x,p.z):null;
    var y = (yr===null?geo.rake(p.z):yr)+0.08;
    pos.push(p.x-nx*anchoLocal/2, y, p.z-nz*anchoLocal/2,  p.x+nx*anchoLocal/2, y, p.z+nz*anchoLocal/2);
    if(i>0) dist += Math.hypot(p.x-pts[i-1].x, p.z-pts[i-1].z);
    uv.push(0, dist*0.6,  1, dist*0.6);
  }
  for(i=0;i<pts.length-1;i++){ var o=i*2; idx.push(o,o+1,o+2, o+1,o+3,o+2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

/* Trapecio de enlace cuyos testeros permanecen paralelos al borde del
   pasillo y al primer escalón, aunque sus centros no estén alineados. */
function enlaceAlfombra(x0,z0,w0,x1,z1,w1,mat){
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([
    x0,geo.rake(z0-w0/2)+0.085,z0-w0/2,
    x0,geo.rake(z0+w0/2)+0.085,z0+w0/2,
    x1,geo.rake(z1-w1/2)+0.085,z1-w1/2,
    x1,geo.rake(z1+w1/2)+0.085,z1+w1/2
  ],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
  g.setIndex([0,1,2,1,3,2]);
  g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

/* Superficie de la planta (patio / techo), con la pendiente ya aplicada. */
function superficie(pts, yFn, mat, conUV){
  var forma=new THREE.Shape();
  forma.moveTo(pts[0].x, pts[0].z);
  for(var i=1;i<pts.length;i++) forma.lineTo(pts[i].x, pts[i].z);
  var g=new THREE.ShapeGeometry(forma);
  var pos=g.attributes.position, uv=[];
  for(var j=0;j<pos.count;j++){
    var x=pos.getX(j), z=pos.getY(j);
    pos.setXYZ(j, x, yFn(z), z);
    uv.push((x+14)/28, (z+1)/27);
  }
  if(conUV) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

FALLA.piezas = FALLA.piezas || {};
FALLA.piezas.cinta = cinta;
FALLA.piezas.banda = banda;
FALLA.piezas.remuestreaLinea = remuestreaLinea;
FALLA.piezas.alfombra = alfombra;
FALLA.piezas.enlaceAlfombra = enlaceAlfombra;
FALLA.piezas.superficie = superficie;
})();
