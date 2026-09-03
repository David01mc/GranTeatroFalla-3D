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
var texParquet      = textura('Textures/Parquet.png', 14, 16);
var texParquetPlatea= textura('Textures/Parquet.png', 1, 1);
var texAlfombra     = textura('Textures/RedCarpet.png', 1, 1); // el largo se controla en el propio UV de la alfombra
var texTelon        = textura('Textures/Telon.png', 1, 1);     // ídem: el UV de la cortina ya mete su propio repetido
var texMaderaButaca = textura('Textures/MaderaButaca.png', 1, 1);
var texMaderaBlanca = textura('Textures/MaderaBlanca.png', 1, 1);
var texMaderaPlatea = textura('Textures/MaderaPlateaInferior.png', 1, 1);
var texTerciopelo2  = textura('Textures/TerciopeloButaca2.png', 1, 1);
var texBarnizClaro  = textura('Textures/BarnizBlancoClaraHuevo.png', 18, 1);
var texMudejarGeo   = textura('Textures/MudejarGeometrico.png', 1, 1);
var texMudejarFloral= textura('Textures/MudejarFloral.png', 1, 2);
var texMudejarArcos = textura('Textures/MudejarArcos.png', 6, 1);
var texPuertaPalco  = cargador.load('Textures/PuertaPalcoMudejar.png');

/* Carga una textura y le rebaja la saturación (mezcla cada píxel hacia
   su propio gris en el porcentaje indicado) antes de asignarla al
   material — la foto del terciopelo de la butaca venía demasiado roja. */
function texturaDesaturada(ruta, factor, material){
  var img = new Image();
  img.onload = function(){
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var datos = ctx.getImageData(0, 0, c.width, c.height), d = datos.data;
    for(var i=0; i<d.length; i+=4){
      var gris = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      d[i]   += (gris-d[i])  *factor;
      d[i+1] += (gris-d[i+1])*factor;
      d[i+2] += (gris-d[i+2])*factor;
    }
    ctx.putImageData(datos, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    material.map = t;
    material.needsUpdate = true;
  };
  img.src = ruta;
}
var matTerciopeloButaca = new THREE.MeshLambertMaterial({color:new THREE.Color(0.90,1,1)});
texturaDesaturada('Textures/TerciopeloButaca.png', 0.45, matTerciopeloButaca);

var MAT = {
  terciopeloButaca: matTerciopeloButaca,
  maderaButaca:     new THREE.MeshLambertMaterial({map:texMaderaButaca}),
  // Tinte ligeramente gris para conservar la veta sin quemarla bajo los
  // numerosos focos cálidos de los palcos.
  maderaBlanca:     new THREE.MeshLambertMaterial({map:texMaderaBlanca, color:0xb0a99b, side:THREE.DoubleSide}),
  maderaPlatea:     new THREE.MeshLambertMaterial({map:texMaderaPlatea, side:THREE.DoubleSide}),
  terciopelo2:      new THREE.MeshLambertMaterial({map:texTerciopelo2, side:THREE.DoubleSide}),
  barnizClaro:      new THREE.MeshLambertMaterial({map:texBarnizClaro, color:0x8f8a80}),
  mudejarGeometrico:new THREE.MeshLambertMaterial({map:texMudejarGeo, color:0xbdb4a3, side:THREE.DoubleSide}),
  mudejarFloral:    new THREE.MeshLambertMaterial({map:texMudejarFloral, color:0xb8ae9c}),
  mudejarArcos:     new THREE.MeshLambertMaterial({map:texMudejarArcos, color:0xbdb3a1}),
  puertaPalco:      new THREE.MeshLambertMaterial({map:texPuertaPalco}),
  suelo:      new THREE.MeshLambertMaterial({color:0x3a2118, side:THREE.DoubleSide}),
  parquet:    new THREE.MeshLambertMaterial({map:texParquet, side:THREE.DoubleSide}),
  parquetPlatea:new THREE.MeshLambertMaterial({map:texParquetPlatea, side:THREE.DoubleSide}),
  // polygonOffset empuja la alfombra hacia la cámara en el buffer de
  // profundidad (no en el mundo): el pequeño y+0.06 de alfombra() ya no
  // basta él solo para evitar el parpadeo/hundimiento con el parquet al
  // verla de lejos o en rasante, así que se combinan las dos.
  alfombra:   new THREE.MeshLambertMaterial({map:texAlfombra, side:THREE.DoubleSide,
                 polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}),
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
