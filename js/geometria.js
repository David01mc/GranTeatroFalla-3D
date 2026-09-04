(function(){
'use strict';
var FALLA = window.FALLA;
var geo = FALLA.geo, P = geo.P, MAT = FALLA.materiales.MAT, registrar = FALLA.materiales.registrar;

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
    var y = geo.rake(p.z)+0.08; // por encima del suelo; el resto del margen anti z-fighting lo da polygonOffset en MAT.alfombra
    pos.push(p.x-nx*ancho/2, y, p.z-nz*ancho/2,  p.x+nx*ancho/2, y, p.z+nz*ancho/2);
    if(i>0) dist += Math.hypot(p.x-pts[i-1].x, p.z-pts[i-1].z);
    uv.push(0, dist*0.6,  1, dist*0.6);
  }
  for(i=0;i<pts.length-1;i++){ var o=i*2; idx.push(o,o+1,o+2, o+1,o+3,o+2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
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

var FILAS_CENTRO = 16, ASIENTOS_CENTRO = 9;
var FILAS_LATERAL = 15;
// fila 1 (junto al escenario) .. fila 15 (junto al fondo de la sala)
var ASIENTOS_LATERAL = [6,6,6, 7,7,7,7,7,7,7,7, 6,5,4,2];

var CENTRO_MEDIO = ASIENTOS_CENTRO/2*ASIENTO_PASO;              // media anchura del bloque central
var LATERAL_DENTRO = CENTRO_MEDIO + PASILLO_CENTRAL;             // borde interior (hacia el pasillo central) de cada lateral

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
var RETIRO_ESCENARIO_Z = 1.0;       // espacio adicional reservado delante para el foso
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
  var zIni=Z_FILA1-0.6, zFin=zFila(FILAS_CENTRO-1)+0.6;
  var cx = (CENTRO_MEDIO+LATERAL_DENTRO)/2;
  var anchoAlfombra = PASILLO_CENTRAL - 0.36;
  [-1,1].forEach(function(signo){
    var pts=[{x:signo*cx, z:zIni}, {x:signo*cx, z:zFin}];
    g.add(alfombra(pts, anchoAlfombra, MAT.alfombra));
  });
  // Alfombra transversal, perpendicular a las dos de arriba: justo
  // delante de la fila 1 (Z_CORREDOR_INI..FIN), de Palco Frontal a Palco
  // Frontal, cruzando también por delante del bloque central — una sola
  // pieza continua (no dos tramos con un hueco en medio) para que enlace
  // sin costura con las dos alfombras verticales en Z_CORREDOR_FIN. A
  // todo el ancho del pasillo (no con el margen de las de arriba).
  var zCruce=(Z_CORREDOR_INI+Z_CORREDOR_FIN)/2, xFrenteFrontal=limitesFrontal().xFrente;
  var ptsCruce=[{x:-xFrenteFrontal, z:zCruce}, {x:xFrenteFrontal, z:zCruce}];
  g.add(alfombra(ptsCruce, PASILLO_CENTRAL, MAT.alfombra));
  return g;
}

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

var ALTO_BRAZO = 0.54; // un poco por encima del cojín (que llega a 0.52)

/* El panel de brazo se dibuja en un plano alto/profundidad y se gira
   90º para que el grosor quede en el eje x (izquierda/derecha) y el
   perfil en z/y (profundidad/altura), tal como se ve desde el pasillo. */
function geometriaBrazo(grosor){
  var g=new THREE.ExtrudeGeometry(perfilBrazo(0.20,0.30,ALTO_BRAZO,0.12),
    {depth:grosor, bevelEnabled:false, curveSegments:10});
  g.translate(0,0,-grosor/2);
  g.rotateY(Math.PI/2);
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

  var anchoMuro = P.jamba+1.0; // algo más ancho que la jamba, para que tape bien el lateral
  var forma=new THREE.Shape();
  forma.moveTo(-anchoMuro,0); forma.lineTo(anchoMuro,0); forma.lineTo(anchoMuro,P.altura);
  forma.lineTo(-anchoMuro,P.altura); forma.lineTo(-anchoMuro,0);
  var hueco=new THREE.Path();
  hueco.moveTo(perfil[0].x, perfil[0].y);
  for(var i=1;i<perfil.length;i++) hueco.lineTo(perfil[i].x, perfil[i].y);
  forma.holes.push(hueco);

  var muro=new THREE.Mesh(new THREE.ExtrudeGeometry(forma,{depth:0.7,bevelEnabled:false}), MAT.muro);
  muro.position.z=-0.35;
  g.add(muro);

  // Gran paño curvo de lacería sobre la boca, como el granate con rombos
  // de las fotografías. Las cintas de distinto avance generan relieve.
  g.add(cintaArcoRebajado(1.02,1.52,0.38,MAT.embocaduraGeo));
  [
    {dy:0.02,h:0.16,z:0.48,m:MAT.oro},
    {dy:0.28,h:0.18,z:0.51,m:MAT.embocaduraCrema},
    {dy:0.54,h:0.13,z:0.54,m:MAT.oro},
    {dy:1.78,h:0.16,z:0.50,m:MAT.oro}
  ].forEach(function(b){g.add(cintaArcoRebajado(b.dy,b.h,b.z,b.m));});

  // Pilastras monumentales: basamento, fuste panelado y capitel que
  // recibe las arquivoltas. Se separan del muro para leer su volumen.
  [-1,1].forEach(function(s){
    var x=s*(P.arcoA+0.78);
    var fuste=new THREE.Mesh(new THREE.BoxGeometry(1.34,7.55,0.52),MAT.embocaduraCrema);
    fuste.position.set(x,4.08,0.30); g.add(fuste);
    var panel=new THREE.Mesh(new THREE.BoxGeometry(0.86,5.85,0.07),MAT.mudejarFloral);
    panel.position.set(x,4.25,0.60); g.add(panel);
    var zocalo=new THREE.Mesh(new THREE.BoxGeometry(1.62,0.82,0.70),MAT.maderaPlatea);
    zocalo.position.set(x,0.41,0.27); g.add(zocalo);
    [
      {y:7.72,w:1.62,h:0.22,d:0.68},
      {y:7.98,w:1.88,h:0.30,d:0.76},
      {y:8.28,w:2.08,h:0.30,d:0.82}
    ].forEach(function(c){
      var cap=new THREE.Mesh(new THREE.BoxGeometry(c.w,c.h,c.d),MAT.embocaduraCrema);
      cap.position.set(x,c.y,0.30); g.add(cap);
    });
    // Arquivoltas verticales paralelas a cada jamba.
    [0.00,0.28,0.54].forEach(function(dx,j){
      var banda=new THREE.Mesh(new THREE.BoxGeometry(j===1?0.18:0.14,7.35,0.15),j===1?MAT.embocaduraCrema:MAT.oro);
      banda.position.set(s*(P.arcoA+dx),4.48,0.48+j*0.025); g.add(banda);
    });
  });
  // La embocadura acompaña al escenario retirado para que el arco de
  // herradura siga definiendo correctamente la nueva boca escénica.
  g.position.z=-RETIRO_ESCENARIO_Z;
  return g;
}

/* ---------------- ESCENARIO --------------------------------------- */

/* Perfil de una cortina con pliegues: una polilínea horizontal que
   ondula en profundidad (z), para dar volumen de tela real en vez de
   una caja plana. "pliegues" es el nº de ondas a lo largo del ancho. */
function perfilCortina(ancho, pliegues, profundidad, segPorPliegue){
  var n=Math.max(1,Math.round(pliegues*segPorPliegue)), pts=[], i;
  for(i=0;i<=n;i++){
    var t=i/n;
    pts.push({x:(t-0.5)*ancho, z:Math.sin(t*pliegues*Math.PI*2)*profundidad});
  }
  return pts;
}

/* Cortina de terciopelo: una cinta vertical (de yb a yt) que sigue un
   perfil con pliegues, con la textura de tela mapeada a lo largo de
   la propia tela (así los pliegues no la estiran ni la comprimen). */
function cortina(perfil, yb, yt, mat, repV){
  var g=new THREE.BufferGeometry(), pos=[], uv=[], idx=[], i, dist=0;
  for(i=0;i<perfil.length;i++){
    var p=perfil[i];
    if(i>0) dist += Math.hypot(p.x-perfil[i-1].x, p.z-perfil[i-1].z);
    pos.push(p.x,yb,p.z, p.x,yt,p.z);
    uv.push(dist*0.4,0, dist*0.4,repV);
  }
  for(i=0;i<perfil.length-1;i++){ var a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

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
  var suelo=new THREE.Mesh(new THREE.BoxGeometry(18,0.4,16), MAT.tablas);
  suelo.position.set(0,0.85,-8); g.add(suelo);
  var fondo=new THREE.Mesh(new THREE.PlaneGeometry(19,12), MAT.hueco);
  fondo.position.set(0,6,-15.9); g.add(fondo);

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
      var alf=new THREE.Mesh(new THREE.BoxGeometry(largo-0.018,0.026,e.ancho-0.08),MAT.alfombra);
      alf.position.set(signo*(x0+x1)/2,alto+0.013,(z0+z1)/2);
      alf.rotation.y=pel.rotation.y;
      g.add(alf);

      // La misma alfombra baja por la contrahuella. Se coloca apenas
      // adelantada para evitar z-fighting con la caja de madera.
      var altoPaso=e.altura/e.peldanos,ux=dx/largo,uz=dz/largo;
      var frente=new THREE.Mesh(new THREE.BoxGeometry(0.026,altoPaso-0.012,e.ancho-0.08),MAT.alfombra);
      frente.position.set(signo*x0-ux*0.013,alto-altoPaso/2,z0-uz*0.013);
      frente.rotation.y=pel.rotation.y;
      g.add(frente);
    }
  });
  return g;
}

/* Mampara de tres arcos en el desembarco de cada escalera lateral. La
   parte inferior es maciza, como en la referencia, y los tres vanos
   permiten ver la sala desde el pasillo de acceso al palco. */
function mamparasEscaleras(){
  var conjunto=new THREE.Group();
  // La mampara ocupa el tabique radial que cierra el palco 2: desde su
  // barandilla interior hasta el muro exterior, sobre la misma recta.
  var ancho=P.pisos[0].dentro, alto=4.38, base=1.62, margen=0.10, separacion=0.08;
  var anchoVano=(ancho-2*margen-2*separacion)/3, altoArranque=3.18, altoClave=4.02;

  var forma=new THREE.Shape();
  forma.moveTo(-ancho/2,0); forma.lineTo(ancho/2,0); forma.lineTo(ancho/2,alto);
  forma.lineTo(-ancho/2,alto); forma.closePath();

  for(var n=0;n<3;n++){
    var izquierda=-ancho/2+margen+n*(anchoVano+separacion), derecha=izquierda+anchoVano;
    var hueco=new THREE.Path();
    hueco.moveTo(izquierda,base);
    hueco.lineTo(izquierda,altoArranque);
    hueco.quadraticCurveTo((izquierda+derecha)/2,2*altoClave-altoArranque,derecha,altoArranque);
    hueco.lineTo(derecha,base); hueco.closePath();
    forma.holes.push(hueco);
  }

  // El espesor atraviesa el borde del palco por ambos lados: el eje se
  // mantiene en la junta exacta y el solape no abre un pasillo paralelo.
  var fondoMampara=0.16;
  var geoPantalla=new THREE.ExtrudeGeometry(forma,{depth:fondoMampara,bevelEnabled:true,bevelThickness:0.018,bevelSize:0.018,bevelSegments:1});
  geoPantalla.translate(0,0,-fondoMampara/2);

  var bordePlatea=geo.dentro(geo.PLAN,P.pisos[0].dentro);
  // La mampara pertenece al borde del palco que mira a la escalera:
  // es iAlaD, la primera arista del ala, no el límite entre el palco 2
  // y el palco siguiente (que la dejaría en medio de dos arcos).
  var iAlaD=-1;
  for(var ip=0;ip<geo.PLAN.length;ip++){
    if(iAlaD<0 && geo.PLAN[ip].z>=Z_CORREDOR_FIN) iAlaD=ip;
  }
  [-1,1].forEach(function(signo){
    var grupo=new THREE.Group();
    grupo.add(new THREE.Mesh(geoPantalla,MAT.mudejarGeometrico));
    var cara=fondoMampara/2;

    // Moldura de cada vano: jambas finas y arco superior dentado.
    for(var n=0;n<3;n++){
      var izquierda=-ancho/2+margen+n*(anchoVano+separacion), derecha=izquierda+anchoVano;
      var centro=(izquierda+derecha)/2;
      [izquierda,derecha].forEach(function(xj){
        var jamba=new THREE.Mesh(new THREE.BoxGeometry(0.045,altoArranque-base,0.16),MAT.mudejarArcos);
        jamba.position.set(xj,(base+altoArranque)/2,cara+0.025); grupo.add(jamba);
      });
      var curva=new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(izquierda,altoArranque,cara+0.025),
        new THREE.Vector3(centro,2*altoClave-altoArranque,cara+0.025),
        new THREE.Vector3(derecha,altoArranque,cara+0.025)
      );
      grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,14,0.045,6,false),MAT.mudejarArcos));
      var panelBajo=new THREE.Mesh(new THREE.BoxGeometry(anchoVano-0.07,base-0.16,0.035),MAT.maderaBlanca);
      panelBajo.position.set(centro,base/2,cara+0.035); grupo.add(panelBajo);
      var rombo=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.22,0.028),MAT.oro);
      rombo.position.set(centro,base/2,cara+0.065); rombo.rotation.z=Math.PI/4; grupo.add(rombo);
    }

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

/* Suelo de la nueva franja entre la embocadura y el escenario retirado.
   Continúa a nivel del patio y queda libre de butacas para organización
   y fotografía. */
function sueloFoso(){
  var foso=new THREE.Mesh(new THREE.BoxGeometry(18,0.08,RETIRO_ESCENARIO_Z), MAT.suelo);
  foso.position.set(0,0.04,-RETIRO_ESCENARIO_Z/2);
  return foso;
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
function posteYesoEnIndice(escena, borde, plan, i, yBase, alto){
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
  var div=new THREE.Mesh(geometriaDiv, MAT.maderaBlanca);
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

/* Balaustre plano inspirado en las vallas caladas tradicionales: cuello
   estrecho, cuerpo romboidal y pequeños ensanchamientos en los extremos.
   Se extruye muy poco para conservar el aspecto de pieza recortada. */
function geometriaBalaustreOrnamental(alto){
  var h=alto, niveles=[0,0.08,0.16,0.42,0.50,0.58,0.84,0.92,1];
  var anchos=[0.05,0.07,0.035,0.09,0.115,0.09,0.035,0.07,0.05];
  var s=new THREE.Shape(), i;
  s.moveTo(-anchos[0],niveles[0]*h);
  for(i=1;i<niveles.length;i++) s.lineTo(-anchos[i],niveles[i]*h);
  for(i=niveles.length-1;i>=0;i--) s.lineTo(anchos[i],niveles[i]*h);
  s.closePath();
  // Pequeño calado ovalado en el corazón de cada pieza, centrado en su
  // zona más ancha y con margen suficiente de madera a ambos lados.
  var hueco=new THREE.Path();
  hueco.absellipse(0,h*0.50,0.038,h*0.105,0,Math.PI*2,true);
  s.holes.push(hueco);
  var g=new THREE.ExtrudeGeometry(s,{
    depth:0.055, bevelEnabled:true, bevelThickness:0.008,
    bevelSize:0.008, bevelSegments:1
  });
  g.translate(0,0,-0.0275);
  return g;
}

/* Barandilla ornamentada de los palcos de platea: zócalo bajo + una fila
   de balaustres dorados + pasamanos, en vez del antepecho macizo de
   terciopelo de los pisos de arriba — así se nota que el palco está
   sobre una peana y no es una simple continuación del muro. Cubre todo
   el anillo (también el tramo central sin tabicar). */
function barandillaPalco(escena, borde, yBase, alto){
  escena.add(cinta(borde, yBase, function(p){return yBase(p)+0.12;}, MAT.antepecho));       // zócalo
  escena.add(cinta(borde, function(p){return yBase(p)+alto-0.025;}, function(p){return yBase(p)+alto;}, MAT.terciopelo2)); // pasamanos fino tapizado
  var altoBal=Math.max(0.30,alto-0.17), geoBal=geometriaBalaustreOrnamental(altoBal);
  var separacion=0.34, transforms=[];
  for(var i=0;i<borde.length-1;i++){
    var a=borde[i], b=borde[i+1], dx=b.x-a.x, dz=b.z-a.z;
    var largo=Math.hypot(dx,dz), cantidad=Math.max(1,Math.round(largo/separacion));
    for(var j=0;j<cantidad;j++){
      var t=(j+0.5)/cantidad, x=a.x+dx*t, z=a.z+dz*t;
      var punto={x:x,z:z};
      transforms.push({x:x,y:yBase(punto)+0.13,z:z,rotY:-Math.atan2(dz,dx)});
    }
  }
  var instancias=new THREE.InstancedMesh(geoBal,MAT.barnizClaro,transforms.length);
  var matriz=new THREE.Matrix4(), quat=new THREE.Quaternion(), ejeY=new THREE.Vector3(0,1,0);
  var escala=new THREE.Vector3(1,1,1), posicion=new THREE.Vector3();
  transforms.forEach(function(t,n){
    posicion.set(t.x,t.y,t.z); quat.setFromAxisAngle(ejeY,t.rotY);
    matriz.compose(posicion,quat,escala); instancias.setMatrixAt(n,matriz);
  });
  instancias.instanceMatrix.needsUpdate=true;
  escena.add(instancias);
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

/* Cortina lateral recogida: paño ancho arriba, ceñido en el centro por
   el alzapaño y ligeramente abierto de nuevo en su caída inferior. */
function geometriaCortinaPalco(ancho,alto,lado){
  var s=new THREE.Shape(), xExt=lado*ancho/2, xInt=lado*ancho*0.13;
  s.moveTo(xExt,alto*0.12);
  s.lineTo(lado*ancho*0.36,alto*0.12);
  s.lineTo(lado*ancho*0.31,alto*0.46);
  s.lineTo(xInt,alto*0.94);
  s.lineTo(xExt,alto*0.94);
  s.lineTo(lado*ancho*0.42,alto*0.48);
  s.closePath();
  var g=new THREE.ExtrudeGeometry(s,{depth:0.045,bevelEnabled:true,bevelThickness:0.012,bevelSize:0.012,bevelSegments:1});
  g.translate(0,0,-0.0225);
  return g;
}

/* Columna compartida entre dos arcos: llega hasta el forjado, mientras
   que su capitel escalonado marca el arranque del arco a media altura. */
function columnaMudejar(alto,arranque){
  var g=new THREE.Group(), niveles=[0,0.11,0.18,arranque-0.15,arranque-0.10,arranque+0.13,arranque+0.18,alto-0.08,alto];
  var anchos=[0.115,0.115,0.075,0.075,0.175,0.175,0.075,0.125,0.125];
  var perfil=new THREE.Shape(), i;
  perfil.moveTo(-anchos[0],niveles[0]);
  for(i=1;i<niveles.length;i++) perfil.lineTo(-anchos[i],niveles[i]);
  for(i=niveles.length-1;i>=0;i--) perfil.lineTo(anchos[i],niveles[i]);
  perfil.closePath();
  var geoCol=new THREE.ExtrudeGeometry(perfil,{depth:0.16,bevelEnabled:true,bevelThickness:0.01,bevelSize:0.01,bevelSegments:1});
  geoCol.translate(0,0,-0.08);
  g.add(new THREE.Mesh(geoCol,MAT.mudejarFloral));
  // Pequeño rombo dorado en el frente del capitel intermedio.
  var rombo=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.075,0.018),MAT.oro);
  rombo.position.set(0,arranque+0.055,0.145); rombo.rotation.z=Math.PI/4; g.add(rombo);
  return g;
}

/* Portadas del fondo de los palcos de platea: una por celda, detrás de
   la última fila de sillas. Combinan jambas, arco de doble moldura y dos
   cortinas de terciopelo recogidas, siguiendo la orientación local de
   la herradura. */
function portadasPalcosPlatea(escena,borde,plan,ini,fin,nCeldas,yBase){
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
    var altoTecho=P.pisos[1].y-y0-0.02, altoTotal=altoTecho-0.32;
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
    var geoDiente=new THREE.ConeGeometry(0.060,0.14,3);
    var dientes=new THREE.InstancedMesh(geoDiente,MAT.mudejarArcos,cantidadDientes);
    var matrizD=new THREE.Matrix4(), quatD=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
    var escalaD=new THREE.Vector3(1,1,1), posD=new THREE.Vector3(), nd=0;
    for(var di=2;di<ptsArco.length-2;di+=2){
      posD.set(ptsArco[di].x,ptsArco[di].y-0.105,0.015);
      matrizD.compose(posD,quatD,escalaD); dientes.setMatrixAt(nd++,matrizD);
    }
    dientes.instanceMatrix.needsUpdate=true; grupo.add(dientes);
    // Detalle geométrico repetido en el paño superior.
    var geoAdorno=new THREE.BoxGeometry(0.075,0.075,0.022);
    var adornos=new THREE.InstancedMesh(geoAdorno,MAT.oro,5);
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
    var yCol=yBase(qk), altoCol=P.pisos[1].y-yCol-0.02;
    var col=columnaMudejar(altoCol,1.22);
    col.position.set(qk.x-(ddx/dl)*0.16,yCol,qk.z-(ddz/dl)*0.16);
    col.rotation.y=-Math.atan2(next.z-prev.z,next.x-prev.x);
    escena.add(col);
  }
}

/* Puertas reales de los antepalcos: cada hoja conserva su propia bisagra
   y estado para poder abrirse desde el modo paseo. */
var puertasPalco=[];
function puertaCercana(x,z,dist){
  var mejor=null,dMejor=dist===undefined?1.65:dist;
  puertasPalco.forEach(function(p){
    var d=Math.hypot(x-p.x,z-p.z);
    if(d<dMejor){dMejor=d;mejor=p;}
  });
  return mejor;
}
function alternarPuertaCercana(x,z){
  var p=puertaCercana(x,z,1.75);
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
function puertaBloquea(x,z){
  for(var i=0;i<puertasPalco.length;i++){
    var p=puertasPalco[i];
    if(p.apertura>0.65)continue;
    var dx=x-p.x,dz=z-p.z;
    var lateral=Math.abs(dx*p.tx+dz*p.tz);
    var normal=Math.abs(dx*(-p.tz)+dz*p.tx);
    if(lateral<0.52 && normal<0.24)return true;
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
function antepalcosPlatea(escena,plan,ini,fin,nCeldas,yBase){
  var exterior=geo.dentro(plan,-2.0), tramoPlan=plan.slice(ini,fin+1), tramoExt=exterior.slice(ini,fin+1);
  escena.add(banda(tramoPlan,tramoExt,yBase,yBase,MAT.parquetPlatea));
  escena.add(cinta(tramoExt,function(p){return yBase(p)+2.12;},P.pisos[1].y,MAT.muro));

  var idx=indicesPorLongitud(plan,ini,fin,nCeldas), k;
  // Tabiques laterales que prolongan cada separación hasta el nuevo muro.
  for(k=0;k<idx.length;k++){
    var ic=idx[k];
    escena.add(cinta([plan[ic],exterior[ic]],yBase,P.pisos[1].y,MAT.maderaPlatea));
  }

  // Marcos instanciados; las hojas son individuales porque rotan sobre
  // bisagras y deben poder abrirse por separado.
  var matsPuerta=[MAT.maderaButaca,MAT.maderaButaca,MAT.maderaButaca,
                  MAT.maderaButaca,MAT.puertaPalco,MAT.maderaButaca];
  var marcos=new THREE.InstancedMesh(new THREE.BoxGeometry(0.09,2.05,0.11),MAT.mudejarFloral,nCeldas*2);
  var dinteles=new THREE.InstancedMesh(new THREE.BoxGeometry(1.01,0.12,0.12),MAT.mudejarArcos,nCeldas);
  var hojaGeo=new THREE.BoxGeometry(0.82,1.92,0.07);
  var matriz=new THREE.Matrix4(), quat=new THREE.Quaternion(), ejeY=new THREE.Vector3(0,1,0);
  var escala=new THREE.Vector3(1,1,1), pos=new THREE.Vector3(), nMarco=0;
  for(k=0;k<nCeldas;k++){
    var i=Math.round((idx[k]+idx[k+1])/2), q=exterior[i];
    var a=exterior[Math.max(ini,i-1)], b=exterior[Math.min(fin,i+1)];
    var angulo=-Math.atan2(b.z-a.z,b.x-a.x), cs=Math.cos(angulo), sn=Math.sin(angulo);
    quat.setFromAxisAngle(ejeY,angulo);
    var pivote=new THREE.Group();
    pivote.position.set(q.x-cs*0.41,yBase(q),q.z+sn*0.41);
    pivote.rotation.y=angulo;
    var hoja=new THREE.Mesh(hojaGeo,matsPuerta);
    hoja.position.set(0.41,0.96,0); pivote.add(hoja); escena.add(pivote);
    puertasPalco.push({pivote:pivote,x:q.x,z:q.z,tx:cs,tz:-sn,angulo:angulo,
      sentido:signoPuerta(q),apertura:0,objetivo:0});

    // Paños macizos a ambos lados del hueco de puerta.
    var qa=exterior[idx[k]],qb=exterior[idx[k+1]],lCelda=Math.hypot(qb.x-qa.x,qb.z-qa.z);
    var ladoAncho=Math.max(0.05,(lCelda-1.02)/2);
    [-1,1].forEach(function(lado){
      var paño=new THREE.Mesh(new THREE.BoxGeometry(ladoAncho,2.12,0.12),MAT.muro);
      var localX=lado*(0.51+ladoAncho/2);
      paño.position.set(q.x+cs*localX,yBase(q)+1.06,q.z-sn*localX);
      paño.rotation.y=angulo; escena.add(paño);
    });
    [-1,1].forEach(function(lado){
      var lx=lado*0.46,lz=0.015;
      pos.set(q.x+cs*lx+sn*lz,yBase(q)+1.025,q.z-sn*lx+cs*lz);
      matriz.compose(pos,quat,escala); marcos.setMatrixAt(nMarco++,matriz);
    });
    pos.set(q.x+sn*0.015,yBase(q)+2.04,q.z+cs*0.015);
    matriz.compose(pos,quat,escala); dinteles.setMatrixAt(k,matriz);
  }
  marcos.instanceMatrix.needsUpdate=true; dinteles.instanceMatrix.needsUpdate=true;
  escena.add(marcos); escena.add(dinteles);
}

function signoPuerta(q){return q.x>=0?1:-1;}

/* Corredor común de tres metros detrás de los antepalcos, continuo
   alrededor de la herradura y a la misma cota que la platea. */
function pasilloCurvoPalcos(escena,plan,ini,fin,yBase){
  var interior=geo.dentro(plan,-2.0).slice(ini,fin+1);
  var exterior=geo.dentro(plan,-5.0).slice(ini,fin+1);
  escena.add(banda(interior,exterior,yBase,yBase,MAT.parquetPlatea));
  escena.add(cinta(exterior,yBase,P.pisos[1].y,MAT.muro));
}

/* ---------------- MONTAJE ----------------------------------------- */
function construir(escena){
  escena.background=new THREE.Color(0x0d0608);
  escena.fog=new THREE.Fog(0x0d0608, 34, 78);

  // Patio de butacas (suelo en pendiente, con parquet) y muro perimetral.
  escena.add(superficie(geo.PLAN, geo.rake, MAT.parquet, true));
  // El muro original se abre a la altura de la platea para comunicar
  // cada palco con su antepalco posterior. Conserva un zócalo bajo el
  // suelo y continúa normalmente por encima del piso principal.
  escena.add(cinta(geo.PLAN, function(p){return geo.rake(p.z);}, function(p){
    return p.z>=Z_CORREDOR_FIN ? geo.platea.altura : P.altura;
  }, MAT.muro));
  escena.add(cinta(geo.PLAN, function(p){
    return p.z>=Z_CORREDOR_FIN ? P.pisos[1].y : P.altura;
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
    var borde = geo.dentro(geo.PLAN, piso.dentro);
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
      var umbral=(CENTRO_MEDIO+LATERAL_DENTRO)/2, corteD=-1;
      for(ci=0; ci<geo.PLAN.length; ci++){ if(geo.PLAN[ci].x<=umbral){ corteD=ci; break; } }
      var corteI=(geo.PLAN.length-1)-corteD;

      if(!sillaPalcoGeo) sillaPalcoGeo = construirSillaPalco();
      var yFrontal=function(){return ALTURA_FRONTAL;};

      // Palco Frontal: un cajón recto empotrado junto al arco de boca,
      // del arco (z=0) al pasillo transversal (Z_CORREDOR_INI), mirando
      // de canto hacia el centro de la sala — así los dos, en paralelo,
      // quedan enfrentados el uno al otro a través del escenario, en vez
      // de escorados como el resto del ala. El punto intermedio (z/2) no
      // cambia la recta, pero le da a sillasPalco() un índice real en el
      // que centrar el grupo de sillas. limitesFrontal() aparta el fondo
      // del muro real (ver su comentario: un fondo fijo al ancho de la
      // jamba quedaría oculto detrás del muro).
      var limFrontal=limitesFrontal();
      [-1,1].forEach(function(signo){
        var zInicio=-RETIRO_ESCENARIO_Z, zMed=(zInicio+Z_CORREDOR_INI)/2;
        var xFondo=signo*(limFrontal.xFondo+DESPLAZAMIENTO_FRONTAL_X), xFrente=signo*(limFrontal.xFrente+DESPLAZAMIENTO_FRONTAL_X);
        var bF=[{x:xFrente,z:zInicio},{x:xFrente,z:zMed},{x:xFrente,z:Z_CORREDOR_INI}];
        var plF=[{x:xFondo,z:zInicio},{x:xFondo,z:zMed},{x:xFondo,z:Z_CORREDOR_INI}];
        // Base cerrada del palco frontal: frente, trasera y testeros bajan
        // hasta el suelo para que la pieza no parezca suspendida.
        escena.add(cinta(bF, function(p){return geo.rake(p.z);}, yFrontal, MAT.maderaPlatea));
        escena.add(cinta(plF, function(p){return geo.rake(p.z);}, yFrontal, MAT.maderaPlatea));
        escena.add(cinta([bF[0],plF[0]], function(p){return geo.rake(p.z);}, yFrontal, MAT.maderaPlatea));
        escena.add(cinta([bF[bF.length-1],plF[plF.length-1]], function(p){return geo.rake(p.z);}, yFrontal, MAT.maderaPlatea));
        barandillaPalco(escena, bF, yFrontal, ALTURA_BARANDILLA_PLATEA);
        escena.add(banda(bF, plF, function(){return ALTURA_FRONTAL+piso.alto;}, function(){return ALTURA_FRONTAL+piso.alto;}, MAT.hueco));
        escena.add(banda(bF, plF, yFrontal, yFrontal, MAT.suelo));
        escena.add(cinta(bF, function(){return ALTURA_FRONTAL+ALTURA_BARANDILLA_PLATEA;}, function(){return ALTURA_FRONTAL+ALTURA_BARANDILLA_PLATEA+0.035;}, MAT.terciopelo2));
        sillasPalco(escena, bF, plF, 0, 2, 1, yFrontal, sillaPalcoGeo);
        // Tabique que cierra el Frontal hacia el pasillo transversal.
        var cierre=new THREE.Mesh(new THREE.BoxGeometry(ANCHO_FRONTAL, piso.alto+1.5, 0.16), MAT.yeso);
        cierre.position.set((xFondo+xFrente)/2, ALTURA_FRONTAL+(piso.alto+1.5)/2, Z_CORREDOR_INI);
        escena.add(cierre);
      });

      // El ala en sí (peana+barandilla+suelo+moldura continuos, y dentro,
      // los 9 palcos tabicados con sus sillas), de iAla a corte y de
      // corte a iAla especular — así el Antepalco (de iArco a iAla) y el
      // hueco central (de corteD a corteI) quedan sin construir.
      var bAla=borde.slice(iAlaD,iAlaI+1), plAla=geo.PLAN.slice(iAlaD,iAlaI+1);
      // Muro portante continuo bajo el frente de la platea: cierra el
      // desnivel entre el suelo inclinado del patio y la cota horizontal
      // de los palcos, evitando que estos parezcan suspendidos.
      escena.add(cinta(bAla, function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      // Moldura cilíndrica en la junta entre el muro portante y la valla.
      // Sigue toda la herradura y oculta el encuentro entre ambos planos.
      var curvaRemate=new THREE.CatmullRomCurve3(bAla.map(function(p){
        return new THREE.Vector3(p.x,ALTURA_PLATEA+0.07,p.z);
      }));
      // El diámetro cubre por completo los 12 cm del zócalo rojo situado
      // detrás, evitando que asome o produzca parpadeo por solapamiento.
      var geoRemate=new THREE.TubeGeometry(curvaRemate,Math.max(48,bAla.length*2),0.075,10,false);
      escena.add(new THREE.Mesh(geoRemate,MAT.barnizClaro));
      barandillaPalco(escena, bAla, yPiso, ALTURA_BARANDILLA_PLATEA);
      // Trasdós: misma forma que la herradura pero más retranqueado (más
      // cerca del muro real), para que el ala tenga volumen real y no
      // sea una peana de espesor cero. De momento sin textura.
      var trasdos = geo.dentro(geo.PLAN, piso.dentro*0.35).slice(iAlaD,iAlaI+1);
      escena.add(cinta(trasdos, function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      escena.add(cinta([bAla[0],trasdos[0]], function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      escena.add(cinta([bAla[bAla.length-1],trasdos[trasdos.length-1]], function(p){return geo.rake(p.z);}, yPiso, MAT.maderaPlatea));
      escena.add(banda(bAla, plAla, yPiso, yPiso, MAT.parquetPlatea));
      escena.add(cinta(bAla, function(){return ALTURA_PLATEA+ALTURA_BARANDILLA_PLATEA;}, function(){return ALTURA_PLATEA+ALTURA_BARANDILLA_PLATEA+0.035;}, MAT.terciopelo2));

      separadoresPalco(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso, piso.alto);
      separadoresPalco(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso, piso.alto);
      sillasPalco(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso, sillaPalcoGeo);
      sillasPalco(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso, sillaPalcoGeo);
      portadasPalcosPlatea(escena, borde, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso);
      portadasPalcosPlatea(escena, borde, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso);
      antepalcosPlatea(escena, geo.PLAN, iAlaD, corteD, piso.palcosLado, yPiso);
      antepalcosPlatea(escena, geo.PLAN, corteI, iAlaI, piso.palcosLado, yPiso);
      pasilloCurvoPalcos(escena,geo.PLAN,iAlaD,iAlaI,yPiso);
    } else {
      escena.add(cinta(borde, yPiso, yTop, MAT.antepecho));                 // antepecho
      escena.add(banda(borde, geo.PLAN, yTop, yTop, MAT.hueco));            // hueco del palco
      escena.add(banda(borde, geo.PLAN, yPiso, yPiso, MAT.suelo));          // suelo del palco
      escena.add(cinta(borde, yTop, function(p){return yTop(p)+0.14;}, MAT.oro)); // moldura
      if(piso.palcos) separadoresPalco(escena, borde, geo.PLAN, 0, borde.length-1, piso.palcos, piso.y, piso.alto);
    }
  });

  escena.add(butacas());
  escena.add(pasillosPatio());
  escena.add(embocadura());
  escena.add(sueloFoso());
  escena.add(escalerasLaterales());
  escena.add(mamparasEscaleras());
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
    focoFrontal.position.set(signo*((limFrontalLuz.xFondo+limFrontalLuz.xFrente)/2+DESPLAZAMIENTO_FRONTAL_X), 2.6, (Z_CORREDOR_INI-RETIRO_ESCENARIO_Z)/2);
    escena.add(focoFrontal);
  });

  return {nButacas:nButacas, nFilas:nFilas};
}

FALLA.escena = { construir: construir };
})();
