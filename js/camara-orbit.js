(function(){
'use strict';
var FALLA = window.FALLA;
var geo = FALLA.geo;

var camara=null;
var pausado=false;
var vista={radio:16, phi:1.35, theta:0, objetivo:new THREE.Vector3()};
var destino=null, t0=0, dur=1500, desde=null;

var VISTAS={
  butaca:    {pos:[0.4,1.78+geo.rake(10.4),10.4], mira:[0,4.6,-1]},
  escenario: {pos:[0,2.9,-2.2],             mira:[0,6.0,15]},
  palco:     {pos:[7.4,7.6,10.5],           mira:[-1,4.5,1]},
  paraiso:   {pos:[0,11.0,21.5],            mira:[0,4.0,-1]},
  planta:    {pos:[0,40,14.2],              mira:[0,0,13.4]}
};

function suave(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

function aEsfericas(pos, mira){
  var o=new THREE.Vector3().fromArray(mira);
  var v=new THREE.Vector3().fromArray(pos).sub(o);
  var r=v.length();
  return {radio:r, phi:Math.acos(Math.max(-1,Math.min(1,v.y/r))), theta:Math.atan2(v.x,v.z), objetivo:o};
}

function irA(nombre){
  var v=VISTAS[nombre]; if(!v) return;
  desde={radio:vista.radio, phi:vista.phi, theta:vista.theta, objetivo:vista.objetivo.clone()};
  destino=aEsfericas(v.pos, v.mira);
  var dt=destino.theta-desde.theta;
  while(dt>Math.PI) destino.theta-=2*Math.PI;
  while(dt<-Math.PI) destino.theta+=2*Math.PI;
  t0=performance.now();
}

/* Recoloca la órbita a partir de una posición/mira arbitrarias (p.ej. al
   salir del modo paseo, para retomar la órbita justo donde se dejó de andar). */
function establecerDesde(posArr, miraArr){
  var s=aEsfericas(posArr, miraArr);
  vista.radio=s.radio; vista.phi=s.phi; vista.theta=s.theta; vista.objetivo.copy(s.objetivo);
  destino=null;
}

function aplicarCamara(){
  var r=vista.radio, phi=Math.max(0.08, Math.min(Math.PI-0.08, vista.phi));
  camara.position.set(
    vista.objetivo.x + r*Math.sin(phi)*Math.sin(vista.theta),
    vista.objetivo.y + r*Math.cos(phi),
    vista.objetivo.z + r*Math.sin(phi)*Math.cos(vista.theta)
  );
  camara.lookAt(vista.objetivo);
}

function controles(el){
  var arrastrando=false, px=0, py=0, pinza=0;
  function abajo(x,y){ if(pausado) return; arrastrando=true; px=x; py=y; destino=null; }
  function mover(x,y){
    if(pausado || !arrastrando) return;
    vista.theta -= (x-px)*0.005;
    vista.phi   -= (y-py)*0.005;
    vista.phi=Math.max(0.12, Math.min(Math.PI-0.12, vista.phi));
    px=x; py=y;
  }
  el.addEventListener('mousedown', function(e){abajo(e.clientX,e.clientY);});
  window.addEventListener('mousemove', function(e){mover(e.clientX,e.clientY);});
  window.addEventListener('mouseup', function(){arrastrando=false;});
  el.addEventListener('wheel', function(e){
    if(pausado) return;
    e.preventDefault(); destino=null;
    vista.radio=Math.max(1.6, Math.min(60, vista.radio*(1+e.deltaY*0.0012)));
  }, {passive:false});
  el.addEventListener('touchstart', function(e){
    if(pausado) return;
    if(e.touches.length===1) abajo(e.touches[0].clientX,e.touches[0].clientY);
    else if(e.touches.length===2) pinza=Math.hypot(
      e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
  }, {passive:true});
  el.addEventListener('touchmove', function(e){
    if(pausado) return;
    if(e.touches.length===1) mover(e.touches[0].clientX,e.touches[0].clientY);
    else if(e.touches.length===2){
      var d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
      if(pinza) vista.radio=Math.max(1.6, Math.min(60, vista.radio*pinza/d));
      pinza=d; destino=null;
    }
  }, {passive:true});
  el.addEventListener('touchend', function(){arrastrando=false; pinza=0;});
}

function actualizar(){
  if(destino){
    var t=Math.min(1,(performance.now()-t0)/dur), e=suave(t);
    vista.radio = desde.radio + (destino.radio-desde.radio)*e;
    vista.phi   = desde.phi   + (destino.phi-desde.phi)*e;
    vista.theta = desde.theta + (destino.theta-desde.theta)*e;
    vista.objetivo.lerpVectors(desde.objetivo, destino.objetivo, e);
    if(t>=1) destino=null;
  }
  aplicarCamara();
}

function inicializar(camaraRef, elControl){
  camara = camaraRef;
  var v=VISTAS.butaca, s=aEsfericas(v.pos,v.mira);
  vista.radio=s.radio; vista.phi=s.phi; vista.theta=s.theta; vista.objetivo.copy(s.objetivo);
  controles(elControl);
}

function pausar(){ pausado=true; destino=null; }
function reanudar(){ pausado=false; }

FALLA.orbit = {
  VISTAS: VISTAS,
  vista: vista,
  inicializar: inicializar,
  actualizar: actualizar,
  irA: irA,
  establecerDesde: establecerDesde,
  pausar: pausar,
  reanudar: reanudar
};
})();
