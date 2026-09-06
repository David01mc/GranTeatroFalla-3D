/* ------------------------------------------------------------------
   ORNAMENTO MUDÉJAR
   Las piezas decorativas que se repiten por toda la sala: balaustre,
   mampara de arcos, columna y cortina. Dependen de los materiales
   compartidos, pero no de la planta ni del montaje de la escena.
-------------------------------------------------------------------*/
(function(){
'use strict';
window.FALLA = window.FALLA || {};
var FALLA = window.FALLA;
var MAT = FALLA.materiales.MAT;

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

/* Espesor de las mamparas. Único mando: lo usan tanto la extrusión de la
   pantalla y el fondo de sus jambas como el retranqueo de media pieza con
   el que se apoyan contra el borde de la alfombra, así que tocarlo aquí
   los mantiene cuadrados entre sí. */
var FONDO_MAMPARA = 0.09;

/* Mampara de arcos: parte inferior maciza, como en la referencia, y los
   vanos que se pidan, por los que se ve la sala. Se arma a la medida
   —el alto libre no es el mismo en el desembarco de las escaleras que
   bajo el forjado del piso principal—, centrada en el origen y de cara a
   +Z, lista para girarla sobre su radial. Las proporciones de arranque,
   clave y zócalo son las de la mampara original de 4.38 m. */
function construirMamparaArcos(ancho,alto,nVanos){
  var grupo=new THREE.Group();
  var base=alto*0.370, altoArranque=alto*0.726, altoClave=alto*0.918;
  var margen=0.10, separacion=0.08;
  nVanos=nVanos||3;
  var anchoVano=(ancho-2*margen-(nVanos-1)*separacion)/nVanos, n, izquierda, derecha;

  var forma=new THREE.Shape();
  forma.moveTo(-ancho/2,0); forma.lineTo(ancho/2,0); forma.lineTo(ancho/2,alto);
  forma.lineTo(-ancho/2,alto); forma.closePath();

  for(n=0;n<nVanos;n++){
    izquierda=-ancho/2+margen+n*(anchoVano+separacion); derecha=izquierda+anchoVano;
    var hueco=new THREE.Path();
    hueco.moveTo(izquierda,base);
    hueco.lineTo(izquierda,altoArranque);
    hueco.quadraticCurveTo((izquierda+derecha)/2,2*altoClave-altoArranque,derecha,altoArranque);
    hueco.lineTo(derecha,base); hueco.closePath();
    forma.holes.push(hueco);
  }

  // El espesor atraviesa el borde del palco por ambos lados: el eje se
  // mantiene en la junta exacta y el solape no abre un pasillo paralelo.
  var fondoMampara=FONDO_MAMPARA;
  var geoPantalla=new THREE.ExtrudeGeometry(forma,{depth:fondoMampara,bevelEnabled:true,bevelThickness:0.010,bevelSize:0.010,bevelSegments:1});
  geoPantalla.translate(0,0,-fondoMampara/2);
  grupo.add(new THREE.Mesh(geoPantalla,MAT.mudejarGeometrico));

  // Moldura de cada vano: jambas finas y arco superior dentado. Va en las
  // dos caras, porque la mampara se ve por igual desde el palco y desde la
  // alfombra: ornamentar sólo una dejaba el reverso liso mirase por donde
  // mirase, que es justo lo que no puede pasar en una pieza exenta.
  // Todos los vanos de una mampara miden lo mismo, así que las cuatro
  // piezas comparten geometría y sólo cambia su posición: se instancian en
  // una malla por tipo en vez de una malla por pieza y cara. El arco se
  // construye centrado en el origen para poder trasladarlo como los demás.
  var cara=fondoMampara/2, jambas=[], arcos=[], paneles=[], rombos=[];
  for(n=0;n<nVanos;n++){
    izquierda=-ancho/2+margen+n*(anchoVano+separacion); derecha=izquierda+anchoVano;
    var centro=(izquierda+derecha)/2;
    [1,-1].forEach(function(lado){
      jambas.push({x:izquierda,y:(base+altoArranque)/2,z:lado*(cara+0.025)});
      jambas.push({x:derecha,  y:(base+altoArranque)/2,z:lado*(cara+0.025)});
      arcos.push({x:centro,y:0,z:lado*(cara+0.025)});
      paneles.push({x:centro,y:base/2,z:lado*(cara+0.035)});
      rombos.push({x:centro,y:base/2,z:lado*(cara+0.065)});
    });
  }

  var curvaArco=new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-anchoVano/2,altoArranque,0),
    new THREE.Vector3(0,2*altoClave-altoArranque,0),
    new THREE.Vector3(anchoVano/2,altoArranque,0)
  );
  [{lista:jambas,  mat:MAT.mudejarArcos, giroZ:0,
    geometria:new THREE.BoxGeometry(0.045,altoArranque-base,fondoMampara)},
   {lista:arcos,   mat:MAT.mudejarArcos, giroZ:0,
    geometria:new THREE.TubeGeometry(curvaArco,14,0.045,6,false)},
   {lista:paneles, mat:MAT.maderaBlanca, giroZ:0,
    geometria:new THREE.BoxGeometry(anchoVano-0.07,Math.max(0.10,base-0.16),0.035)},
   {lista:rombos,  mat:MAT.oro, giroZ:Math.PI/4,
    geometria:new THREE.BoxGeometry(0.22,0.22,0.028)}
  ].forEach(function(pieza){
    var malla=new THREE.InstancedMesh(pieza.geometria,pieza.mat,pieza.lista.length);
    var matriz=new THREE.Matrix4(), quat=new THREE.Quaternion(), pos=new THREE.Vector3();
    var escala=new THREE.Vector3(1,1,1);
    quat.setFromAxisAngle(new THREE.Vector3(0,0,1),pieza.giroZ);
    pieza.lista.forEach(function(t,k){
      pos.set(t.x,t.y,t.z);
      matriz.compose(pos,quat,escala);
      malla.setMatrixAt(k,matriz);
    });
    malla.instanceMatrix.needsUpdate=true;
    grupo.add(malla);
  });
  return grupo;
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

FALLA.piezas = FALLA.piezas || {};
FALLA.piezas.FONDO_MAMPARA = FONDO_MAMPARA;
FALLA.piezas.geometriaBalaustreOrnamental = geometriaBalaustreOrnamental;
FALLA.piezas.construirMamparaArcos = construirMamparaArcos;
FALLA.piezas.columnaMudejar = columnaMudejar;
FALLA.piezas.geometriaCortinaPalco = geometriaCortinaPalco;
FALLA.piezas.perfilCortina = perfilCortina;
FALLA.piezas.cortina = cortina;
})();
