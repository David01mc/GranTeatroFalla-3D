// Ejecutar desde la raíz: node tests/dimensiones.cjs /ruta/three-r128.min.js
// Usa la misma geometría que el navegador, sin necesitar WebGL ni texturas.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
assert(process.argv[2], 'Indica la ruta al bundle de Three.js r128 usado por index.html');
const c={console,document:{addEventListener(){}},addEventListener(){}}; c.window=c; vm.createContext(c);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),c);
const T=c.THREE;
vm.runInContext(fs.readFileSync('js/parametros.js','utf8'),c);
c.FALLA.materiales={MAT:new Proxy({}, {get(o,k){return o[k]||(o[k]=new T.MeshLambertMaterial({side:T.DoubleSide}));}}),registrar(){}};
for(const f of ['primitivas','mobiliario','ornamento']) vm.runInContext(fs.readFileSync('js/geometria/'+f+'.js','utf8'),c);
let src=fs.readFileSync('js/geometria.js','utf8');
src=src.replace('FALLA.escena = { construir: construir };','FALLA.escena = { construir: construir }; FALLA.test={butacas,sitiosCentro,sitiosLateral,alturaMarco,puntoMarco};');
vm.runInContext(src,c);


const geo=c.FALLA.geo,P=geo.P;
const chairs=c.FALLA.test.butacas(),sites=c.FALLA.test.sitiosCentro().concat(c.FALLA.test.sitiosLateral(-1),c.FALLA.test.sitiosLateral(1));
let back=-Infinity;const v=new T.Vector3(),mat=new T.Matrix4();
chairs.traverse(o=>{if(!o.isInstancedMesh)return;for(let i=(P.patio.filas-1)*9;i<P.patio.filas*9;i++){o.getMatrixAt(i,mat);const p=o.geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(mat);back=Math.max(back,v.z);}}});
const front=geo.dentro(geo.PLAN,P.pisos[0].dentro)[36].z;

assert.equal(P.patio.filas,18);
assert.equal(new Set(sites.map(s=>s.z)).size,18);
assert(Math.abs(front-back-2.5)<0.005,'Separación real del respaldo al frente de plataforma');
assert(Math.abs(geo.PLAN[0].z)<1e-8,'La embocadura debe conservar z=0');
assert(Math.abs(P.Rx-14.318)<1e-8,'La anchura debe conservarse');
assert.equal(geo.platea.altura,1.222);
assert.deepEqual(Array.from(P.pisos,p=>p.y),[0,4.35,7.10,9.90]);
for(const s of sites){
  assert(sites.some(t=>Math.abs(t.x+s.x)<1e-8 && t.z===s.z),'Distribución simétrica');
  for(const dx of [-0.3,0,0.3])for(const dz of [-0.25,0.37]){
    assert(!geo.enPlatea(s.x+dx,s.z+dz),'Butaca solapada con plataforma lateral');
  }
}
for(const sign of [-1,1]){
  const r=geo.rampasTraseras;
  assert(Math.abs(geo.alturaRampaTrasera(sign*r.xInicio,r.zInicio)-geo.rake(r.zInicio))<1e-8);
  assert(Math.abs(geo.alturaRampaTrasera(sign*r.xFin,r.zFin)-geo.platea.altura)<1e-8);
}
c.document.createElement=()=>({getContext:()=>new Proxy({createRadialGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]||(()=>{})})});
const scene=new T.Scene(),stats=c.FALLA.escena.construir(scene);
assert.equal(stats.nFilas,18);scene.updateMatrixWorld(true);
// La embocadura debe conservar sus relieves visibles y cerrar contra
// el techo y los tres palcos, no quedarse como cintas detrás del dintel.
const marco=scene.getObjectByName('Marco del escenario');
assert(marco,'Marco del escenario presente');
const seccion=marco.userData.seccionMarco;
for(let i=0;i<5;i++){
  const abajo=seccion[2*i],arriba=seccion[2*i+1],huella=seccion[2*i+2];
  assert(Math.abs(arriba.y-abajo.y-(i===4?0.4:0.2))<1e-8);
  assert(huella.z>arriba.z,'Los escalones avanzan hacia el patio');
  const r=new T.Raycaster(new T.Vector3(0,P.marcoEscenario.clave+(abajo.y+arriba.y)/2,5),new T.Vector3(0,0,-1));
  assert.equal(r.intersectObject(marco,true)[0].object.name,'Tabica inferior '+(i+1),
    'El dintel antiguo no debe ocultar las tabicas');
}
const ultima=seccion[seccion.length-1];
const puntoFranja=new T.Vector3(0,P.marcoEscenario.clave+1.2+P.marcoEscenario.altoFranja*0.8,
  marco.position.z+P.marcoEscenario.zInicio+5*P.marcoEscenario.avanceEscalon+P.marcoEscenario.avanceFranja*0.8);
const ojoMarco=new T.Vector3(0,5,18);
const vistaMarco=new T.Raycaster(ojoMarco,puntoFranja.clone().sub(ojoMarco).normalize());
assert.equal(vistaMarco.intersectObjects(scene.children,true)[0].object.name,'Franja burdeos inclinada',
  'El techo de la caja escénica no debe atravesar el marco visto desde el patio');
assert(Math.abs(P.altura-14.9)<1e-8,'Techo a 14,90: elevado para el mural y rebajado 2 m');
assert(Math.abs(marco.userData.alturaMarco-12.65)<1e-8,'Marco más bajo, independiente del techo');
assert(Math.abs(P.altura-marco.userData.alturaMarco-2.25)<1e-8,'Pared visible por encima del centro del marco');
assert(Math.abs(ultima.z+marco.position.z-1.8)<1e-8,'La pared del mural coincide con el final del palco frontal');
const posicionMarco=c.FALLA.test.puntoMarco(ultima,0.25);
P.altura+=1;
assert(Math.abs(c.FALLA.test.alturaMarco()-12.65)<1e-8,'Elevar el techo no estira el arco');
assert.deepEqual(c.FALLA.test.puntoMarco(ultima,0.25),posicionMarco,'Los apoyos tampoco dependen del techo');
P.altura-=1;
const vistaTecho=new T.Raycaster(new T.Vector3(0,13,10),new T.Vector3(0,1,0));
assert(Math.abs(vistaTecho.intersectObjects(scene.children,true)[0].point.y-14.9)<1e-5,'Techo real a la nueva cota');
const bordeTecho=marco.getObjectByName('Huella superior 2').geometry.attributes.position;
const mural=marco.getObjectByName('Mural sobre el escenario');
const cierreSuperior=mural.geometry.attributes.position;
const uvMural=mural.geometry.attributes.uv;
const muestrasPerfil=bordeTecho.count/97;
// Dintel recto en el centro y hombros curvos: todas las molduras deben
// compartir la transición tangente sin perder sus perfiles redondeados.
for(let j=0;j<muestrasPerfil;j++){
  const central=48*muestrasPerfil+j;
  for(const fila of [42,46,50,54]){
    assert(Math.abs(bordeTecho.getY(fila*muestrasPerfil+j)-bordeTecho.getY(central))<1e-5);
    assert(Math.abs(bordeTecho.getZ(fila*muestrasPerfil+j)-bordeTecho.getZ(central))<1e-5);
  }
  assert(bordeTecho.getY(8*muestrasPerfil+j)<bordeTecho.getY(24*muestrasPerfil+j),
    'El hombro asciende antes de llegar al tramo recto');
}
const telon=scene.getObjectByName('Telón de boca');
const tela=telon.geometry.attributes.position;
let zTelaMin=Infinity,zTelaMax=-Infinity;
for(let i=0;i<tela.count;i++){zTelaMin=Math.min(zTelaMin,tela.getZ(i));zTelaMax=Math.max(zTelaMax,tela.getZ(i));}
assert(Math.abs((zTelaMin+zTelaMax)/2-marco.userData.apoyosMarco.interior.z)<0.015,
  'El telón acompaña el plano de las columnas');
for(const signo of [-1,1]){
  const vistaTela=new T.Raycaster(new T.Vector3(signo*7.55,3,5),new T.Vector3(0,0,-1));
  const visible=vistaTela.intersectObjects(scene.children,true)[0];
  assert(visible && (visible.object===telon||visible.object.parent===telon),
    'No debe quedar un paño burdeos entre la columna estrecha y el telón');
}
const zAntes=telon.position.z;
c.FALLA.telon.alternar();c.FALLA.telon.actualizar(10);
assert(telon.scale.y<0.5 && telon.position.z===zAntes,'El telón avanzado se recoge verticalmente');
c.FALLA.telon.alternar();c.FALLA.telon.actualizar(10);
assert(Math.abs(telon.scale.y-1)<1e-8,'El telón vuelve a cerrar');
for(let i=0;i<97;i++){
  const j=(i+1)*muestrasPerfil-1;
  assert(Math.abs(cierreSuperior.getY(2*i+1)-P.altura)<1e-5,'Cierre superior hasta el techo');
  assert(Math.abs(uvMural.getY(2*i)-(1-(P.altura-cierreSuperior.getY(2*i))/marco.userData.altoPintura))<1e-6,
    'El mural se recorta con el arco sin deformar la pintura');
  for(const eje of ['X','Y','Z'])assert(Math.abs(cierreSuperior['get'+eje](2*i)-bordeTecho['get'+eje](j))<1e-5,
    'Cierre continuo sobre la última moldura');
}
const vistaMural=new T.Raycaster(new T.Vector3(0,14.5,10),new T.Vector3(0,0,-1));
assert.equal(vistaMural.intersectObjects(scene.children,true)[0].object,mural,'El mural es visible desde la sala');
const apoyos=marco.userData.apoyosMarco;
for(const m of marco.children.filter(m=>/^Tabica inferior|^Huella inferior/.test(m.name))){
  const indices=new Set(Array.from(m.geometry.index.array).filter(i=>i<muestrasPerfil));
  for(const i of indices){
    const p=m.geometry.attributes.position;
    assert(Math.abs(p.getY(i)-P.pisos[3].y)<1e-5,'Las cinco molduras nacen a la cota del capitel');
    const a=apoyos.interior,b=apoyos.exterior;
    assert(Math.abs((p.getX(i)-a.x)*(b.z-a.z)-(p.getZ(i)-a.z)*(b.x-a.x))<1e-5,
      'Apoyo sobre la arista exterior del capitel');
  }
}
for(const m of marco.children.filter(m=>/Franja burdeos|^Tabica superior|^Huella superior/.test(m.name))){
  for(const i of new Set(Array.from(m.geometry.index.array).filter(i=>i<muestrasPerfil))){
    const p=m.geometry.attributes.position,z=p.getZ(i)+marco.position.z;
    assert(Math.abs(p.getY(i)-P.pisos[3].y)<1e-5 && p.getZ(i)>=apoyos.exterior.z-1e-5,
      'La franja y los dos remates continúan sobre el palco superior');
    const t=(z-geo.frenteEscenico.zInicioPalcos)/(1.8-geo.frenteEscenico.zInicioPalcos);
    const cornisa=9+0.12-geo.accesoPalcoFrontal.curvaPalco*Math.sin(Math.PI*t);
    assert(Math.abs(p.getX(i)-cornisa)<0.075,'Apoyo dentro del grosor de la cornisa curva del palco');
  }
}
// La antigua esquina (y=0,20, z=inicio) ya no pertenece a la piel:
// debe haber muestras intermedias que redondeen su sección.
let redondeo=0;
for(let i=0;i<bordeTecho.count;i++)if(Math.abs(bordeTecho.getX(i))<1e-5){
  const y=bordeTecho.getY(i)-P.marcoEscenario.clave,z=bordeTecho.getZ(i)-P.marcoEscenario.zInicio;
  assert(!(Math.abs(y-0.2)<1e-5 && Math.abs(z)<1e-5),'Sin pico cuadrado original');
  if(y>0.14 && y<0.2 && z>0 && z<0.065)redondeo++;
}
assert(redondeo>=6,'Sección curva con suficientes muestras');
for(const s of [-1,1]){
  for(const suelo of [geo.accesoPalcoFrontal.altura,P.pisos[1].y,P.pisos[2].y]){
    const interiorPalco=new T.Raycaster(new T.Vector3(s*9.1,suelo+1.9,-0.4),new T.Vector3(s,0,0),0,2.2);
    assert.equal(interiorPalco.intersectObjects(scene.children,true).length,0,
      'La pared de la caja escénica no debe invadir el interior de los palcos frontales');
  }
  const pilastra=new T.Box3().setFromObject(marco.getObjectByName('Pilastra de embocadura '+s));
  assert.equal(marco.getObjectByName('Pilastra de embocadura '+s).userData.anchoFuste,1.25);
  const encuentro=new T.Box3().setFromObject(marco.getObjectByName('Encuentro pilastra palco '+s));
  assert(Math.abs(pilastra.max.y-P.pisos[3].y)<1e-5,'Capitel a la altura del tercer palco');
  assert(pilastra.intersectsBox(encuentro),'Pilastra conectada al retorno del palco');
  assert(encuentro.min.z<geo.frenteEscenico.zInicioPalcos && encuentro.max.z>geo.frenteEscenico.zInicioPalcos);
}
const ray=new T.Raycaster(new T.Vector3(0,1,back+0.02),new T.Vector3(0,0,1),0,4);
const hit=ray.intersectObjects(scene.children,true)[0];
assert(hit && Math.abs(hit.point.z-front)<0.001,'El frente construido coincide con la cota calculada');
scene.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
console.log(`OK: 18 filas, ${sites.length} butacas de patio, paso real ${(front-back).toFixed(3)} m, rampas, marco escalonado y encuentros válidos.`);
