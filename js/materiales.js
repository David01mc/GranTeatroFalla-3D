(function(){
'use strict';
var FALLA = window.FALLA;

/* Texturas foto-reales del suelo del patio: parquet bajo las butacas,
   alfombra roja en los dos pasillos centrales. */
var cargador = new THREE.TextureLoader();
function textura(ruta, repX, repY){
  var t = cargador.load(ruta);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  return t;
}
var texParquet   = textura('Textures/Parquet.png', 14, 16);
var texAlfombra  = textura('Textures/RedCarpet.png', 1, 1); // el largo se controla en el propio UV de la alfombra
var texTelon     = textura('Textures/Telon.png', 1, 1);     // ídem: el UV de la cortina ya mete su propio repetido

/* Varios materiales "gemelos" por textura (misma imagen, cada uno con su
   propia rotación/desplazamiento de UV y un tono ligeramente distinto),
   para que butacas vecinas no se vean todas exactamente iguales. */
function variantesMaterial(ruta, n, rotMax, tonoMin, tonoMax){
  var mats=[], i;
  for(i=0;i<n;i++){
    var t=cargador.load(ruta);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.center.set(0.5,0.5);
    t.rotation=(Math.random()*2-1)*rotMax;
    t.offset.set(Math.random(), Math.random());
    var tono=tonoMin+Math.random()*(tonoMax-tonoMin);
    mats.push(new THREE.MeshLambertMaterial({map:t, color:new THREE.Color(tono,tono,tono)}));
  }
  return mats;
}
var matTercButaca   = variantesMaterial('Textures/TerciopeloButaca.png', 6, 0.20, 0.88, 1.10);
var matMaderaButaca = variantesMaterial('Textures/MaderaButaca.png',     6, 0.15, 0.90, 1.08);

var MAT = {
  terciopeloButaca: matTercButaca, // array: una por variante, ver geometria.js
  maderaButaca:     matMaderaButaca,
  suelo:      new THREE.MeshLambertMaterial({color:0x3a2118, side:THREE.DoubleSide}),
  parquet:    new THREE.MeshLambertMaterial({map:texParquet, side:THREE.DoubleSide}),
  alfombra:   new THREE.MeshLambertMaterial({map:texAlfombra, side:THREE.DoubleSide}),
  muro:       new THREE.MeshLambertMaterial({color:0x2a1519, side:THREE.DoubleSide}),
  antepecho:  new THREE.MeshLambertMaterial({color:0x6b2226, side:THREE.DoubleSide}),
  oro:        new THREE.MeshLambertMaterial({color:0xc9922f, emissive:0x2a1c05, side:THREE.DoubleSide}),
  yeso:       new THREE.MeshLambertMaterial({color:0xd8c9a8, side:THREE.DoubleSide}),
  hueco:      new THREE.MeshLambertMaterial({color:0x140a0c, side:THREE.DoubleSide}),
  tablas:     new THREE.MeshLambertMaterial({color:0x5b3a24}),
  telon:      new THREE.MeshLambertMaterial({map:texTelon, side:THREE.DoubleSide})
};

var lista=[];
for(var k in MAT){
  var v=MAT[k];
  if(Array.isArray(v)) v.forEach(function(m){ lista.push(m); });
  else lista.push(v);
}

/* Materiales creados dinámicamente (texturas de canvas, etc.) se registran
   aquí para que el toggle de "modo boceto" también los ponga en wireframe. */
function registrar(mat){ lista.push(mat); }

FALLA.materiales = {
  MAT: MAT,
  lista: lista,
  registrar: registrar
};
})();
