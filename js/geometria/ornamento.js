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

/* Carpintería inspirada en la mampara histórica: coronación curva,
   sobreluces polilobuladas y cuarterones con diagonales en ambas caras.
   Se usa completa en los laterales y por módulos en los pasillos. */
function construirMamparaReferencia(ancho,alto,nVanos,pasoLibre){
  var grupo=new THREE.Group(), fondo=FONDO_MAMPARA;
  nVanos=nVanos||3;
  // Comparte exactamente el acabado de los separadores entre palcos.
  var madera=MAT.maderaBlanca;
  var filete=MAT.maderaBlanca.clone(); filete.color.setHex(0xe2c18d);
  var sombra=new THREE.MeshLambertMaterial({color:0x806344});
  var margen=ancho*0.065, montante=ancho*0.060;
  // El zócalo alcanza la altura del antepecho contiguo para que no quede
  // una rendija visual bajo los paños acristalados.
  var luz=(ancho-2*margen-(nVanos-1)*montante)/nVanos, base=alto*0.38;
  var forma=new THREE.Shape();
  forma.moveTo(-ancho/2,0); forma.lineTo(ancho/2,0);
  forma.lineTo(ancho/2,alto*0.79);
  forma.bezierCurveTo(ancho/2,alto*1.07,-ancho/2,alto*1.07,-ancho/2,alto*0.79);
  forma.closePath();
  function relieve(puntos,radio,material){
    [1,-1].forEach(function(lado){
      var curva=new THREE.CurvePath();
      for(var k=1;k<puntos.length;k++) curva.add(new THREE.LineCurve3(
        new THREE.Vector3(puntos[k-1].x,puntos[k-1].y,lado*(fondo/2+0.012)),
        new THREE.Vector3(puntos[k].x,puntos[k].y,lado*(fondo/2+0.012))));
      grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva,Math.max(8,puntos.length*2),radio,5,false),material));
    });
  }
  function rectangulo(x0,y0,x1,y1){
    var p=new THREE.Path(); p.moveTo(x0,y0); p.lineTo(x0,y1);
    p.lineTo(x1,y1); p.lineTo(x1,y0); p.closePath(); return p;
  }
  for(var n=0;n<nVanos;n++){
    var centro=(n-(nVanos-1)/2)*(luz+montante), iz=centro-luz/2, de=centro+luz/2;
    var central=n===(nVanos-1)/2;
    var arranque=alto*(central?0.715:0.695), clave=alto*(central?0.936:0.888);
    var travesano=arranque-alto*0.032;
    // Cada semicircunferencia desplaza el intradós hacia fuera: los
    // lóbulos son huecos reales, y la moldura sigue el mismo contorno.
    var arcoPts=[{x:iz,y:arranque}], lobulos=11;
    for(var j=0;j<lobulos;j++){
      var a0=Math.PI-j*Math.PI/lobulos, a1=Math.PI-(j+1)*Math.PI/lobulos;
      var x0=centro+luz/2*Math.cos(a0), y0=arranque+(clave-arranque)*Math.sin(a0);
      var x1=centro+luz/2*Math.cos(a1), y1=arranque+(clave-arranque)*Math.sin(a1);
      var dx=x1-x0, dy=y1-y0;
      for(var k=1;k<=8;k++){
        var t=k/8, bulbo=Math.sin(Math.PI*t)*0.48;
        arcoPts.push({x:x0+dx*t-dy*bulbo,y:y0+dy*t+dx*bulbo});
      }
    }
    var arco=new THREE.Path();
    if(pasoLibre){
      // Un único hueco continuo desde el suelo hasta la clave: no queda
      // zócalo ni travesaño atravesando la zona de paso.
      arco.moveTo(iz,0);
      arco.lineTo(iz,arranque);
      for(var ap=1;ap<arcoPts.length;ap++) arco.lineTo(arcoPts[ap].x,arcoPts[ap].y);
      arco.lineTo(de,0);
    }else{
      var inferior=rectangulo(iz,base,de,travesano);
      forma.holes.push(inferior);
      relieve(inferior.getPoints(),0.012,filete);
      arco.moveTo(arcoPts[0].x,arcoPts[0].y);
      for(var ap=1;ap<arcoPts.length;ap++) arco.lineTo(arcoPts[ap].x,arcoPts[ap].y);
      arco.lineTo(de,arranque);
    }
    arco.closePath(); forma.holes.push(arco);
    relieve(arco.getPoints(),0.018,filete);
    if(!pasoLibre){
      // Panel inferior rehundido, con marco y haces diagonales simétricos.
      var panel=rectangulo(iz,alto*0.045,de,base-alto*0.025);
      relieve(panel.getPoints(),0.014,filete);
      var yb=alto*0.058, yt=base-alto*0.040, pad=luz*0.07;
      for(var d=0;d<5;d++){
        var yy=yb+(yt-yb)*d/5;
        relieve([{x:iz+pad,y:yy},{x:de-pad,y:Math.min(yt,yy+(yt-yb)*0.50)}],0.006,filete);
        relieve([{x:iz+pad,y:Math.min(yt,yy+(yt-yb)*0.50)},{x:de-pad,y:yy}],0.006,filete);
      }
    }
  }
  // Medallones florales entre las claves, tallados sobre la madera.
  if(nVanos===3){
    [-1,1].forEach(function(signo){
      var cx=signo*(luz+montante)/2, cy=alto*0.91, r=Math.min(montante*0.65,alto*0.034);
      var circulo=[];
      for(var i=0;i<=40;i++){var a=i*Math.PI/20; circulo.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
      relieve(circulo,0.009,filete);
      var flor=[];
      for(var i=0;i<=72;i++){var a=i*Math.PI/36, rr=r*(0.48+0.20*Math.cos(6*a)); flor.push({x:cx+rr*Math.cos(a),y:cy+rr*Math.sin(a)});}
      relieve(flor,0.005,sombra);
    });
  }
  var geometria=new THREE.ExtrudeGeometry(forma,{depth:fondo,curveSegments:20,
    bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:2});
  geometria.translate(0,0,-fondo/2);
  grupo.add(new THREE.Mesh(geometria,madera));
  return grupo;
}

/* Mampara de arcos: parte inferior maciza, como en la referencia, y los
   vanos que se pidan, por los que se ve la sala. Se arma a la medida
   —el alto libre no es el mismo en el desembarco de las escaleras que
   bajo el forjado del piso principal—, centrada en el origen y de cara a
   +Z, lista para girarla sobre su radial. Las proporciones de arranque,
   clave y zócalo son las de la mampara original de 4.38 m. */
function construirMamparaArcos(ancho,alto,nVanos,pasoLibre){
  if(!nVanos || nVanos===1 || nVanos===3)
    return construirMamparaReferencia(ancho,alto,nVanos||3,pasoLibre);
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

/* Módulo de celosía inspirado en la valla histórica: no es un balaustre
   aislado, sino una pieza continua con rombos entrelazados arriba,
   volutas alrededor de un óvalo central y calados lanceolados abajo.
   Los biseles escalonados hacen legibles las molduras concéntricas. */
var cacheBalaustresOrnamentales={};
/* Teselado del balaustre de la celosía. Es la pieza más repetida de la
   sala —unas 440 copias instanciadas entre los cuatro niveles— así que
   su recuento manda sobre el de la escena entera: con los valores de
   antes (curva 10, bisel 2, filetes de 32x4) salía a 7808 triángulos,
   o sea 3,4 de los 3,8 millones que se dibujaban al mirar el patio,
   el 90 %.

   Los filetes son tubos de 2,5 mm de radio: a la distancia desde la que
   se ven, incluso desde el propio palco, no llegan a un par de píxeles,
   de modo que bajar sus segmentos no cambia la imagen. La silueta y los
   calados son lo que sí se lee, y ésos conservan curva suficiente. */
var SEG_CURVA=6, SEG_BISEL=1, SEG_FILETE=10, LADOS_FILETE=3;

function geometriaBalaustreOrnamental(alto){
  if(cacheBalaustresOrnamentales[alto])return cacheBalaustresOrnamentales[alto];
  var h=alto,w=0.34,s=new THREE.Shape();
  s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.lineTo(-w/2,h);s.closePath();

  function huecoPoligono(puntos){
    var p=new THREE.Path();p.moveTo(puntos[0][0],puntos[0][1]*h);
    for(var i=1;i<puntos.length;i++)p.lineTo(puntos[i][0],puntos[i][1]*h);
    p.closePath();s.holes.push(p);
  }
  // Rombos superiores con puntas suavizadas. Se deja una franja
  // maciza hasta las volutas para que los calados no se intersecten.
  [-1,1].forEach(function(lado){
    var cx=lado*0.083,cy=0.825,rx=0.066,ry=0.125;
    huecoPoligono([
      [cx-0.008,cy+ry-0.012],[cx+0.008,cy+ry-0.012],
      [cx+rx,cy+0.012],[cx+rx,cy-0.012],
      [cx+0.008,cy-ry+0.012],[cx-0.008,cy-ry+0.012],
      [cx-rx,cy-0.012],[cx-rx,cy+0.012]
    ]);
  });

  // Óvalo central, rodeado por cuatro brazos que conectan las volutas.
  var centro=new THREE.Path();
  centro.absellipse(0,h*0.485,0.038,h*0.086,0,Math.PI*2,true);s.holes.push(centro);

  // Huecos en forma de corazón/voluta a ambos lados del medallón.
  [-1,1].forEach(function(lado){
    var p=new THREE.Path();
    p.moveTo(lado*0.047,h*0.52);
    p.bezierCurveTo(lado*0.076,h*0.675,lado*0.158,h*0.67,lado*0.151,h*0.54);
    p.bezierCurveTo(lado*0.147,h*0.445,lado*0.082,h*0.395,lado*0.047,h*0.44);
    p.bezierCurveTo(lado*0.072,h*0.475,lado*0.078,h*0.545,lado*0.047,h*0.52);
    p.closePath();s.holes.push(p);
  });

  // Calados inferiores sinuosos: estrechos en el centro y abiertos en
  // los extremos, como las hojas enfrentadas de la fotografía.
  [-1,1].forEach(function(lado){
    var p=new THREE.Path();
    p.moveTo(lado*0.027,h*0.395);
    p.bezierCurveTo(lado*0.072,h*0.38,lado*0.147,h*0.35,lado*0.151,h*0.25);
    p.bezierCurveTo(lado*0.158,h*0.115,lado*0.108,h*0.045,lado*0.046,h*0.025);
    p.bezierCurveTo(lado*0.075,h*0.145,lado*0.066,h*0.285,lado*0.027,h*0.395);
    p.closePath();s.holes.push(p);
  });

  // Pequeños calados de transición que separan las volutas de la X.
  [-1,1].forEach(function(lado){
    var p=new THREE.Path();
    p.absellipse(lado*0.124,h*0.666,0.013,h*0.016,0,Math.PI*2,true);s.holes.push(p);
  });
  // Un calado adicional aligera el eje inferior, que antes seguía leyendo
  // como una barra maciza al contemplar la valla desde la platea.
  var gotaInferior=new THREE.Path();
  gotaInferior.absellipse(0,h*0.185,0.018,h*0.068,0,Math.PI*2,true);s.holes.push(gotaInferior);
  var cuerpo=new THREE.ExtrudeGeometry(s,{
    depth:0.038, bevelEnabled:true, bevelThickness:0.005,
    bevelSize:0.003, bevelSegments:SEG_BISEL, curveSegments:SEG_CURVA
  });
  cuerpo.translate(0,0,-0.019);

  // Filetes redondos sobre cada calado: dibujan la floritura también
  // desde dentro del palco. Se funden en la misma geometría instanciada,
  // sin añadir un objeto por voluta ni por repetición de la valla.
  var partes=[cuerpo];
  s.holes.forEach(function(hueco){
    var puntos=hueco.getSpacedPoints(SEG_FILETE);
    [-1,1].forEach(function(cara){
      var curva=new THREE.CatmullRomCurve3(puntos.slice(0,-1).map(function(p){
        return new THREE.Vector3(p.x,p.y,cara*0.023);
      }),true,'centripetal');
      partes.push(new THREE.TubeGeometry(curva,SEG_FILETE,0.0025,LADOS_FILETE,true));
    });
  });
  var posiciones=[],normales=[],uvs=[];
  partes.forEach(function(parte){
    var plana=parte.index?parte.toNonIndexed():parte;
    var pos=plana.getAttribute('position'),nor=plana.getAttribute('normal'),uv=plana.getAttribute('uv');
    for(var i=0;i<pos.count;i++){
      posiciones.push(pos.getX(i),pos.getY(i),pos.getZ(i));
      normales.push(nor.getX(i),nor.getY(i),nor.getZ(i));
      uvs.push(uv.getX(i),uv.getY(i));
    }
    if(plana!==parte)plana.dispose();
    parte.dispose();
  });
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(posiciones,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normales,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  cacheBalaustresOrnamentales[alto]=g;
  return g;
}

/* Cortina lateral recogida: paño ancho arriba, ceñido en el centro por
   el alzapaño y ligeramente abierto de nuevo en su caída inferior. */
function geometriaCortinaPalco(ancho,alto,lado){
  // Una superficie de tela: los pliegues convergen en la recogida y
  // vuelven a abrirse hacia el suelo. El borde superior queda oculto
  // detrás del arco, evitando el antiguo corte diagonal rígido.
  var nx=48, ny=36, pos=[], uv=[], colores=[], indices=[];
  for(var j=0;j<=ny;j++){
    var v=j/ny, t, interior;
    if(v<0.43){
      t=v/0.43; t=t*t*(3-2*t);
      interior=0.31+0.095*t;
    }else{
      t=Math.min(1,(v-0.43)/0.57);
      interior=0.018+0.387*Math.pow(1-t,1.45);
    }
    var recogida=Math.exp(-Math.pow((v-0.43)/0.105,2));
    var exterior=0.51-0.045*recogida;
    var amplitud=Math.min(0.085,ancho*0.037)*(1-0.72*recogida);
    for(var i=0;i<=nx;i++){
      var u=i/nx, fase=u*Math.PI*12+0.18*Math.sin(v*Math.PI*2);
      var pliegue=Math.cos(fase), secundario=Math.cos(fase*2)*0.16;
      var px=lado*ancho*(interior+(exterior-interior)*u);
      var py=0.025+v*(alto*1.055-0.025);
      py-=0.014*(1-v)*Math.sin(u*Math.PI*6);
      var pz=amplitud*(pliegue+secundario)+0.025*Math.sin(v*Math.PI);
      pos.push(px,py,pz);
      uv.push(u*ancho*0.65,v*alto);
      // Sombra suave en el fondo del pliegue sin sombras dinámicas.
      var tono=0.72+0.28*(pliegue+1)/2;
      colores.push(tono,tono,tono);
    }
  }
  for(var j=0;j<ny;j++)for(var i=0;i<nx;i++){
    var a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    if(lado>0)indices.push(a,b,c,b,d,c);
    else indices.push(a,c,b,b,c,d);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colores,3));
  g.setIndex(indices); g.computeVertexNormals();
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
