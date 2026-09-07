(function(){
'use strict';
var FALLA = window.FALLA;
var geo = FALLA.geo, P = geo.P, MAT = FALLA.materiales.MAT, registrar = FALLA.materiales.registrar;

/* Piezas reutilizables, extraídas a js/geometria/. Se toman como alias
   locales para poder seguir llamándolas por su nombre a secas, igual que
   cuando vivían en este archivo. */
var piezas = FALLA.piezas;
// primitivas.js — mallas genéricas a partir de polilíneas
var cinta = piezas.cinta, banda = piezas.banda, superficie = piezas.superficie;
var alfombra = piezas.alfombra, enlaceAlfombra = piezas.enlaceAlfombra;
var remuestreaLinea = piezas.remuestreaLinea;
// mobiliario.js — butaca del patio y silla de palco
var ALTO_BRAZO = piezas.ALTO_BRAZO, perfilRespaldo = piezas.perfilRespaldo;
var geometriaBrazo = piezas.geometriaBrazo, construirSillaPalco = piezas.construirSillaPalco;
// ornamento.js — balaustre, mampara, columna y cortina mudéjares
var FONDO_MAMPARA = piezas.FONDO_MAMPARA;
var geometriaBalaustreOrnamental = piezas.geometriaBalaustreOrnamental;
var construirMamparaArcos = piezas.construirMamparaArcos;
var columnaMudejar = piezas.columnaMudejar;
var geometriaCortinaPalco = piezas.geometriaCortinaPalco;
var perfilCortina = piezas.perfilCortina, cortina = piezas.cortina;
// El suelo principal queda a 4,35 m, pero su línea inferior conserva la
// cota histórica de 4,10 m; los 25 cm intermedios forman el entresuelo.
var COTA_BAJO_PRINCIPAL=P.pisos[1].y-P.entresueloPrincipal;

/* ---------------- BUTACAS -----------------------------------------
   El patio tiene 3 bloques rectos (izquierda, centro, derecha) y 4
   pasillos: dos centrales (entre cada lateral y el bloque central) y
   dos laterales (entre cada lateral y el muro). Todas las butacas
   miran hacia el escenario (-z), así que no hace falta rotarlas fila
   a fila como en un patio en abanico.
   Se instancian con InstancedMesh: cientos de asientos con 4 draw calls.
-------------------------------------------------------------------*/
var nButacas=0, nFilas=0;

var ASIENTO_PASO = 0.60;     // separación entre butacas de una misma fila (m)
var FILA_PASO    = 1.00;     // separación entre filas (m)
var PASILLO_CENTRAL = 1.4;   // ancho de los dos pasillos entre el bloque central y los laterales
var PASILLO_LATERAL = 1.2;   // ancho de los dos pasillos junto a los muros
var Z_FILA1 = 3.8;           // profundidad (z) de la fila 1, la más cercana al escenario

var FILAS_CENTRO = 21, ASIENTOS_CENTRO = 9;
var FILAS_LATERAL = 20;
// fila 1 (junto al escenario) .. fila 15 (junto al fondo de la sala)
var ASIENTOS_LATERAL = [6,6,6, 7,7,7,7,7,7,7,7, 7,7,7,7, 6,6,5,4,3];

var CENTRO_MEDIO = ASIENTOS_CENTRO/2*ASIENTO_PASO;              // media anchura del bloque central
var LATERAL_DENTRO = CENTRO_MEDIO + PASILLO_CENTRAL;             // borde interior (hacia el pasillo central) de cada lateral
// Media anchura reservada en el fondo para los cinco vanos técnicos.
// Debe superar el borde exterior del último arco (4.60 + 2.16/2), de
// modo que la última portada de palco nunca invada su columna lateral.
var RESERVA_TECNICA_MEDIA = 5.80;

// Pasillo transversal justo delante de la fila 1 (no a su altura ni por
// detrás): termina exactamente donde empieza el patio de butacas —el
// mismo borde que ya usa pasillosPatio() para arrancar la alfombra— y
// se extiende PASILLO_CENTRAL hacia el escenario desde ahí. Conecta cada
// pasillo central con el Palco Frontal de su lado, perpendicular a los
// pasillos de alfombra. ANCHO_FRONTAL es también la profundidad (en X,
// desde el muro) del propio Palco Frontal (ver construir() en
// geometria.js).
var ANCHO_FRONTAL = 2.5;
var DESPLAZAMIENTO_FRONTAL_X = 3.0; // 3 m hacia atrás de cada palco, hacia el muro lateral
var RETIRO_ESCENARIO_Z = geo.frenteEscenico.retiro; // el escenario retrocede para alojar las alas
var AVANCE_ALAS_EMBOCADURA = geo.frenteEscenico.avanceAlas;
var Z_CORREDOR_FIN = Z_FILA1-0.6, Z_CORREDOR_INI = Z_CORREDOR_FIN-PASILLO_CENTRAL;

/* Fondo y frente (en X, lado derecho) del Palco Frontal. Devuelve los
   límites del lado derecho (signo=+1); el izquierdo es su espejo.

   El palco debe quedar pegado a la boca del escenario, no a media sala:
   su fondo se ancla justo al borde del arco (P.arcoA), con un pequeño
   margen. Esa posición deseada se limita («cap») al punto más estrecho
   del muro real en todo el tramo [0,Z_CORREDOR_INI] — si el muro
   llegase a estrecharse ahí (como pasaba con la circunferencia + tramo
   recto de antes de pasar a la elipse), un fondo fijo se saldría de él
   y quedaría oculto detrás del muro que sí se ve. Con la planta
   elíptica actual ese límite ya no aprieta (el muro solo se ensancha
   según nos alejamos del escenario), así que en la práctica manda la
   posición deseada. */
function limitesFrontal(){
  var margenMuro=0.3, xFondoSeguro=1e9, i;
  for(i=0;i<geo.PLAN.length;i++){
    if(geo.PLAN[i].x>0 && geo.PLAN[i].z>=0 && geo.PLAN[i].z<=Z_CORREDOR_INI) xFondoSeguro=Math.min(xFondoSeguro, geo.PLAN[i].x);
  }
  xFondoSeguro -= margenMuro;
  var xFondoDeseado = P.arcoA + 1.0;
  var xFondo = Math.min(xFondoDeseado, xFondoSeguro);
  return {xFondo:xFondo, xFrente:xFondo-ANCHO_FRONTAL};
}

/* Ancho de la vuelta a la herradura, en palcos. El palco 2 se adelanta
   entero; a partir de su tabique el borde regresa a la curva a lo largo
   de este tramo. En 0 el regreso es un ángulo seco, y se nota mucho en
   la celosía vista desde el patio; en 1 el palco 3 hace de embudo y la
   valla entra en la curva sin quiebro. */
var PALCOS_VUELTA_PROSCENIO=1;

/* Adelanta el palco 2 del principal —el primero de la balconada, el que
   sigue al palco frontal— hasta la línea del frente de éste. Sin ello el
   anillo arranca ya sobre la herradura, 2,14 m por detrás, y la valla da
   un escalón justo en la junta entre uno y otro: el palco frontal
   asomaba sobre el patio y el palco 2 quedaba retranqueado contra el
   muro.

   Se adelanta el palco 2 entero: su frente pasa a ser el mismo x que el
   del palco frontal y su fondo se queda donde está, de modo que gana
   profundidad. Desde su tabique, el borde vuelve a la herradura con un
   suavizado de pendiente nula al llegar, repartido sobre
   PALCOS_VUELTA_PROSCENIO palcos y medido sobre el recorrido real de la
   valla, no por índice.

   El corte se toma del mismo reparto por longitud que usa
   separadoresPalco(), no de una distancia aparte: así el palco 2 llega
   adelantado exactamente hasta su tabique y no hasta media celda.

   Devuelve un contorno nuevo. El original no se toca porque geo.dentro()
   lo recalcula para cada piso y sólo el principal lleva este adelanto. */
function adelantaPalcosProscenio(borde, palcosLado){
  var xObjetivo=limitesFrontal().xFrente+DESPLAZAMIENTO_FRONTAL_X;
  // Junta con el palco frontal (donde arranca el palco 2) y final de la
  // fila de palcos, que es donde empieza el palco de autoridades.
  var iRef=0, iLim=borde.length-1, i;
  for(i=0;i<geo.PLAN.length;i++){ if(geo.PLAN[i].z>=Z_CORREDOR_INI){ iRef=i; break; } }
  for(i=0;i<geo.PLAN.length;i++){ if(geo.PLAN[i].x<=4.4){ iLim=i; break; } }
  var corte=indicesPorLongitud(geo.PLAN, iRef, iLim, palcosLado)[1];
  var largo=0;
  for(i=iRef+1;i<=iLim;i++) largo+=Math.hypot(borde[i].x-borde[i-1].x, borde[i].z-borde[i-1].z);
  var vuelta=largo/Math.max(1,palcosLado)*PALCOS_VUELTA_PROSCENIO;

  var salida=borde.map(function(p){return {x:p.x, z:p.z};});
  var ultimo=borde.length-1;
  [1,-1].forEach(function(signo){
    var en=function(k){ return signo>0?k:ultimo-k; };
    // Palco frontal y palco 2, a la línea del frente. Por debajo de iRef
    // el borde va bajo el propio palco frontal: mantenerlo en la misma
    // recta evita un entrante en la junta entre los dos.
    for(var k=0;k<=corte;k++) salida[en(k)].x=signo*xObjetivo;
    if(vuelta<=0) return;
    var recorrido=0;
    for(k=corte+1;k<=ultimo;k++){
      var a=borde[en(k-1)], b=borde[en(k)];
      recorrido+=Math.hypot(b.x-a.x, b.z-a.z);
      var t=recorrido/vuelta;
      if(t>=1) break;                       // ya está sobre la herradura
      var w=1-(3*t*t-2*t*t*t);
      salida[en(k)].x=b.x+w*(signo*xObjetivo-b.x);
    }
  });
  return salida;
}

function zFila(i){ return Z_FILA1 + i*FILA_PASO; }

/* Los 9x16 asientos del bloque central. */
function sitiosCentro(){
  var out=[];
  for(var i=0;i<FILAS_CENTRO;i++){
    var z=zFila(i);
    for(var c=0;c<ASIENTOS_CENTRO;c++) out.push({x:(c-(ASIENTOS_CENTRO-1)/2)*ASIENTO_PASO, z:z});
  }
  return out;
}

/* Bloque lateral (signo=-1 izquierda, +1 derecha): pegado al pasillo
   central, con el número de butacas por fila del enunciado; el hueco
   hacia el muro varía fila a fila y es lo que deja el pasillo lateral.
   La fila 1 (i=0) se deja libre: ahí cruza el pasillo transversal que
   lleva del pasillo central al Palco Frontal (ver pasillosPatio()). */
function sitiosLateral(signo){
  var out=[];
  for(var i=1;i<FILAS_LATERAL;i++){
    var z=zFila(i), n=ASIENTOS_LATERAL[i];
    for(var k=0;k<n;k++){
      var x=signo*(LATERAL_DENTRO + (k+0.5)*ASIENTO_PASO);
      // salvaguarda: si esta butaca dejase menos del pasillo lateral mínimo
      // hasta el muro real, se omite en vez de solaparse con la pared.
      if(geo.distAPlanta(x,z) < PASILLO_LATERAL) continue;
      out.push({x:x, z:z});
    }
  }
  return out;
}

var SITIOS_BUTACAS=sitiosCentro().concat(sitiosLateral(-1),sitiosLateral(1));
geo.sitiosButacas=SITIOS_BUTACAS;
/* Franja de piernas de cada fila: el tramo libre justo delante de sus
   butacas, por el que se llega al sitio caminando de lado desde el
   pasillo. Medida desde el eje de la fila, hacia el escenario. */
var PIERNAS_DELANTE = 0.50, PIERNAS_DETRAS = 0.20;

/* Colisión del bloque de butacas. No basta con acotar cada asiento por
   separado: entre butaca y butaca quedan 12 cm libres, y como esos
   huecos se repiten fila tras fila formaban pasillos rectos de delante
   a atrás por los que se cruzaba el patio entero.

   El criterio es por franjas. Dentro del bloque todo está ocupado salvo
   el espacio de piernas de cada fila, que es continuo a lo ancho —así se
   recorre la fila hasta el sitio— pero queda separado del de la fila
   siguiente por el cuerpo de las butacas. Para cambiar de fila hay que
   salir al pasillo, o saltar, igual que en una sala de verdad. */
geo.enButacaIndividual=function(x,z){
  if(!enBloqueAsientos(x,z)) return false;
  var fase = z - (Z_FILA1 + Math.round((z-Z_FILA1)/FILA_PASO)*FILA_PASO);
  var enPiernas = fase > -PIERNAS_DELANTE && fase < -PIERNAS_DETRAS;
  return !enPiernas;
};

/* ¿(x,z) cae sobre una butaca? (para el modo paseo: solo se puede caminar
   por los pasillos, y hay que saltar para pasar por encima de las filas). */
function enBloqueAsientos(x,z){
  var i = Math.round((z-Z_FILA1)/FILA_PASO);
  if(i < 0) return false;
  if(i < FILAS_CENTRO && Math.abs(x) < CENTRO_MEDIO) return true;
  if(i > 0 && i < FILAS_LATERAL){
    var ancho = ASIENTOS_LATERAL[i]*ASIENTO_PASO;
    if(Math.abs(x) >= LATERAL_DENTRO && Math.abs(x) < LATERAL_DENTRO+ancho){
      return geo.distAPlanta(x,z) >= PASILLO_LATERAL; // coincide con la salvaguarda de sitiosLateral()
    }
  }
  return false;
}
geo.enBloqueAsientos = enBloqueAsientos;

/* Fuente única de la geometría de los pasillos posteriores. Rampas,
   alfombras y extensiones de platea deben consumir estos mismos puntos
   para que sus bordes coincidan incluso cuando cambia la curvatura. */
function ejeAlfombraPasillo(signo){
  var r=geo.rampasTraseras,zIni=Z_FILA1-0.70,zFin=r.zFin;
  var cx=(CENTRO_MEDIO+LATERAL_DENTRO)/2,pts=[];
  for(var i=0;i<=28;i++){
    var z=zIni+(zFin-zIni)*i/28;
    var x=z<r.zInicio?cx:geo.centroRampaTrasera(z);
    pts.push({x:signo*x,z:z});
  }
  return pts;
}

function anchoAlfombraPasillo(p){
  var anchoBase=PASILLO_CENTRAL-0.36;
  return p.z<geo.rampasTraseras.zInicio?anchoBase:geo.anchoRampaTrasera(p.z)-0.31;
}

/* Devuelve uno de los dos bordes reales de la malla de alfombra.
   exterior=true selecciona el que mira al palco lateral; false, el que
   mira a las tres cabinas centrales. */
function bordeAlfombraPasillo(signo,exterior,zDesde){
  var eje=ejeAlfombraPasillo(signo),salida=[];
  for(var i=0;i<eje.length;i++){
    var p=eje[i];if(zDesde!==undefined && p.z<zDesde)continue;
    var a=eje[Math.max(0,i-1)],b=eje[Math.min(eje.length-1,i+1)];
    var tx=b.x-a.x,tz=b.z-a.z,L=Math.hypot(tx,tz)||1;tx/=L;tz/=L;
    var nx=-tz,nz=tx,w=anchoAlfombraPasillo(p)/2;
    var e1={x:p.x-nx*w,z:p.z-nz*w},e2={x:p.x+nx*w,z:p.z+nz*w};
    var primeroExterior=signo*e1.x>signo*e2.x;
    salida.push(exterior?(primeroExterior?e1:e2):(primeroExterior?e2:e1));
  }
  return salida;
}

/* Las alfombras solo cubren los dos pasillos centrales (los que más se
   recorren); los laterales, junto a los muros, se quedan en parquet.
   La alfombra se pinta algo más estrecha que el propio pasillo — deja
   un pequeño margen de parquet a cada lado, como una alfombra de
   pasillo real que no llega de canto a canto — para que el borde del
   brazo de la butaca (que toca justo el límite del pasillo) no quede
   pegado al borde de la alfombra: el brazo mide 0.54 m de alto, y visto
   desde muy arriba y algo lejos la perspectiva puede desplazar su parte
   alta bastante más de lo que separaría un margen pequeño, así que el
   hueco tiene que ser generoso, no solo simbólico. */
function pasillosPatio(){
  var g=new THREE.Group();
  // Entra 10 cm bajo la alfombra transversal: al estar el patio en
  // pendiente, una junta exacta dejaba asomar una línea de parquet.
  [-1,1].forEach(function(signo){
    g.add(alfombra(ejeAlfombraPasillo(signo),anchoAlfombraPasillo,MAT.alfombra));
  });
  // Alfombra transversal, perpendicular a las dos de arriba: justo
  // delante de la fila 1 (Z_CORREDOR_INI..FIN), de Palco Frontal a Palco
  // Frontal, cruzando también por delante del bloque central — una sola
  // pieza continua (no dos tramos con un hueco en medio) para que enlace
  // sin costura con las dos alfombras verticales en Z_CORREDOR_FIN. A
  // todo el ancho del pasillo (no con el margen de las de arriba).
  var zCruce=(Z_CORREDOR_INI+Z_CORREDOR_FIN)/2;
  var xBase=limitesFrontal().xFrente,xEscalera=geo.escalerasLaterales.xBajo;
  var ptsCruce=[{x:-xBase,z:zCruce},{x:xBase,z:zCruce}];
  g.add(alfombra(ptsCruce, PASILLO_CENTRAL, MAT.alfombra));
  [-1,1].forEach(function(signo){
    var e=geo.escalerasLaterales;
    // Solapa 6 cm bajo ambas piezas contiguas y conserva testeros rectos.
    g.add(enlaceAlfombra(
      signo*(xBase-0.06),zCruce,PASILLO_CENTRAL,
      signo*(xEscalera+0.06),e.centroZ,e.ancho-0.08,MAT.alfombra));
  });
  return g;
}

function butacas(){
  var sitios = sitiosCentro().concat(sitiosLateral(-1), sitiosLateral(1));
  nButacas = sitios.length;
  nFilas = FILAS_CENTRO;

  var GROSOR_BRAZO=0.07, X_BRAZO=ASIENTO_PASO/2-0.035; // deja un pequeño hueco entre butacas vecinas
  var yFilete=ALTO_BRAZO+0.005;

  var geoRespaldo=new THREE.ExtrudeGeometry(perfilRespaldo(0.46,0.56,0.19),
    {depth:0.10, bevelEnabled:false, curveSegments:10});
  geoRespaldo.translate(0,0.50,0.15);
  // Concha de madera del respaldo: el mismo perfil, más ancho/alto y
  // más grueso, colocada justo detrás del cojín tapizado, para que
  // asome como un marco de madera alrededor y por detrás de la tela
  // (tal como en las butacas reales del Falla, vistas desde el pasillo).
  var geoRespaldoMadera=new THREE.ExtrudeGeometry(perfilRespaldo(0.56,0.64,0.22),
    {depth:0.07, bevelEnabled:false, curveSegments:10});
  geoRespaldoMadera.translate(0,0.46,0.24);
  var geoCojin=new THREE.BoxGeometry(0.46,0.10,0.42); geoCojin.translate(0,0.47,0.00);
  var geoBase=new THREE.BoxGeometry(0.50,0.06,0.40); geoBase.translate(0,0.38,0.00);
  var geoBrazoI=geometriaBrazo(GROSOR_BRAZO); geoBrazoI.translate(-X_BRAZO,0,0);
  var geoBrazoD=geometriaBrazo(GROSOR_BRAZO); geoBrazoD.translate(X_BRAZO,0,0);
  var geoFileteI=new THREE.BoxGeometry(GROSOR_BRAZO+0.015,0.025,0.14); geoFileteI.translate(-X_BRAZO,yFilete,0.16);
  var geoFileteD=new THREE.BoxGeometry(GROSOR_BRAZO+0.015,0.025,0.14); geoFileteD.translate(X_BRAZO,yFilete,0.16);

  // Todas las butacas son iguales: un único material de terciopelo y
  // uno de madera para las 326 (8 draw calls en total, no una por butaca).
  var piezas=[
    {g:geoRespaldoMadera, m:MAT.maderaButaca},
    {g:geoRespaldo,       m:MAT.terciopeloButaca},
    {g:geoCojin,          m:MAT.terciopeloButaca},
    {g:geoBase,           m:MAT.maderaButaca},
    {g:geoBrazoI,         m:MAT.maderaButaca},
    {g:geoBrazoD,         m:MAT.maderaButaca},
    {g:geoFileteI,        m:MAT.oro},
    {g:geoFileteD,        m:MAT.oro}
  ];

  var grupo=new THREE.Group(), m4=new THREE.Matrix4(), q=new THREE.Quaternion(),
      pos3=new THREE.Vector3(), esc=new THREE.Vector3(1,1,1);

  piezas.forEach(function(p){
    var im=new THREE.InstancedMesh(p.g, p.m, sitios.length);
    for(var i=0;i<sitios.length;i++){
      var s=sitios[i];
      pos3.set(s.x, geo.rake(s.z), s.z);
      m4.compose(pos3,q,esc); // q = identidad: todas las butacas miran hacia el escenario
      im.setMatrixAt(i,m4);
    }
    im.instanceMatrix.needsUpdate=true;
    grupo.add(im);
  });

  return grupo;
}

/* ---------------- EMBOCADURA REAL DEL FALLA -----------------------
   La boca no es de herradura: dos jambas verticales reciben un arco
   muy rebajado, envuelto por arquivoltas y un ancho paño de lacería. */
function perfilArco(){
  var pts=[], arranque=8.15, clave=10.45, i, t;
  pts.push(new THREE.Vector2(P.arcoA,0));
  pts.push(new THREE.Vector2(P.arcoA,arranque));
  for(i=0;i<=48;i++){
    t=i/48;
    pts.push(new THREE.Vector2(
      P.arcoA*(1-2*t),
      arranque+4*(clave-arranque)*t*(1-t)
    ));
  }
  pts.push(new THREE.Vector2(-P.arcoA,arranque));
  pts.push(new THREE.Vector2(-P.arcoA, 0));
  return pts;
}

function cintaArcoRebajado(yExtra,grosor,z,mat){
  var n=48,pos=[],uv=[],idx=[],arranque=8.15,clave=10.45;
  for(var i=0;i<=n;i++){
    var t=i/n,x=P.arcoA*(1-2*t),y=arranque+4*(clave-arranque)*t*(1-t)+yExtra;
    pos.push(x,y-grosor/2,z, x,y+grosor/2,z);
    uv.push(t*3,0,t*3,1);
  }
  for(i=0;i<n;i++){var a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  var bg=new THREE.BufferGeometry();
  bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  bg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  bg.setIndex(idx); bg.computeVertexNormals();
  return new THREE.Mesh(bg,mat);
}

function embocadura(){
  var g=new THREE.Group();
  var perfil=perfilArco();

  // Solo el dintel queda en el plano frontal. Un hueco que coincidiese
  // con ambos bordes laterales produciría un contorno degenerado.
  var forma=new THREE.Shape();
  forma.moveTo(perfil[1].x,perfil[1].y);
  for(var i=2;i<perfil.length-1;i++) forma.lineTo(perfil[i].x,perfil[i].y);
  forma.lineTo(-P.arcoA,P.altura);
  forma.lineTo(P.arcoA,P.altura);
  forma.closePath();

  var muro=new THREE.Mesh(new THREE.ExtrudeGeometry(forma,{depth:0.7,bevelEnabled:false}), MAT.muro);
  muro.position.z=-0.35;
  g.add(muro);

  // Alas en planta: desde la boca hacia el frente de los palcos. El
  // tramo exterior vuelve a ser transversal para cerrar la sala.
  var xEncuentro=limitesFrontal().xFrente+DESPLAZAMIENTO_FRONTAL_X;
  var avance=AVANCE_ALAS_EMBOCADURA;
  // El paseo consulta la misma sección que se construye aquí.
  geo.embocadura={xEncuentro:xEncuentro,avance:avance,retiro:RETIRO_ESCENARIO_Z};
  [-1,1].forEach(function(s){
    var puntos=[{x:s*P.arcoA,z:0},{x:s*xEncuentro,z:avance},
      {x:s*(P.jamba+1.0),z:avance}];
    for(var k=0;k<puntos.length-1;k++){
      var a=puntos[k],b=puntos[k+1],dx=b.x-a.x,dz=b.z-a.z;
      var ala=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx,dz),P.altura,0.7),MAT.muro);
      ala.position.set((a.x+b.x)/2,P.altura/2,(a.z+b.z)/2);
      ala.rotation.y=-Math.atan2(dz,dx);
      g.add(ala);
    }
  });

  /* Remate superior del muro frontal. Alas y paño del arco terminan
     justo en P.altura, y a esa cota el techo de la sala ya ha despegado:
     quedaba una ranura horizontal por la que se veía el exterior, sobre
     todo junto a la embocadura. El muro se prolonga 2 m por encima,
     retranqueado 40 cm hacia el escenario para que las propias alas lo
     tapen desde la sala. */
  var remate=new THREE.Mesh(new THREE.BoxGeometry((P.jamba+1.0)*2,2.0,0.7),MAT.muro);
  remate.position.set(0,P.altura+0.8,avance-0.4);
  g.add(remate);

  // Gran paño curvo de lacería sobre la boca, como el granate con rombos
  // de las fotografías. Las cintas de distinto avance generan relieve.
  g.add(cintaArcoRebajado(1.02,1.52,0.38,MAT.embocaduraGeo));
  [
    {dy:0.02,h:0.16,z:0.48,m:MAT.oro},
    {dy:0.28,h:0.18,z:0.51,m:MAT.embocaduraCrema},
    {dy:0.54,h:0.13,z:0.54,m:MAT.oro},
    {dy:1.78,h:0.16,z:0.50,m:MAT.oro}
  ].forEach(function(b){g.add(cintaArcoRebajado(b.dy,b.h,b.z,b.m));});

  // Cada pilastra completa sigue el ala diagonal. Su eje vertical se
  // conserva; el giro es en planta, con base, panel y capitel solidarios.
  [-1,1].forEach(function(s){
    var lateral=new THREE.Group();
    var x=s*0.78;
    var fuste=new THREE.Mesh(new THREE.BoxGeometry(1.34,7.55,0.52),MAT.embocaduraCrema);
    fuste.position.set(x,4.08,0.30); lateral.add(fuste);
    var panel=new THREE.Mesh(new THREE.BoxGeometry(0.86,5.85,0.07),MAT.mudejarFloral);
    panel.position.set(x,4.25,0.60); lateral.add(panel);
    var zocalo=new THREE.Mesh(new THREE.BoxGeometry(1.62,0.82,0.70),MAT.maderaPlatea);
    zocalo.position.set(x,0.41,0.27); lateral.add(zocalo);
    [
      {y:7.72,w:1.62,h:0.22,d:0.68},
      {y:7.98,w:1.88,h:0.30,d:0.76},
      {y:8.28,w:2.08,h:0.30,d:0.82}
    ].forEach(function(c){
      var cap=new THREE.Mesh(new THREE.BoxGeometry(c.w,c.h,c.d),MAT.embocaduraCrema);
      cap.position.set(x,c.y,0.30); lateral.add(cap);
    });
    // Arquivoltas verticales paralelas a cada jamba.
    [0.00,0.28,0.54].forEach(function(dx,j){
      var banda=new THREE.Mesh(new THREE.BoxGeometry(j===1?0.18:0.14,7.35,0.15),j===1?MAT.embocaduraCrema:MAT.oro);
      banda.position.set(s*dx,4.48,0.48+j*0.025); lateral.add(banda);
    });
    // El basamento nace sobre las tablas; la coronación conserva su
    // encuentro con el arco superior al ajustar la altura de la pilastra.
    lateral.position.set(s*P.arcoA,geo.escenario.altura,0);
    lateral.scale.y=(8.43-geo.escenario.altura)/8.43;
    lateral.rotation.y=-s*Math.atan2(avance,xEncuentro-P.arcoA);
    g.add(lateral);
  });
  // La embocadura acompaña al escenario retirado para que el arco de
  // herradura siga definiendo correctamente la nueva boca escénica.
  g.position.z=-RETIRO_ESCENARIO_Z;
  return g;
}

/* ---------------- ESCENARIO --------------------------------------- */

/* Un juego de telón: dos patas (a los lados) y una bambalina (arriba),
   todo con pliegues. Un teatro real tiene varios de estos, cada vez
   más adentro del escenario, para tapar bambalinas, focos y patas de
   los juegos siguientes según se recula hacia el fondo. */
function juegoTelon(g, z, anchoBamba, altoPata, anchoPata, xPata, altoBamba){
  var basePata = perfilCortina(anchoPata, 3, anchoPata*0.18, 8);
  [-1,1].forEach(function(s){
    var perfil = basePata.map(function(p){ return {x:s*xPata+p.x, z:z+p.z}; });
    g.add(cortina(perfil, 0, altoPata, MAT.telon, 2.2));
  });
  var perfilBamba = perfilCortina(anchoBamba, 7, anchoBamba*0.02, 6)
    .map(function(p){ return {x:p.x, z:z+p.z}; });
  g.add(cortina(perfilBamba, altoPata-0.4, altoPata-0.4+altoBamba, MAT.telon, 1));
}

/* ---------------- TELÓN DE BOCA FUNCIONAL (se abre y se cierra) ---
   Dos paños que cuelgan recogidos junto a las patas del primer juego
   y se deslizan hasta juntarse en el centro. La geometría del pliegue
   no cambia; solo se traslada en x, así que animar es barato. */
var TELON_ANCHO=8.4, TELON_ALTO=10.3, TELON_Z=-0.9, TELON_X_ABIERTO=7.1;
var TELON_DURACION=3.0; // segundos que tarda en abrir/cerrar del todo

var telonDer=null, telonIzq=null, telonProgreso=0, telonObjetivo=0;

function perfilMedioTelon(ancho, pliegues, profundidad, segPorPliegue){
  var n=Math.max(1,Math.round(pliegues*segPorPliegue)), pts=[], i;
  for(i=0;i<=n;i++){
    var t=i/n;
    pts.push({x:t*ancho, z:Math.sin(t*pliegues*Math.PI*2)*profundidad});
  }
  return pts;
}

function construirTelonFuncional(g){
  var perfilD=perfilMedioTelon(TELON_ANCHO,5,TELON_ANCHO*0.09,8)
    .map(function(p){ return {x:p.x, z:TELON_Z+p.z}; });
  var perfilI=perfilMedioTelon(TELON_ANCHO,5,TELON_ANCHO*0.09,8)
    .map(function(p){ return {x:-p.x, z:TELON_Z+p.z}; });
  telonDer=cortina(perfilD, 0, TELON_ALTO, MAT.telon, 2.6);
  telonIzq=cortina(perfilI, 0, TELON_ALTO, MAT.telon, 2.6);
  telonDer.position.x=TELON_X_ABIERTO;
  telonIzq.position.x=-TELON_X_ABIERTO;
  g.add(telonDer, telonIzq);
}

function suaveT(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

function actualizarTelon(dt){
  if(!telonDer) return;
  var paso=dt/TELON_DURACION;
  if(telonProgreso<telonObjetivo) telonProgreso=Math.min(telonObjetivo, telonProgreso+paso);
  else if(telonProgreso>telonObjetivo) telonProgreso=Math.max(telonObjetivo, telonProgreso-paso);
  var x=TELON_X_ABIERTO*(1-suaveT(telonProgreso));
  telonDer.position.x=x;
  telonIzq.position.x=-x;
}

function alternarTelon(){
  telonObjetivo = telonObjetivo>0.5 ? 0 : 1;
  return telonObjetivo>0.5;
}

FALLA.telon={
  actualizar: actualizarTelon,
  alternar: alternarTelon,
  get cerrado(){ return telonObjetivo>0.5; }
};

function escenario(){
  var g=new THREE.Group();
  // La tarima alcanza las pilastras y se abomba hacia el patio. Se usa
  // el mismo contorno que consulta el paseo, expresado aquí en el grupo.
  var esc=geo.escenario;
  var frente=geo.contornoFrenteEscenario().map(function(p){
    return {x:p.x,z:p.z+RETIRO_ESCENARIO_Z};
  });
  var trasera=frente.map(function(p){return {x:p.x,z:esc.zFondo+RETIRO_ESCENARIO_Z};});
  g.add(banda(trasera,frente,esc.altura,esc.altura,MAT.sueloEscenario));
  // El faldón que mira al patio lleva la carpintería histórica de la
  // platea inferior. Los laterales y la trasera permanecen oscuros.
  g.add(cinta(frente.slice().reverse(),geo.foso.altura,esc.altura,MAT.maderaPlatea));
  g.add(cinta([frente[0],trasera[0],trasera[trasera.length-1],frente[frente.length-1]],
    geo.foso.altura,esc.altura,MAT.tablas));
  // Dos molduras horizontales subrayan la curva del faldón de madera.
  [0.16,esc.altura-0.07].forEach(function(y){
    var curva=new THREE.CatmullRomCurve3(frente.map(function(p){return new THREE.Vector3(p.x,y,p.z+0.012);}));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva,64,0.018,6,false),MAT.maderaPlatea));
  });
  var fondo=new THREE.Mesh(new THREE.PlaneGeometry(19,12), MAT.hueco);
  fondo.position.set(0,6,-15.9); g.add(fondo);

  /* Caja escénica cerrada. Tarima, fondo y telones no formaban volumen:
     por encima de la bambalina más alta y por los dos costados se veía
     el exterior desde el patio. Se cierra con el mismo negro del fondo y
     a su misma medida (19 m de ancho, 12 m de alto), así que a la vista
     no cambia nada —sigue siendo oscuridad— salvo que ya no hay por
     dónde escaparse. Los paños quedan 50 cm por fuera de la tarima y muy
     por fuera de la luz del arco (P.arcoA = 7,50), de modo que desde la
     sala no asoman. La boca llega a z=2,5 en coordenadas del grupo, que
     es el z=0 de la sala: empalma con el muro frontal sin junta. */
  var mitadCaja=9.5, altoCaja=12, zBocaCaja=2.5, zFondoCaja=-15.9;
  var largoCaja=zBocaCaja-zFondoCaja, zCentroCaja=(zBocaCaja+zFondoCaja)/2;
  var paredCaja=new THREE.PlaneGeometry(largoCaja, altoCaja-geo.foso.altura);
  [-1,1].forEach(function(sc){
    var m=new THREE.Mesh(paredCaja, MAT.hueco);
    m.position.set(sc*mitadCaja,(altoCaja+geo.foso.altura)/2,zCentroCaja);
    m.rotation.y=-sc*Math.PI/2;   // la cara vista mira hacia dentro
    g.add(m);
  });
  var techoCaja=new THREE.Mesh(new THREE.PlaneGeometry(mitadCaja*2,largoCaja),MAT.hueco);
  techoCaja.rotation.x=Math.PI/2; // normal hacia abajo: se ve desde la sala
  techoCaja.position.set(0,altoCaja,zCentroCaja);
  g.add(techoCaja);

  juegoTelon(g, -1.6,  15.5, 11.0, 2.2, 7.0, 2.4); // patas y bambalina (decorativas, siempre recogidas)
  juegoTelon(g, -6.0,  11.5,  9.6, 1.6, 5.6, 2.0); // primer subtelón
  juegoTelon(g, -10.4,  9.5,  8.4, 1.3, 4.7, 1.7); // segundo subtelón
  construirTelonFuncional(g);                       // telón de boca: éste es el que se abre y se cierra

  // Se retira el conjunto completo, incluidos telones y fondo, para
  // liberar delante una franja real destinada al foso de organización.
  g.position.z=-RETIRO_ESCENARIO_Z;
  return g;
}

/* Peldaños macizos de las dos salidas laterales próximas al escenario.
   Cada caja crece desde el suelo hasta su cota para que no haya huecos
   visibles debajo de la escalera. */
function escalerasLaterales(){
  var g=new THREE.Group(), e=geo.escalerasLaterales;
  [-1,1].forEach(function(signo){
    for(var i=0;i<e.peldanos;i++){
      var t0=i/e.peldanos,t1=(i+1)/e.peldanos;
      var x0=e.xBajo+(e.xAlto-e.xBajo)*t0,x1=e.xBajo+(e.xAlto-e.xBajo)*t1;
      var z0=e.centroZ+e.curvaZ*Math.sin(Math.PI*t0),z1=e.centroZ+e.curvaZ*Math.sin(Math.PI*t1);
      var dx=signo*(x1-x0),dz=z1-z0,largo=Math.hypot(dx,dz),alto=e.altura*(i+1)/e.peldanos;
      var pel=new THREE.Mesh(new THREE.BoxGeometry(largo+0.012,alto,e.ancho),MAT.maderaPlatea);
      pel.position.set(signo*(x0+x1)/2,alto/2,(z0+z1)/2);
      pel.rotation.y=-Math.atan2(dz,dx);
      g.add(pel);

      // Alfombra sobre cada huella; se deja un vivo mínimo de madera
      // para que el borde del peldaño continúe siendo legible.
      var alf=new THREE.Mesh(new THREE.BoxGeometry(largo-0.018,0.026,e.ancho-0.08),MAT.alfombraEscalera);
      alf.position.set(signo*(x0+x1)/2,alto+0.013,(z0+z1)/2);
      alf.rotation.y=pel.rotation.y;
      g.add(alf);

      // La misma alfombra baja por la contrahuella. Se coloca apenas
      // adelantada para evitar z-fighting con la caja de madera.
      var altoPaso=e.altura/e.peldanos,ux=dx/largo,uz=dz/largo;
      var frente=new THREE.Mesh(new THREE.BoxGeometry(0.026,altoPaso-0.012,e.ancho-0.08),MAT.alfombraEscalera);
      frente.position.set(signo*x0-ux*0.013,alto-altoPaso/2,z0-uz*0.013);
      frente.rotation.y=pel.rotation.y;
      g.add(frente);

      // Zócalos escalonados a ambos lados, ligeramente por encima de
      // cada huella para rematar la escalera contra los palcos.
      [-1,1].forEach(function(lado){
        var zocalo=new THREE.Mesh(new THREE.BoxGeometry(largo+0.02,alto+0.12,0.10),MAT.maderaPlatea);
        zocalo.position.set(signo*(x0+x1)/2,(alto+0.12)/2,
          (z0+z1)/2+lado*(e.ancho/2-0.05));
        zocalo.rotation.y=pel.rotation.y;
        g.add(zocalo);
      });
    }
  });
  return g;
}

/* Mampara en el desembarco de cada escalera lateral. Ocupa el tabique
   radial que cierra el palco 2: desde su barandilla interior hasta el
   muro exterior, sobre la misma recta. */
function mamparasEscaleras(){
  var conjunto=new THREE.Group(), ancho=P.pisos[0].dentro;
  var bordePlatea=geo.dentro(geo.PLAN,P.pisos[0].dentro);
  // La mampara pertenece al borde del palco que mira a la escalera:
  // es iAlaD, la primera arista del ala, no el límite entre el palco 2
  // y el palco siguiente (que la dejaría en medio de dos arcos).
  var iAlaD=-1;
  for(var ip=0;ip<geo.PLAN.length;ip++){
    if(iAlaD<0 && geo.PLAN[ip].z>=Z_CORREDOR_FIN) iAlaD=ip;
  }
  [-1,1].forEach(function(signo){
    var grupo=construirMamparaArcos(ancho,4.38,3);
    // Usa la columna extrema del palco 2, la que linda directamente con
    // la escalera; el lado izquierdo es su índice especular.
    var idxFrente=signo>0?iAlaD:geo.PLAN.length-1-iAlaD;
    var q=bordePlatea[idxFrente],q2=geo.PLAN[idxFrente];
    var tx=q2.x-q.x,tz=q2.z-q.z,L=Math.hypot(tx,tz)||1; tx/=L;tz/=L;
    grupo.position.set((q.x+q2.x)/2,0,(q.z+q2.z)/2);
    grupo.rotation.y=-Math.atan2(tz,tx);
    conjunto.add(grupo);
  });
  return conjunto;
}

/* Punto y tangente exactos de la fachada técnica sobre la herradura.
   Lo comparten los arcos del fondo y las mamparas de las rampas para que
   estas últimas terminen en el plano real del arco, no en un Z aproximado. */
function muestraCurvaFondo(cx){
  var curva=geo.PLAN,r=geo.rampasTraseras,p=null,pa=null,pb=null,j;
  for(j=0;j<curva.length-1;j++){
    var a=curva[j],b=curva[j+1];
    if(Math.max(a.z,b.z)<r.zFin-3.0)continue;
    if((a.x-cx)*(b.x-cx)<=0){
      var u=(cx-a.x)/((b.x-a.x)||1);
      p={x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u};
      pa=a;pb=b;break;
    }
  }
  if(!p){
    var mejor=1,dist=Infinity;
    for(j=1;j<curva.length-1;j++){
      var d=Math.abs(curva[j].x-cx);
      if(curva[j].z>=r.zFin-3.0 && d<dist){dist=d;mejor=j;}
    }
    p=curva[mejor];pa=curva[mejor-1];pb=curva[mejor+1];
  }
  var dx=pb.x-pa.x,dz=pb.z-pa.z,l=Math.hypot(dx,dz)||1;
  return {p:p,tx:dx/l,tz:dz/l};
}

/* Conserva la parte de una polilínea comprendida entre su inicio y el
   primer cruce con un plano vertical definido en planta. */
function recortaEnPlano(pts,origen,nx,nz){
  if(pts.length<2)return pts.slice();
  var salida=[pts[0]],d0=(pts[0].x-origen.x)*nx+(pts[0].z-origen.z)*nz;
  for(var i=1;i<pts.length;i++){
    var a=pts[i-1],b=pts[i];
    var da=(a.x-origen.x)*nx+(a.z-origen.z)*nz;
    var db=(b.x-origen.x)*nx+(b.z-origen.z)*nz;
    if((da<=0 && db>=0)||(da>=0 && db<=0)){
      var t=da/(da-db||1);
      salida.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
      return salida;
    }
    // Mientras siga en el mismo semiespacio que el arranque, se conserva.
    if(db*d0>=0)salida.push(b);else return salida;
  }
  return salida;
}

/* Las cuatro mamparas que separan los palcos de platea de las dos
   alfombras de salida, una por flanco de cada rampa. No pueden ser un
   tabique recto: la rampa se va abriendo de x=3.40 a x=4.60 mientras
   avanza hacia el fondo. Se resuelven igual que los cinco arcos del
   fondo técnico —en módulos de un solo vano, cada uno tangente al borde
   real de la alfombra en su tramo—, de modo que los tres arcos juntos
   acompañan la curva en lugar de cortarla en recto. */
function mamparasRampas(){
  var conjunto=new THREE.Group(), fondoMampara=FONDO_MAMPARA;
  // Alto libre bajo el forjado del piso principal: el mismo que usan los
  // cinco arcos del fondo técnico, para que la fachada lea como una sola.
  var alto=COTA_BAJO_PRINCIPAL-geo.platea.altura-0.02;
  var bordePlatea=geo.dentro(geo.PLAN,P.pisos[0].dentro);
  var tramos=tramosPlateaSinSalidas(bordePlatea), bordes=[], t;
  for(t=0;t<tramos.length;t++){
    if(t>0) bordes.push(tramos[t][0]);
    if(t<tramos.length-1) bordes.push(tramos[t][tramos[t].length-1]);
  }
  if(bordes.length<4) return conjunto;

  // Los cuatro bordes de hueco salen en orden a lo largo de la herradura:
  // ala derecha, autoridades derecha, autoridades izquierda y ala
  // izquierda. Cada uno marca dónde arranca su mampara.
  [{signo: 1, exterior:true,  arranque:bordes[0]},
   {signo: 1, exterior:false, arranque:bordes[1]},
   {signo:-1, exterior:false, arranque:bordes[2]},
   {signo:-1, exterior:true,  arranque:bordes[3]}].forEach(function(lado){
    // Arranca en el propio borde del hueco, que es donde termina la
    // barandilla: el primer punto del borde de la alfombra cae medio metro
    // más atrás y dejaba los arcos despegados de ella. Sólo se admiten
    // puntos que avanzan hacia el fondo, porque al pasar del eje de la
    // alfombra a su borde el primero retrocede en z.
    var curva=[lado.arranque];
    bordeAlfombraPasillo(lado.signo,lado.exterior,lado.arranque.z).forEach(function(p){
      if(p.z>curva[curva.length-1].z+0.02) curva.push(p);
    });
    // El vano exterior de la fachada está centrado en x=±4.60. Su cara
    // se retranquea 16 cm hacia la sala; recortamos contra ese mismo plano
    // tangente para que la mampara no continúe dentro del corredor.
    var muestraSalida=muestraCurvaFondo(lado.signo*4.60);
    var signoFuera=((-muestraSalida.tz)*muestraSalida.p.x+
      muestraSalida.tx*(muestraSalida.p.z-P.zc))>=0?1:-1;
    var nPlanoX=-muestraSalida.tz*signoFuera;
    var nPlanoZ=muestraSalida.tx*signoFuera;
    var planoArco={
      x:muestraSalida.p.x-nPlanoX*0.16,
      z:muestraSalida.p.z-nPlanoZ*0.16
    };
    curva=recortaEnPlano(curva,planoArco,nPlanoX,nPlanoZ);
    if(curva.length<2) return;
    // Los tres vanos se reparten sobre el recorrido real de la alfombra y
    // no sobre su proyección recta: los cuatro puntos de corte salen
    // equidistantes por longitud de arco. Un recorrido demasiado corto no
    // necesita descarte propio, porque deja los tres módulos por debajo
    // del mínimo que ya filtra el bucle.
    var cortes=remuestreaLinea(curva,4);
    for(var m=0;m<3;m++){
      var a=cortes[m], b=cortes[m+1];
      var dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz);
      if(L<0.20) continue;
      var mx=(a.x+b.x)/2, mz=(a.z+b.z)/2, nx=-dz/L, nz=dx/L;
      // La normal se orienta siempre en sentido contrario al eje de la
      // rampa: así las molduras miran hacia los palcos y el retranqueo de
      // medio espesor deja la cara interior a ras de la alfombra.
      if(nx*(mx-lado.signo*geo.centroRampaTrasera(mz))<0){
        dx=-dx; dz=-dz; nx=-nx; nz=-nz;
      }
      var modulo=construirMamparaArcos(L,alto,1);
      modulo.position.set(mx+nx*fondoMampara/2,geo.platea.altura,mz+nz*fondoMampara/2);
      modulo.rotation.y=-Math.atan2(dz,dx);
      conjunto.add(modulo);
    }
  });
  return conjunto;
}

/* Foso curvo entre la tarima y el paso común del patio. La valla es un
   antepecho tapizado continuo, con remate y postes finos de latón. */
function sueloFoso(){
  var g=new THREE.Group(),f=geo.foso,e=f.escaleras;
  var atras=geo.contornoFrenteEscenario();
  var borde=atras.map(function(p){return {x:p.x,z:geo.frenteFoso(p.x)};});
  g.add(banda(atras,borde,f.altura,f.altura,MAT.maderaFoso));
  // Muros de contención: el antepecho queda a cota del patio, no en el
  // fondo del foso. La tarima cierra su pared posterior hasta -0,90 m.
  g.add(cinta(borde,f.altura,0,MAT.muro));
  [0,borde.length-1].forEach(function(i){g.add(cinta([atras[i],borde[i]],f.altura,0,MAT.muro));});
  var delante=[];
  for(var i=0;i<=64;i++){
    var x=e.xAlto*(2*i/64-1);delante.push({x:x,z:geo.frenteFoso(x)});
  }
  var interior=delante.map(function(p){return {x:p.x,z:p.z-f.grosorValla/2};});
  var exterior=delante.map(function(p){return {x:p.x,z:p.z+f.grosorValla/2};});
  var yAlto=f.altoValla;
  g.add(cinta(interior,0,yAlto,MAT.terciopeloPasamanos));
  g.add(cinta(exterior.slice().reverse(),0,yAlto,MAT.terciopeloPasamanos));
  g.add(banda(interior,exterior,yAlto,yAlto,MAT.terciopeloPasamanos));
  [0,delante.length-1].forEach(function(i){
    g.add(cinta([interior[i],exterior[i]],0,yAlto,MAT.terciopeloPasamanos));
  });
  function tubo(puntos,radio,material){
    var curva=new THREE.CatmullRomCurve3(puntos);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curva,Math.max(1,puntos.length-1)*2,radio,8,false),material));
  }
  tubo(delante.map(function(p){return new THREE.Vector3(p.x,yAlto+0.015,p.z);}),0.025,MAT.oro);
  for(i=0;i<=8;i++){
    var x=e.xAlto*(2*i/8-1),z=geo.frenteFoso(x);
    var poste=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.023,yAlto+0.05,8),MAT.oro);
    poste.position.set(x,(yAlto+0.05)/2,z);g.add(poste);
  }
  [-1,1].forEach(function(signo){
    var zMin=e.zCentro-e.ancho/2,zMax=e.zCentro+e.ancho/2;
    // Rellano a nivel del patio y seis contrahuellas de 15 cm.
    var inicioRellano=[],finRellano=[];
    for(var r=0;r<=12;r++){
      var rx=e.xAlto+(e.xExterior-e.xAlto)*r/12;
      inicioRellano.push({x:signo*rx,z:zMin});
      finRellano.push({x:signo*rx,z:geo.frenteFoso(rx)});
    }
    if(signo<0){inicioRellano.reverse();finRellano.reverse();}
    var plataforma=new THREE.Group();
    plataforma.add(banda(inicioRellano,finRellano,0,0,MAT.tablas));
    var canto=[inicioRellano[0]].concat(finRellano,[inicioRellano[inicioRellano.length-1],inicioRellano[0]]).reverse();
    plataforma.add(cinta(canto,-0.16,0,MAT.tablas));
    g.add(plataforma);
    var huella=(e.xAlto-e.xBajo)/e.peldanos;
    for(var j=0;j<e.peldanos;j++){
      var x0=e.xBajo+j*huella,x1=x0+huella;
      var y=geo.alturaAccesoFoso((x0+x1)/2,e.zCentro);
      var peldaño=new THREE.Mesh(new THREE.BoxGeometry(huella,y-f.altura,e.ancho),MAT.tablas);
      peldaño.position.set(signo*(x0+x1)/2,(y+f.altura)/2,e.zCentro);g.add(peldaño);
    }
    // Pasamanos inclinados y retorno hasta el extremo de la valla.
    [zMin,zMax].forEach(function(z){
      tubo([new THREE.Vector3(signo*e.xBajo,f.altura+0.9,z),new THREE.Vector3(signo*e.xAlto,0.9,z)],0.035,MAT.terciopeloPasamanos);
      for(var k=0;k<=3;k++){
        var x=e.xBajo+(e.xAlto-e.xBajo)*k/3;
        var y=k===0?f.altura:geo.alturaAccesoFoso(Math.min(x,e.xAlto-0.001),e.zCentro);
        var barra=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.9,8),MAT.oro);
        barra.position.set(signo*x,y+0.45,z);g.add(barra);
      }
    });
    tubo([new THREE.Vector3(signo*e.xAlto,0.9,zMax),new THREE.Vector3(signo*e.xAlto,yAlto+0.015,geo.frenteFoso(e.xAlto))],0.035,MAT.terciopeloPasamanos);
    // Luz baja para que las huellas y el fondo se lean desde el acceso.
    var luz=new THREE.PointLight(0xffd6ac,0.35,7);
    luz.position.set(signo*(e.xBajo-0.4),-0.4,e.zCentro);g.add(luz);
  });
  return g;
}

/* ---------------- TECHO: alegoría del Paraíso --------------------- */
function texturaTecho(){
  var c=document.createElement('canvas'); c.width=c.height=512;
  var x=c.getContext('2d');
  var g=x.createRadialGradient(256,256,20,256,256,270);
  g.addColorStop(0,'#f0dfae'); g.addColorStop(0.35,'#cf9a58');
  g.addColorStop(0.7,'#7d5a6b'); g.addColorStop(1,'#3a2740');
  x.fillStyle=g; x.fillRect(0,0,512,512);
  var i;
  for(i=0;i<90;i++){
    var a=Math.random()*Math.PI*2, r=60+Math.random()*190;
    var px=256+Math.cos(a)*r, py=256+Math.sin(a)*r, s=12+Math.random()*46;
    x.globalAlpha=0.06+Math.random()*0.13;
    x.fillStyle=Math.random()>0.45?'#f6e9c9':'#8f5f74';
    x.beginPath(); x.ellipse(px,py,s,s*0.62,a,0,Math.PI*2); x.fill();
  }
  x.globalAlpha=1;
  x.strokeStyle='#c9922f'; x.lineWidth=9;
  x.beginPath(); x.arc(256,256,232,0,Math.PI*2); x.stroke();
  x.lineWidth=3;
  x.beginPath(); x.arc(256,256,214,0,Math.PI*2); x.stroke();
  return new THREE.CanvasTexture(c);
}

function lampara(){
  var g=new THREE.Group();
  var aro=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.07,6,32), MAT.oro);
  aro.rotation.x=Math.PI/2; g.add(aro);
  var aro2=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.06,6,26), MAT.oro);
  aro2.rotation.x=Math.PI/2; aro2.position.y=0.5; g.add(aro2);
  var luzMat=new THREE.MeshBasicMaterial({color:0xffd98a});
  registrar(luzMat);
  for(var i=0;i<20;i++){
    var a=i/20*Math.PI*2, r=(i%2)?0.95:1.5, y=(i%2)?0.5:0;
    var b=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,6), luzMat);
    b.position.set(Math.cos(a)*r, y+0.12, Math.sin(a)*r); g.add(b);
  }
  var cable=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.2,5), MAT.oro);
  cable.position.y=1.4; g.add(cable);
  return g;
}

/* n+1 índices que reparten el tramo [ini,fin] de "plan" en n partes de
   longitud de arco igual. Repartir por índice a secas (ini+k*(fin-ini)/n)
   sale muy desigual donde el trazado pasa del tramo recto de la jamba al
   arco de la herradura: ahí los puntos están mucho más juntos, así que
   dos cortes "equiespaciados en índice" pueden caer casi en el mismo
   sitio físico. */
function indicesPorLongitud(plan, ini, fin, n){
  var acc=[0], i;
  for(i=ini+1;i<=fin;i++) acc.push(acc[acc.length-1]+Math.hypot(plan[i].x-plan[i-1].x, plan[i].z-plan[i-1].z));
  var total=acc[acc.length-1], out=[ini];
  for(var k=1;k<n;k++){
    var objetivo=total*k/n, j=0;
    while(j<acc.length-1 && acc[j+1]<objetivo) j++;
    out.push(ini+j);
  }
  out.push(fin);
  return out;
}

/* Separador bajo entre dos palcos. Su perfil reproduce las piezas de la
   sala real: es recto y bajo junto a las butacas y, ya cerca del fondo,
   sube con una curva suave. No llega al techo ni cierra visualmente el
   palco como lo hacía el tabique anterior. */
function posteYesoEnIndice(escena, borde, plan, i, yBase, alto, material){
  var p=borde[i], q=plan[i];
  var y0=(typeof yBase==='function')?yBase(p):yBase;
  var dx=q.x-p.x, dz=q.z-p.z, distancia=Math.hypot(dx,dz)||1;
  var ux=dx/distancia, uz=dz/distancia, margenFrontal=0.10, margenFondo=0.08;
  var fondo=Math.max(0.30,distancia-margenFrontal-margenFondo), grosor=0.12;
  var hBajo=Math.max(0.68, alto*0.62), hFondo=Math.max(1.08, alto*1.02);

  // Tramo superior horizontal seguido de una única onda ascendente hacia
  // el muro, como los biombos de la fotografía de referencia.
  var perfil=new THREE.Shape();
  perfil.moveTo(0,0);
  perfil.lineTo(fondo,0);
  perfil.lineTo(fondo,hFondo);
  perfil.bezierCurveTo(fondo*0.84,hFondo, fondo*0.76,hBajo, fondo*0.58,hBajo);
  perfil.lineTo(0,hBajo);
  perfil.lineTo(0,0);

  var geometriaDiv=new THREE.ExtrudeGeometry(perfil,{
    depth:grosor, bevelEnabled:true, bevelThickness:0.025,
    bevelSize:0.025, bevelSegments:2
  });
  geometriaDiv.translate(0,0,-grosor/2);
  var div=new THREE.Mesh(geometriaDiv, material||MAT.maderaBlanca);
  // Se retranquea también el bisel: ninguna parte sobresale por delante
  // de la barandilla ni alcanza el borde exterior del suelo del palco.
  div.position.set(p.x+ux*margenFrontal, y0, p.z+uz*margenFrontal);
  // El eje X local del perfil apunta desde la barandilla hacia el muro.
  div.rotation.y=-Math.atan2(dz,dx);
  escena.add(div);
}

/* Tabiques de separación entre palcos: postes de yeso repartidos a partes
   iguales (en longitud real, no en índice) entre los índices [ini,fin]
   (ambos de "borde" y de "geo.PLAN", que comparten índice punto a punto).
   yBase da la altura del suelo del palco en cada punto (constante en los
   pisos altos, y siguiendo la pendiente del patio —más la peana— en la
   platea). Devuelve los índices de corte, para que quien llame pueda
   repartir asientos por el mismo criterio. */
function separadoresPalco(escena, borde, plan, ini, fin, n, yBase, alto){
  if(n<2 || fin<=ini) return [ini,fin];
  var idx=indicesPorLongitud(plan, ini, fin, n);
  for(var k=1;k<n;k++) posteYesoEnIndice(escena, borde, plan, idx[k], yBase, alto);
  return idx;
}

/* Barandilla ornamentada de los palcos de platea: zócalo bajo + una fila
   de balaustres dorados + pasamanos, en vez del antepecho macizo de
   terciopelo de los pisos de arriba — así se nota que el palco está
   sobre una peana y no es una simple continuación del muro. Cubre todo
   el anillo (también el tramo central sin tabicar). */
function barandillaPalco(escena, borde, yBase, alto, recortaEnMampara){
  escena.add(cinta(borde, yBase, function(p){return yBase(p)+0.12;}, MAT.antepecho));       // zócalo
  /* Remate tapizado fino: media caña de 9 cm de ancho y solo 3,5 cm de
     alto, cerrada por una base plana que apoya sobre la valla. Se genera
     a mano para mantener siempre el corte inferior horizontal, algo que
     TubeGeometry no puede hacer al orientar una sección por la curva. */
  var recorridoPasamanos=borde;
  if(recortaEnMampara && borde.length>=2){
    // Retira 19 cm solo en los extremos que desembocan en una salida.
    // Es la media anchura del capitel: el terciopelo llega a su cara,
    // pero no atraviesa el volumen de la columna ornamental.
    function recortaInicio(pts,dist){
      var salida=pts.slice(),resto=dist;
      while(salida.length>1){
        var a=salida[0],b=salida[1],l=Math.hypot(b.x-a.x,b.z-a.z);
        if(l>resto){
          salida[0]={x:a.x+(b.x-a.x)*resto/l,z:a.z+(b.z-a.z)*resto/l};break;
        }
        resto-=l;salida.shift();
      }
      return salida;
    }
    var rPas=geo.rampasTraseras;
    recorridoPasamanos=borde.slice();
    if(recorridoPasamanos[0].z>=rPas.zInicio-0.02)
      recorridoPasamanos=recortaInicio(recorridoPasamanos,0.19);
    if(recorridoPasamanos[recorridoPasamanos.length-1].z>=rPas.zInicio-0.02){
      recorridoPasamanos.reverse();
      recorridoPasamanos=recortaInicio(recorridoPasamanos,0.19);
      recorridoPasamanos.reverse();
    }
  }
  if(recorridoPasamanos.length>=2){
    var lados=8,posPas=[],uvPas=[],idxPas=[],distPas=0,bi,si;
    for(bi=0;bi<recorridoPasamanos.length;bi++){
      var bp=recorridoPasamanos[bi],ba=recorridoPasamanos[Math.max(0,bi-1)],bb=recorridoPasamanos[Math.min(recorridoPasamanos.length-1,bi+1)];
      var tx=bb.x-ba.x,tz=bb.z-ba.z,tLen=Math.hypot(tx,tz)||1;
      var nx=-tz/tLen,nz=tx/tLen,baseY=yBase(bp)+alto-0.035;
      if(bi>0)distPas+=Math.hypot(bp.x-recorridoPasamanos[bi-1].x,bp.z-recorridoPasamanos[bi-1].z);
      // Arco superior, desde un borde de la costura hasta el contrario.
      for(si=0;si<=lados;si++){
        var ang=Math.PI*si/lados,lateral=Math.cos(ang)*0.045;
        posPas.push(bp.x+nx*lateral,baseY+Math.sin(ang)*0.035,bp.z+nz*lateral);
        uvPas.push(distPas*1.5,si/lados);
      }
    }
    var fila=lados+1;
    for(bi=0;bi<recorridoPasamanos.length-1;bi++){
      for(si=0;si<lados;si++){
        var po=bi*fila+si;
        idxPas.push(po,po+fila,po+1,po+1,po+fila,po+fila+1);
      }
      // Cara inferior plana: la junta queda pegada a la valla.
      var izq=bi*fila,der=bi*fila+lados,izqSig=izq+fila,derSig=der+fila;
      idxPas.push(izq,der,izqSig,der,derSig,izqSig);
    }
    // Tapas planas en los dos extremos del pasamanos.
    for(si=1;si<lados;si++)idxPas.push(0,si,si+1);
    var ultimo=(recorridoPasamanos.length-1)*fila;
    for(si=1;si<lados;si++)idxPas.push(ultimo,ultimo+si+1,ultimo+si);
    var geoPasamanos=new THREE.BufferGeometry();
    geoPasamanos.setAttribute('position',new THREE.Float32BufferAttribute(posPas,3));
    geoPasamanos.setAttribute('uv',new THREE.Float32BufferAttribute(uvPas,2));
    geoPasamanos.setIndex(idxPas);geoPasamanos.computeVertexNormals();
    escena.add(new THREE.Mesh(geoPasamanos,MAT.terciopeloPasamanos));
  }
  var altoBal=Math.max(0.30,alto-0.17), geoBal=geometriaBalaustreOrnamental(altoBal);
  // Cada pieza es ahora un módulo de celosía ancho y enlazado, no un
  // balaustre aislado; esta cadencia deja una junta mínima entre módulos.
  var separacion=0.35, transforms=[];
  for(var i=0;i<borde.length-1;i++){
    var a=borde[i], b=borde[i+1], dx=b.x-a.x, dz=b.z-a.z;
    var largo=Math.hypot(dx,dz);
    if(largo<0.001)continue;
    var cantidad=Math.max(1,Math.round(largo/separacion));
    // Ajusta la anchura al tramo real: evita huecos o solapes al
    // redondear el número de módulos, también en los remates cortos.
    var escalaX=(largo/cantidad)/0.346; // ancho total, incluidos biseles
    for(var j=0;j<cantidad;j++){
      var t=(j+0.5)/cantidad, x=a.x+dx*t, z=a.z+dz*t;
      var punto={x:x,z:z};
      transforms.push({x:x,y:yBase(punto)+0.13,z:z,rotY:-Math.atan2(dz,dx),escalaX:escalaX});
    }
  }
  var instancias=new THREE.InstancedMesh(geoBal,MAT.barnizClaro,transforms.length);
  var matriz=new THREE.Matrix4(), quat=new THREE.Quaternion(), ejeY=new THREE.Vector3(0,1,0);
  var escala=new THREE.Vector3(1,1,1), posicion=new THREE.Vector3();
  transforms.forEach(function(t,n){
    posicion.set(t.x,t.y,t.z); quat.setFromAxisAngle(ejeY,t.rotY);
    escala.set(t.escalaX,1,1);
    matriz.compose(posicion,quat,escala); instancias.setMatrixAt(n,matriz);
  });
  instancias.instanceMatrix.needsUpdate=true;
  escena.add(instancias);
}

/* En el fondo de la platea la barandilla se interrumpe ante los dos
   arcos de salida. Se conserva exactamente la misma curva: únicamente
   se parte el recorrido en los puntos transitables de las rampas. */
/* Holgura entre la valla y el borde visible de la alfombra. Es el único
   número que hay que tocar para acercarla o separarla: lo usan por igual
   el hueco de la valla principal y la pieza de enlace del fondo. A cero,
   la curva de la valla cae justo sobre el borde de la alfombra; como el
   balaustre tiene 5.5 cm de grueso, vuela 2.75 cm sobre ella (sin cortarla:
   su base va 32 cm más alta que la rampa en ese tramo). */
var HOLGURA_VALLA_ALFOMBRA = 0;

/* ¿Cae este punto dentro del paso de una de las rampas traseras? La
   abertura sigue el eje real de la rampa, que se va desplazando hacia
   fuera, y acompaña el ancho visible de su alfombra. Lo consultan tanto
   la valla como el remate del suelo, así que vive aquí y no dentro de
   una de las dos. */
function enHuecoRampa(p){
  var r=geo.rampasTraseras;
  if(p.z<r.zInicio) return false;
  var semiancho=(geo.anchoRampaTrasera(p.z)-0.31)/2+HOLGURA_VALLA_ALFOMBRA;
  return Math.abs(Math.abs(p.x)-geo.centroRampaTrasera(p.z))<semiancho;
}
function tramosPlateaSinSalidas(borde){
  var enHueco=enHuecoRampa;
  // Punto exacto del borde del hueco entre uno de fuera y otro de dentro.
  // Va por bisección porque el eje y el ancho de la rampa cambian con z:
  // interpolar en línea recta dejaría la valla descuadrada respecto a la
  // alfombra. Devuelve siempre el lado de fuera, para no invadir el paso.
  function bordeDelHueco(fuera,dentro){
    var a=fuera, b=dentro, m;
    for(var k=0;k<24;k++){
      m={x:(a.x+b.x)/2, z:(a.z+b.z)/2};
      if(enHueco(m)) b=m; else a=m;
    }
    return a;
  }
  // Se corta el segmento por donde pasa realmente el borde del hueco, no
  // por segmentos enteros del borde: con vértices de ~70 cm, descartar el
  // segmento completo dejaba la valla hasta 30 cm corta de la alfombra.
  var tramos=[], tramo=[], previo=null, previoDentro=false;
  for(var i=0;i<borde.length;i++){
    var p=borde[i], dentroHueco=enHueco(p);
    if(dentroHueco){
      if(previo && !previoDentro){
        tramo.push(bordeDelHueco(previo,p));
        if(tramo.length>1) tramos.push(tramo);
        tramo=[];
      }
    }else{
      if(previo && previoDentro) tramo.push(bordeDelHueco(p,previo));
      tramo.push(p);
    }
    previo=p; previoDentro=dentroHueco;
  }
  if(tramo.length>1) tramos.push(tramo);
  return tramos;
}
function barandillaPlateaConSalidas(escena, borde, yBase, alto){
  var tramos=tramosPlateaSinSalidas(borde);
  tramos.forEach(function(t){barandillaPalco(escena,t,yBase,alto,true);});
}

/* Reparte 6 sillas (3 filas de 2) por cada uno de los "nCeldas" palcos
   entre [ini,fin], mirando hacia el patio/escenario (de "plan", el muro,
   hacia "borde", la barandilla). Usa los mismos cortes por longitud que
   separadoresPalco(), así cada grupo de sillas cae centrado en su palco. */
function sillasPalco(escena, borde, plan, ini, fin, nCeldas, yBase, sillaGeo){
  var idx=indicesPorLongitud(plan, ini, fin, nCeldas);
  var transforms=[];
  for(var c=0;c<nCeldas;c++){
    var i=Math.round((idx[c]+idx[c+1])/2);
    var pIn=borde[i], pOut=plan[i];
    var fx=pIn.x-pOut.x, fz=pIn.z-pOut.z, fl=Math.hypot(fx,fz)||1; fx/=fl; fz/=fl; // hacia la barandilla/patio
    var rx=fz, rz=-fx; // tangente al palco, para separar las 2 sillas de cada fila
    var rotY=Math.atan2(-fx,-fz);
    [0.18,0.42,0.66].forEach(function(prof){
      var cx=pIn.x+(pOut.x-pIn.x)*prof, cz=pIn.z+(pOut.z-pIn.z)*prof;
      // La altura del suelo del palco varía con la profundidad (la peana
      // es más alta junto al escenario y decae hacia el fondo), así que
      // se evalúa en el punto de cada fila, no en el de la barandilla.
      var y0=yBase({z:cz});
      [-0.35,0.35].forEach(function(lado){
        transforms.push({x:cx+rx*lado, y:y0, z:cz+rz*lado, rotY:rotY});
      });
    });
  }
  var m4=new THREE.Matrix4(), q=new THREE.Quaternion(), ejeY=new THREE.Vector3(0,1,0),
      esc=new THREE.Vector3(1,1,1), pos3=new THREE.Vector3();
  ['asiento','respaldo','base'].forEach(function(parte){
    var mat = parte==='base' ? MAT.maderaButaca : MAT.terciopeloButaca;
    var im=new THREE.InstancedMesh(sillaGeo[parte], mat, transforms.length);
    transforms.forEach(function(t,i2){
      pos3.set(t.x,t.y,t.z);
      q.setFromAxisAngle(ejeY,t.rotY);
      m4.compose(pos3,q,esc);
      im.setMatrixAt(i2,m4);
    });
    im.instanceMatrix.needsUpdate=true;
    escena.add(im);
  });
}

/* Portadas del fondo de los palcos de platea: una por celda, detrás de
   la última fila de sillas. Combinan jambas, arco de doble moldura y dos
   cortinas de terciopelo recogidas, siguiendo la orientación local de
   la herradura. */
function portadasPalcosPlatea(escena,borde,plan,ini,fin,nCeldas,yBase,yTechoPortada){
  yTechoPortada=yTechoPortada===undefined?COTA_BAJO_PRINCIPAL:yTechoPortada;
  var idx=indicesPorLongitud(plan,ini,fin,nCeldas);
  for(var c=0;c<nCeldas;c++){
    var i=Math.round((idx[c]+idx[c+1])/2), p=borde[i], q=plan[i];
    var qa=plan[idx[c]], qb=plan[idx[c+1]];
    // El arco ocupa toda la luz entre los dos separadores consecutivos;
    // solo se descuentan unos centímetros para que las jambas no los
    // atraviesen debido al bisel de ambas geometrías.
    var ancho=Math.max(0.80,Math.hypot(qb.x-qa.x,qb.z-qa.z)-0.10);
    // Se usa el centro geométrico del vano, no el punto medio por índice:
    // en una curva ambos no coinciden y el arco dejaría de apoyar sobre
    // las columnas que delimitan el palco.
    var qCentro={x:(qa.x+qb.x)/2,z:(qa.z+qb.z)/2};
    var y0=yBase(qCentro), altoArranque=1.22;
    // El arco deja un paño superior para la decoración mudéjar; ese paño
    // completa la portada hasta el forjado del piso principal.
    var altoTecho=yTechoPortada-y0-0.02, altoTotal=altoTecho-0.32;
    var controlArco=2*altoTotal-altoArranque;
    var dx=q.x-p.x, dz=q.z-p.z, L=Math.hypot(dx,dz)||1;
    var grupo=new THREE.Group();
    var curva=new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-ancho/2,altoArranque,0),
      new THREE.Vector3(0,controlArco,0),
      new THREE.Vector3(ancho/2,altoArranque,0)
    );
    grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,24,0.085,8,false),MAT.mudejarArcos));
    grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,24,0.025,6,false),MAT.oro));

    // Paño que rellena el espacio entre el arco y el forjado. Sigue la
    // propia curva por abajo, por lo que no tapa el vano ni la cortina.
    var ptsArco=curva.getPoints(28), panel=new THREE.Shape();
    panel.moveTo(ptsArco[0].x,ptsArco[0].y);
    for(var pa=1;pa<ptsArco.length;pa++) panel.lineTo(ptsArco[pa].x,ptsArco[pa].y);
    panel.lineTo(ancho/2,altoTecho); panel.lineTo(-ancho/2,altoTecho); panel.closePath();
    var geoPanel=new THREE.ExtrudeGeometry(panel,{depth:0.05,bevelEnabled:false});
    geoPanel.translate(0,0,-0.20);
    grupo.add(new THREE.Mesh(geoPanel,MAT.mudejarGeometrico));
    var cornisa=new THREE.Mesh(new THREE.BoxGeometry(ancho,0.075,0.10),MAT.mudejarArcos);
    cornisa.position.set(0,altoTecho-0.038,-0.04); grupo.add(cornisa);

    // Dientes del intradós, ligeramente separados para leer bien la
    // silueta lobulada incluso desde el patio.
    var cantidadDientes=Math.floor((ptsArco.length-4)/2);
    var dientes=new THREE.InstancedMesh(GEO_DIENTE_PORTADA,MAT.mudejarArcos,cantidadDientes);
    var matrizD=new THREE.Matrix4(), quatD=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
    var escalaD=new THREE.Vector3(1,1,1), posD=new THREE.Vector3(), nd=0;
    for(var di=2;di<ptsArco.length-2;di+=2){
      posD.set(ptsArco[di].x,ptsArco[di].y-0.105,0.015);
      matrizD.compose(posD,quatD,escalaD); dientes.setMatrixAt(nd++,matrizD);
    }
    dientes.instanceMatrix.needsUpdate=true; grupo.add(dientes);
    // Detalle geométrico repetido en el paño superior.
    var adornos=new THREE.InstancedMesh(GEO_ADORNO_PORTADA,MAT.oro,5);
    var matrizA=new THREE.Matrix4(), quatA=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/4);
    for(var oi=1;oi<=5;oi++){
      matrizA.compose(new THREE.Vector3(-ancho/2+ancho*oi/6,altoTecho-0.15,-0.145),quatA,escalaD);
      adornos.setMatrixAt(oi-1,matrizA);
    }
    adornos.instanceMatrix.needsUpdate=true; grupo.add(adornos);

    [-1,1].forEach(function(lado){
      var cortina=new THREE.Mesh(geometriaCortinaPalco(ancho,altoTotal,lado),MAT.telon);
      cortina.position.z=-0.26;
      grupo.add(cortina);
      var lazo=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.018,6,12),MAT.oro);
      lazo.position.set(lado*ancho*0.34,altoTotal*0.47,-0.225);
      grupo.add(lazo);
    });

    // Se coloca casi contra el muro, pero adelantado unos centímetros
    // para evitar parpadeos con la pared y la textura del fondo.
    grupo.position.set(qCentro.x-(dx/L)*0.16,y0,qCentro.z-(dz/L)*0.16);
    grupo.rotation.y=-Math.atan2(qb.z-qa.z,qb.x-qa.x);
    escena.add(grupo);
  }

  // Una sola columna en cada límite sirve a los dos arcos contiguos.
  for(var k=0;k<idx.length;k++){
    var ik=idx[k], qk=plan[ik], pk=borde[ik], ddx=qk.x-pk.x, ddz=qk.z-pk.z;
    var dl=Math.hypot(ddx,ddz)||1, prev=plan[Math.max(ini,ik-1)], next=plan[Math.min(fin,ik+1)];
    var yCol=yBase(qk), altoCol=yTechoPortada-yCol-0.02;
    var col=columnaMudejar(altoCol,1.22);
    col.position.set(qk.x-(ddx/dl)*0.16,yCol,qk.z-(ddz/dl)*0.16);
    col.rotation.y=-Math.atan2(next.z-prev.z,next.x-prev.x);
    escena.add(col);
  }
}

/* Aplique histórico del frente del entresuelo: cuerpo de bronce, dos
   brazos curvos con globos opalinos y dos lágrimas suspendidas. Es una
   pieza real con volumen, no un dibujo incorporado a la textura. */
function apliqueEntresuelo(){
  var g=new THREE.Group();
  var placa=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.105,0.055),MAT.bronceAplique);
  placa.position.z=0.015;g.add(placa);
  var medallon=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.072,0.045,16),MAT.bronceAplique);
  medallon.rotation.x=Math.PI/2;medallon.position.z=0.065;g.add(medallon);

  [-1,1].forEach(function(lado){
    var brazo=new THREE.CatmullRomCurve3([
      new THREE.Vector3(lado*0.055,0.015,0.075),
      new THREE.Vector3(lado*0.13,0.055,0.10),
      new THREE.Vector3(lado*0.21,0.035,0.115),
      new THREE.Vector3(lado*0.27,-0.015,0.12)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(brazo,12,0.014,7,false),MAT.bronceAplique));
    var copa=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.038,0.045,12),MAT.bronceAplique);
    copa.position.set(lado*0.27,-0.018,0.12);g.add(copa);
    var globo=new THREE.Mesh(new THREE.SphereGeometry(0.073,14,10),MAT.vidrioAplique);
    globo.scale.set(1,0.88,1);globo.position.set(lado*0.27,-0.075,0.125);g.add(globo);

    var hilo=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.10,6),MAT.bronceAplique);
    hilo.position.set(lado*0.105,-0.105,0.09);g.add(hilo);
    var lagrima=new THREE.Mesh(new THREE.SphereGeometry(0.025,10,8),MAT.vidrioAplique);
    lagrima.scale.set(0.72,1.35,0.72);
    lagrima.position.set(lado*0.105,-0.165,0.09);g.add(lagrima);
  });
  return g;
}

function apliquesEntresuelo(escena,borde,plan,ini,fin,nCeldas,yCentro){
  var idx=indicesPorLongitud(plan,ini,fin,nCeldas),prototipo=apliqueEntresuelo();
  for(var c=0;c<nCeldas;c++){
    var i=Math.round((idx[c]+idx[c+1])/2),p=borde[i],q=plan[i];
    var qa=plan[idx[c]],qb=plan[idx[c+1]],nx=p.x-q.x,nz=p.z-q.z,nl=Math.hypot(nx,nz)||1;
    var a=new THREE.Object3D();
    // Ocho centímetros hacia el patio evitan que la placa se funda con
    // el frente curvo y permiten leer el volumen de brazos y tulipas.
    a.position.set(p.x+nx/nl*0.08,yCentro,p.z+nz/nl*0.08);
    a.rotation.y=-Math.atan2(qb.z-qa.z,qb.x-qa.x);
    /* Se aplanan las piezas del grupo sobre la escena. El fusionador del
       final puede reunir así todos los bronces en una malla y todos los
       vidrios en otra; mantener 22 grupos suponía cientos de draw calls. */
    a.updateMatrix();
    prototipo.children.forEach(function(pieza){
      pieza.updateMatrix();
      var matrizMundo=new THREE.Matrix4().multiplyMatrices(a.matrix,pieza.matrix);
      var malla=new THREE.Mesh(pieza.geometry.clone().applyMatrix4(matrizMundo),pieza.material);
      escena.add(malla);
    });
  }
  prototipo.children.forEach(function(pieza){pieza.geometry.dispose();});
}

/* Puertas reales de los antepalcos: cada hoja conserva su propia bisagra
   y estado para poder abrirse desde el modo paseo. */
var puertasPalco=[];
var murosPuertasPasillo=[];
var murosExterioresPasillo=[];
function puertaCercana(x,z,dist,y){
  var mejor=null,dMejor=dist===undefined?1.65:dist;
  puertasPalco.forEach(function(p){
    if(y!==undefined && Math.abs(y-p.y)>0.80)return;
    var d=Math.hypot(x-p.x,z-p.z);
    if(d<dMejor){dMejor=d;mejor=p;}
  });
  return mejor;
}
function alternarPuertaCercana(x,z,y){
  var p=puertaCercana(x,z,1.75,y);
  if(!p)return false;
  p.objetivo=p.objetivo>0.5?0:1;
  return true;
}
function actualizarPuertas(dt){
  puertasPalco.forEach(function(p){
    var paso=Math.min(1,dt*3.2);
    p.apertura+=(p.objetivo-p.apertura)*paso;
    p.pivote.rotation.y=p.angulo+p.sentido*p.apertura*Math.PI*0.5;
  });
}
function puertaBloquea(x,z,y){
  for(var i=0;i<puertasPalco.length;i++){
    var p=puertasPalco[i];
    if(y!==undefined && Math.abs(y-p.y)>0.80)continue;
    if(p.apertura>0.65)continue;
    var dx=x-p.x,dz=z-p.z;
    var lateral=Math.abs(dx*p.tx+dz*p.tz);
    var normal=Math.abs(dx*(-p.tz)+dz*p.tx);
    if(lateral<0.52 && normal<0.24)return true;
  }
  // Distancia del jugador a una polilínea visible del corredor.
  function cercaDeMuro(linea,margen){
    for(var j=0;j<linea.length-1;j++){
      var a=linea[j],b=linea[j+1],vx=b.x-a.x,vz=b.z-a.z;
      var l2=vx*vx+vz*vz,t=l2?((x-a.x)*vx+(z-a.z)*vz)/l2:0;
      t=Math.max(0,Math.min(1,t));
      if(Math.hypot(x-(a.x+vx*t),z-(a.z+vz*t))<margen)return true;
    }
    return false;
  }
  // La pared exterior es continua salvo en los extremos de entrada.
  for(i=0;i<murosExterioresPasillo.length;i++){
    if(y!==undefined && Math.abs(y-murosExterioresPasillo[i].y)>0.80)continue;
    if(cercaDeMuro(murosExterioresPasillo[i].linea,0.28))return true;
  }
  // En la pared interior solo se permite cruzar por la luz de una puerta.
  for(i=0;i<murosPuertasPasillo.length;i++){
    if(y!==undefined && Math.abs(y-murosPuertasPasillo[i].y)>0.80)continue;
    if(!cercaDeMuro(murosPuertasPasillo[i].linea,0.23))continue;
    var enVano=false;
    for(var k=0;k<puertasPalco.length;k++){
      var puerta=puertasPalco[k],ddx=x-puerta.x,ddz=z-puerta.z;
      if(y!==undefined && Math.abs(y-puerta.y)>0.80)continue;
      var dl=Math.abs(ddx*puerta.tx+ddz*puerta.tz);
      var dn=Math.abs(ddx*(-puerta.tz)+ddz*puerta.tx);
      if(dl<0.40 && dn<0.30){enVano=true;break;}
    }
    if(!enVano)return true;
  }
  return false;
}
FALLA.puertas={
  actualizar:actualizarPuertas,
  alternarCercana:alternarPuertaCercana,
  cercana:puertaCercana,
  bloquea:puertaBloquea
};

/* Antepalco posterior de dos metros. Los arcos y cortinas permanecen en
   la línea del antiguo muro; detrás se prolonga el parquet hasta un nuevo
   cerramiento con una puerta centrada para cada palco. */
function antepalcosPlatea(escena,plan,ini,fin,nCeldas,yBase,yTecho,nivel){
  yTecho=yTecho===undefined?COTA_BAJO_PRINCIPAL:yTecho;
  nivel=nivel||0;
  var exterior=geo.dentro(plan,-2.0), tramoPlan=plan.slice(ini,fin+1), tramoExt=exterior.slice(ini,fin+1);
  murosPuertasPasillo.push({linea:tramoExt,y:yBase(tramoExt[0]),nivel:nivel});
  escena.add(banda(tramoPlan,tramoExt,yBase,yBase,MAT.parquetPlatea));
  escena.add(cinta(tramoExt,function(p){return yBase(p)+2.12;},yTecho,MAT.paredPasillo));
  // Segunda piel 18 mm hacia la sala. Desde el palco queda delante del
  // yeso y crea penumbra; desde el corredor permanece oculta tras él.
  // También se usa en el principal: el antiguo paño burdeos estructural
  // ya está abierto, de modo que aquí solo queda este velo translúcido.
  var sombraSuperior=geo.dentro(tramoExt,0.018);
  escena.add(cinta(sombraSuperior,function(p){return yBase(p)+2.12;},yTecho,MAT.sombraAntepalco));

  var idx=indicesPorLongitud(plan,ini,fin,nCeldas), k;
  // Tabiques laterales que prolongan cada separación hasta el nuevo muro.
  for(k=0;k<idx.length;k++){
    var ic=idx[k];
    escena.add(cinta([plan[ic],exterior[ic]],yBase,yTecho,MAT.maderaPlatea));
  }

  // Marcos instanciados; las hojas son individuales porque rotan sobre
  // bisagras y deben poder abrirse por separado.
  // BoxGeometry asigna las dos últimas caras al frente y al reverso.
  // Ambas reciben la portada tallada para que también se vea al recorrer
  // el corredor, no solo desde dentro del antepalco.
  var matsPuerta=[MAT.zocaloPasillo,MAT.zocaloPasillo,MAT.zocaloPasillo,
                  MAT.zocaloPasillo,MAT.puertaPalco,MAT.puertaPalco];
  var marcos=new THREE.InstancedMesh(new THREE.BoxGeometry(0.09,2.05,0.11),MAT.zocaloPasillo,nCeldas*2);
  // El dintel solapa 3 cm con el paño superior: incluso en una vista
  // rasante no queda una ranura por la que se vea la sala.
  var dinteles=new THREE.InstancedMesh(new THREE.BoxGeometry(1.01,0.18,0.12),MAT.zocaloPasillo,nCeldas);
  // La luz interior es de 0.83 x 1.98 m. Un solape de 5 mm en las jambas
  // y 10 mm bajo el dintel impide que se filtre luz al estar cerrada.
  var anchoHoja=0.84,altoHoja=1.99;
  var hojaGeo=new THREE.BoxGeometry(anchoHoja,altoHoja,0.07);
  var matriz=new THREE.Matrix4(), quat=new THREE.Quaternion(), ejeY=new THREE.Vector3(0,1,0);
  var escala=new THREE.Vector3(1,1,1), pos=new THREE.Vector3(), nMarco=0;
  for(k=0;k<nCeldas;k++){
    var i=Math.round((idx[k]+idx[k+1])/2), q=exterior[i];
    var a=exterior[Math.max(ini,i-1)], b=exterior[Math.min(fin,i+1)];
    var angulo=-Math.atan2(b.z-a.z,b.x-a.x), cs=Math.cos(angulo), sn=Math.sin(angulo);
    quat.setFromAxisAngle(ejeY,angulo);
    var pivote=new THREE.Group();
    pivote.position.set(q.x-cs*anchoHoja/2,yBase(q),q.z+sn*anchoHoja/2);
    pivote.rotation.y=angulo;
    var hoja=new THREE.Mesh(hojaGeo,matsPuerta);
    hoja.position.set(anchoHoja/2,altoHoja/2,0); pivote.add(hoja); escena.add(pivote);
    puertasPalco.push({pivote:pivote,x:q.x,y:yBase(q),z:q.z,tx:cs,tz:-sn,angulo:angulo,nivel:nivel,
      sentido:signoPuerta(q),apertura:0,objetivo:0});

    /* Los paños siguen la curva real hasta los límites exactos de cada
       celda. Antes eran cajas tangentes: sus testeros rectos no podían
       encontrarse sobre una curva y dejaban cuñas abiertas entre puertas. */
    var curvaCelda=exterior.slice(idx[k],idx[k+1]+1), acumulada=[0], total=0, centro=0;
    for(var pc=1;pc<curvaCelda.length;pc++){
      total+=Math.hypot(curvaCelda[pc].x-curvaCelda[pc-1].x,curvaCelda[pc].z-curvaCelda[pc-1].z);
      acumulada.push(total);
      if(idx[k]+pc===i) centro=total;
    }
    function puntoEn(dist){
      dist=Math.max(0,Math.min(total,dist)); var s=0;
      while(s<acumulada.length-2 && acumulada[s+1]<dist)s++;
      var largo=acumulada[s+1]-acumulada[s],u=largo?(dist-acumulada[s])/largo:0;
      return {x:curvaCelda[s].x+(curvaCelda[s+1].x-curvaCelda[s].x)*u,
              z:curvaCelda[s].z+(curvaCelda[s+1].z-curvaCelda[s].z)*u};
    }
    function tramo(desde,hasta){
      var pts=[puntoEn(desde)];
      for(var tp=1;tp<curvaCelda.length-1;tp++){
        if(acumulada[tp]>desde && acumulada[tp]<hasta)pts.push(curvaCelda[tp]);
      }
      pts.push(puntoEn(hasta)); return pts;
    }
    var bordeIzq=Math.max(0,centro-0.51), bordeDer=Math.min(total,centro+0.51);
    [[0,bordeIzq],[bordeDer,total]].forEach(function(limites){
      if(limites[1]-limites[0]<0.01)return;
      var paño=tramo(limites[0],limites[1]);
      escena.add(cinta(paño,yBase,function(p){return yBase(p)+0.36;},MAT.zocaloPasillo));
      escena.add(cinta(paño,function(p){return yBase(p)+0.36;},function(p){return yBase(p)+2.12;},MAT.paredPasillo));
      var sombraPaño=geo.dentro(paño,0.018);
      escena.add(cinta(sombraPaño,yBase,function(p){return yBase(p)+2.12;},MAT.sombraAntepalco));
    });
    [-1,1].forEach(function(lado){
      var lx=lado*0.46,lz=0.015;
      pos.set(q.x+cs*lx+sn*lz,yBase(q)+1.025,q.z-sn*lx+cs*lz);
      matriz.compose(pos,quat,escala); marcos.setMatrixAt(nMarco++,matriz);
    });
    pos.set(q.x+sn*0.015,yBase(q)+2.06,q.z+cs*0.015);
    matriz.compose(pos,quat,escala); dinteles.setMatrixAt(k,matriz);
  }
  marcos.instanceMatrix.needsUpdate=true; dinteles.instanceMatrix.needsUpdate=true;
  escena.add(marcos); escena.add(dinteles);
}

function signoPuerta(q){return q.x>=0?1:-1;}

/* Corredor común detrás de los antepalcos, continuo
   alrededor de la herradura y a la misma cota que la platea. */
function pasilloCurvoPalcos(escena,plan,ini,fin,yBase,yTecho,nivel){
  yTecho=yTecho===undefined?COTA_BAJO_PRINCIPAL:yTecho;
  nivel=nivel||0;
  var interior=geo.dentro(plan,-2.0).slice(ini,fin+1);
  var exterior=geo.dentro(plan,-(2.0+P.anchoPasilloPalcos)).slice(ini,fin+1);
  if(nivel===1 && ini===0 && fin===plan.length-1){
    /* Losa del principal con dos huecos reales para las escaleras. Una
       banda de quads continua tapaba el último vuelo visto desde abajo. */
    var forma=new THREE.Shape();
    forma.moveTo(interior[0].x,interior[0].z);
    for(var fp=1;fp<interior.length;fp++)forma.lineTo(interior[fp].x,interior[fp].z);
    for(fp=exterior.length-1;fp>=0;fp--)forma.lineTo(exterior[fp].x,exterior[fp].z);
    forma.closePath();
    var cEsc=geo.cajaEscalera;
    [-1,1].forEach(function(signo){
      var hueco=new THREE.Path();
      var xa=signo>0?cEsc.xMin:-cEsc.xMin,xb=signo>0?cEsc.pretil.xMax:-cEsc.pretil.xMax;
      var x0=Math.min(xa,xb)+0.02,x1=Math.max(xa,xb)-0.02;
      var z0=cEsc.tramos[2].z0+0.03,z1=cEsc.zMax+0.02;
      hueco.moveTo(x0,z0);hueco.lineTo(x0,z1);hueco.lineTo(x1,z1);hueco.lineTo(x1,z0);hueco.closePath();
      forma.holes.push(hueco);
    });
    var geoLosa=new THREE.ShapeGeometry(forma);
    var pLosa=geoLosa.getAttribute('position'),uvLosa=[];
    for(fp=0;fp<pLosa.count;fp++)uvLosa.push(pLosa.getX(fp)*0.5,pLosa.getY(fp)*0.5);
    geoLosa.setAttribute('uv',new THREE.Float32BufferAttribute(uvLosa,2));
    geoLosa.rotateX(Math.PI/2);
    var losa=new THREE.Mesh(geoLosa,MAT.sueloPasillo);losa.position.y=yBase(interior[0]);
    escena.add(losa);
  }else{
    escena.add(banda(interior,exterior,yBase,yBase,MAT.sueloPasillo));
  }
  // El muro burdeos exterior deja libre una entrada en cada extremo,
  // justo frente a las escaleras de acceso.
  var margenEntrada=2;
  var muroExterior=exterior.slice(margenEntrada,exterior.length-margenEntrada);
  murosExterioresPasillo.push({linea:muroExterior,y:yBase(muroExterior[0]),nivel:nivel});
  escena.add(cinta(muroExterior,yBase,function(p){return yBase(p)+0.36;},MAT.zocaloPasillo));
  escena.add(cinta(muroExterior,function(p){return yBase(p)+0.36;},yTecho,MAT.paredPasillo));
}

/* Caja de escalera de acceso al primer piso, una por ala (signo = ±1).
   Al salir del pasillo EXIT se entra a un vestíbulo despejado; los tres
   vuelos quedan detrás, girando alrededor del hueco central.

   Vuelos y rellanos son macizos desde la solera, no losas voladas: la
   cota pisable que publica alturaCajaEscalera los trata como ocupados,
   y dejarlos huecos por debajo crearía muros invisibles. Lo que hace
   franca la entrada no es vaciarlos, sino el vestíbulo que los precede. */
function cajaEscaleraPrimerPiso(signo){
  var g=new THREE.Group(),c=geo.cajaEscalera;
  g.name='cajaEscalera'+(signo>0?'D':'I');
  var altoMuro=P.pisos[2].y-c.baseY-0.10,espesor=0.18;

  /* Toda la sala se define en x positivo; el ala izquierda es su
     reflejo, y reflejar una caja equivale a invertir su giro. */
  function caja(ancho,alto,fondo,x,y,z,mat,rot){
    var m=new THREE.Mesh(new THREE.BoxGeometry(ancho,alto,fondo),mat);
    m.position.set(signo*x,y,z);
    if(rot) m.rotation.y=signo*rot;
    g.add(m); return m;
  }

  // Solera, enrasada con el suelo del pasillo EXIT que tiene encima.
  caja(c.xMax-c.xMin,0.16,c.zMax-c.zMin,(c.xMin+c.xMax)/2,c.baseY-0.08,(c.zMin+c.zMax)/2,MAT.parquetPlatea);

  // Cerramientos. La arista norte queda abierta de par en par a lo ancho
  // del pasillo: el acceso no lleva puerta y es lo que se ve de frente
  // al salir. Solo se cierra el trozo que ya no tiene pasillo delante.
  var cy=c.baseY+altoMuro/2;
  var e=geo.escalerasLaterales, zPasillo=e.centroZ+e.ancho/2;   // fondo del pasillo EXIT
  caja(c.xMax-c.xMin,altoMuro,espesor,(c.xMin+c.xMax)/2,cy,c.zMin,MAT.muro);        // testero sur
  caja(espesor,altoMuro,c.zMax-c.zMin,c.xMin,cy,(c.zMin+c.zMax)/2,MAT.muro);        // costado del teatro
  // El costado de fuera sube también por el pasillo y hace de testero
  // final suyo: es donde queda colgado el cartel de salida.
  caja(espesor,altoMuro,zPasillo-c.zMin,c.xMax,cy,(c.zMin+zPasillo)/2,MAT.muro);
  // Y el trozo de fondo de pasillo que ya no cubre el corredor de platea.
  caja(c.xMax-18.80,altoMuro,espesor,(18.80+c.xMax)/2,cy,zPasillo,MAT.muro);

  // Cada peldaño es una caja maciza desde la solera hasta su huella. La
  // alfombra cubre huella y contrahuella con un pequeño margen lateral.
  c.tramos.forEach(function(t){
    var vx=t.x1-t.x0,vz=t.z1-t.z0,L=Math.hypot(vx,vz),ux=vx/L,uz=vz/L;
    var paso=L/c.peldanos,rot=-Math.atan2(vz,vx),subida=(t.y1-t.y0)/c.peldanos;
    for(var i=0;i<c.peldanos;i++){
      var s0=i/c.peldanos,s1=(i+1)/c.peldanos;
      var x0=t.x0+vx*s0,z0=t.z0+vz*s0,x1=t.x0+vx*s1,z1=t.z0+vz*s1;
      var y=t.y0+subida*(i+1),alto=y-c.baseY;
      caja(paso+0.012,alto,c.anchoTramo,(x0+x1)/2,c.baseY+alto/2,(z0+z1)/2,MAT.muro,rot);
      caja(paso-0.012,0.026,c.anchoTramo-0.08,(x0+x1)/2,y+0.013,(z0+z1)/2,MAT.alfombraEscalera,rot);
      caja(0.026,subida-0.010,c.anchoTramo-0.08,x0-ux*0.013,y-subida/2,z0-uz*0.013,MAT.alfombraEscalera,rot);
    }
  });

  // Rellanos macizos con alfombra continua para marcar el giro.
  c.rellanos.forEach(function(r){
    var ancho=r.xMax-r.xMin,fondo=r.zMax-r.zMin,alto=r.y-c.baseY;
    var cx=(r.xMin+r.xMax)/2,cz=(r.zMin+r.zMax)/2;
    caja(ancho,alto,fondo,cx,c.baseY+alto/2,cz,MAT.muro);
    caja(ancho-0.08,0.026,fondo-0.08,cx,r.y+0.013,cz,MAT.alfombraEscalera);
  });

  // Barandilla siguiendo las tres aristas que dan al hueco central. La
  // cota se saca del propio tramo y no de alturaCajaEscalera: los puntos
  // caen justo sobre el borde y el redondeo podría dejarlos fuera.
  c.bordesInteriores.forEach(function(linea,indice){
    var t=c.tramos[indice],vx=t.x1-t.x0,vz=t.z1-t.z0,L2=vx*vx+vz*vz;
    var puntos=[],j;
    for(j=0;j<=c.peldanos;j++){
      puntos.push({x:signo*(linea[0].x+(linea[1].x-linea[0].x)*j/c.peldanos),
                   z:linea[0].z+(linea[1].z-linea[0].z)*j/c.peldanos});
    }
    barandillaPalco(g,puntos,function(p){
      var s=((Math.abs(p.x)-t.x0)*vx+(p.z-t.z0)*vz)/L2;
      s=Math.max(0,Math.min(1,s));
      var escalon=Math.min(c.peldanos-1,Math.floor(s*c.peldanos));
      return t.y0+(t.y1-t.y0)*(escalon+1)/c.peldanos;
    },0.92);
  });

  // El antiguo pretil del desembarco se elimina: el último vuelo ya no
  // termina ante un vacío, sino en el corredor transitable del principal.
  return g;
}

function texturaSalida(flecha){
  var c=document.createElement('canvas');c.width=512;c.height=192;
  var x=c.getContext('2d');
  x.fillStyle='#08743b';x.fillRect(0,0,c.width,c.height);
  x.strokeStyle='#d9f7df';x.lineWidth=10;x.strokeRect(8,8,c.width-16,c.height-16);
  x.fillStyle='#ffffff';x.font='bold 58px sans-serif';x.textAlign='center';
  x.fillText('SALIDA  EXIT',256,82);
  x.font='bold 62px sans-serif';x.fillText(flecha,256,154);
  return new THREE.CanvasTexture(c);
}

/* Conexión sin puerta entre cada escalera lateral y el extremo abierto
   del corredor posterior. */
function salidasEscalerasPasillo(escena,altura){
  // El pasillo llega justo hasta el costado exterior de la caja de
  // escalera, que se abre a lo largo de todo su flanco sur.
  var e=geo.escalerasLaterales,xIni=e.xAlto,xFin=geo.cajaEscalera.xMax,largo=xFin-xIni;
  [-1,1].forEach(function(signo){
    // El pasillo cruza por debajo del corredor de los palcos, que está a
    // su misma cota: 5 mm de rehundido evitan que las dos tapas peleen
    // por el mismo plano donde se solapan.
    var suelo=new THREE.Mesh(new THREE.BoxGeometry(largo,altura-0.005,e.ancho),MAT.parquetPlatea);
    suelo.position.set(signo*(xIni+xFin)/2,(altura-0.005)/2,e.centroZ);escena.add(suelo);

    // La flecha señala hacia -z, que es el lado por el que ahora se abre
    // la caja de escalera; el giro del cartel invierte el sentido en el
    // ala izquierda, así que el glifo va cambiado respecto al signo.
    var matCartel=new THREE.MeshBasicMaterial({map:texturaSalida(signo>0?'←':'→'),side:THREE.DoubleSide});
    registrar(matCartel);
    var cartel=new THREE.Mesh(new THREE.PlaneGeometry(1.65,0.62),matCartel);
    cartel.position.set(signo*(xFin-0.18),3.02,e.centroZ);
    cartel.rotation.y=-signo*Math.PI/2;
    escena.add(cartel);
  });
}

/* Sala de autoridades oculta detrás del tramo central curvo. Desde el
   patio se percibe la misma fachada continua que en el resto del piso. */
function palcoAutoridades(escena,sillaGeo,y){
  var ancho=8.8,zFrente=26.95,zFondo=31.55;
  var suelo=new THREE.Mesh(new THREE.BoxGeometry(ancho,0.18,zFondo-zFrente),MAT.parquetPlatea);
  suelo.position.set(0,y-0.09,(zFrente+zFondo)/2);escena.add(suelo);

  // Los cerramientos comienzan retrasados: no cortan la fachada curva
  // ni delatan desde el patio que detrás existe una sala más profunda.
  [-1,1].forEach(function(s){
    var lateral=new THREE.Mesh(new THREE.BoxGeometry(0.16,2.55,zFondo-28.15),MAT.muro);
    lateral.position.set(s*ancho/2,y+1.275,(28.15+zFondo)/2);escena.add(lateral);
  });
  var fondo=new THREE.Mesh(new THREE.BoxGeometry(ancho,2.55,0.18),MAT.muro);
  fondo.position.set(0,y+1.275,zFondo);escena.add(fondo);

  var posiciones=[];
  for(var fila=0;fila<5;fila++){
    for(var col=0;col<8;col++){
      posiciones.push({x:(col-3.5)*0.88,y:y,z:zFrente+0.42+fila*0.78});
    }
  }
  var m=new THREE.Matrix4(),q=new THREE.Quaternion(),escala=new THREE.Vector3(1,1,1),pos=new THREE.Vector3();
  ['asiento','respaldo','base'].forEach(function(parte){
    var mat=parte==='base'?MAT.maderaButaca:MAT.terciopeloButaca;
    var im=new THREE.InstancedMesh(sillaGeo[parte],mat,posiciones.length);
    posiciones.forEach(function(p,i){
      pos.set(p.x,p.y,p.z);m.compose(pos,q,escala);im.setMatrixAt(i,m);
    });
    im.instanceMatrix.needsUpdate=true;escena.add(im);
  });
}

/* Dos rampas de salida y fachada de cinco arcos bajo el piso principal:
   salidas en los extremos y tres cabinas técnicas en el centro. */
function fondoTecnicoPlatea(escena){
  var r=geo.rampasTraseras,altura=geo.platea.altura,n=18;
  [-1,1].forEach(function(signo){
    var a=[],b=[];
    for(var i=0;i<=n;i++){
      var z=r.zInicio+(r.zFin-r.zInicio)*i/n;
      var centro=geo.centroRampaTrasera(z);
      var anchoRampa=geo.anchoRampaTrasera(z);
      a.push({x:signo*centro-anchoRampa/2,z:z});
      b.push({x:signo*centro+anchoRampa/2,z:z});
    }
    var yR=function(p){return geo.alturaRampaTrasera(p.x,p.z);};
    escena.add(banda(a,b,yR,yR,MAT.parquetPlatea));
    escena.add(cinta(a,function(p){return geo.rake(p.z);},yR,MAT.maderaPlatea));
    escena.add(cinta(b,function(p){return geo.rake(p.z);},yR,MAT.maderaPlatea));
  });

  // Plataforma única de las tres cabinas centrales. Es una franja de la
  // herradura entre la barandilla y el muro de los arcos; no se prolonga
  // hacia el patio siguiendo longitudinalmente las alfombras.
  // El núcleo coincide con los tres módulos (3 * 2.16 / 2 = 3.24) y
  // deja margen para sus columnas. Dos alas laterales lo enlazan luego
  // con el borde exacto de cada alfombra.
  var bordeCabinas=geo.dentro(geo.PLAN,P.pisos[0].dentro),limiteCabinas=3.38;
  var id=-1,ii=-1,td=0,ti=0;
  for(var ic=0;ic<geo.PLAN.length-1;ic++){
    var qa=geo.PLAN[ic],qb=geo.PLAN[ic+1];
    if(id<0 && qa.x>=limiteCabinas && qb.x<=limiteCabinas){id=ic;td=(limiteCabinas-qa.x)/((qb.x-qa.x)||1);}
    if(ii<0 && qa.x>=-limiteCabinas && qb.x<=-limiteCabinas){ii=ic;ti=(-limiteCabinas-qa.x)/((qb.x-qa.x)||1);}
  }
  if(id>=0 && ii>=id){
    function interpola(a,b,t){return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};}
    var frenteCabinas=[interpola(bordeCabinas[id],bordeCabinas[id+1],td)];
    var muroCabinas=[interpola(geo.PLAN[id],geo.PLAN[id+1],td)];
    for(ic=id+1;ic<=ii;ic++){
      frenteCabinas.push(bordeCabinas[ic]);muroCabinas.push(geo.PLAN[ic]);
    }
    frenteCabinas.push(interpola(bordeCabinas[ii],bordeCabinas[ii+1],ti));
    muroCabinas.push(interpola(geo.PLAN[ii],geo.PLAN[ii+1],ti));
    escena.add(banda(frenteCabinas,muroCabinas,altura,altura,MAT.parquetPlatea));
    escena.add(cinta(frenteCabinas,function(p){return geo.rake(p.z);},altura,MAT.maderaPlatea));

    // Alas laterales: desde la arista radial del núcleo hasta el borde
    // interior real de cada alfombra. Se generan como bandas de quads,
    // por lo que no quedan cuñas sin cara ni triangulaciones ambiguas.
    [-1,1].forEach(function(signo){
      var curvaAlf=bordeAlfombraPasillo(signo,false);
      var extremoFrente=signo>0?frenteCabinas[0]:frenteCabinas[frenteCabinas.length-1];
      var extremoMuro=signo>0?muroCabinas[0]:muroCabinas[muroCabinas.length-1];
      var inicioCurva=0,distancia=Infinity;
      for(var ac=0;ac<curvaAlf.length;ac++){
        var dc=Math.hypot(curvaAlf[ac].x-extremoFrente.x,curvaAlf[ac].z-extremoFrente.z);
        if(dc<distancia){distancia=dc;inicioCurva=ac;}
      }
      curvaAlf=curvaAlf.slice(inicioCurva);
      var aristaRadial=[];
      for(ac=0;ac<curvaAlf.length;ac++){
        var uRad=ac/(curvaAlf.length-1);
        aristaRadial.push({
          x:extremoFrente.x+(extremoMuro.x-extremoFrente.x)*uRad,
          z:extremoFrente.z+(extremoMuro.z-extremoFrente.z)*uRad
        });
      }
      escena.add(banda(curvaAlf,aristaRadial,altura,altura,MAT.parquetPlatea));
      escena.add(cinta(curvaAlf,function(p){
        var yr=geo.alturaRampaTrasera(signo*geo.centroRampaTrasera(p.z),p.z);
        return yr===null?geo.rake(p.z):yr;
      },altura,MAT.maderaPlatea));
    });
  }

  var altoTecho=COTA_BAJO_PRINCIPAL-altura-0.02,altoArco=altoTecho-0.32;
  // Una separación de 2.30 m deja 14 cm entre paños; la columna ocupa
  // por completo esa junta y ya no tapa las molduras de los vanos.
  var centros=[-4.60,-2.30,0,2.30,4.60];
  // El tramo curvo nace 60 cm más arriba; la clave permanece en su cota
  // para no invadir el paño mudéjar ni el forjado del piso superior.
  var anchoModulo=2.16,vano=1.70,arranque=1.82;
  var controlArco=2*altoArco-arranque;
  // Cada vano tiene su propio plano tangente a la herradura. Así la
  // fachada deja de ser una pared recta y acompaña la curva del teatro.
  centros.forEach(function(cx,indice){
    // Interpolación exacta en el segmento que cruza cx. Usar el punto
    // discreto más cercano hacía que varios centros saltasen a la misma
    // muestra de PLAN y los paños acabasen montados unos sobre otros.
    var muestra=muestraCurvaFondo(cx),p=muestra.p,tx=muestra.tx,tz=muestra.tz;
    var rot=-Math.atan2(tz,tx);
    // Normal local +Z; se determina qué signo mira hacia el corredor.
    var signoFuera=((-tz)*p.x+tx*(p.z-P.zc))>=0?1:-1;
    var nx=-tz*signoFuera,nz=tx*signoFuera;
    var grupo=new THREE.Group();
    // El mismo retranqueo interior de 16 cm que portadasPalcosPlatea().
    grupo.position.set(p.x-nx*0.16,altura,p.z-nz*0.16);grupo.rotation.y=rot;

    var forma=new THREE.Shape(),iz=-anchoModulo/2,de=anchoModulo/2;
    forma.moveTo(iz,0);forma.lineTo(de,0);forma.lineTo(de,altoTecho);
    forma.lineTo(iz,altoTecho);forma.closePath();
    var hueco=new THREE.Path();
    hueco.moveTo(-vano/2,0);hueco.lineTo(-vano/2,arranque);
    hueco.quadraticCurveTo(0,controlArco,vano/2,arranque);
    hueco.lineTo(vano/2,0);hueco.closePath();forma.holes.push(hueco);
    grupo.add(new THREE.Mesh(new THREE.ExtrudeGeometry(forma,{depth:0.18,bevelEnabled:false}),MAT.mudejarGeometrico));
    var curva=new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-vano/2,arranque,-0.02),
      new THREE.Vector3(0,controlArco,-0.02),
      new THREE.Vector3(vano/2,arranque,-0.02));
    grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,18,0.055,6,false),MAT.mudejarArcos));
    grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,18,0.022,6,false),MAT.oro));

    // Cornisa, dentado y rombos: el mismo remate volumétrico y ornamental
    // de las portadas laterales de platea.
    var cornisa=new THREE.Mesh(new THREE.BoxGeometry(anchoModulo,0.075,0.28),MAT.mudejarArcos);
    cornisa.position.set(0,altoTecho-0.038,0.02);grupo.add(cornisa);
    var ptsArco=curva.getPoints(28),cantidadDientes=Math.floor((ptsArco.length-4)/2);
    var dientes=new THREE.InstancedMesh(GEO_DIENTE_PORTADA,MAT.mudejarArcos,cantidadDientes);
    var matrizD=new THREE.Matrix4(),quatD=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
    var escalaD=new THREE.Vector3(1,1,1),posD=new THREE.Vector3(),nd=0;
    for(var di=2;di<ptsArco.length-2;di+=2){
      posD.set(ptsArco[di].x,ptsArco[di].y-0.105,-0.005);
      matrizD.compose(posD,quatD,escalaD);dientes.setMatrixAt(nd++,matrizD);
    }
    dientes.instanceMatrix.needsUpdate=true;grupo.add(dientes);
    var geoAdorno=new THREE.BoxGeometry(0.075,0.075,0.045);
    var adornos=new THREE.InstancedMesh(geoAdorno,MAT.oro,5);
    var matrizA=new THREE.Matrix4(),quatA=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/4);
    for(var oi=1;oi<=5;oi++){
      matrizA.compose(new THREE.Vector3(-anchoModulo/2+anchoModulo*oi/6,altoTecho-0.15,-0.025),quatA,escalaD);
      adornos.setMatrixAt(oi-1,matrizA);
    }
    adornos.instanceMatrix.needsUpdate=true;grupo.add(adornos);

    // Sólo los tres huecos centrales son cabinas. Los extremos quedan
    // completamente libres para comunicar rampas, arcos y corredor.
    if(indice>0 && indice<4){
      [-1,1].forEach(function(lado){
        var tabique=new THREE.Mesh(new THREE.BoxGeometry(0.08,2.55,2.15),MAT.muro);
        tabique.position.set(lado*anchoModulo/2,1.275,signoFuera*1.08);grupo.add(tabique);
      });
    }
    escena.add(grupo);
  });

  // Cuatro columnas compartidas: ocultan la unión entre planos
  // tangentes y dan continuidad arquitectónica al conjunto de arcos.
  [-3.45,-1.15,1.15,3.45].forEach(function(cx){
    var muestra=muestraCurvaFondo(cx),p=muestra.p,tx=muestra.tx,tz=muestra.tz;
    var signoFuera=((-tz)*p.x+tx*(p.z-P.zc))>=0?1:-1;
    var nx=-tz*signoFuera,nz=tx*signoFuera;
    var columna=columnaMudejar(altoTecho,arranque);
    columna.position.set(p.x-nx*0.19,altura,p.z-nz*0.19);
    columna.rotation.y=-Math.atan2(tz,tx);
    escena.add(columna);
  });
}

/* Portada del palco frontal, colocada en el plano vertical de su
   barandilla. El vano es casi rectangular: jambas largas y un arco muy
   rebajado bajo un paño superior continuo, como en la sala histórica. */
function arcoPalcoFrontal(escena,signo,x,zInicio,zFin,yBarandilla,yTecho){
  var ancho=zFin-zInicio-0.16,alto=yTecho-yBarandilla;
  if(ancho<=0.4 || alto<=0.45)return;
  var margenJamba=0.18,luz=ancho-2*margenJamba;
  var yArranque=alto*0.76;
  // En una Bézier cuadrática la clave real queda a mitad de camino entre
  // el arranque y el control. Este control produce solo 24 cm de subida
  // en platea, mucho menos que la portada anterior.
  var subida=Math.min(0.24,alto*0.11);
  var grupo=new THREE.Group(),curva=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-luz/2,yArranque,0),
    new THREE.Vector3(0,yArranque+2*subida,0),
    new THREE.Vector3(luz/2,yArranque,0)
  );
  // Jambas rectas, anchas y continuas desde la barandilla.
  [-1,1].forEach(function(lado){
    var jamba=new THREE.Mesh(new THREE.BoxGeometry(margenJamba,alto,0.12),MAT.mudejarArcos);
    jamba.position.set(lado*(ancho/2-margenJamba/2),alto/2,0);grupo.add(jamba);
    var filete=new THREE.Mesh(new THREE.BoxGeometry(0.030,yArranque,0.142),MAT.oro);
    filete.position.set(lado*(luz/2+0.026),yArranque/2,-0.004);grupo.add(filete);
  });
  // Paño sobre el arco: su borde inferior sigue exactamente la curva y
  // su cara visible recibe el patrón mudéjar de las portadas del teatro.
  var ptsArco=curva.getPoints(40),paño=new THREE.Shape();
  paño.moveTo(-ancho/2,yArranque);
  paño.lineTo(ptsArco[0].x,ptsArco[0].y);
  for(var ip=1;ip<ptsArco.length;ip++)paño.lineTo(ptsArco[ip].x,ptsArco[ip].y);
  paño.lineTo(ancho/2,yArranque);
  paño.lineTo(ancho/2,alto);paño.lineTo(-ancho/2,alto);paño.closePath();
  var geoPaño=new THREE.ExtrudeGeometry(paño,{
    depth:0.11,bevelEnabled:true,bevelThickness:0.012,bevelSize:0.012,bevelSegments:1
  });
  geoPaño.translate(0,0,-0.055);
  grupo.add(new THREE.Mesh(geoPaño,MAT.mudejarGeometrico));
  // Tres líneas finas dan profundidad sin convertirlo en un arco alto.
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,40,0.070,8,false),MAT.mudejarArcos));
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,40,0.026,6,false),MAT.oro));
  var curvaExterior=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-luz/2,yArranque+0.105,-0.066),
    new THREE.Vector3(0,yArranque+2*subida+0.105,-0.066),
    new THREE.Vector3(luz/2,yArranque+0.105,-0.066)
  );
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curvaExterior,40,0.020,6,false),MAT.oro));
  // Pequeños dientes en el intradós, muy juntos, responsables de la
  // silueta festoneada visible en la fotografía.
  var nDientes=15,dientes=new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.038,0.10,3),MAT.mudejarArcos,nDientes);
  var matriz=new THREE.Matrix4(),quat=new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0,0,1),Math.PI),escala=new THREE.Vector3(1,1,1);
  for(var id=0;id<nDientes;id++){
    var pd=curva.getPoint((id+0.5)/nDientes);
    matriz.compose(new THREE.Vector3(pd.x,pd.y-0.075,0.078),quat,escala);
    dientes.setMatrixAt(id,matriz);
  }
  dientes.instanceMatrix.needsUpdate=true;grupo.add(dientes);
  var cornisa=new THREE.Mesh(new THREE.BoxGeometry(ancho+0.10,0.10,0.15),MAT.mudejarArcos);
  cornisa.position.set(0,alto-0.05,0);grupo.add(cornisa);
  grupo.position.set(x,yBarandilla,(zInicio+zFin)/2);
  grupo.rotation.y=-signo*Math.PI/2;
  escena.add(grupo);
}

/* Recorta un contorno simétrico en zEncuentro y hace que nazca en una
   arista de la mampara. No añade un tramo transversal sobre su cara:
   desplaza gradualmente los primeros metros del contorno y recupera la
   curva original después, de modo que la barandilla sale hacia el fondo. */
function uneContornoAPared(contorno,xPared,zEncuentro){
  var iD=1;
  while(iD<contorno.length && contorno[iD].z<zEncuentro)iD++;
  var iI=contorno.length-2;
  while(iI>=0 && contorno[iI].z<zEncuentro)iI--;
  function cruce(a,b){
    var t=(zEncuentro-a.z)/((b.z-a.z)||1);
    return {x:a.x+(b.x-a.x)*t,z:zEncuentro};
  }
  var pD=cruce(contorno[iD-1],contorno[iD]);
  var pI=cruce(contorno[iI],contorno[iI+1]);
  var desplazamientoD=pD.x-xPared;
  var desplazamientoI=pI.x+xPared;
  var zRecupera=zEncuentro+4.60;
  var cuerpo=contorno.slice(iD,iI+1).map(function(p){
    var t=Math.max(0,Math.min(1,(p.z-zEncuentro)/(zRecupera-zEncuentro)));
    t=t*t*(3-2*t);
    var desplazamiento=p.x>=0?desplazamientoD:desplazamientoI;
    return {x:p.x-desplazamiento*(1-t),z:p.z};
  });
  return [{x:xPared,z:zEncuentro}]
    .concat(cuerpo,[{x:-xPared,z:zEncuentro}]);
}

/* Palco Frontal: un cajón curvo que conserva su inicio en z=-1 y llega
   hasta el pasillo transversal (Z_CORREDOR_INI), mirando hacia el
   centro de la sala — así los dos, en paralelo, quedan enfrentados el uno
   al otro a través del escenario, en vez de escorados como el resto del
   ala. El punto intermedio (z/2) no cambia la recta, pero le da a
   sillasPalco() un índice real en el que centrar el grupo de sillas.
   limitesFrontal() aparta el fondo del muro real (ver su comentario: un
   fondo fijo al ancho de la jamba quedaría oculto detrás del muro). */
function palcosFrontales(escena, alturaFrontal, alturaBarandilla, altoPiso, sillaGeo, yBase){
  var limFrontal=limitesFrontal(), yFrontal=function(){return alturaFrontal;};
  var esPlatea=alturaFrontal<P.pisos[1].y-1;
  var yTecho=esPlatea?P.pisos[1].y:P.pisos[2].y;
  [-1,1].forEach(function(signo){
    var zInicio=geo.frenteEscenico.zInicioPalcos;
    var xFondo=signo*(limFrontal.xFondo+DESPLAZAMIENTO_FRONTAL_X), xFrente=signo*(limFrontal.xFrente+DESPLAZAMIENTO_FRONTAL_X);
    var bF=[],plF=[],muestras=16;
    for(var ib=0;ib<=muestras;ib++){
      var tb=ib/muestras,zB=zInicio+(Z_CORREDOR_INI-zInicio)*tb;
      // Los extremos permanecen anclados; el centro avanza 42 cm hacia
      // la sala y produce el frente convexo de los palcos históricos.
      bF.push({x:xFrente-signo*0.42*Math.sin(Math.PI*tb),z:zB});
      plF.push({x:xFondo,z:zB});
    }
    /* Base cerrada del palco: frente, trasera y testeros bajan hasta
       yBase para que la pieza no parezca suspendida. En platea yBase es
       el patio en pendiente, así que el palco se apoya en el suelo; en un
       piso alto es el intradós de su propia losa, y entonces el palco
       vuela como el resto de la balconada en vez de nacer del patio. */
    escena.add(cinta(bF, yBase, yFrontal, MAT.maderaPlatea));
    escena.add(cinta(plF, yBase, yFrontal, MAT.maderaPlatea));
    escena.add(cinta([bF[0],plF[0]], yBase, yFrontal, MAT.maderaPlatea));
    escena.add(cinta([bF[bF.length-1],plF[plF.length-1]], yBase, yFrontal, MAT.maderaPlatea));
    escena.add(banda(bF, plF, yBase, yBase, MAT.yeso));   // intradós
    barandillaPalco(escena, bF, yFrontal, alturaBarandilla);
    /* Techo del palco, 5 mm por debajo del forjado que lo cubre. El del
       principal es ahora el propio suelo de la balconada, que pasa por
       encima a la cota exacta del piso: sin ese rehundido las dos tapas
       quedarían coplanares y pelearían por el mismo plano. */
    var yTapa=yTecho-0.005;
    escena.add(banda(bF,plF,function(){return yTapa;},function(){return yTapa;},MAT.hueco));
    escena.add(banda(bF, plF, yFrontal, yFrontal, MAT.suelo));
    sillasPalco(escena, bF, plF, 0, 2, 1, yFrontal, sillaGeo);
    arcoPalcoFrontal(escena,signo,xFrente,zInicio,Z_CORREDOR_INI,
      alturaFrontal+alturaBarandilla,yTecho);
    // Tabique propio del palco frontal. En platea alcanza exactamente el
    // intradós del palco principal; sus 8 cm evitan que sobresalga por los
    // laterales. La apertura al corredor se practica en el muro exterior.
    var altoCierre=esPlatea?P.pisos[1].y-alturaFrontal:altoPiso+1.5;
    var grosorCierre=0.08;
    var centroCierreX=(xFondo+xFrente)/2;
    var cierre=new THREE.Mesh(new THREE.BoxGeometry(ANCHO_FRONTAL,altoCierre,grosorCierre),MAT.yeso);
    cierre.position.set(centroCierreX,alturaFrontal+altoCierre/2,Z_CORREDOR_INI);
    escena.add(cierre);
    // Composición histórica en la cara que mira hacia las mamparas de
    // tres arcos: panel cuadrado abajo y friso horizontal arriba.
    var ladoPanel=Math.min(ANCHO_FRONTAL-0.34,altoCierre-0.24);
    var zPanel=Z_CORREDOR_INI+grosorCierre/2+0.006;
    var panel=new THREE.Mesh(new THREE.PlaneGeometry(ladoPanel,ladoPanel),MAT.panelPalcoFrontal);
    panel.name='panelMudejarPalcoFrontal';
    panel.position.set(centroCierreX,alturaFrontal+0.12+ladoPanel/2,zPanel);
    escena.add(panel);
    if(esPlatea){
      var altoFriso=0.58;
      var friso=new THREE.Mesh(new THREE.PlaneGeometry(ladoPanel,altoFriso),MAT.frisoPalcoFrontal);
      friso.name='frisoMudejarPalcoFrontal';
      friso.position.set(centroCierreX,alturaFrontal+0.12+ladoPanel+0.09+altoFriso/2,zPanel);
      escena.add(friso);
    }
  });
}

/* Pieza terminal entre el último palco y el arco de salida: prolonga el
   frente de la platea hasta el fondo bordeando la alfombra, con la misma
   holgura que usa el hueco de la valla, de modo que suelo, canto y valla
   comparten los mismos puntos. Recibe de construir() los dos remates del
   suelo y los dos extremos de valla ya calculados, porque salen de la
   propia curva de la barandilla. */
function remateHaciaAlfombra(escena, borde, remates, extremosValla, alturaPlatea, yPiso){
  [-1,1].forEach(function(signo){
    var indice=signo>0?remates.derecha:remates.izquierda;
    var frente=borde[indice];
    var curvaCompleta=bordeAlfombraPasillo(signo,true);
    // Interpolamos el borde de la alfombra exactamente a la misma Z que el
    // remate de la valla. Elegir sólo la muestra más cercana dejaba una
    // diagonal entre ambas y esa cara formaba una cuña triangular visible
    // encima de la alfombra.
    var inicioAlfombra=0,puntoInicio=curvaCompleta[0];
    for(var ic=0;ic<curvaCompleta.length-1;ic++){
      var ca=curvaCompleta[ic],cb=curvaCompleta[ic+1];
      if(frente.z>=ca.z && frente.z<=cb.z){
        var tz=(frente.z-ca.z)/((cb.z-ca.z)||1);
        puntoInicio={x:ca.x+(cb.x-ca.x)*tz,z:frente.z};
        inicioAlfombra=ic+1;
        break;
      }
      if(Math.abs(curvaCompleta[ic+1].z-frente.z)<Math.abs(puntoInicio.z-frente.z)){
        puntoInicio=curvaCompleta[ic+1];inicioAlfombra=ic+2;
      }
    }
    var curvaAlfombra=[puntoInicio].concat(curvaCompleta.slice(inicioAlfombra));
    // Arranca justo donde termina la valla principal, no en el vértice del
    // borde: valla, canto y suelo comparten así el mismo punto de partida
    // y el contorno del relleno deja de cruzarse.
    var extremoValla=signo>0?extremosValla.derecha:extremosValla.izquierda;
    var puntosEnlace=[extremoValla];
    curvaAlfombra.forEach(function(p){
      var q={x:p.x+signo*HOLGURA_VALLA_ALFOMBRA,z:p.z},ultimo=puntosEnlace[puntosEnlace.length-1];
      // Sólo puntos que avanzan hacia el fondo: al desplazar el eje de la
      // alfombra a su borde, el primero retrocede en z y metía un paso
      // atrás que volvía a cruzar el contorno del relleno.
      if(q.z>ultimo.z+0.02 && Math.hypot(q.x-ultimo.x,q.z-ultimo.z)>0.05) puntosEnlace.push(q);
    });
    var objetivoEnlace=puntosEnlace[puntosEnlace.length-1];
    // El cierre posterior también debe recorrer el muro curvo. La antigua
    // arista muro->objetivo era una diagonal larga que atravesaba la rampa
    // y dibujaba falsas cuñas sobre la alfombra.
    var indiceMuroFinal=indice,distMuro=Infinity;
    for(var im=0;im<geo.PLAN.length;im++){
      var dm=Math.hypot(geo.PLAN[im].x-objetivoEnlace.x,geo.PLAN[im].z-objetivoEnlace.z);
      if(dm<distMuro){distMuro=dm;indiceMuroFinal=im;}
    }
    var recorridoMuro=[],pasoMuro=indiceMuroFinal>=indice?1:-1;
    for(var jm=indice;;jm+=pasoMuro){
      recorridoMuro.push(geo.PLAN[jm]);
      if(jm===indiceMuroFinal)break;
    }
    // Igual que en el borde de las cabinas que ya funciona bien: rellenamos
    // mediante quads entre el contorno de la alfombra y el muro. Ambos se
    // remuestrean por longitud para que cada pareja avance en el mismo
    // sentido. Así evitamos por completo la triangulación ambigua del
    // antiguo polígono cóncavo.
    var muestrasRelleno=Math.max(12,puntosEnlace.length,recorridoMuro.length);
    var enlaceUniforme=remuestreaLinea(puntosEnlace,muestrasRelleno);
    var muroUniforme=remuestreaLinea(recorridoMuro,muestrasRelleno);
    escena.add(banda(enlaceUniforme,muroUniforme,
      function(){return alturaPlatea+0.006;},
      function(){return alturaPlatea+0.006;},MAT.parquetPlatea));

    // El canto de madera recorre el límite de la plataforma junto a la
    // alfombra. La rampa llega a la misma cota que el palco en su extremo;
    // si se usa esa altura directamente, los últimos quads colapsan y
    // forman puntas triangulares. Conservamos un faldón mínimo continuo,
    // unido al canto del último tramo con valla. Esta zona es un acceso
    // abierto: no lleva balaustres ni pasamanos.
    escena.add(cinta(enlaceUniforme,function(p){
      var yr=geo.alturaRampaTrasera(signo*geo.centroRampaTrasera(p.z),p.z);
      var baseNatural=yr===null?geo.rake(p.z):yr;
      return Math.min(baseNatural,yPiso(p)-0.32);
    },yPiso,MAT.maderaPlatea));
  });
}

/* Ornamentos de portada: el diente del intradós y el rombo del paño alto
   son idénticos en todos los palcos, así que la geometría se crea una vez
   y la comparten todas las mallas instanciadas. Dentro del bucle se
   subían a la GPU unas ochenta copias del mismo buffer. */
var GEO_DIENTE_PORTADA = new THREE.ConeGeometry(0.060,0.14,3);
var GEO_ADORNO_PORTADA = new THREE.BoxGeometry(0.075,0.075,0.022);

/* Funde en una sola malla por material todas las piezas estáticas que
   cuelgan directamente de la escena. La sala es un interior que se ve casi
   entero desde cualquier punto, así que el descarte por frustum no estaba
   ahorrando prácticamente nada y en cambio cada pieza costaba su propia
   llamada de dibujo.

   Sólo toca las hijas directas de la escena, y ése es justo el criterio
   que la hace segura: lo que se mueve —las hojas de puerta, que cuelgan de
   su pivote, y el telón, que vive dentro del grupo del escenario— está
   siempre dentro de un grupo, así que queda excluido sin necesidad de
   marcarlo. Las normales se transforman con su propia matriz, no con la
   del vértice, o el sombreado se rompería en las piezas giradas. */
function fusionaEstaticas(escena){
  var porMaterial=new Map();
  escena.children.slice().forEach(function(o){
    if(!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    if(!o.geometry || !o.geometry.attributes.position) return;
    if(!porMaterial.has(o.material)) porMaterial.set(o.material,[]);
    porMaterial.get(o.material).push(o);
  });

  porMaterial.forEach(function(mallas,material){
    if(mallas.length<2) return;
    var pos=[], nor=[], uvs=[], idx=[], base=0;
    var matrizNormal=new THREE.Matrix3(), v=new THREE.Vector3();
    mallas.forEach(function(malla){
      malla.updateMatrix();
      matrizNormal.getNormalMatrix(malla.matrix);
      var g=malla.geometry, p=g.attributes.position;
      var n=g.attributes.normal, u=g.attributes.uv, i, k;
      for(i=0;i<p.count;i++){
        v.fromBufferAttribute(p,i).applyMatrix4(malla.matrix);
        pos.push(v.x,v.y,v.z);
        if(n){ v.fromBufferAttribute(n,i).applyMatrix3(matrizNormal).normalize(); nor.push(v.x,v.y,v.z); }
        else nor.push(0,1,0);
        if(u) uvs.push(u.getX(i),u.getY(i)); else uvs.push(0,0);
      }
      if(g.index){ for(k=0;k<g.index.count;k++) idx.push(base+g.index.getX(k)); }
      else { for(k=0;k<p.count;k++) idx.push(base+k); }
      base+=p.count;
    });
    var fusion=new THREE.BufferGeometry();
    fusion.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    fusion.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    fusion.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    fusion.setIndex(idx);
    mallas.forEach(function(malla){ escena.remove(malla); malla.geometry.dispose(); });
    escena.add(new THREE.Mesh(fusion,material));
  });
}

/* ---------------- MONTAJE ----------------------------------------- */
function construir(escena){
  escena.background=new THREE.Color(0x0d0608);
  escena.fog=new THREE.Fog(0x0d0608, 34, 78);

  // Patio de butacas (suelo en pendiente, con parquet) y muro perimetral.
  escena.add(superficie(geo.contornoPatioConFoso(), geo.rake, MAT.parquet, true));
  // El muro original se abre a la altura de la platea para comunicar
  // cada palco con su antepalco posterior. Conserva un zócalo bajo el
  // suelo. El tramo del principal también queda abierto hasta el forjado
  // siguiente: sus portadas y el cerramiento retrasado del pasillo son
  // quienes delimitan ahora los palcos, no el antiguo muro burdeos.
  escena.add(cinta(geo.PLAN, function(p){return geo.rake(p.z);}, function(p){
    // Desde el final del palco frontal se rebaja el muro hasta el suelo
    // de platea para abrir la salida hacia el corredor.
    return p.z>=Z_CORREDOR_INI-0.8 ? geo.platea.altura : P.altura;
  }, MAT.muro));
  escena.add(cinta(geo.PLAN, function(p){
    return p.z>=Z_CORREDOR_INI-0.8 ? P.pisos[2].y : P.altura;
  }, P.altura, MAT.muro));

  // Los cuatro niveles de la herradura.
  //
  // La platea tiene tres piezas distintas, no un anillo continuo:
  //  - El Palco Frontal, uno a cada lado, encajado en el tramo recto de
  //    la jamba (junto al arco de boca), a la altura del escenario: no
  //    seríamos capaces de sentarnos con la peana normal, tan escorados
  //    y tan cerca, así que va como pieza aparte, plana, a su propia
  //    altura fija.
  //  - El Antepalco: un hueco/pasillo de salida entre el Palco Frontal y
  //    el primer palco de la platea, sin suelo ni peana propios todavía
  //    (se dejará listo para puerta/pasillo más adelante).
  //  - El ala de la platea en sí: los 9 palcos por lado sobre la peana
  //    normal, empezando ya pasado el Antepalco.
  var ALTURA_FRONTAL = geo.escenario.altura + 0.10; // suelo del palco junto al escenario: un poco por encima de las tablas
  var ELEVACION_PLATEA = 0.40;                      // peana normal del resto del ala
  var ALTURA_BARANDILLA_PLATEA = Math.max(0.68, P.pisos[0].alto*0.62); // coincide con el tramo recto de los separadores
  // La platea inferior es horizontal: se toma como cota única el punto
  // más alto que antes alcanzaba al seguir la pendiente de la sala. Así
  // se elevan los tramos delanteros sin bajar los del fondo.
  var ALTURA_PLATEA = geo.rake(P.zc+P.Rz)+ELEVACION_PLATEA;
  var sillaPalcoGeo = null;   // se construye una sola vez, la primera vez que hace falta
  P.pisos.forEach(function(piso, n){
    var planPiso=geo.PLAN;
    var borde = geo.dentro(planPiso, piso.dentro);
    if(n===1){
      // Los palcos de proscenio se adelantan hasta la línea del palco
      // frontal. El modo paseo decide por contorno, no por la geometría
      // dibujada, así que tiene que recibir exactamente el mismo.
      borde=adelantaPalcosProscenio(borde, piso.palcosLado);
      geo.fijaBordeNivel(n, borde);
    }
    if(n===2){
      // El segundo piso no recibe otro palco frontal: su anillo completo
      // se prolonga hasta la pared existente. Los extremos coinciden con
      // sus dos cantos, de xFrente a xFondo, en z=Z_CORREDOR_INI.
      var limSegundo=limitesFrontal();
      var xInteriorSegundo=limSegundo.xFrente+DESPLAZAMIENTO_FRONTAL_X;
      var xExteriorSegundo=limSegundo.xFondo+DESPLAZAMIENTO_FRONTAL_X;
      var bordeSegundo=uneContornoAPared(borde,xInteriorSegundo,Z_CORREDOR_INI);
      var planSegundo=uneContornoAPared(planPiso,xExteriorSegundo,Z_CORREDOR_INI);
      var muestrasSegundo=Math.max(bordeSegundo.length,planSegundo.length);
      borde=remuestreaLinea(bordeSegundo,muestrasSegundo);
      planPiso=remuestreaLinea(planSegundo,muestrasSegundo);
    }
    // yPiso/yTop siempre como función de p, aunque en los pisos altos sea
    // un valor constante: así la moldura de abajo no necesita distinguir
    // el caso de la platea (suelo en pendiente) del resto (suelo plano).
    var yPiso = (n===0) ? function(){return ALTURA_PLATEA;} : function(){return piso.y;};
    var yTop  = (n===0) ? function(){return ALTURA_PLATEA+piso.alto;} : function(){return piso.y+piso.alto;};

    if(n===0){
      // El ala de la platea arranca donde termina el pasillo transversal
      // (a la profundidad Z_CORREDOR_FIN, justo pasada la fila 1), no a
      // un nº de metros de arco de la jamba: se busca el primer punto de
      // la curva que ya está a esa profundidad. corteD/corteI, como
      // antes, marcan el otro extremo del ala (a la altura de los
      // pasillos centrales, antes del futuro palco de autoridades).
      var iAlaD=-1, ci;
      for(ci=0; ci<geo.PLAN.length; ci++){ if(geo.PLAN[ci].z>=Z_CORREDOR_FIN){ iAlaD=ci; break; } }
      var iAlaI=geo.PLAN.length-1-iAlaD;
      // Los palcos se redistribuyen en un arco algo más corto para
      // liberar el conjunto central de cinco vanos. Antes el corte se
      // hacía en x=3.40 (el eje del pasillo), por lo que la última
      // portada lateral se solapaba con el arco exterior de salida.
      var umbral=RESERVA_TECNICA_MEDIA, corteD=-1;
      for(ci=0; ci<geo.PLAN.length; ci++){ if(geo.PLAN[ci].x<=umbral){ corteD=ci; break; } }
      var corteI=(geo.PLAN.length-1)-corteD;

      if(!sillaPalcoGeo) sillaPalcoGeo = construirSillaPalco();

      palcosFrontales(escena, ALTURA_FRONTAL, ALTURA_BARANDILLA_PLATEA, piso.alto, sillaPalcoGeo,
        function(p){return geo.rake(p.z);});

      // El ala en sí (peana+barandilla+suelo+moldura continuos, y dentro,
      // los 9 palcos tabicados con sus sillas), de iAla a corte y de
      // corte a iAla especular — así el Antepalco (de iArco a iAla) y el
      // hueco central (de corteD a corteI) quedan sin construir.
      var bAla=borde.slice(iAlaD,iAlaI+1), plAla=geo.PLAN.slice(iAlaD,iAlaI+1);
      var tramosBarandilla=tramosPlateaSinSalidas(bAla);
      // Muro portante continuo bajo el frente de la platea: cierra el
      // desnivel entre el suelo inclinado del patio y la cota horizontal
      // de los palcos. En los arcos 1 y 5 se interrumpe también este
      // frente para que no forme un escalón atravesado sobre la rampa.
      tramosBarandilla.forEach(function(tramoBar){
        escena.add(cinta(tramoBar, function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      });
      // Moldura cilíndrica en la junta entre el muro portante y la valla.
      // Sigue toda la herradura y oculta el encuentro entre ambos planos.
      // El diámetro cubre por completo los 12 cm del zócalo rojo situado
      // detrás. También se interrumpe en las dos salidas, igual que la
      // valla, para que no quede un travesaño a ras de suelo.
      tramosBarandilla.forEach(function(tramoBar){
        var curvaRemate=new THREE.CatmullRomCurve3(tramoBar.map(function(p){
          return new THREE.Vector3(p.x,ALTURA_PLATEA+0.07,p.z);
        }));
        var geoRemate=new THREE.TubeGeometry(curvaRemate,Math.max(12,tramoBar.length*2),0.075,10,false);
        escena.add(new THREE.Mesh(geoRemate,MAT.barnizClaro));
      });
      barandillaPlateaConSalidas(escena, bAla, yPiso, ALTURA_BARANDILLA_PLATEA);
      // Trasdós: misma forma que la herradura pero más retranqueado (más
      // cerca del muro real), para que el ala tenga volumen real y no
      // sea una peana de espesor cero. De momento sin textura.
      var trasdos = geo.dentro(geo.PLAN, piso.dentro*0.35).slice(iAlaD,iAlaI+1);
      escena.add(cinta(trasdos, function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      escena.add(cinta([bAla[0],trasdos[0]], function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      escena.add(cinta([bAla[bAla.length-1],trasdos[trasdos.length-1]], function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      // El suelo termina exactamente donde lo hace la valla lateral.
      // Derivar el índice de su propio extremo evita confundir el sentido
      // de PLAN y prolongar accidentalmente la plataforma hacia la rampa.
      var extremoVallaD=tramosBarandilla[0][tramosBarandilla[0].length-1];
      var ultimoTramoValla=tramosBarandilla[tramosBarandilla.length-1];
      var extremoVallaI=ultimoTramoValla[0];
      function indiceMasCercano(punto){
        // Sólo vértices fuera del hueco de la rampa. El más cercano a secas
        // podía caer 19 cm dentro: el suelo de la platea se asomaba sobre
        // la alfombra y, peor, el contorno del relleno posterior arrancaba
        // del lado equivocado y se cruzaba consigo mismo.
        var mejor=-1,distancia=Infinity;
        for(var iv=iAlaD;iv<=iAlaI;iv++){
          if(enHuecoRampa(borde[iv])) continue;
          var d=Math.hypot(borde[iv].x-punto.x,borde[iv].z-punto.z);
          if(d<distancia){distancia=d;mejor=iv;}
        }
        return mejor<0?iAlaD:mejor;
      }
      var remateD=indiceMasCercano(extremoVallaD);
      var remateI=indiceMasCercano(extremoVallaI);
      escena.add(banda(
        borde.slice(iAlaD,remateD+1),geo.PLAN.slice(iAlaD,remateD+1),
        yPiso,yPiso,MAT.parquetPlatea));
      escena.add(banda(
        borde.slice(remateI,iAlaI+1),geo.PLAN.slice(remateI,iAlaI+1),
        yPiso,yPiso,MAT.parquetPlatea));
      separadoresPalco(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso, piso.alto);
      separadoresPalco(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso, piso.alto);
      remateHaciaAlfombra(escena, borde,
        {derecha:remateD, izquierda:remateI},
        {derecha:extremoVallaD, izquierda:extremoVallaI},
        ALTURA_PLATEA, yPiso);
      sillasPalco(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso, sillaPalcoGeo);
      sillasPalco(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso, sillaPalcoGeo);
      portadasPalcosPlatea(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso);
      portadasPalcosPlatea(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso);
      antepalcosPlatea(escena, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso);
      antepalcosPlatea(escena, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso);
      pasilloCurvoPalcos(escena,geo.PLAN,iAlaD,iAlaI,yPiso);
      salidasEscalerasPasillo(escena,ALTURA_PLATEA);
    } else {
      /* El principal lleva palco frontal propio, alineado en planta con el
         de platea. Su anillo se solaparía con él —y sus dos suelos
         quedarían coplanares a la misma cota, que es z-fighting seguro—,
         así que arranca en el primer punto de planta ya pasada la boca
         del palco. iFrontalD y su espejo iFrontalI marcan ese hueco, y
         todas las piezas del anillo que chocan se recortan contra ellos.
         El corredor trasero no: va por x>=14.5 y nunca roza el palco.

         El anillo ya no arranca sobre la herradura: adelantaPalcosProscenio()
         ha traído su borde hasta la línea del palco frontal, de modo que la
         valla sale de éste y sigue recta antes de recuperar la curva. */
      var iFrontalD=0, iFrontalI=borde.length-1;
      if(n===1){
        for(var iff=0; iff<geo.PLAN.length; iff++){
          if(geo.PLAN[iff].z>=Z_CORREDOR_INI){ iFrontalD=iff; break; }
        }
        iFrontalI=geo.PLAN.length-1-iFrontalD;
      }
      var bordeAnillo=borde.slice(iFrontalD,iFrontalI+1);
      var planAnillo=planPiso.slice(iFrontalD,iFrontalI+1);
      if(n===1){
        /* iFrontalD se elige sobre la planta, pero el borde interior lo
           produce dentro(), que desplaza cada punto por su normal: junto
           a la embocadura esa normal tiene mucha componente en z, así que
           el primer punto del anillo cae en z=2,67 mientras el palco
           frontal termina en z=1,80. Valla y canto arrancaban ahí y
           dejaban una cuña de 87 cm de suelo sin cerrar, por la que se
           veía la pared del fondo. Se les añade el punto que falta —a la
           misma x, porque ese tramo ya es recto— para que empalmen con el
           palco frontal. El suelo no lo necesitaba: banda() lo cose desde
           el contorno completo, que sí pasa por ahí. */
        bordeAnillo=[{x:bordeAnillo[0].x,z:Z_CORREDOR_INI}].concat(
          bordeAnillo,[{x:bordeAnillo[bordeAnillo.length-1].x,z:Z_CORREDOR_INI}]);
      }

      if(n===1){
        // Entresuelo independiente: cara inferior a 4,10 m y suelo del
        // principal a 4,35 m. Se deja con acabado neutro y como grupo
        // propio para poder sustituirlo por ornamentación más adelante.
        var entresuelo=new THREE.Group();
        entresuelo.name='entresueloDecorativoPrincipal';
        var yBajo=piso.y-P.entresueloPrincipal;
        // Intradós y trasdós siguen dando la vuelta completa: recortarlos
        // dejaba cuñas sin suelo entre el palco y el arranque del anillo.
        entresuelo.add(banda(borde,geo.PLAN,yBajo,yBajo,MAT.yeso));
        // Solo el canto orientado al patio recibe el paño moldurado;
        // intradós, trasdós y testeros conservan su material independiente.
        entresuelo.add(cinta(bordeAnillo,yBajo,piso.y,MAT.entresueloFrente));
        entresuelo.add(cinta(geo.PLAN,yBajo,piso.y,MAT.yeso));
        entresuelo.add(cinta([bordeAnillo[0],planAnillo[0]],yBajo,piso.y,MAT.yeso));
        entresuelo.add(cinta([bordeAnillo[bordeAnillo.length-1],planAnillo[planAnillo.length-1]],yBajo,piso.y,MAT.yeso));
        escena.add(entresuelo);

        /* Palco frontal del principal: misma planta que el de platea, pero
           colgado del intradós de su losa en vez de apoyado en el patio.
           Su suelo se solaparía con el del anillo, que pasa por debajo a la
           misma cota; 5 mm de separación evitan que las dos tapas peleen
           por el mismo plano, igual que en el cruce del pasillo EXIT. */
        palcosFrontales(escena, piso.y+0.005, piso.alto, piso.alto, sillaPalcoGeo,
          yBajo-0.005);
      }
      if(n===1)barandillaPalco(escena,bordeAnillo,yPiso,piso.alto);
      else escena.add(cinta(borde, yPiso, yTop, MAT.antepecho));            // antepecho
      // En el principal no se coloca la antigua tapa horizontal oscura:
      // sus portadas arqueadas cierran visualmente cada palco sin formar
      // una gran cara negra al mirar el nivel desde fuera.
      if(n!==1)escena.add(banda(borde,planPiso,yTop,yTop,MAT.hueco));       // hueco del palco
      escena.add(banda(borde,planPiso,yPiso,yPiso,MAT.suelo));              // suelo del palco
      if(n!==1)escena.add(cinta(borde, yTop, function(p){return yTop(p)+0.14;}, MAT.oro)); // moldura
      if(n===1){
        // Once palcos por lado. El tramo central posterior queda
        // reservado al palco de autoridades, no recibe separadores.
        var limiteAutoridadD=-1;
        for(var ia=0;ia<geo.PLAN.length;ia++){
          if(geo.PLAN[ia].x<=4.4){limiteAutoridadD=ia;break;}
        }
        var limiteAutoridadI=geo.PLAN.length-1-limiteAutoridadD;
        apliquesEntresuelo(escena,borde,geo.PLAN,iFrontalD,limiteAutoridadD,
          piso.palcosLado,piso.y-P.entresueloPrincipal/2);
        apliquesEntresuelo(escena,borde,geo.PLAN,limiteAutoridadI,iFrontalI,
          piso.palcosLado,piso.y-P.entresueloPrincipal/2);
        separadoresPalco(escena,borde,geo.PLAN,iFrontalD,limiteAutoridadD,piso.palcosLado,piso.y,piso.alto);
        separadoresPalco(escena,borde,geo.PLAN,limiteAutoridadI,iFrontalI,piso.palcosLado,piso.y,piso.alto);
        sillasPalco(escena,borde,geo.PLAN,iFrontalD,limiteAutoridadD,piso.palcosLado,yPiso,sillaPalcoGeo);
        sillasPalco(escena,borde,geo.PLAN,limiteAutoridadI,iFrontalI,piso.palcosLado,yPiso,sillaPalcoGeo);
        portadasPalcosPlatea(escena,borde,geo.PLAN,iFrontalD,limiteAutoridadD,
          piso.palcosLado,yPiso,P.pisos[2].y);
        portadasPalcosPlatea(escena,borde,geo.PLAN,limiteAutoridadI,iFrontalI,
          piso.palcosLado,yPiso,P.pisos[2].y);
        palcoAutoridades(escena,sillaPalcoGeo,piso.y);
        // Segundo nivel transitable: antepalcos laterales con puertas y
        // corredor continuo, a la cota superior del entresuelo.
        antepalcosPlatea(escena,geo.PLAN,iFrontalD,limiteAutoridadD,piso.palcosLado,
          yPiso,P.pisos[2].y,1);
        antepalcosPlatea(escena,geo.PLAN,limiteAutoridadI,iFrontalI,piso.palcosLado,
          yPiso,P.pisos[2].y,1);
        pasilloCurvoPalcos(escena,geo.PLAN,0,geo.PLAN.length-1,
          yPiso,P.pisos[2].y,1);
      }else if(piso.palcos){
        separadoresPalco(escena,borde,planPiso,0,borde.length-1,piso.palcos,piso.y,piso.alto);
      }
    }
  });

  escena.add(butacas());
  escena.add(pasillosPatio());
  fondoTecnicoPlatea(escena);
  escena.add(embocadura());
  escena.add(sueloFoso());
  escena.add(escalerasLaterales());
  escena.add(mamparasEscaleras());
  escena.add(mamparasRampas());
  [-1,1].forEach(function(signo){ escena.add(cajaEscaleraPrimerPiso(signo)); });
  escena.add(escenario());

  // Techo con la alegoría.
  var techo=superficie(geo.PLAN, function(){return P.altura;},
    new THREE.MeshLambertMaterial({map:texturaTecho(), side:THREE.DoubleSide}), true);
  registrar(techo.material);
  escena.add(techo);

  var lam=lampara(); lam.position.set(0,10.4,13.5); escena.add(lam);

  // Luz: cálida, poca, como en sala antes de empezar.
  escena.add(new THREE.AmbientLight(0xffddb8, 0.42));
  escena.add(new THREE.HemisphereLight(0xffe0b0, 0x1a0c0e, 0.45));
  var araña=new THREE.PointLight(0xffcf8a, 0.95, 40); araña.position.set(0,10.2,13.5); escena.add(araña);
  var focoIzq=new THREE.PointLight(0xffb88a, 0.35, 26); focoIzq.position.set(-7,6,9); escena.add(focoIzq);
  var focoDer=new THREE.PointLight(0xffb88a, 0.35, 26); focoDer.position.set(7,6,9); escena.add(focoDer);
  var candilejas=new THREE.PointLight(0xfff0d0, 1.1, 30); candilejas.position.set(0,4.5,-3); escena.add(candilejas);
  // Los Palcos Frontales quedan en un rincón que ninguna de las luces de
  // arriba alcanza bien (lejos de la araña, por debajo de los focos
  // laterales): sin luz propia, la barandilla dorada y las sillas se ven
  // casi negras contra el muro. Una luz suave por palco basta.
  var limFrontalLuz=limitesFrontal();
  [-1,1].forEach(function(signo){
    var focoFrontal=new THREE.PointLight(0xffcf9a, 0.55, 12);
    focoFrontal.position.set(signo*((limFrontalLuz.xFondo+limFrontalLuz.xFrente)/2+DESPLAZAMIENTO_FRONTAL_X), 2.6, (Z_CORREDOR_INI+geo.frenteEscenico.zInicioPalcos)/2);
    escena.add(focoFrontal);
  });

  // Último paso del montaje: a partir de aquí la escena ya no se modifica,
  // así que se pueden fundir las piezas estáticas.
  fusionaEstaticas(escena);

  return {nButacas:nButacas, nFilas:nFilas};
}

FALLA.escena = { construir: construir };
})();
