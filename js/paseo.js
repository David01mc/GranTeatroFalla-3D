(function(){
'use strict';
var FALLA = window.FALLA;
var geo = FALLA.geo;

/* ---------------- MODO PASEO ---------------------------------------
   Caminar en primera persona sobre el suelo de la sala: WASD relativo
   a hacia donde mira la cámara (el pitch no afecta al movimiento),
   ratón con pointer-lock para mirar, salto simple con gravedad medida
   desde el propio terreno (así el salto sigue la pendiente del patio
   sin necesitar una física de mundo completa).
-------------------------------------------------------------------*/
var VELOCIDAD = 3.5;       // m/s
var ALTURA_OJO = 1.7;      // m
var GRAVEDAD = 18;         // m/s^2 — arco de salto corto, a juego con la escala de la sala
var IMPULSO_SALTO = 7.0;   // m/s — permite alcanzar la platea de 1.22 m
var MARGEN_MURO = 0.35;    // separación mínima al muro exterior del patio
var MARGEN_ATERRIZAJE = 0.14; // tolerancia de los pies al coronar una plataforma

var activo=false;
var camara=null, elemento=null;
var yaw=0, pitch=0;
var teclas={};
var x=0, z=0;               // posición horizontal del jugador
var alturaSalto=0, velocidadSalto=0;
var alSalirCb=null;
var vDir=new THREE.Vector3();

/* Altura del suelo transitable en (x,z), o null si es zona no navegable
   (fuera de la planta, o parte maciza del muro de la embocadura). */
function terrenoAltura(x,z){
  var esc=geo.escenario;
  if(Math.abs(x) < esc.mitadX && z <= esc.zFrente && z >= esc.zFondo) return esc.altura;

  var alturaEscalera=geo.alturaEscaleraLateral(x,z);
  if(alturaEscalera!==null) return alturaEscalera;

  // El muro de la embocadura solo tiene paso entre sus dos jambas.
  if(z > -0.6 && z < 0.35 && Math.abs(x) > geo.P.arcoA) return null;

  // Suelo horizontal elevado de la platea. Por ahora solo colisiona la
  // plataforma: sus sillas y demás mobiliario se mantienen atravesables.
  if(geo.enPlatea(x,z)) return geo.platea.altura;

  if(geo.dentroDePlanta(x,z) && geo.distAPlanta(x,z) > MARGEN_MURO) return geo.rake(z);

  return null;
}

/* De pie solo se puede caminar por los pasillos: una butaca bloquea el paso
   igual que un muro. En el aire (saltando) las butacas no cuentan, así que
   un salto sirve para cruzar por encima de una fila. */
function posicionValida(px,pz){
  if(terrenoAltura(px,pz)===null) return false;
  if(FALLA.puertas && FALLA.puertas.bloquea(px,pz)) return false;
  if(alturaSalto<=0.02 && !geo.enPlatea(px,pz) && geo.enBloqueAsientos(px,pz)) return false;
  return true;
}

/* Intenta trasladar al jugador conservando la altura absoluta de sus
   pies. Una plataforma alta solo se puede cruzar cuando el salto ya ha
   alcanzado su cota; al coronarla, el jugador aterriza sobre ella en vez
   de atravesarla o ser teletransportado hacia arriba. */
function intentarPosicion(nx,nz){
  if(!posicionValida(nx,nz)) return false;
  var sueloActual=terrenoAltura(x,z), sueloNuevo=terrenoAltura(nx,nz);
  if(sueloActual===null || sueloNuevo===null) return false;
  var alturaPies=sueloActual+alturaSalto;
  if(sueloNuevo>sueloActual+0.25 && alturaPies+MARGEN_ATERRIZAJE<sueloNuevo) return false;
  x=nx; z=nz;
  alturaSalto=Math.max(0,alturaPies-sueloNuevo);
  if(alturaSalto===0 && velocidadSalto<0) velocidadSalto=0;
  return true;
}

/* Resuelve el movimiento eje a eje, para deslizar sobre los obstáculos
   en vez de quedarse bloqueado en seco al tocarlos. */
function moverA(nx, nz){
  if(intentarPosicion(nx,nz)) return;
  if(intentarPosicion(nx,z)) return;
  intentarPosicion(x,nz);
}

function saltar(){
  if(alturaSalto<=0 && velocidadSalto===0) velocidadSalto=IMPULSO_SALTO;
}

function alMoverRaton(e){
  if(!activo) return;
  yaw   -= e.movementX*0.0022;
  pitch -= e.movementY*0.0022;
  pitch = Math.max(-1.4, Math.min(1.4, pitch));
}
var TECLAS_USADAS = {KeyW:1, KeyA:1, KeyS:1, KeyD:1, KeyE:1, Space:1};
function alTeclaAbajo(e){
  if(!activo || !TECLAS_USADAS[e.code]) return;
  e.preventDefault(); // evita que Espacio/flechas activen botones o desplacen la página
  teclas[e.code]=true;
  if(e.code==='Space') saltar();
  if(e.code==='KeyE' && !e.repeat && FALLA.puertas) FALLA.puertas.alternarCercana(x,z);
}
function alTeclaArriba(e){ teclas[e.code]=false; }
function alCambioBloqueo(){
  if(activo && document.pointerLockElement!==elemento) salir();
}

/* Vector de mirada proyectado en el plano horizontal (ignora el pitch,
   igual que el movimiento). */
function mirada(){
  return {x:-Math.sin(yaw), z:-Math.cos(yaw)};
}

function entrar(camaraRef, el, cb){
  camara=camaraRef; elemento=el; alSalirCb=cb||null;
  x=camara.position.x; z=camara.position.z;

  camara.getWorldDirection(vDir);
  yaw = Math.atan2(-vDir.x, -vDir.z);
  pitch = Math.max(-1.4, Math.min(1.4, Math.asin(Math.max(-1, Math.min(1, vDir.y)))));

  var suelo = terrenoAltura(x,z);
  if(suelo===null) suelo = geo.rake(z);
  alturaSalto = Math.max(0, camara.position.y - suelo - ALTURA_OJO);
  velocidadSalto = 0;
  teclas = {};

  activo=true;
  var solicitud=el.requestPointerLock();
  if(solicitud && solicitud.catch) solicitud.catch(function(){}); // el navegador puede denegarlo; el modo paseo sigue funcionando igual con teclado
}

function salir(){
  if(!activo) return;
  activo=false;
  var aviso=document.getElementById('interaccion'); if(aviso) aviso.hidden=true;
  if(document.pointerLockElement===elemento) document.exitPointerLock();
  var cb=alSalirCb; alSalirCb=null;
  if(cb) cb();
}

/* Punto a `distancia` metros por delante del jugador — se usa para que la
   cámara orbital, al recuperar el control, apunte hacia donde se miraba. */
function vectorMira(distancia){
  var f=mirada();
  return [camara.position.x+f.x*distancia, camara.position.y, camara.position.z+f.z*distancia];
}

function actualizar(dt){
  if(!activo) return;

  var f=mirada(), r={x:-f.z, z:f.x};
  var dx=0, dz=0;
  if(teclas.KeyW){ dx+=f.x; dz+=f.z; }
  if(teclas.KeyS){ dx-=f.x; dz-=f.z; }
  if(teclas.KeyD){ dx+=r.x; dz+=r.z; }
  if(teclas.KeyA){ dx-=r.x; dz-=r.z; }
  var L=Math.hypot(dx,dz);
  if(L>0) moverA(x+(dx/L)*VELOCIDAD*dt, z+(dz/L)*VELOCIDAD*dt);

  velocidadSalto -= GRAVEDAD*dt;
  alturaSalto += velocidadSalto*dt;
  if(alturaSalto<=0){ alturaSalto=0; velocidadSalto=0; }

  var suelo = terrenoAltura(x,z);
  if(suelo===null) suelo = geo.rake(z); // colchón de seguridad, no debería alcanzarse

  camara.position.set(x, suelo+ALTURA_OJO+alturaSalto, z);
  camara.rotation.set(pitch, yaw, 0, 'YXZ');

  var aviso=document.getElementById('interaccion');
  if(aviso){
    aviso.hidden=!(FALLA.puertas && FALLA.puertas.cercana(x,z,1.75));
  }
}

document.addEventListener('pointerlockchange', alCambioBloqueo);
document.addEventListener('mousemove', alMoverRaton);
document.addEventListener('keydown', alTeclaAbajo);
document.addEventListener('keyup', alTeclaArriba);

FALLA.paseo = {
  entrar: entrar,
  salir: salir,
  actualizar: actualizar,
  vectorMira: vectorMira,
  get activo(){ return activo; }
};
})();
