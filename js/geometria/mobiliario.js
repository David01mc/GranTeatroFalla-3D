/* ------------------------------------------------------------------
   MOBILIARIO
   Perfiles y geometrías de la butaca del patio y de la silla de palco.
   Son piezas puras: no conocen la planta de la sala ni sus materiales,
   sólo devuelven geometría lista para instanciar.
-------------------------------------------------------------------*/
(function(){
'use strict';
window.FALLA = window.FALLA || {};
var FALLA = window.FALLA;

/* Perfil del respaldo: recto por los lados y por abajo, redondeado
   por arriba (como el de la foto de referencia). */
function perfilRespaldo(ancho, alto, radio){
  var hw=ancho/2, r=Math.min(radio, hw, alto*0.85), s=new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw, alto-r);
  s.quadraticCurveTo(-hw, alto, -hw+r, alto);
  s.lineTo(hw-r, alto);
  s.quadraticCurveTo(hw, alto, hw, alto-r);
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  return s;
}

/* Perfil (visto de lado) del panel de madera del brazo: junto al
   respaldo sube recto y remata en una esquina redondeada (apenas un
   poco por encima del cojín, no un poste marcado), y baja curvándose
   hacia el escenario en una voluta, como en las butacas de teatro
   clásicas. */
function perfilBrazo(atras, delante, altoAtras, altoDelante){
  var r=0.05, s=new THREE.Shape();
  s.moveTo(-atras, 0);
  s.lineTo(-atras, altoAtras-r);
  s.quadraticCurveTo(-atras, altoAtras, -atras+r, altoAtras);
  s.quadraticCurveTo(-atras*0.15, altoAtras, delante*0.35, altoAtras*0.86);
  s.quadraticCurveTo(delante*0.85, altoAtras*0.5, delante, altoDelante);
  s.lineTo(delante, 0);
  s.lineTo(-atras, 0);
  return s;
}

var ALTO_BRAZO = 0.65;

/* Cojín con cantos blandos: caja redondeada por proyección de sus
   vértices sobre el núcleo, sin inflar las dimensiones exteriores. */
function cajaAcolchada(ancho,alto,fondo,radio){
  var g=new THREE.BoxGeometry(ancho,alto,fondo,6,6,6);
  var p=g.attributes.position, nucleo=new THREE.Vector3(ancho/2-radio,alto/2-radio,fondo/2-radio);
  var v=new THREE.Vector3(), c=new THREE.Vector3(), n=new THREE.Vector3();
  for(var i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i); c.copy(v).clamp(nucleo.clone().negate(),nucleo);
    n.copy(v).sub(c).normalize(); v.copy(c).addScaledVector(n,radio);
    p.setXYZ(i,v.x,v.y,v.z);
    g.attributes.normal.setXYZ(i,n.x,n.y,n.z);
  }
  return g;
}

function geometriaReposabrazos(){
  var g=cajaAcolchada(0.085,0.044,0.49,0.02), p=g.attributes.position;
  for(var i=0;i<p.count;i++){
    var z=p.getZ(i), curva=0.024*(1-Math.pow(z/0.245,2));
    p.setY(i,p.getY(i)+ALTO_BRAZO+curva);
  }
  g.computeVertexNormals(); return g;
}

/* El panel de brazo se dibuja en un plano alto/profundidad y se gira
   90º para que el grosor quede en el eje x (izquierda/derecha) y el
   perfil en z/y (profundidad/altura), tal como se ve desde el pasillo. */
function geometriaBrazo(grosor){
  var s=new THREE.Shape();
  s.moveTo(-0.20,0.025); s.lineTo(0.25,0.025);
  s.lineTo(0.25,ALTO_BRAZO-0.06);
  s.quadraticCurveTo(0.02,ALTO_BRAZO-0.025,-0.20,ALTO_BRAZO-0.055);
  s.closePath();
  var g=new THREE.ExtrudeGeometry(s,
    {depth:grosor, bevelEnabled:true,bevelSize:0.006,bevelThickness:0.006,bevelSegments:2,curveSegments:8});
  g.translate(0,0,-grosor/2);
  g.rotateY(Math.PI/2);
  return g;
}

/* Silla suelta de palco: más sencilla que la butaca del patio (se ve de
   lejos y en grupos de 6), pero con los mismos materiales de tela y
   madera para que no desentone. Mirando hacia -z en reposo, igual que
   las butacas del patio. */
function construirSillaPalco(){
  var asiento=new THREE.BoxGeometry(0.40,0.08,0.38); asiento.translate(0,0.44,0);
  var respaldo=new THREE.BoxGeometry(0.40,0.42,0.06); respaldo.translate(0,0.67,0.16);
  var base=new THREE.BoxGeometry(0.36,0.40,0.34); base.translate(0,0.20,0);
  return {asiento:asiento, respaldo:respaldo, base:base};
}

FALLA.piezas = FALLA.piezas || {};
FALLA.piezas.ALTO_BRAZO = ALTO_BRAZO;
FALLA.piezas.cajaAcolchada = cajaAcolchada;
FALLA.piezas.geometriaReposabrazos = geometriaReposabrazos;
FALLA.piezas.perfilRespaldo = perfilRespaldo;
FALLA.piezas.perfilBrazo = perfilBrazo;
FALLA.piezas.geometriaBrazo = geometriaBrazo;
FALLA.piezas.construirSillaPalco = construirSillaPalco;
})();
