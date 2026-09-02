(function(){
'use strict';
var FALLA = window.FALLA;
var geo = FALLA.geo, P = geo.P, MAT = FALLA.materiales.MAT, registrar = FALLA.materiales.registrar;

/* Cinta vertical siguiendo una polilínea. */
function cinta(pts, yb, yt, mat){
  var g=new THREE.BufferGeometry(), pos=[], idx=[], i;
  for(i=0;i<pts.length;i++){
    var p=pts[i];
    var b=(typeof yb==='function')?yb(p):yb, t=(typeof yt==='function')?yt(p):yt;
    pos.push(p.x,b,p.z, p.x,t,p.z);
  }
  for(i=0;i<pts.length-1;i++){
    var a=i*2;
    idx.push(a,a+1,a+2, a+1,a+3,a+2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}

/* Banda horizontal entre dos polilíneas (suelos de palco, cornisas). */
function banda(pA, pB, yA, yB, mat){
  var g=new THREE.BufferGeometry(), pos=[], idx=[], i;
  for(i=0;i<pA.length;i++){
    var a=pA[i], b=pB[i];
    pos.push(a.x,(typeof yA==='function')?yA(a):yA,a.z, b.x,(typeof yB==='function')?yB(b):yB,b.z);
  }
  for(i=0;i<pA.length-1;i++){
    var o=i*2;
    idx.push(o,o+1,o+2, o+1,o+3,o+2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
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
    var y = geo.rake(p.z)+0.04; // ligeramente por encima del suelo, evita z-fighting a distancia
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
   hacia el muro varía fila a fila y es lo que deja el pasillo lateral. */
function sitiosLateral(signo){
  var out=[];
  for(var i=0;i<FILAS_LATERAL;i++){
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
  if(i < FILAS_LATERAL){
    var ancho = ASIENTOS_LATERAL[i]*ASIENTO_PASO;
    if(Math.abs(x) >= LATERAL_DENTRO && Math.abs(x) < LATERAL_DENTRO+ancho){
      return geo.distAPlanta(x,z) >= PASILLO_LATERAL; // coincide con la salvaguarda de sitiosLateral()
    }
  }
  return false;
}
geo.enBloqueAsientos = enBloqueAsientos;

/* Las alfombras solo cubren los dos pasillos centrales (los que más se
   recorren); los laterales, junto a los muros, se quedan en parquet. */
function pasillosPatio(){
  var g=new THREE.Group();
  var zIni=Z_FILA1-0.6, zFin=zFila(FILAS_CENTRO-1)+0.6;
  var cx = (CENTRO_MEDIO+LATERAL_DENTRO)/2;
  [-1,1].forEach(function(signo){
    var pts=[{x:signo*cx, z:zIni}, {x:signo*cx, z:zFin}];
    g.add(alfombra(pts, PASILLO_CENTRAL, MAT.alfombra));
  });
  return g;
}

function butacas(){
  var sitios = sitiosCentro().concat(sitiosLateral(-1), sitiosLateral(1));
  nButacas = sitios.length;
  nFilas = FILAS_CENTRO;

  var piezas = [
    {g:new THREE.BoxGeometry(0.46,0.52,0.09), t:[0,0.76,0.20], m:MAT.terciopelo},
    {g:new THREE.BoxGeometry(0.46,0.10,0.42), t:[0,0.47,0.00], m:MAT.terciopelo},
    {g:new THREE.BoxGeometry(0.58,0.06,0.40), t:[0,0.55,0.00], m:MAT.madera},
    {g:new THREE.BoxGeometry(0.13,0.44,0.13), t:[0,0.23,0.02], m:MAT.madera}
  ];
  var grupo=new THREE.Group(), m4=new THREE.Matrix4(), q=new THREE.Quaternion(),
      pos3=new THREE.Vector3(), esc=new THREE.Vector3(1,1,1);

  piezas.forEach(function(p){
    p.g.translate(p.t[0],p.t[1],p.t[2]);
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

/* ---------------- EMBOCADURA (arco de herradura) ------------------ */
function perfilArco(){
  var pts=[], t0=Math.atan2(-Math.sqrt(P.arcoR*P.arcoR-P.arcoA*P.arcoA), P.arcoA), i, t;
  var yS = P.arcoYc + P.arcoR*Math.sin(t0);
  pts.push(new THREE.Vector2(P.arcoA, 0));
  pts.push(new THREE.Vector2(P.arcoA, yS));
  for(i=0;i<=48;i++){
    t = t0 + (Math.PI - 2*t0)*i/48;
    pts.push(new THREE.Vector2(P.arcoR*Math.cos(t), P.arcoYc+P.arcoR*Math.sin(t)));
  }
  pts.push(new THREE.Vector2(-P.arcoA, yS));
  pts.push(new THREE.Vector2(-P.arcoA, 0));
  return pts;
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

  // Moldura dorada rodeando el arco: dos polilíneas paralelas.
  var A=[],B=[],c=new THREE.Vector2(0,P.arcoYc);
  for(i=0;i<perfil.length;i++){
    var p=perfil[i], d=new THREE.Vector2(p.x-c.x,p.y-c.y);
    if(d.length()<0.001) d.set(1,0);
    d.normalize();
    A.push({x:p.x, z:0.36, y:p.y});
    B.push({x:p.x+d.x*0.42, z:0.36, y:p.y+d.y*0.42});
  }
  var geom=new THREE.BufferGeometry(), pos=[], idx=[];
  for(i=0;i<A.length;i++){ pos.push(A[i].x,A[i].y,A[i].z, B[i].x,B[i].y,B[i].z); }
  for(i=0;i<A.length-1;i++){ var o=i*2; idx.push(o,o+1,o+2, o+1,o+3,o+2); }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geom.setIndex(idx); geom.computeVertexNormals();
  g.add(new THREE.Mesh(geom, MAT.oro));
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

/* ---------------- MONTAJE ----------------------------------------- */
function construir(escena){
  escena.background=new THREE.Color(0x0d0608);
  escena.fog=new THREE.Fog(0x0d0608, 34, 78);

  // Patio de butacas (suelo en pendiente, con parquet) y muro perimetral.
  escena.add(superficie(geo.PLAN, geo.rake, MAT.parquet, true));
  escena.add(cinta(geo.PLAN, function(p){return geo.rake(p.z);}, P.altura, MAT.muro));

  // Los cuatro niveles de la herradura.
  P.pisos.forEach(function(piso, n){
    var borde = geo.dentro(geo.PLAN, piso.dentro);
    var yPiso = (n===0) ? function(p){return geo.rake(p.z);} : piso.y;
    var yTop  = (n===0) ? function(p){return geo.rake(p.z)+piso.alto;} : piso.y+piso.alto;

    escena.add(cinta(borde, yPiso, yTop, MAT.antepecho));                 // antepecho
    escena.add(banda(borde, geo.PLAN, yTop, yTop, MAT.hueco));            // hueco del palco
    escena.add(banda(borde, geo.PLAN, yPiso, yPiso, MAT.suelo));          // suelo del palco
    escena.add(cinta(borde,
      (n===0)?function(p){return geo.rake(p.z)+piso.alto;}:piso.y+piso.alto,
      (n===0)?function(p){return geo.rake(p.z)+piso.alto+0.14;}:piso.y+piso.alto+0.14,
      MAT.oro));                                                          // moldura

    if(piso.palcos){                                                      // separadores
      var paso=Math.floor(borde.length/piso.palcos);
      for(var i=paso;i<borde.length-1;i+=paso){
        var p=borde[i], q=geo.PLAN[i];
        var div=new THREE.Mesh(new THREE.BoxGeometry(0.16, piso.alto+1.5, 1.5), MAT.yeso);
        div.position.set((p.x*0.75+q.x*0.25),(piso.y+(piso.alto+1.5)/2),(p.z*0.75+q.z*0.25));
        div.rotation.y=Math.atan2(q.x-p.x, q.z-p.z);
        escena.add(div);
      }
    }
  });

  escena.add(butacas());
  escena.add(pasillosPatio());
  escena.add(embocadura());
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

  return {nButacas:nButacas, nFilas:nFilas};
}

FALLA.escena = { construir: construir };
})();
