(function(){
'use strict';
var FALLA = window.FALLA;

var escena, camara, render, reloj;

function iniciar(){
  render=new THREE.WebGLRenderer({antialias:true, logarithmicDepthBuffer:true});
  render.setPixelRatio(Math.min(devicePixelRatio,2));
  render.setSize(innerWidth, innerHeight);
  document.body.appendChild(render.domElement);

  camara=new THREE.PerspectiveCamera(52, innerWidth/innerHeight, 0.1, 100);
  escena=new THREE.Scene();
  var stats=FALLA.escena.construir(escena);

  FALLA.orbit.inicializar(camara, render.domElement);

  addEventListener('resize', function(){
    camara.aspect=innerWidth/innerHeight; camara.updateProjectionMatrix();
    render.setSize(innerWidth, innerHeight);
  });

  document.getElementById('datos').textContent =
    stats.nButacas + ' butacas en ' + stats.nFilas + ' filas · planta en herradura de ' +
    (FALLA.geo.P.R*2).toFixed(1) + ' m · generado por código, sin malla importada';

  var botonesVista=document.querySelectorAll('[data-vista]');
  botonesVista.forEach(function(b){
    b.addEventListener('click', function(){
      botonesVista.forEach(function(o){o.removeAttribute('aria-pressed');});
      b.setAttribute('aria-pressed','true');
      FALLA.orbit.irA(b.dataset.vista);
    });
  });
  botonesVista[0].setAttribute('aria-pressed','true');

  var btBoceto=document.getElementById('boceto');
  btBoceto.addEventListener('click', function(){
    var enBoceto = btBoceto.getAttribute('aria-pressed')!=='true';
    btBoceto.setAttribute('aria-pressed', enBoceto?'true':'false');
    FALLA.materiales.lista.forEach(function(m){ m.wireframe=enBoceto; m.needsUpdate=true; });
    escena.background=new THREE.Color(enBoceto?0x0a0f14:0x0d0608);
    escena.fog.color.set(enBoceto?0x0a0f14:0x0d0608);
  });

  var btPaseo=document.getElementById('paseo');
  function alSalirDePaseo(){
    var mira=FALLA.paseo.vectorMira(3);
    FALLA.orbit.establecerDesde(
      [camara.position.x, camara.position.y, camara.position.z], mira);
    FALLA.orbit.reanudar();
    btPaseo.setAttribute('aria-pressed','false');
    botonesVista.forEach(function(o){o.disabled=false;});
  }
  btPaseo.addEventListener('click', function(){
    if(FALLA.paseo.activo){
      FALLA.paseo.salir(); // dispara alSalirDePaseo vía el callback de entrar()
    } else {
      FALLA.orbit.pausar();
      FALLA.paseo.entrar(camara, render.domElement, alSalirDePaseo);
      btPaseo.setAttribute('aria-pressed','true');
      btPaseo.blur(); // si el botón se queda con el foco, Espacio lo "pulsaría" en vez de saltar
      botonesVista.forEach(function(o){o.disabled=true;});
    }
  });

  var btTelon=document.getElementById('telon');
  btTelon.addEventListener('click', function(){
    var cerrado=FALLA.telon.alternar();
    btTelon.setAttribute('aria-pressed', cerrado?'true':'false');
    btTelon.textContent = cerrado ? 'Abrir telón' : 'Cerrar telón';
  });

  reloj=new THREE.Clock();
  animar();

  var c=document.getElementById('carga');
  c.style.opacity=0; setTimeout(function(){c.remove();},700);
}

function animar(){
  requestAnimationFrame(animar);
  var dt=Math.min(0.1, reloj.getDelta());
  if(FALLA.paseo.activo) FALLA.paseo.actualizar(dt);
  else FALLA.orbit.actualizar();
  FALLA.telon.actualizar(dt);
  render.render(escena,camara);
}

if(window.THREE) iniciar();
else addEventListener('load', iniciar);
})();
