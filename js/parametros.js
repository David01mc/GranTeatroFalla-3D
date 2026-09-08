(function(){
'use strict';
window.FALLA = window.FALLA || {};

/* ------------------------------------------------------------------
   PARÁMETROS DE LA SALA
   Todo lo que sigue está sacado de los datos públicos del teatro:
   planta en herradura, embocadura rectangular con arco rebajado,
   tres alturas de palcos + paraíso, y un patio de ~500 butacas.
   Cambiando estas cifras cambia el edificio entero.
-------------------------------------------------------------------*/
var P = {
  jamba: 12.4,       // media anchura de la sala en la embocadura (y de toda la planta en z=0)
  zc: 9.8,            // centro de la elipse de la herradura (profundidad)
  Rx: 14.318,        // semieje de la elipse en anchura (algo mayor que jamba: la sala se abre poco a poco)
  Rz: 19.6,          // semieje de la elipse en profundidad
  tmax: 120*Math.PI/180,
  rake: 0.030,       // pendiente del patio (3 cm por metro, aprox. 1.7 grados)
  zRake: 2.0,
  altura: 13.4,      // hasta el techo de Abárzuza
  anchoPasilloPalcos: 3.90, // corredor posterior (antes 3.00 m; +30 %)
  entresueloPrincipal: 0.25, // espesor decorativo entre 4.10 y 4.35 m
  pisos: [           // y del piso, y del antepecho, retranqueo, nº de palcos
    {y:0.00, alto:1.15, dentro:2.90, palcos:0, palcosLado:8, nombre:'platea'},
    {y:4.35, alto:1.15, dentro:2.10, palcos:20, palcosLado:10, nombre:'principal'},
    /* El segundo sube de 6,70 a 7,10 y el paraíso de 9,60 a 9,90. Con las
       cotas anteriores el principal se quedaba en 2,35 m libres —el
       mínimo de la sala, 53 cm por debajo de los palcos de platea que
       tiene justo debajo— porque los 25 cm del entresuelo decorativo
       salieron de ese hueco al subir su suelo de 4,10 a 4,35. Ahora las
       alturas libres quedan 2,88 (platea) · 2,75 (principal) · 2,80
       (segundo) · 3,50 (paraíso), todas dentro de los 13,40 de la sala.

       Los arcos de las portadas del principal cuelgan de esta misma cota
       (ver portadasPalcosPlatea, que recibe P.pisos[2].y como techo), de
       modo que suben con ella: de 2,01 a 2,41 m de luz. */
    /* `alto` incluye ahora la moldura de oro, que antes se apilaba encima:
       1,15 en el segundo lo deja a la misma altura de valla que el
       principal, y 1,19 en el paraíso conserva la que ya tenía. */
    {y:7.10, alto:1.15, dentro:2.70, palcos:12, nombre:'segundo'},   // 6 por ala en el arco delantero
    {y:9.90, alto:1.19, dentro:3.30, palcos:0,  nombre:'paraíso'}
  ],
  arcoA: 7.5        // semianchura libre de la boca escénica
};

function rake(z){ return P.rake * Math.max(0, z - P.zRake); }

/* Planta de la sala: una única elipse (Rx, Rz, centrada en zc), sin
   tramo recto de jamba aparte — Rx y tmax están elegidos para que la
   elipse arranque y termine exactamente en (±jamba, 0), la embocadura.
   Así la pared no da un salto brusco de anchura nada más pasar el arco
   de boca (como pasaba con la circunferencia + tramo recto anterior):
   crece poco a poco, casi en paralelo al eje de la sala al principio,
   y solo se abre del todo ya bien entrada la curva. */
function planta(){
  var pts=[], i, t;
  for(i=0;i<=72;i++){ t=P.tmax-2*P.tmax*i/72; pts.push({x:P.Rx*Math.sin(t), z:P.zc+P.Rz*Math.cos(t)}); }

  /* Ensayo de palco 2 recto. Su primer módulo (z≈4.18..6.40) mantiene
     X constante, igual que el palco frontal; después recupera la curva
     gradualmente hasta el centro de la herradura. Al modificar la planta
     maestra, suelos, barandillas, puertas, corredor y colisiones quedan
     alineados sin piezas superpuestas. */
  var zInicio=3.2,zFinRecto=6.45,zFinTransicion=9.8,xRecto=null;
  for(i=0;i<pts.length;i++){
    if(pts[i].x>0 && pts[i].z>=zInicio){xRecto=pts[i].x;break;}
  }
  if(xRecto!==null){
    for(i=0;i<pts.length;i++){
      var signo=pts[i].x<0?-1:1, ax=Math.abs(pts[i].x);
      if(pts[i].z>=zInicio && pts[i].z<=zFinRecto){
        pts[i].x=signo*xRecto;
      }else if(pts[i].z>zFinRecto && pts[i].z<zFinTransicion){
        var u=(pts[i].z-zFinRecto)/(zFinTransicion-zFinRecto);
        u=u*u*(3-2*u);
        pts[i].x=signo*(xRecto+(ax-xRecto)*u);
      }
    }
  }
  return pts;
}
var PLAN = planta();

/* Dos escaleras rectas que ocupan, sin holgura, toda la franja entre
   el final del palco frontal (Z_CORREDOR_INI=1.8) y el comienzo del
   palco 2 de platea (Z_CORREDOR_FIN=3.2). */
// La franja llega desde el final del palco frontal (z=1.8) hasta la
// cara oblicua de la mampara; termina en z=4.25 para respetar también
// su punto más cercano y el grosor de los zócalos.
var ESCALERAS_LATERALES={centroZ:3.025,curvaZ:0,ancho:2.45,xBajo:10.25,xAlto:12.25,altura:1.05,peldanos:7};

function centroZEscalera(e,t){ return e.centroZ+e.curvaZ*Math.sin(Math.PI*t); }

function alturaEscaleraLateral(x,z){
  var e=ESCALERAS_LATERALES;
  var ax=Math.abs(x);
  if(ax<e.xBajo || ax>e.xAlto) return null;
  // Comprueba el rectángulo orientado de cada peldaño, siguiendo la
  // misma línea que usa la geometría visible.
  for(var i=e.peldanos-1;i>=0;i--){
    var t0=i/e.peldanos,t1=(i+1)/e.peldanos;
    var x0=e.xBajo+(e.xAlto-e.xBajo)*t0, x1=e.xBajo+(e.xAlto-e.xBajo)*t1;
    var z0=centroZEscalera(e,t0),z1=centroZEscalera(e,t1);
    var vx=x1-x0,vz=z1-z0,wx=ax-x0,wz=z-z0,L2=vx*vx+vz*vz;
    var longitudinal=(wx*vx+wz*vz)/L2;
    var lateral=Math.abs(vx*wz-vz*wx)/Math.sqrt(L2);
    if(longitudinal>=-0.02 && longitudinal<=1.02 && lateral<=e.ancho/2) return e.altura*(i+1)/e.peldanos;
  }
  return null;
}

/* Rampas posteriores: continúan los dos pasillos de alfombra y alcanzan
   suavemente la cota horizontal de la platea/corredor. */
// Llegan hasta la misma corona exterior en la que se apoyan las
// portadas de los palcos. El antiguo final (26.70) coincidía con la
// barandilla interior y comprimía los cinco vanos del fondo.
var RAMPAS_TRASERAS={xInicio:3.40,xFin:4.60,ancho:1.35,anchoFin:1.70,zInicio:23.15,zFin:28.62};
function centroRampaTrasera(z){
  var r=RAMPAS_TRASERAS,t=Math.max(0,Math.min(1,(z-r.zInicio)/(r.zFin-r.zInicio)));
  t=t*t*(3-2*t);
  return r.xInicio+(r.xFin-r.xInicio)*t;
}
function anchoRampaTrasera(z){
  var r=RAMPAS_TRASERAS,t=Math.max(0,Math.min(1,(z-r.zInicio)/(r.zFin-r.zInicio)));
  t=t*t*(3-2*t);
  return r.ancho+(r.anchoFin-r.ancho)*t;
}
function alturaRampaTrasera(x,z){
  var r=RAMPAS_TRASERAS;
  if(Math.abs(Math.abs(x)-centroRampaTrasera(z))>anchoRampaTrasera(z)/2 || z<r.zInicio || z>r.zFin)return null;
  var t=(z-r.zInicio)/(r.zFin-r.zInicio);
  t=t*t*(3-2*t);
  var y0=rake(r.zInicio),y1=rake(P.zc+P.Rz)+0.40;
  return y0+(y1-y0)*t;
}

/* Desplaza la planta hacia dentro d metros (para pisos y antepechos). */
function dentro(pts,d){
  var out=[],i;
  for(i=0;i<pts.length;i++){
    var p=pts[i], a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)];
    var tx=b.x-a.x, tz=b.z-a.z, L=Math.hypot(tx,tz)||1; tx/=L; tz/=L;
    var nx=-tz, nz=tx;
    if((0-p.x)*nx + (P.zc-p.z)*nz < 0){ nx=-nx; nz=-nz; }
    out.push({x:p.x+nx*d, z:p.z+nz*d});
  }
  return out;
}

function dentroDePlanta(x,z){
  var poly=PLAN.concat([{x:-P.jamba,z:0},{x:P.jamba,z:0}]);
  var d=false,i,j;
  for(i=0,j=poly.length-1;i<poly.length;j=i++){
    if(((poly[i].z>z)!==(poly[j].z>z)) &&
       (x < (poly[j].x-poly[i].x)*(z-poly[i].z)/(poly[j].z-poly[i].z)+poly[i].x)) d=!d;
  }
  return d;
}

/* Huella horizontal de la platea inferior. Es la franja comprendida
   entre el muro exterior y el borde retranqueado 2.9 m, desde el final
   del pasillo transversal hacia el fondo de la herradura. */
var plateaAltura=rake(P.zc+P.Rz)+0.40;
var BORDE_PLATEA=dentro(PLAN,P.pisos[0].dentro);
var EXTERIOR_ANTEPALCO=dentro(PLAN,-2.0);
// El antepalco termina a -2 m; desde ahí se mide el corredor posterior.
var EXTERIOR_PASILLO=dentro(PLAN,-(2.0+P.anchoPasilloPalcos));
var BORDES_NIVELES=P.pisos.map(function(piso){return dentro(PLAN,piso.dentro);});

/* El contorno interior de un piso no siempre es el simple retranqueo de
   la planta: en el principal los palcos de proscenio se adelantan hasta
   la línea del palco frontal (adelantaPalcosProscenio en geometria.js).
   Quien construye la geometría deja aquí el contorno que ha dibujado de
   verdad, para que enNivelPalcos —y con él el modo paseo— no bloquee un
   suelo que existe ni deje pisar uno que no. */
function fijaBordeNivel(nivel,contorno){ BORDES_NIVELES[nivel]=contorno; }

/* Caja de escalera de acceso al primer piso, anexa a cada extremo del
   corredor posterior. La planta reproduce el boceto: la caja cuelga al
   sur del pasillo EXIT y ocupa su mismo tramo de x, de modo que se abre
   de frente nada más salir —no pasado el cartel—, con tres vuelos
   girando alrededor de un hueco central: sube por el lado de fuera,
   cruza al fondo y vuelve por el lado del teatro hasta desembarcar a la
   cota del primer piso, pegado al muro por el que algún día se entrará
   al piso principal.

   Está definida para el ala derecha (x positivo). alturaCajaEscalera
   trabaja sobre |x| y la geometría se construye dos veces, con signo,
   de modo que ambas alas comparten estas mismas cotas. */
var CAJA_ESCALERA=(function(){
  var W=2.10;                    // ancho de vuelo y de rellano
  var HUELLA=0.32, PELDANOS=7;
  var CORRIDA=HUELLA*PELDANOS;   // 2.24 m de proyección horizontal por vuelo
  var y0=plateaAltura, y3=P.pisos[1].y, y6=P.pisos[2].y;
  // Dos tandas con contrahuella propia: la de abajo salva 3,13 m en tres
  // vuelos y la de arriba 2,35 m en dos. Cada tanda es regular en sí
  // misma, que es lo que se nota al subir.
  /* La tanda alta salva más desnivel en menos vuelos, así que lleva un
     peldaño más cada uno: con los 7 de abajo la contrahuella se iba a
     0,196 y se notaba el cambio de pendiente a media subida. Con 8 la
     huella baja a 0,28 —el mínimo cómodo— y las dos tandas quedan casi
     iguales de empinadas. */
  var PELDANOS_ALTO=8;
  var pasoBajo=(y3-y0)/(3*PELDANOS);        // ≈0,149 m
  var pasoAlto=(y6-y3)/(2*PELDANOS_ALTO);   // ≈0,172 m
  var y1=y0+pasoBajo*PELDANOS, y2=y0+pasoBajo*2*PELDANOS;
  var y4=y3+pasoAlto*PELDANOS_ALTO;

  // xMin deja libre el paño lateral de la embocadura, que cierra el muro
  // frontal de la sala y se extiende hasta x=15.50.
  var xMin=15.70;
  var xBaja=xMin+W/2;            // eje del vuelo que desembarca, junto al teatro
  var xSube=xBaja+CORRIDA+W;     // eje del vuelo que arranca, al fondo del pasillo
  var xMax=xSube+W/2;            // 22.14

  /* La boca se retira 60 cm del pasillo EXIT (que llega a z=1,80). Con
     dos desembarcos —el del principal y el del segundo— apilados sobre
     la misma arista, dejarla enrasada amontonaba los dos rellanos justo
     en el borde del pasillo. */
  var zBoca=1.20;
  var zGiro=zBoca-CORRIDA;       // fin del vuelo de subida
  var zMin=zGiro-W;              // testero sur
  var zCruce=zGiro-W/2;          // eje del vuelo transversal

  /* Los vuelos altos van encima de los bajos, como en cualquier hueco de
     escalera real, y por eso cada tramo y cada rellano llevan su nivel:
     alturaCajaEscalera() necesita saber cuál de las dos cotas que hay
     sobre un mismo punto es la que se está pisando. */
  return {
    xMin:xMin, xMax:xMax, zMin:zMin, zMax:zBoca,
    // La arista norte entera queda abierta: el pasillo EXIT se alarga
    // justo hasta xMax para topar con la caja, sin rincones muertos.
    boca:{xMin:xMin, xMax:xMax},
    /* Hueco que las losas de los pisos altos tienen que recortar para
       no tapar la caja vista desde abajo: el carril oeste, por donde
       desembarcan los vuelos, desde el giro hasta la boca. */
    huecoLosa:{xMin:xMin, xMax:xBaja+W/2, zMin:zGiro, zMax:zBoca},
    anchoTramo:W, peldanos:PELDANOS, huella:HUELLA,
    contrahuella:pasoBajo, contrahuellaAlta:pasoAlto,
    baseY:y0, primerPisoY:y3, segundoPisoY:y6,
    tramos:[
      // De la platea al principal.
      {nivel:0, x0:xSube,     z0:zBoca,  x1:xSube,     z1:zGiro, y0:y0, y1:y1},
      {nivel:0, x0:xSube-W/2, z0:zCruce, x1:xBaja+W/2, z1:zCruce, y0:y1, y1:y2},
      {nivel:0, x0:xBaja,     z0:zGiro,  x1:xBaja,     z1:zBoca, y0:y2, y1:y3},
      // Del principal al segundo, sobre los dos primeros.
      {nivel:1, peldanos:PELDANOS_ALTO, x0:xSube,     z0:zBoca,  x1:xSube,     z1:zGiro, y0:y3, y1:y4},
      {nivel:1, peldanos:PELDANOS_ALTO, x0:xSube-W/2, z0:zCruce, x1:xBaja+W/2, z1:zCruce, y0:y4, y1:y6}
    ],
    rellanos:[
      {nivel:0, xMin:xSube-W/2, xMax:xMax,      zMin:zMin, zMax:zGiro, y:y1},
      {nivel:0, xMin:xMin,      xMax:xBaja+W/2, zMin:zMin, zMax:zGiro, y:y2},
      {nivel:1, xMin:xSube-W/2, xMax:xMax,      zMin:zMin, zMax:zGiro, y:y4},
      // Galería de llegada al segundo: del final del último vuelo hasta
      // la boca, que es por donde se sale al corredor de ese piso.
      {nivel:1, xMin:xMin,      xMax:xBaja+W/2, zMin:zMin, zMax:zBoca, y:y6}
    ],
    // Aristas que dan al hueco central, una por tramo, para la barandilla.
    bordesInteriores:[
      [{x:xSube-W/2,z:zBoca}, {x:xSube-W/2,z:zGiro}],
      [{x:xSube-W/2,z:zGiro}, {x:xBaja+W/2,z:zGiro}],
      [{x:xBaja+W/2,z:zGiro}, {x:xBaja+W/2,z:zBoca}],
      [{x:xSube-W/2,z:zBoca}, {x:xSube-W/2,z:zGiro}],
      [{x:xSube-W/2,z:zGiro}, {x:xBaja+W/2,z:zGiro}]
    ]
  };
})();

function alturaEnTramoCaja(t,x,z){
  var vx=t.x1-t.x0,vz=t.z1-t.z0,L2=vx*vx+vz*vz;
  var wx=x-t.x0,wz=z-t.z0,u=(wx*vx+wz*vz)/L2;
  var lateral=Math.abs(vx*wz-vz*wx)/Math.sqrt(L2);
  if(u<0 || u>1 || lateral>CAJA_ESCALERA.anchoTramo/2)return null;
  // Cada tramo puede llevar su propio número de peldaños: los de la
  // tanda alta reparten más desnivel en la misma corrida.
  var n=t.peldanos||CAJA_ESCALERA.peldanos;
  var escalon=Math.min(n-1,Math.max(0,Math.floor(u*n)));
  return t.y0+(t.y1-t.y0)*(escalon+1)/n;
}
/* Cota pisable de la caja de escalera. Trabaja sobre |x|: las dos alas
   son la misma sala reflejada. El hueco central queda a la cota de
   partida; el último vuelo desemboca asomado al pasillo a +2.88 m, un
   desnivel que el modo paseo no deja salvar de un paso, así que a él
   solo se llega dando la vuelta completa, como en una escalera real. */
/* Cota pisable de la caja. Sobre un mismo punto hay ahora hasta dos
   cotas —el vuelo bajo y el que va encima—, así que se recogen todas las
   candidatas y se devuelve la más cercana a yRef, la altura de quien
   camina: es la que está pisando de verdad. Sin yRef se devuelve la más
   baja, que es lo que quiere quien mira la caja desde la solera. */
function alturaCajaEscalera(x,z,yRef){
  var c=CAJA_ESCALERA, ax=Math.abs(x), i, cotas=[];
  if(ax<c.xMin || ax>c.xMax || z<c.zMin || z>c.zMax) return null;
  for(i=0;i<c.rellanos.length;i++){
    var r=c.rellanos[i];
    if(ax>=r.xMin && ax<=r.xMax && z>=r.zMin && z<=r.zMax) cotas.push(r.y);
  }
  for(i=0;i<c.tramos.length;i++){
    var y=alturaEnTramoCaja(c.tramos[i],ax,z); if(y!==null) cotas.push(y);
  }
  if(!cotas.length) return c.baseY;
  var mejor=cotas[0];
  for(i=1;i<cotas.length;i++){
    if(yRef===undefined ? cotas[i]<mejor
                        : Math.abs(cotas[i]-yRef)<Math.abs(mejor-yRef)) mejor=cotas[i];
  }
  return mejor;
}
function dentroDeContornoAbierto(pts,x,z){
  // El test de rayos cierra implícitamente el último punto con el primero.
  var poly=pts;
  var dentro=false,i,j;
  for(i=0,j=poly.length-1;i<poly.length;j=i++){
    if(((poly[i].z>z)!==(poly[j].z>z)) &&
       (x<(poly[j].x-poly[i].x)*(z-poly[i].z)/(poly[j].z-poly[i].z)+poly[i].x)) dentro=!dentro;
  }
  return dentro;
}
function enPlatea(x,z){
  return z>=3.2 && dentroDeContornoAbierto(EXTERIOR_PASILLO,x,z) && !dentroDeContornoAbierto(BORDE_PLATEA,x,z);
}
/* Anillo transitable de un piso alto: balconada, antepalcos y corredor
   comparten cota. El índice coincide con P.pisos (1 = principal). */
function enNivelPalcos(nivel,x,z){
  var piso=P.pisos[nivel];
  if(!piso || nivel<1)return false;
  var borde=BORDES_NIVELES[nivel];
  return dentroDeContornoAbierto(EXTERIOR_PASILLO,x,z) &&
         !dentroDeContornoAbierto(borde,x,z);
}
/* Rellanos rectos que enlazan las escaleras próximas al escenario con
   los dos extremos abiertos del corredor posterior. */
function enSalidaPasillo(x,z){
  var ax=Math.abs(x), e=ESCALERAS_LATERALES, c=CAJA_ESCALERA;
  if(ax<e.xAlto-0.05 || ax>c.xMax) return false;
  if(z>e.centroZ+e.ancho/2+0.08) return false;
  /* Delante de la caja el rellano se prolonga hasta su boca. La caja se
     retiró del pasillo para que los dos desembarcos no se amontonaran en
     su borde, y sin este vestíbulo esos centímetros quedaban sin suelo:
     una barrera invisible a lo ancho de toda la entrada. Sólo se
     prolonga en el tramo de x que ocupa la caja — más adentro, hacia el
     teatro, esa misma franja cae ya dentro de la sala. */
  var zSur = (ax>=c.xMin) ? Math.min(c.zMax, e.centroZ-e.ancho/2)
                          : e.centroZ-e.ancho/2;
  return z>=zSur;
}
function distAPlanta(x,z){
  var m=1e9,i;
  for(i=0;i<PLAN.length-1;i++){
    var a=PLAN[i], b=PLAN[i+1];
    var vx=b.x-a.x, vz=b.z-a.z, wx=x-a.x, wz=z-a.z;
    var L=vx*vx+vz*vz, t=L?Math.max(0,Math.min(1,(wx*vx+wz*vz)/L)):0;
    m=Math.min(m, Math.hypot(x-(a.x+vx*t), z-(a.z+vz*t)));
  }
  return m;
}

// Los palcos conservan su huella original. La diagonal se aloja hacia
// el escenario, cuyo retiro se deduce de ese encuentro fijo.
var FRENTE_ESCENICO={zInicioPalcos:-1.0,avanceAlas:1.5};
FRENTE_ESCENICO.retiro=FRENTE_ESCENICO.avanceAlas-FRENTE_ESCENICO.zInicioPalcos;
var ESCENARIO={altura:1.05,mitadX:9,zFondo:-16-FRENTE_ESCENICO.retiro,
  zFrente:FRENTE_ESCENICO.zInicioPalcos,curvatura:0.65};
/* Vestíbulo posterior de los palcos frontales. Aprovecha el espacio de
   servicio y comunica con las tablas por detrás de la embocadura. */
var ACCESO_PALCO_FRONTAL={
  xPalcoFrente:9.0,xPalcoMax:11.48,curvaPalco:0.42,
  zPalcoMin:-0.98,zPalcoMax:1.82,
  xCorredorMin:11.45,xCorredorMax:15.30,
  zCorredorMin:-4.0,zCorredorMax:1.80,puertaZ:0.62,
  xEnlaceMin:8.80,zEnlaceMax:-1.50,
  pasoMin:11.60,pasoMax:13.10,
  altura:ESCENARIO.altura+0.10
};
function alturaAccesoPalcoFrontal(x,z){
  var a=ACCESO_PALCO_FRONTAL,ax=Math.abs(x);
  var t=Math.max(0,Math.min(1,(z-a.zPalcoMin)/(a.zPalcoMax-a.zPalcoMin)));
  var xFrente=a.xPalcoFrente-a.curvaPalco*Math.sin(Math.PI*t);
  var enPalco=ax>=xFrente+0.02 && ax<=a.xPalcoMax &&
    z>=a.zPalcoMin && z<=a.zPalcoMax;
  var enCorredor=ax>=a.xCorredorMin && ax<=a.xCorredorMax &&
    z>=a.zCorredorMin && z<=a.zCorredorMax;
  var enEnlace=ax>=a.xEnlaceMin && ax<a.xCorredorMin &&
    z>=a.zCorredorMin && z<=a.zEnlaceMax;
  return enPalco||enCorredor||enEnlace?a.altura:null;
}
var FOSO={altura:-0.90,zVallaCentro:1.65,altoValla:0.85,grosorValla:0.10,
  escaleras:{xBajo:6.12,xAlto:7.80,xExterior:9,zCentro:0.25,ancho:1.0,zEntrada:1.80,peldanos:6}};
function frenteEscenario(x){
  var t=Math.min(1,Math.abs(x)/ESCENARIO.mitadX);
  return ESCENARIO.zFrente+ESCENARIO.curvatura*(1-t*t);
}
function frenteFoso(x){
  return FOSO.zVallaCentro+frenteEscenario(x)-frenteEscenario(0);
}
function alturaAccesoFoso(x,z){
  var e=FOSO.escaleras,ax=Math.abs(x),zMin=e.zCentro-e.ancho/2,zMax=e.zCentro+e.ancho/2;
  if(ax>=e.xAlto && ax<=e.xExterior && z>=zMin && z<=e.zEntrada)return 0;
  if(ax<e.xBajo || ax>=e.xAlto || z<zMin || z>zMax)return null;
  var peldaño=Math.min(e.peldanos-1,Math.floor((ax-e.xBajo)/(e.xAlto-e.xBajo)*e.peldanos));
  return FOSO.altura*(1-(peldaño+1)/e.peldanos);
}
function bloqueaBarandillaFoso(x,z){
  var e=FOSO.escaleras,ax=Math.abs(x),margen=0.12;
  if(ax<=e.xAlto && Math.abs(z-frenteFoso(x))<FOSO.grosorValla/2+0.16)return true;
  // Los pasamanos impiden salir de lado de los vuelos y del rellano.
  if(ax>=e.xBajo && ax<=e.xAlto && Math.abs(Math.abs(z-e.zCentro)-e.ancho/2)<margen)return true;
  return Math.abs(ax-e.xAlto)<margen && z>=e.zCentro+e.ancho/2 && z<=frenteFoso(e.xAlto);
}
function contornoPatioConFoso(){
  // La cavidad corta el frente abierto de la sala: se incorpora como
  // entrante del contorno, evitando un agujero que toque su borde.
  var pts=PLAN.slice();
  pts.push({x:-ESCENARIO.mitadX,z:0});
  contornoFrenteEscenario().forEach(function(p){pts.push({x:p.x,z:frenteFoso(p.x)});});
  pts.push({x:ESCENARIO.mitadX,z:0});
  return pts;
}
function contornoFrenteEscenario(){
  var pts=[];
  for(var i=0;i<=64;i++){
    var x=ESCENARIO.mitadX*(2*i/64-1);
    pts.push({x:x,z:frenteEscenario(x)});
  }
  return pts;
}

FALLA.geo = {
  P: P,
  rake: rake,
  PLAN: PLAN,
  dentro: dentro,
  dentroDePlanta: dentroDePlanta,
  distAPlanta: distAPlanta,
  enPlatea: enPlatea,
  enNivelPalcos:enNivelPalcos,
  fijaBordeNivel:fijaBordeNivel,
  enSalidaPasillo: enSalidaPasillo,
  cajaEscalera:CAJA_ESCALERA,
  alturaCajaEscalera:alturaCajaEscalera,
  platea: {altura:plateaAltura},
  escalerasLaterales: ESCALERAS_LATERALES,
  alturaEscaleraLateral: alturaEscaleraLateral,
  rampasTraseras:RAMPAS_TRASERAS,
  centroRampaTrasera:centroRampaTrasera,
  anchoRampaTrasera:anchoRampaTrasera,
  alturaRampaTrasera:alturaRampaTrasera,
  // caja del suelo del escenario (ver geometria.js: escenario()) — la usa el modo paseo para pisar las tablas
  frenteEscenico:FRENTE_ESCENICO,
  escenario:ESCENARIO,
  accesoPalcoFrontal:ACCESO_PALCO_FRONTAL,
  alturaAccesoPalcoFrontal:alturaAccesoPalcoFrontal,
  foso:FOSO,
  frenteEscenario:frenteEscenario,
  frenteFoso:frenteFoso,
  alturaAccesoFoso:alturaAccesoFoso,
  bloqueaBarandillaFoso:bloqueaBarandillaFoso,
  contornoPatioConFoso:contornoPatioConFoso,
  contornoFrenteEscenario:contornoFrenteEscenario
};
})();
