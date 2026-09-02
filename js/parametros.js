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
  jamba: 10.6,       // media anchura de la sala en la embocadura
  zc: 12.0,          // centro del arco de la herradura (profundidad)
  R: 13.4,           // radio de la herradura
  tmax: 148*Math.PI/180,
  rake: 0.045,       // pendiente del patio
  zRake: 2.0,
  altura: 13.4,      // hasta el techo de Abárzuza
  pisos: [           // y del piso, y del antepecho, retranqueo, nº de palcos
    {y:0.00, alto:1.15, dentro:1.60, palcos:0,  nombre:'platea'},
    {y:3.60, alto:1.15, dentro:2.10, palcos:22, nombre:'principal'},
    {y:6.70, alto:1.10, dentro:2.70, palcos:20, nombre:'segundo'},
    {y:9.60, alto:1.05, dentro:3.30, palcos:0,  nombre:'paraíso'}
  ],
  arcoR: 8.4, arcoA: 7.5, arcoYc: 8.9   // embocadura: arco de herradura
};

function rake(z){ return P.rake * Math.max(0, z - P.zRake); }

/* Planta de la sala: abierta por la embocadura, cerrada por detrás. */
function planta(){
  var pts=[], i, s, t;
  var p0={x:P.R*Math.sin(P.tmax), z:P.zc+P.R*Math.cos(P.tmax)};
  for(i=0;i<8;i++){ s=i/8; pts.push({x:P.jamba+(p0.x-P.jamba)*s, z:p0.z*s}); }
  for(i=0;i<=72;i++){ t=P.tmax-2*P.tmax*i/72; pts.push({x:P.R*Math.sin(t), z:P.zc+P.R*Math.cos(t)}); }
  for(i=1;i<=8;i++){ s=i/8; pts.push({x:-p0.x+(-P.jamba+p0.x)*s, z:p0.z*(1-s)}); }
  return pts;
}
var PLAN = planta();

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
  // caja del suelo del escenario (ver geometria.js: escenario()) — la usa el modo paseo para pisar las tablas
  escenario: {altura:1.05, mitadX:9, zFondo:-16, zFrente:0.3}
};
})();
