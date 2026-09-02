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

var MAT = {
  terciopelo: new THREE.MeshLambertMaterial({color:0x711c1c}),
  madera:     new THREE.MeshLambertMaterial({color:0x2e1c14}),
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
for(var k in MAT) lista.push(MAT[k]);

/* Materiales creados dinámicamente (texturas de canvas, etc.) se registran
   aquí para que el toggle de "modo boceto" también los ponga en wireframe. */
function registrar(mat){ lista.push(mat); }

FALLA.materiales = {
  MAT: MAT,
  lista: lista,
  registrar: registrar
};
})();
