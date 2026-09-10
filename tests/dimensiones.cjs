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
src=src.replace('FALLA.escena = { construir: construir };','FALLA.escena = { construir: construir }; FALLA.test={butacas,sitiosCentro,sitiosLateral};');
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
const ray=new T.Raycaster(new T.Vector3(0,1,back+0.02),new T.Vector3(0,0,1),0,4);
const hit=ray.intersectObjects(scene.children,true)[0];
assert(hit && Math.abs(hit.point.z-front)<0.001,'El frente construido coincide con la cota calculada');
scene.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});
console.log(`OK: 18 filas, ${sites.length} butacas de patio, paso real ${(front-back).toFixed(3)} m, rampas y geometría válidas.`);
