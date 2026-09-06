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
var texParquet      = textura('Textures/Parquet.webp', 14, 16);
var texParquetPlatea= textura('Textures/Parquet.webp', 1, 1);
var texSueloEscenario=textura('Textures/SueloEscenarioDesgastado.webp', 3, 3);
var texAlfombra     = textura('Textures/RedCarpet.webp', 1, 1); // el largo se controla en el propio UV de la alfombra
// Carga independiente: clonar antes de que TextureLoader termine puede
// dejar la copia sin imagen y producir peldaños negros.
var texAlfombraEscalera=textura('Textures/RedCarpet.webp',1,1);
texAlfombraEscalera.center.set(0.5,0.5);
texAlfombraEscalera.rotation=Math.PI/2;
texAlfombraEscalera.needsUpdate=true;
var texTelon        = textura('Textures/Telon.webp', 1, 1);     // ídem: el UV de la cortina ya mete su propio repetido
var texMaderaButaca = textura('Textures/MaderaButaca.webp', 1, 1);
var texMaderaBlanca = textura('Textures/MaderaBlanca.webp', 1, 1);
var texMaderaPlatea = textura('Textures/MaderaPlateaInferior.webp', 1, 1);
var texTerciopelo   = textura('Textures/TerciopeloButaca.webp', 1, 1);
var texTerciopelo2  = textura('Textures/TerciopeloButaca2.webp', 1, 1);
var texBarnizClaro  = textura('Textures/BarnizBlancoClaraHuevo.webp', 18, 1);
var texMudejarGeo   = textura('Textures/MudejarGeometrico.webp', 1, 1);
var texMudejarFloral= textura('Textures/MudejarFloral.webp', 1, 2);
var texMudejarArcos = textura('Textures/MudejarArcos.webp', 6, 1);
var texPuertaPalco  = cargador.load('Textures/PuertaPalcoMudejar.webp');
var texEmbCrema     = textura('Textures/EmbocaduraCrema.webp', 2, 3);
var texEmbGeometrica= textura('Textures/EmbocaduraGeometrica.webp', 3, 1);
var texParedPasillo = textura('Textures/ParedPasilloBlanca.webp', 1, 1.5);
var texMaderaPasillo= textura('Textures/MaderaPasilloGrisOscura.webp', 1, 1);
var texBaldosaPasillo=textura('Textures/BaldosasPasilloClaras.webp', 1, 1);
var texTerciopeloPasamanos=textura('Textures/TerciopeloPasamanos.webp', 1, 1);
// Acabado del canto visible del entresuelo: paño malva entre molduras
// horizontales, sin la cenefa de arquillos de la parte superior.
var texEntresuelo   = textura('Textures/EntresueloOrnamental.webp', 0.33, 1);
var texBronceAplique= textura('Textures/BronceApliqueEnvejecido.webp', 2, 2);

// La versión WebP ya está desaturada offline: evita crear un canvas y
// recorrer millones de píxeles durante el arranque.
var matTerciopeloButaca = new THREE.MeshLambertMaterial({map:texTerciopelo,color:new THREE.Color(0.90,1,1)});

var MAT = {
  terciopeloButaca: matTerciopeloButaca,
  maderaButaca:     new THREE.MeshLambertMaterial({map:texMaderaButaca}),
  // Tinte ligeramente gris para conservar la veta sin quemarla bajo los
  // numerosos focos cálidos de los palcos.
  maderaBlanca:     new THREE.MeshLambertMaterial({map:texMaderaBlanca, color:0xb0a99b, side:THREE.DoubleSide}),
  maderaPlatea:     new THREE.MeshLambertMaterial({map:texMaderaPlatea, side:THREE.DoubleSide}),
  terciopelo2:      new THREE.MeshLambertMaterial({map:texTerciopelo2, side:THREE.DoubleSide}),
  terciopeloPasamanos:new THREE.MeshLambertMaterial({map:texTerciopeloPasamanos,
                        color:0x9a7777, side:THREE.DoubleSide}),
  barnizClaro:      new THREE.MeshLambertMaterial({map:texBarnizClaro, color:0x8f8a80}),
  mudejarGeometrico:new THREE.MeshLambertMaterial({map:texMudejarGeo, color:0xbdb4a3, side:THREE.DoubleSide}),
  mudejarFloral:    new THREE.MeshLambertMaterial({map:texMudejarFloral, color:0xb8ae9c}),
  mudejarArcos:     new THREE.MeshLambertMaterial({map:texMudejarArcos, color:0xbdb3a1}),
  // Mantiene el relieve ornamental fotografiado, oscurecido al acabado
  // gris-marrón de la carpintería del corredor histórico.
  puertaPalco:      new THREE.MeshLambertMaterial({map:texPuertaPalco, color:0x77716d}),
  embocaduraCrema:  new THREE.MeshLambertMaterial({map:texEmbCrema, color:0xc8b89d, side:THREE.DoubleSide}),
  embocaduraGeo:    new THREE.MeshLambertMaterial({map:texEmbGeometrica, color:0x9a8175, side:THREE.DoubleSide}),
  suelo:      new THREE.MeshLambertMaterial({color:0x3a2118, side:THREE.DoubleSide}),
  // Mapas repetibles propios del corredor: yeso fino, baldosa mineral y
  // madera teñida. El color solo modula levemente la fotografía base.
  paredPasillo:new THREE.MeshLambertMaterial({map:texParedPasillo, color:0xf2f2ee, side:THREE.DoubleSide}),
  // Velo situado solo en la cara del antepalco orientada a la sala.
  // Conserva el grano del yeso inferior y simula la penumbra del fondo.
  sombraAntepalco:new THREE.MeshBasicMaterial({color:0x21191a, transparent:true,
                    opacity:0.48, side:THREE.DoubleSide, depthWrite:false}),
  sueloPasillo:new THREE.MeshLambertMaterial({map:texBaldosaPasillo, color:0xd6d6d0, side:THREE.DoubleSide}),
  zocaloPasillo:new THREE.MeshLambertMaterial({map:texMaderaPasillo, color:0x8a8a86, side:THREE.DoubleSide}),
  parquet:    new THREE.MeshLambertMaterial({map:texParquet, side:THREE.DoubleSide}),
  parquetPlatea:new THREE.MeshLambertMaterial({map:texParquetPlatea, side:THREE.DoubleSide}),
  // polygonOffset empuja la alfombra hacia la cámara en el buffer de
  // profundidad (no en el mundo): el pequeño y+0.06 de alfombra() ya no
  // basta él solo para evitar el parpadeo/hundimiento con el parquet al
  // verla de lejos o en rasante, así que se combinan las dos.
  alfombra:   new THREE.MeshLambertMaterial({map:texAlfombra, side:THREE.DoubleSide,
                 polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}),
  alfombraEscalera:new THREE.MeshLambertMaterial({map:texAlfombraEscalera, side:THREE.DoubleSide,
                 polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}),
  muro:       new THREE.MeshLambertMaterial({color:0x2a1519, side:THREE.DoubleSide}),
  antepecho:  new THREE.MeshLambertMaterial({color:0x6b2226, side:THREE.DoubleSide}),
  oro:        new THREE.MeshLambertMaterial({color:0xc9922f, emissive:0x2a1c05, side:THREE.DoubleSide}),
  // El mismo mapa actúa como color y microrrelieve: así el grano de
  // fundición se conserva en placa, brazos, copas y cadenas pequeñas.
  bronceAplique:new THREE.MeshPhongMaterial({map:texBronceAplique,
                 bumpMap:texBronceAplique,bumpScale:0.008,color:0xb28d59,
                 emissive:0x120b03,shininess:24,side:THREE.DoubleSide}),
  vidrioAplique:new THREE.MeshPhongMaterial({color:0xd8d1bd, emissive:0x3a3529,
                 transparent:true, opacity:0.82, shininess:55}),
  yeso:       new THREE.MeshLambertMaterial({color:0xd8c9a8, side:THREE.DoubleSide}),
  entresueloFrente:new THREE.MeshLambertMaterial({map:texEntresuelo,
                    color:0xc8bda9, side:THREE.DoubleSide}),
  hueco:      new THREE.MeshLambertMaterial({color:0x140a0c, side:THREE.DoubleSide}),
  tablas:     new THREE.MeshLambertMaterial({color:0x5b3a24}),
  sueloEscenario:new THREE.MeshLambertMaterial({map:texSueloEscenario, color:0xc5c5c5}),
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
