(function(){
'use strict';
window.FALLA = window.FALLA || {};

/* ------------------------------------------------------------------
   PARÁMETROS DE LA SALA
   Todo lo que sigue está sacado de los datos públicos del teatro:
   planta en herradura, embocadura de arco de herradura emiral,
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
  pisos: [           // y del piso, y del antepecho, retranqueo, nº de palcos
    {y:0.00, alto:1.15, dentro:2.90, palcos:0, palcosLado:9, nombre:'platea'},
    {y:3.60, alto:1.15, dentro:2.10, palcos:22, nombre:'principal'},
    {y:6.70, alto:1.10, dentro:2.70, palcos:20, nombre:'segundo'},
    {y:9.60, alto:1.05, dentro:3.30, palcos:0,  nombre:'paraíso'}
  ],
  arcoR: 8.4, arcoA: 7.5, arcoYc: 8.9   // embocadura: arco de herradura
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
  return pts;
}
var PLAN = planta();

/* Dos escaleras simétricas en los pasillos laterales próximos al
   escenario. zBajo es el arranque desde el patio y zAlto el desembarco. */
var ESCALERAS_LATERALES={centroX:8.20,ancho:1.20,zBajo:3.20,zAlto:0.20,altura:1.05,peldanos:7};

function alturaEscaleraLateral(x,z){
  var e=ESCALERAS_LATERALES;
  if(Math.abs(Math.abs(x)-e.centroX)>e.ancho/2 || z<e.zAlto || z>e.zBajo) return null;
  var avance=(e.zBajo-z)/(e.zBajo-e.zAlto);
  var escalon=Math.max(0,Math.min(e.peldanos,Math.ceil(avance*e.peldanos)));
  return e.altura*escalon/e.peldanos;
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
var BORDE_PLATEA=dentro(PLAN,P.pisos[0].dentro);
var EXTERIOR_ANTEPALCO=dentro(PLAN,-2.0);
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
  return z>=3.2 && dentroDeContornoAbierto(EXTERIOR_ANTEPALCO,x,z) && !dentroDeContornoAbierto(BORDE_PLATEA,x,z);
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

FALLA.geo = {
  P: P,
  rake: rake,
  PLAN: PLAN,
  dentro: dentro,
  dentroDePlanta: dentroDePlanta,
  distAPlanta: distAPlanta,
  enPlatea: enPlatea,
  platea: {altura:rake(P.zc+P.Rz)+0.40},
  escalerasLaterales: ESCALERAS_LATERALES,
  alturaEscaleraLateral: alturaEscaleraLateral,
  // caja del suelo del escenario (ver geometria.js: escenario()) — la usa el modo paseo para pisar las tablas
  escenario: {altura:1.05, mitadX:9, zFondo:-17, zFrente:-0.7}
};
})();
