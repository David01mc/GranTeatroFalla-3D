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
/* Suelo del patio de butacas. superficie() proyecta el UV en mundo,
   normalizado a 28 m en x y 27 m en z, así que el repeat sale en
   metros directos: 28x27 da una tabla de 1,00 x 1,00 m, la misma
   escala a la que se ve esta madera en el rellano de la escalera del
   foso. Antes: Parquet.webp a 14x16, es decir 2,00 x 1,69 m.

   El mapa no es MaderaPlateaInferior sino una versión derivada suya:
   aquélla es una foto de panel de pared y sobre el patio se leía como
   una cuadrícula. Tenía dos defectos que el repeat no puede corregir:
   la costura horizontal saltaba 11,7 veces el gradiente natural de la
   veta, y traía la iluminación cocida —una mancha oscura de 5,8
   niveles— que, repetida cada metro, le daba al ojo una marca con la
   que contar baldosas. La derivada le resta la baja frecuencia y funde
   los bordes contra su espejo: costura 0,5x y mancha 1,2 niveles. */
var REPETIDO_PATIO  = new THREE.Vector2(28, 27);
var texSueloPatio   = textura('Textures/MaderaSueloPatio.webp',
                        REPETIDO_PATIO.x, REPETIDO_PATIO.y);
// El suelo se ve casi siempre en rasante, donde el filtrado isótropo
// emborrona la veta y deja ver el patrón. Se pide anisotropía sólo
// aquí; WebGLTextures la recorta al máximo del equipo.
texSueloPatio.anisotropy = 8;
var texVariacionPatio=textura('Textures/VariacionSueloPatio.webp', 1, 1);

/* Aun sin costura, 28x27 m a una tabla por metro son unas 750 baldosas
   idénticas. Esto multiplica el albedo por un ruido suave muestreado
   sobre el UV SIN repetir —vUv viene ya multiplicado por el repeat, de
   ahí la división—, de modo que el tono varía a escala de sala y no de
   baldosa. Cuesta una lectura de textura más en un solo material.
   customProgramCacheKey evita que el compilador reutilice para este
   material un programa cacheado de otro Lambert con la misma firma. */
function variacionMacro(material, mapa, repetido){
  material.onBeforeCompile = function(shader){
    shader.uniforms.mapaVariacion = {value: mapa};
    shader.uniforms.repetidoBase  = {value: repetido};
    shader.fragmentShader =
      'uniform sampler2D mapaVariacion;\nuniform vec2 repetidoBase;\n' +
      shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.rgb *= ' +
        'texture2D( mapaVariacion, vUv / repetidoBase ).rgb * 2.0;');
  };
  material.customProgramCacheKey = function(){ return 'variacionMacro'; };
  return material;
}
var texParquetPlatea= textura('Textures/Parquet.webp', 1, 1);
var texParquetPalco = textura('Textures/Parquet.webp', 3, 3);
var texSueloEscenario=textura('Textures/SueloEscenarioDesgastado.webp', 3, 3);
var texAlfombra     = textura('Textures/RedCarpet.webp', 1, 1); // el largo se controla en el propio UV de la alfombra
// Carga independiente: clonar antes de que TextureLoader termine puede
// dejar la copia sin imagen y producir peldaños negros.
var texAlfombraEscalera=textura('Textures/RedCarpet.webp',1,1);
texAlfombraEscalera.center.set(0.5,0.5);
texAlfombraEscalera.rotation=Math.PI/2;
texAlfombraEscalera.needsUpdate=true;
/* Terciopelo del telón, las patas y las cortinas de palco. No es
   Telon.webp sino una versión derivada suya: la original no es
   repetible y sobre los diez metros del telón de boca cada repetición
   dejaba un escalón de brillo a todo lo ancho —la costura horizontal
   saltaba 4,8 veces el gradiente natural del tejido, y encima traía la
   iluminación de la foto cocida—. La derivada le resta la baja
   frecuencia y funde los bordes contra su espejo: 0,2x y 0,5 niveles.
   El UV de cortina() ya lleva su propio repetido, de ahí el 1,1. */
var texTelon        = textura('Textures/TelonSinCostura.webp', 1, 1);
var texTechoPalcos  = textura('Textures/TechoPalcosGenerado.png',1,1);
var texEstucoPilastra=textura('Textures/EstucoPilastraGenerado.png',1,1);
var texPiedraPilastra=textura('Textures/PiedraPilastraGenerada.png',1,1);
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
/* Foso. Sus tres superficies compartían el defecto de no leerse: dos
   eran color plano y la tercera tenía el mapa anulado por el albedo.
   Las UV de cinta()/banda() avanzan 0,5 por metro, y el arco del foso
   mide 18,06 m, de modo que repeat 1 estiraba cada baldosa a 2 m. */
var texSueloFoso    = textura('Textures/SueloEscenarioDesgastado.webp', 2, 2);
var texMaderaFoso   = textura('Textures/MaderaPlateaInferior.webp', 2, 2);
// Instancia aparte para los peldaños: son BoxGeometry, cuyo UV recorre
// 0..1 en cada cara, no 0,5 por metro. Con el repetido del rellano una
// huella de 28 cm mostraría dos tablas enteras.
var texPeldanoFoso  = textura('Textures/MaderaPlateaInferior.webp', 1, 1);
var texMuroFoso     = textura('Textures/MaderaPasilloGrisOscura.webp', 3, 1);
var texAntepechoFoso= textura('Textures/TerciopeloPasamanos.webp', 2.5, 1);
var texBaldosaPasillo=textura('Textures/BaldosasPasilloClaras.webp', 1, 1);
var texTerciopeloPasamanos=textura('Textures/TerciopeloPasamanos.webp', 1, 1);
var texPanelPalcoFrontal=cargador.load('Textures/PanelPalcoFrontalMudejar.webp');
var texFrisoPalcoFrontal=cargador.load('Textures/FrisoSuperiorPalcoFrontalMudejar.webp');
// Acabado del canto visible del entresuelo: paño malva entre molduras
// horizontales, sin la cenefa de arquillos de la parte superior.
var texEntresuelo   = textura('Textures/EntresueloOrnamental.webp', 0.33, 1);
var texBronceAplique= textura('Textures/BronceApliqueEnvejecido.webp', 2, 2);

// La versión WebP ya está desaturada offline: evita crear un canvas y
// recorrer millones de píxeles durante el arranque.
var matTerciopeloButaca = new THREE.MeshLambertMaterial({map:texTerciopelo,color:new THREE.Color(0.90,1,1)});

// Imágenes generadas para el patio: terciopelo suave y nogal mate.
var texNogalPatio=textura('Textures/NogalButacaPatioGenerado.png',1,1);
var texTejidoPatio=textura('Textures/TerciopeloButacaPatioGenerado.png',1,1);

var MAT = {
  // La imagen aporta solo el microrrelieve; el color coincide con el
  // blanco roto de las piezas mudéjares. Se oscurece en el albedo porque
  // sobre la embocadura se suman tres luces cálidas y un valor más alto
  // termina recortado a blanco puro.
  estucoPilastra:new THREE.MeshLambertMaterial({bumpMap:texEstucoPilastra,
                   bumpScale:0.012,color:0x817b70}),
  piedraPilastra:new THREE.MeshLambertMaterial({map:texPiedraPilastra,color:0xc4c4c4}),
  terciopeloButaca: matTerciopeloButaca,
  maderaButaca:     new THREE.MeshLambertMaterial({map:texMaderaButaca}),
  // Acabado mate, acorde con la carpintería envejecida de la sala.
  // Ambos albedos se compensan para las luces cálidas del patio: sin
  // este tinte la madera vira a naranja y el terciopelo a rojo carmín.
  maderaButacaPatio:new THREE.MeshLambertMaterial({map:texMaderaButaca}),
  tapizadoButacaPatio:new THREE.MeshLambertMaterial({map:texTerciopelo,
                       color:new THREE.Color(0.90,1,1)}),
  // Tinte ligeramente gris para conservar la veta sin quemarla bajo los
  // numerosos focos cálidos de los palcos.
  maderaBlanca:     new THREE.MeshLambertMaterial({map:texMaderaBlanca, color:0xb0a99b, side:THREE.DoubleSide}),
  maderaPlatea:     new THREE.MeshLambertMaterial({map:texMaderaPlatea, side:THREE.DoubleSide}),
  /* Tablazón gastada del fondo del foso. El albedo 0x292929 dejaba el
     mapa al 16% y la superficie salía negra; 0x6a5f54 la hace legible
     manteniéndola como el suelo más oscuro de la sala. */
  maderaFoso:       new THREE.MeshLambertMaterial({map:texSueloFoso, color:0x6a5f54, side:THREE.DoubleSide}),
  // Revestimiento del muro de contención del foso, de -0,90 a la cota
  // del patio. Antes compartía MAT.muro, color plano usado por toda la
  // estructura del teatro: se separa para poder texturarlo aquí solo.
  muroFoso:         new THREE.MeshLambertMaterial({map:texMuroFoso, color:0x54343a, side:THREE.DoubleSide}),
  // Antepecho tapizado del foso. Mismo terciopelo que el pasamanos,
  // pero con repetido propio: sobre los 18 m del arco el del pasamanos
  // daba baldosas de 2 m y el paño se leía como un plano granate liso.
  antepechoFoso:    new THREE.MeshLambertMaterial({map:texAntepechoFoso, color:0x9a7777, side:THREE.DoubleSide}),
  panelPalcoFrontal:new THREE.MeshLambertMaterial({map:texPanelPalcoFrontal, color:0xc8b99b, side:THREE.DoubleSide}),
  frisoPalcoFrontal:new THREE.MeshLambertMaterial({map:texFrisoPalcoFrontal, color:0xc8b99b, side:THREE.DoubleSide}),
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
  /* Suelo de los palcos —de los cuatro niveles—, del palco frontal y de
     los peldaños del graderío. Era un color plano sin mapa: la única
     superficie pisable de la sala que no tenía veta. El tono sube de
     0x3a2118 a 0x7a5c46 porque ahora multiplica a la imagen, y con el
     valor viejo el parqué salía casi negro. banda() da UV por longitud,
     0,5 por metro, así que con repeat 3 sale una tabla cada 67 cm. */
  suelo:      new THREE.MeshLambertMaterial({map:texParquetPalco, color:0x7a5c46,
                side:THREE.DoubleSide}),
  // Mapas repetibles propios del corredor: yeso fino, baldosa mineral y
  // madera teñida. El color solo modula levemente la fotografía base.
  paredPasillo:new THREE.MeshLambertMaterial({map:texParedPasillo, color:0xf2f2ee, side:THREE.DoubleSide}),
  /* La misma pared, pero dentro del palco frontal. Ahí se suman el
     ambiente, la hemisférica, la araña y un foco propio a 2,60 m, y con
     el albedo casi blanco del corredor el paño se recortaba a blanco
     puro. Se baja el albedo y se admite color por vértice, que es como
     se le hornea la sombra: el proyecto no tiene mapas de sombra. */
  paredPalcoFrontal:new THREE.MeshLambertMaterial({map:texParedPasillo,
                      color:0xb3a795, vertexColors:true, side:THREE.DoubleSide}),
  // Velo situado solo en la cara del antepalco orientada a la sala.
  // Conserva el grano del yeso inferior y simula la penumbra del fondo.
  sombraAntepalco:new THREE.MeshBasicMaterial({color:0x21191a, transparent:true,
                    opacity:0.48, side:THREE.DoubleSide, depthWrite:false}),
  sueloPasillo:new THREE.MeshLambertMaterial({map:texBaldosaPasillo, color:0xd6d6d0, side:THREE.DoubleSide}),
  zocaloPasillo:new THREE.MeshLambertMaterial({map:texMaderaPasillo, color:0x8a8a86, side:THREE.DoubleSide}),
  parquet:    variacionMacro(new THREE.MeshLambertMaterial({map:texSueloPatio,
                side:THREE.DoubleSide}), texVariacionPatio, REPETIDO_PATIO),
  parquetPlatea:new THREE.MeshLambertMaterial({map:texParquetPlatea, side:THREE.DoubleSide}),
  // polygonOffset empuja la alfombra hacia la cámara en el buffer de
  // profundidad (no en el mundo): el pequeño y+0.06 de alfombra() ya no
  // basta él solo para evitar el parpadeo/hundimiento con el parquet al
  // verla de lejos o en rasante, así que se combinan las dos.
  // Granate apagado: conserva el pelo fotografiado sin convertirse en
  // una franja roja luminosa bajo las luces cálidas del patio.
  alfombra:   new THREE.MeshLambertMaterial({map:texAlfombra,color:0x73545a,side:THREE.DoubleSide,
                 polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4}),
  alfombraEscalera:new THREE.MeshLambertMaterial({map:texAlfombraEscalera,color:0x73545a,side:THREE.DoubleSide,
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
  techoPalco: new THREE.MeshLambertMaterial({map:texTechoPalcos,
                color:0xb59b83, side:THREE.DoubleSide}),
  /* Peldaños, rellano y costados de la escalera del foso: único uso de
     tablas en toda la sala. Recibe la misma carpintería del faldón del
     escenario, que arranca a un metro. El albedo sube de 0x5b3a24
     porque ahora multiplica al mapa en lugar de ser el color final. */
  tablas:     new THREE.MeshLambertMaterial({map:texMaderaFoso, color:0xad6e44}),
  // Huellas y tabicas de la escalera del foso: misma madera y mismo
  // tinte que tablas, con el repetido que pide el UV por cara del cubo.
  peldanoFoso:new THREE.MeshLambertMaterial({map:texPeldanoFoso, color:0xad6e44}),
  sueloEscenario:new THREE.MeshLambertMaterial({map:texSueloEscenario, color:0xc5c5c5}),
  cortinaPalco:new THREE.MeshLambertMaterial({map:texTelon, color:0x74303c,
                 vertexColors:true, side:THREE.DoubleSide}),
  alzapanoPalco:new THREE.MeshLambertMaterial({color:0xc5a574, side:THREE.DoubleSide}),
  /* Terciopelo del telón y de las patas. vertexColors deja que cortina()
     hornee el claroscuro del pliegue en la propia malla: sin él la tela
     depende sólo de las normales y, con la luz difusa de la boca, los
     pliegues se aplanan. Toda cortina emite el atributo color —blanco
     cuando no pide sombra—, así que las patas y los subtelones siguen
     viéndose igual que antes. */
  telon:      new THREE.MeshLambertMaterial({map:texTelon, vertexColors:true,
                side:THREE.DoubleSide})
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
