/* Repris de sky-pilot/js/main.js (F-35B et PV-40), adapté en module (three r165). */
export function createAircraftModels(THREE, RK){
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
function buildF35(){
const planeG=new THREE.Group();
let flameMesh,gearGroup,nozG,chuteG,navMats=[];
let liftFanG,liftFanRotor,liftFanDoors=[],cockpitScreens=[],cockpitScreenTime=0;
function buildPlane(){
  // Chasseur furtif STOVL fictif, inspiré des proportions d'un appareil de 5e génération (nez vers -Z).
  const M=RK.M,A=(geo,mat,x,y,z,par,rx,ry,rz)=>{const m=RK.add(par||planeG,geo,mat,x,y,z,rx,ry,rz);m.castShadow=false;return m};
  /* revêtement furtif : gris mat avec lignes de panneaux et joints en dents de scie */
  const skinTex=RK.canvasTex(1024,1024,(g,w,h)=>{
    g.fillStyle='#7a838a';g.fillRect(0,0,w,h);const r=RK.rng(4);
    for(let i=0;i<220;i++){const x=r()*w,y=r()*h,pw=30+r()*160,ph=30+r()*160;g.fillStyle='rgba('+(r()<.5?'255,255,255':'0,0,0')+','+(.02+r()*.035)+')';g.fillRect(x,y,pw,ph)}
    g.strokeStyle='rgba(30,36,40,.35)';g.lineWidth=1.4;
    for(let i=0;i<70;i++){const x=r()*w,y=r()*h,pw=50+r()*220,ph=40+r()*200;g.strokeRect(x,y,pw,ph)}
    g.strokeStyle='rgba(150,158,164,.5)';g.lineWidth=5;
    for(let i=0;i<14;i++){const x0=r()*w,y0=r()*h;g.beginPath();g.moveTo(x0,y0);for(let k=0;k<8;k++)g.lineTo(x0+k*18,y0+(k%2?14:0));g.stroke()}
    g.fillStyle='rgba(20,24,28,.5)';for(let i=0;i<500;i++)g.fillRect(r()*w,r()*h,1.6,1.6);
  },{repeat:[1,1]});
  const paint=M.std(0x9aa1a6,.6,.2,{map:skinTex,envMapIntensity:.55});
  const panel=M.std(0x5d666d,.6,.3,{envMapIntensity:.7});
  const dark=M.std(0x1a2026,.45,.5);
  const rubber=M.rubber();
  const glass=new THREE.MeshPhysicalMaterial({color:0xc2a35a,metalness:.55,roughness:.06,clearcoat:1,clearcoatRoughness:.03,transparent:true,opacity:.55,envMap:RK.ENV,envMapIntensity:1.6,side:THREE.DoubleSide,depthWrite:false});
  const trim=M.alu(0x9aa4ab,{roughness:.34});
  const heat=M.std(0xffffff,.42,.9,{map:RK.canvasTex(256,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#6f6a63');gr.addColorStop(.35,'#7b6a55');gr.addColorStop(.6,'#4c5470');gr.addColorStop(1,'#2a2a2e');g.fillStyle=gr;g.fillRect(0,0,w,h)})});
  const glowRed=new THREE.MeshBasicMaterial({color:0xff3030}),glowGreen=new THREE.MeshBasicMaterial({color:0x32ff83}),glowWhite=new THREE.MeshBasicMaterial({color:0xffffff}),formation=new THREE.MeshBasicMaterial({color:0x9dff6a,transparent:true,opacity:.55});
  /* --- fuselage : sections à arêtes (chines) pointues, dos plat, large corps porteur --- */
  const fus=RK.loft([
    {z:-9.35,w:.05,t:.05,b:.05,y:.02,n:1.6},{z:-8.8,w:.3,t:.2,b:.18,y:.02,n:1.55},{z:-7.8,w:.56,t:.36,b:.3,y:.02,n:1.6},
    {z:-6.6,w:.8,t:.52,b:.44,y:0,n:1.7},{z:-5.2,w:.98,t:.66,b:.56,y:0,n:1.85},{z:-3.6,w:1.1,t:.74,b:.66,y:0,n:2},
    {z:-2.0,w:1.16,t:.8,b:.74,y:0,n:2.2},{z:-.4,w:1.24,t:.82,b:.8,y:0,n:2.5},{z:1.5,w:1.3,t:.8,b:.78,y:0,n:2.7},
    {z:3.4,w:1.2,t:.72,b:.72,y:0,n:2.6},{z:4.7,w:.94,t:.64,b:.64,y:0,n:2.4},{z:5.6,w:.66,t:.58,b:.58,y:-.02,n:2.2}
  ],{sides:56,sub:4,cap:false});
  A(fus,paint,0,0,0);
  /* entrées d'air latérales (DSI) avec bosse de compression et conduit sombre */
  for(const s of[-1,1]){
    const inl=RK.loft([{z:-2.55,x:s*1.08,w:.36,t:.4,b:.34,y:-.04,n:2.6},{z:-1.9,x:s*1.13,w:.44,t:.46,b:.4,y:-.04,n:2.8},{z:-.6,x:s*1.08,w:.44,t:.46,b:.42,y:-.05,n:2.8},{z:1.2,x:s*.98,w:.38,t:.38,b:.38,y:-.06,n:2.6}],{sides:32,sub:4,cap:false});
    A(inl,paint,0,0,0);
    A(RK.loft([{z:-2.5,x:s*1.08,w:.32,t:.35,b:.3,y:-.04,n:2.6},{z:-1.2,x:s*1.0,w:.24,t:.26,b:.24,y:-.04,n:2.4}],{sides:28,sub:2}),dark,0,0,0);
    const bump=A(new THREE.SphereGeometry(.5,24,14),paint,s*.92,.08,-2.95);bump.scale.set(.32,.55,1.25);
    A(RK.tube([[s*1.42,-.04,-2.56],[s*1.1,.39,-2.6],[s*.78,-.04,-2.52],[s*1.1,-.4,-2.5],[s*1.42,-.04,-2.56]],.035,{closed:true,seg:40,radial:6}),trim,0,0,0);
  }
  /* capteur EOTS sous le nez et antennes */
  A(new THREE.OctahedronGeometry(.17,0),M.glass(0x33281a,{opacity:.85}),0,-.42,-6.9).scale.set(1,.6,1.6);
  for(const z of[-5.5,.8])A(RK.rbox(.05,.18,.32,.02,1),panel,0,-.82,z,null,.35,0,0);
  /* verrière sans arceau, teinte dorée, avec le pilote visible au travers */
  const can=RK.loft([{z:-5.05,w:.05,t:.02,b:.02,y:.66},{z:-4.6,w:.42,t:.3,b:.1,y:.66,n:2.1},{z:-3.6,w:.56,t:.55,b:.1,y:.66,n:2.2},{z:-2.6,w:.55,t:.53,b:.1,y:.66,n:2.2},{z:-1.85,w:.42,t:.3,b:.1,y:.66,n:2.1},{z:-1.5,w:.2,t:.1,b:.05,y:.66}],{sides:40,sub:5});
  A(can,glass,0,.02,0).renderOrder=2;
  A(RK.tube([[-.55,.78,-2.45],[-.4,1.08,-2.45],[0,1.17,-2.45],[.4,1.08,-2.45],[.55,.78,-2.45]],.03,{seg:30,radial:8}),panel,0,0,0);
  A(RK.loft([{z:-1.9,w:.3,t:.12,b:.02,y:.8},{z:-1.0,w:.55,t:.18,b:.02,y:.8,n:2.6},{z:2.4,w:.6,t:.1,b:.02,y:.8,n:3},{z:4.2,w:.35,t:.04,b:.02,y:.72}],{sides:28}),paint,0,0,0);
  /* pilote assis : combinaison, harnais, casque à visière intégrée */
  {
    const suit=M.std(0x4a5040,.85,0),harness=M.std(0x2a2b28,.8,0),hshell=M.std(0x3a3e43,.45,.2),visor=M.std(0x101418,.08,.85);
    const pg=new THREE.Group();pg.position.set(0,-.02,-2.55);planeG.add(pg);
    const t=RK.loft([{z:0,w:.18,t:.1,b:.11},{z:.25,w:.17,t:.1,b:.1},{z:.45,w:.21,t:.1,b:.11,n:2.6},{z:.56,w:.12,t:.06,b:.06}],{sides:20});t.rotateX(-Math.PI/2);A(t,suit,0,.3,.05,pg,-.12,0,0);
    for(const s of[-1,1])A(RK.rbox(.05,.5,.02,.01,1),harness,s*.08,.58,.15,pg,-.12,0,0);
    const hg=RK.helmet(pg,hshell,visor,{r:.16,style:'jet'});hg.position.set(0,.96,.03);hg.rotation.y=Math.PI;
    A(RK.rbox(.5,.75,.2,.06,2),M.std(0x2c3036,.7,.2),0,.6,.32,pg,-.1,0,0);
    A(RK.rbox(.36,.3,.18,.05,2),M.std(0x2c3036,.7,.2),0,1.1,.4,pg);
    for(const s of[-1,1])A(RK.rbox(.04,.28,.04,.01,1),M.std(0xf2c014,.6,0),s*.12,.98,.31,pg);
  }
  /* --- ailes trapézoïdales à profil NACA, gouvernes et feux --- */
  for(const s of[-1,1]){
    const w=RK.wing({x:s*.95,y:-.1,z:-2.6,c:6.1,t:.055},{x:s*5.3,y:-.02,z:.75,c:1.65,t:.04},{chord:20,span:6});A(w,paint,0,0,0);
    A(RK.wing({x:s*2.2,y:-.06,z:2.15,c:.85,t:.03},{x:s*5.05,y:-.02,z:1.75,c:.58,t:.03},{chord:8,span:2}),panel,0,.012,0);
    A(RK.rbox(.12,.05,.3,.02,1),s<0?glowRed:glowGreen,s*5.3,-.02,1.2);
    A(RK.rbox(.03,.012,1.4,.006,1),formation,s*3.1,.12,-.2,null,0,s*-.55,0);
  }
  /* empennages : deux dérives inclinées et stabilisateurs monoblocs */
  for(const s of[-1,1]){
    const fin=RK.wing({x:0,y:0,z:0,c:2.9,t:.05},{x:2.35,y:0,z:1.85,c:1.25,t:.045},{chord:16,span:5});
    const fg=new THREE.Group();fg.position.set(s*.92,.55,1.85);fg.rotation.z=s>0?Math.PI/2-.42:Math.PI/2+.42;
    planeG.add(fg);A(fin,paint,0,0,0,fg);
    A(RK.rbox(.05,.02,.75,.01,1),panel,1.4,.0,2.55,fg);
    const tail=RK.wing({x:s*.85,y:-.1,z:3.45,c:2.35,t:.045},{x:s*3.3,y:-.16,z:4.95,c:1.05,t:.04},{chord:14,span:4});A(tail,paint,0,0,0);
  }
  /* marquages basse visibilité */
  const markingCanvas=document.createElement('canvas');markingCanvas.width=512;markingCanvas.height=128;
  const markingCtx=markingCanvas.getContext('2d');
  if(!markingCtx)throw new Error('Impossible de créer les marquages de la cellule.');
  markingCtx.fillStyle='#9aa3a8';markingCtx.font='700 64px Arial';markingCtx.fillText('F-35B',18,72);
  markingCtx.font='500 25px Arial';markingCtx.fillText('STOVL  /  07',20,108);
  const markingTexture=new THREE.CanvasTexture(markingCanvas);markingTexture.anisotropy=8;
  const markingMat=new THREE.MeshBasicMaterial({map:markingTexture,transparent:true,opacity:.6,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const side of [-1,1]){const decal=A(new THREE.PlaneGeometry(.95,.24).rotateX(-Math.PI/2),markingMat,side*2.9,.045,.9);decal.renderOrder=1}
  /* poteaux de roulis sous les ailes (vol vertical) */
  for(const s of[-1,1]){A(new THREE.CylinderGeometry(.16,.2,.5,18),dark,s*4.9,-.24,.7,null,Math.PI/2,0,0);A(new THREE.TorusGeometry(.17,.03,8,18),trim,s*4.9,-.24,.95,null,0,0,0)}
  /* soufflante de sustentation : trappes affleurantes, rotor visible en mode STOVL */
  liftFanG=new THREE.Group();liftFanG.position.set(0,.62,-1.25);planeG.add(liftFanG);
  A(new THREE.CylinderGeometry(.7,.7,.4,32,1,true),dark,0,-.2,0,liftFanG);
  A(new THREE.CircleGeometry(.7,32),dark,0,-.39,0,liftFanG,-Math.PI/2,0,0);
  A(new THREE.TorusGeometry(.64,.05,10,32),trim,0,-.06,0,liftFanG,Math.PI/2,0,0);
  liftFanRotor=new THREE.Group();liftFanRotor.position.set(0,-.14,0);liftFanG.add(liftFanRotor);
  A(RK.lathe([[0,-.08],[.16,-.08],[.18,.0],[.12,.06],[0,.08]],20),panel,0,0,0,liftFanRotor);
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=A(RK.rbox(.42,.012,.08,.004,1),trim,Math.cos(a)*.38,0,Math.sin(a)*.38,liftFanRotor);b.rotation.set(.45,-a,0)}
  for(const side of [-1,1]){
    const hinge=new THREE.Group();hinge.position.set(side*.6,.2,0);liftFanG.add(hinge);
    A(RK.rbox(.6,.05,1.45,.02,2),paint,-side*.3,0,0,hinge);
    A(RK.rbox(.5,.012,.03,.005,1),panel,-side*.3,.027,.6,hinge);
    liftFanDoors.push({hinge,side});
  }
  for(let i=0;i<5;i++)A(RK.rbox(.62,.01,.07,.005,1),dark,0,.81,.35+i*.12);
  /* tuyère orientable à bord crénelé, anneaux et corps de post-combustion */
  nozG=new THREE.Group();nozG.position.set(0,-.02,5.55);planeG.add(nozG);
  A(RK.lathe([[.62,0],[.6,.4],[.55,.75],[.5,1.0]],40).rotateX(Math.PI/2),heat,0,0,0,nozG);
  A(RK.lathe([[.47,1.0],[.48,.6],[.5,.2]],40).rotateX(Math.PI/2),M.std(0x2a2522,.6,.8),0,0,0,nozG);
  {const pos=[],n=16,R0=.5,R1=.46;for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,am=(a0+a1)/2;
     pos.push(Math.cos(a0)*R0,Math.sin(a0)*R0,1.0,Math.cos(am)*R1,Math.sin(am)*R1,1.22,Math.cos(a1)*R0,Math.sin(a1)*R0,1.0)}
   const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));sg.computeVertexNormals();A(sg,new THREE.MeshStandardMaterial({color:0x6f6458,metalness:.9,roughness:.4,side:THREE.DoubleSide,envMap:RK.ENV}),0,0,0,nozG)}
  for(let i=0;i<3;i++)A(new THREE.TorusGeometry(.6-i*.04,.018,6,40),trim,0,0,.15+i*.35,nozG);
  A(new THREE.CircleGeometry(.44,32),M.glow(0x40180a,.6),0,0,.25,nozG);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;A(RK.rbox(.03,.3,.03,.01,1),dark,Math.cos(a)*.22,Math.sin(a)*.22,.3,nozG,0,0,a)}
  flameMesh=A(new THREE.ConeGeometry(.33,1,16,1,true).rotateX(Math.PI/2).translate(0,0,.45),
    new THREE.MeshBasicMaterial({color:0xff9a3a,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),0,0,1.05,nozG);
  const core=A(new THREE.ConeGeometry(.2,.8,14,1,true).rotateX(Math.PI/2).translate(0,0,.35),new THREE.MeshBasicMaterial({color:0xb8d4ff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,0,flameMesh);
  for(let i=0;i<4;i++)A(new THREE.SphereGeometry(.15-i*.022,12,8),new THREE.MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.35-i*.06,blending:THREE.AdditiveBlending,depthWrite:false}),0,0,.22+i*.2,flameMesh).scale.set(1,1,.45);
  /* quille ventrale, crosse d'appontage, feux */
  A(RK.rbox(.5,.16,2.8,.06,2),paint,0,-.7,2.9);
  const hook=A(new THREE.CylinderGeometry(.05,.07,1.5,10),dark,0,-.66,4.55);hook.rotation.x=-.38;
  A(new THREE.SphereGeometry(.09,10,8),glowWhite,0,.12,5.35);
  A(new THREE.SphereGeometry(.07,8,6),glowRed,0,.95,-1.6);
  /* train tricycle : jambes oléopneumatiques, compas, pneus profilés, jantes, trappes */
  gearGroup=new THREE.Group();planeG.add(gearGroup);
  const strutMat=M.chrome({roughness:.12}),legMat=M.std(0xe6e8ea,.5,.2),hubMat=M.alu(0xa9b2b8,{roughness:.3});
  const makeWheel=(x,z,main)=>{
    const R=main?.37:.27,W=main?.26:.18,y=-2.05+R,topY=-.5;
    const tg=RK.tireGeo(R,W,R*.6,{round:.35,seg:32});A(tg,RK.tireMat('road',tg),x,y,z,gearGroup);
    const rg=RK.rimGeo(R*.6,W*.8,{spokes:main?8:6,hub:.3,spokeW:R*.08,seg:24});for(const gg of[rg.face,rg.barrel,rg.hub])A(gg,hubMat,x,y,z,gearGroup);
    const sx=main?x-Math.sign(x)*.18:x;
    A(new THREE.CylinderGeometry(.09,.09,(topY-(y+.55)),14).translate(0,(topY-(y+.55))/2,0),legMat,sx,y+.55,z,gearGroup);
    A(new THREE.CylinderGeometry(.065,.065,.5,14).translate(0,.25,0),strutMat,sx,y+.05,z,gearGroup);
    A(new THREE.CylinderGeometry(.04,.04,Math.abs(sx-x)+W*.6,10),dark,(sx+x)/2,y,z,gearGroup,0,0,Math.PI/2);
    A(RK.rbox(.06,.3,.06,.02,1),dark,sx,y+.35,z+.12,gearGroup,.5,0,0);A(RK.rbox(.06,.3,.06,.02,1),dark,sx,y+.6,z+.12,gearGroup,-.5,0,0);
    if(!main){A(new THREE.CylinderGeometry(.07,.08,.1,16),M.glow(0xfff2cc,1.4),sx,y+.95,z-.14,gearGroup,Math.PI/2,0,0)}
    A(RK.rbox(.03,main?.9:.7,main?1.1:.8,.01,1),paint,x+(main?Math.sign(x)*.12:.32),-.62,z,gearGroup);
    if(!main)A(RK.rbox(.03,.7,.8,.01,1),paint,-.32,-.62,z,gearGroup);
  };
  makeWheel(0,-4.65,false);
  makeWheel(-1.45,1.75,true);makeWheel(1.45,1.75,true);
  planeG.traverse(o=>{if(o.isMesh&&o.material!==glass&&o.material!==markingMat&&!(o.material.blending===THREE.AdditiveBlending))o.castShadow=false});
}
buildPlane();
return {root:planeG,flameMesh,gearGroup,nozG,liftFanG,liftFanRotor,liftFanDoors};
}
function buildPV40(){
const pvG=new THREE.Group(),pvInteriorG=new THREE.Group();
let f35G=null,f35CockpitG=null;
const PV={tilt:null,props:[],discs:[],tailRotor:null,nose:null,mains:[],doors:[],iDoors:[],ramp:null,iRamp:null,paintMats:[],hsv:[184,.74,.3],propAng:0};
function hsv2rgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return new THREE.Color(f(5),f(3),f(1))}
function setPVColor(h,s,v){PV.hsv=[h,s,v];const c=hsv2rgb(h,s,v);for(const m of PV.paintMats)m.color.copy(c)}
function pvWheel(par,x,y,z,R,W){
  const tg=RK.tireGeo(R,W,R*.6,{round:.35,seg:28});RK.add(par,tg,RK.tireMat('road',tg),x,y,z);
  const rg=RK.rimGeo(R*.6,W*.8,{spokes:6,hub:.3,spokeW:R*.08,seg:20});for(const gg of[rg.face,rg.barrel,rg.hub])RK.add(par,gg,RK.M.alu(0xb5bcc2,{roughness:.3}),x,y,z);
}
/* Véhicule assorti (4x4) : même couleur que l'avion */
function pvVehicle(par,paint){
  const M=RK.M,g=new THREE.Group();par.add(g);
  const dark=M.std(0x14181c,.5,.3),glass=M.std(0x1b2a33,.1,.6),chrome=M.alu(0xc9ced3,{roughness:.2});
  RK.add(g,RK.rbox(1.86,.72,3.7,.16,3),paint,0,.0,0);
  RK.add(g,RK.rbox(1.72,.62,2.0,.18,3),paint,0,.62,-.15);
  RK.add(g,RK.rbox(1.74,.42,1.9,.1,2),glass,0,.66,-.15);
  RK.add(g,RK.rbox(1.9,.14,.2,.05,2),dark,0,-.18,-1.9);RK.add(g,RK.rbox(1.9,.14,.2,.05,2),dark,0,-.18,1.9);
  for(const s of[-1,1]){RK.add(g,RK.rbox(.22,.12,.05,.03,1),M.glow(0xfff4d0,.8),s*.66,.12,-1.86);RK.add(g,RK.rbox(.22,.1,.05,.03,1),M.glow(0xff2a2a,.6),s*.7,.12,1.86)}
  RK.add(g,RK.rbox(1.6,.06,1.2,.02,1),chrome,0,1.0,.1);
  for(const sx of[-1,1])for(const sz of[-1.2,1.25])pvWheel(g,sx*.92,-.42,sz,.4,.3);
  return g;
}
function buildPV(){
  const M=RK.M,A=(geo,mat,x,y,z,par,rx,ry,rz)=>RK.add(par||pvG,geo,mat,x,y,z,rx,ry,rz);
  const paint=M.std(0x1d6f73,.4,.2,{envMapIntensity:.9});
  const vpaint=M.std(0x1d6f73,.35,.3,{envMapIntensity:.9});
  PV.paintMats.push(paint,vpaint);
  const dark=M.std(0x1a1f24,.5,.4),gray=M.std(0x59616a,.55,.3),metal=M.alu(0xaab2b8,{roughness:.32}),black=M.std(0x0b0d10,.6,.2);
  const glass=M.glass(0x0b1620,{transparent:true,opacity:.86});
  const blade=M.std(0x23272b,.5,.35),tip=M.std(0xf2c014,.5,0);
  const glowRed=new THREE.MeshBasicMaterial({color:0xff3030}),glowGreen=new THREE.MeshBasicMaterial({color:0x32ff83}),glowWhite=new THREE.MeshBasicMaterial({color:0xffffff});
  /* fuselage : nez arrondi façon V-22, section presque carrée, queue relevée au-dessus de la rampe */
  const fus=RK.loft([
    {z:-16.6,w:.12,t:.12,b:.12,y:-.35},{z:-16.1,w:.85,t:.8,b:.85,y:-.3,n:2.2},{z:-15.1,w:1.32,t:1.3,b:1.3,y:-.15,n:2.4},
    {z:-13.6,w:1.62,t:1.66,b:1.48,n:2.7},{z:-11,w:1.72,t:1.78,b:1.58,n:2.9},{z:-3,w:1.76,t:1.8,b:1.62,n:3},{z:5,w:1.76,t:1.8,b:1.62,n:3},
    {z:8.4,w:1.68,t:1.74,b:1.05,y:.25,n:2.9},{z:12,w:1.2,t:1.3,b:.55,y:.95,n:2.6},{z:15,w:.62,t:.72,b:.32,y:1.42,n:2.3},{z:16.6,w:.2,t:.25,b:.15,y:1.62}
  ],{sides:56,sub:4});
  A(fus,paint,0,0,0);
  for(const [a0,a1] of[[.55,Math.PI-.55],[-.25,.55],[Math.PI-.55,Math.PI+.25]]){const g=RK.loftPatch(fus,-15.8,-14.05,a0,a1,.025);if(g)A(g,glass,0,0,0).renderOrder=2}
  A(RK.rbox(1.6,.05,.9,.02,1),black,0,1.33,-13.75,null,-.32,0,0);                  // bandeau anti-reflets
  // hublots de cabine, porte passagers, portes parachutistes coulissantes et treuils
  for(const s of[-1,1]){
    for(let k=0;k<8;k++)A(RK.rbox(.04,.42,.32,.02,1),glass,s*1.752,.35,-10.6+k*1.45);
    A(RK.rbox(.03,1.85,.95,.04,1),gray,s*1.765,-.15,-11.95);
    A(RK.rbox(.02,1.75,1.3,.02,1),black,s*1.758,-.05,4.4);
    const d=new THREE.Group();d.position.set(s*1.795,-.05,4.4);pvG.add(d);A(RK.rbox(.06,1.78,1.32,.03,1),paint,0,0,0,d);A(RK.rbox(.02,.08,.3,.01,1),metal,s*.03,0,-.4,d);
    PV.doors.push({g:d,z:4.4});
    const h=new THREE.Group();h.position.set(s*1.95,1.15,4.4);pvG.add(h);
    A(RK.rbox(.42,.1,.12,.03,1),metal,s*.2,0,0,h);A(new THREE.CylinderGeometry(.06,.06,.08,12),dark,s*.4,-.04,0,h,0,0,Math.PI/2);
    A(new THREE.CylinderGeometry(.008,.008,.55,6),dark,s*.4,-.33,0,h);A(new THREE.TorusGeometry(.05,.012,6,12,Math.PI*1.4),metal,s*.4,-.64,0,h);
  }
  // sponsons du train principal
  for(const s of[-1,1])A(RK.loft([{z:-1.6,x:s*1.72,w:.28,t:.3,b:.35,y:-1.05,n:2.4},{z:-.8,x:s*1.9,w:.6,t:.55,b:.62,y:-1.05,n:2.6},{z:3.4,x:s*1.9,w:.62,t:.55,b:.62,y:-1.05,n:2.6},{z:5,x:s*1.76,w:.3,t:.35,b:.4,y:-1.0,n:2.4}],{sides:28,sub:3}),paint,0,0,0);
  // rampe arrière
  PV.ramp=new THREE.Group();PV.ramp.position.set(0,-1.0,7.6);pvG.add(PV.ramp);
  A(RK.rbox(2.7,.12,4.5,.05,2),paint,0,0,2.25,PV.ramp);
  for(let k=0;k<6;k++)A(RK.rbox(2.4,.03,.06,.01,1),dark,0,.07,.5+k*.7,PV.ramp);
  // pilotes visibles derrière le pare-brise
  for(const s of[-1,1]){const pg=new THREE.Group();pg.position.set(s*.62,-.15,-14.2);pvG.add(pg);
    A(RK.rbox(.45,.55,.3,.1,2),M.std(0x2f3a48,.8,0),0,.2,0,pg);const hg=RK.helmet(pg,M.std(0xe8e8e8,.4,.2),M.std(0x111418,.08,.8),{r:.15,style:'jet'});hg.position.set(0,.68,0);hg.rotation.y=Math.PI}
  /* aile basculante et nacelles */
  PV.tilt=new THREE.Group();PV.tilt.position.set(0,1.95,-1.3);pvG.add(PV.tilt);
  A(RK.loft([{z:-3.6,w:.3,t:.15,b:.05,y:1.68},{z:-2.8,w:1.0,t:.38,b:.05,y:1.68,n:2.4},{z:.4,w:1.0,t:.42,b:.05,y:1.68,n:2.4},{z:1.6,w:.4,t:.15,b:.05,y:1.68}],{sides:28}),paint,0,0,0);
  for(const s of[-1,1]){
    A(RK.wing({x:s*.3,y:0,z:-2.0,c:4.4,t:.15},{x:s*16.95,y:.2,z:-2.6,c:2.8,t:.12},{chord:20,span:10}),paint,0,0,0,PV.tilt);
    A(RK.rbox(.16,.07,.34,.03,1),s<0?glowRed:glowGreen,s*16.98,.22,-1.4,PV.tilt);
    A(RK.rbox(.12,.06,.14,.03,1),glowWhite,s*16.98,.22,.05,PV.tilt);
    for(const x of[5.3,10.6]){
      const xs=s*x,zl=-2-(x-.3)/16.65*.6;
      A(RK.loft([{z:zl-2.3,x:xs,w:.42,t:.42,b:.45,y:0,n:2.2},{z:zl-1.6,x:xs,w:.56,t:.55,b:.64,y:-.06,n:2.4},{z:zl+2.6,x:xs,w:.55,t:.52,b:.6,y:-.06,n:2.4},{z:zl+4.6,x:xs,w:.18,t:.2,b:.22,y:0,n:2}],{sides:28,sub:3}),paint,0,0,0,PV.tilt);
      A(new THREE.CylinderGeometry(.12,.15,.5,14),dark,xs+s*.5,-.1,zl+1.4,PV.tilt,Math.PI/2,0,0);
      const spin=new THREE.Group();spin.position.set(xs,0,zl-2.35);PV.tilt.add(spin);
      A(RK.lathe([[.42,0],[.37,.35],[.24,.66],[.06,.88],[0,.9]],24).rotateX(-Math.PI/2),metal,0,0,0,spin);
      const prop=new THREE.Group();prop.position.z=-.1;spin.add(prop);prop.userData.dir=(x>8?1:-1)*s;
      for(let k=0;k<4;k++){const bg=new THREE.Group();bg.rotation.z=k*Math.PI/2;prop.add(bg);
        A(RK.rbox(1.62,.05,.32,.02,1),blade,.4+.81,0,0,bg).rotation.x=.32;A(RK.rbox(.2,.052,.3,.02,1),tip,.4+1.62+.08,0,0,bg).rotation.x=.32}
      const disc=new THREE.Mesh(new THREE.RingGeometry(.45,2.2,48),new THREE.MeshBasicMaterial({color:0x1a1d20,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
      disc.position.z=-.12;spin.add(disc);
      PV.props.push(prop);PV.discs.push(disc);
    }
  }
  /* empennage en T, rotor de queue horizontal pour le vol stationnaire */
  const fg=new THREE.Group();fg.position.set(0,1.45,12.3);fg.rotation.z=Math.PI/2;pvG.add(fg);
  A(RK.wing({x:0,y:0,z:0,c:4.4,t:.12},{x:4.9,y:0,z:2.9,c:2.3,t:.1},{chord:16,span:6}),paint,0,0,0,fg);
  for(const s of[-1,1])A(RK.wing({x:s*.15,y:6.28,z:14.95,c:2.5,t:.1},{x:s*5.4,y:6.28,z:16.25,c:1.3,t:.09},{chord:12,span:5}),paint,0,0,0);
  A(new THREE.SphereGeometry(.09,10,8),glowRed,0,6.42,15.4);
  A(new THREE.SphereGeometry(.08,10,8),glowWhite,0,1.6,16.7);
  A(new THREE.TorusGeometry(.78,.08,8,28),paint,0,1.62,17.25,null,Math.PI/2,0,0);
  A(RK.rbox(.12,.1,.7,.04,1),paint,0,1.62,16.65);
  PV.tailRotor=new THREE.Group();PV.tailRotor.position.set(0,1.62,17.25);pvG.add(PV.tailRotor);
  for(let k=0;k<3;k++){const b=A(RK.rbox(.68,.03,.13,.01,1),blade,0,0,0,PV.tailRotor);b.position.set(Math.cos(k*2.094)*.36,0,Math.sin(k*2.094)*.36);b.rotation.y=-k*2.094}
  // immatriculation sur la dérive
  const lc=document.createElement('canvas');lc.width=512;lc.height=160;const lx=lc.getContext('2d');
  lx.fillStyle='rgba(255,255,255,.92)';lx.font='800 96px Arial';lx.fillText('PV-40',30,112);
  const lt=new THREE.CanvasTexture(lc);lt.anisotropy=8;
  const lm=new THREE.MeshBasicMaterial({map:lt,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const s of[-1,1]){const d=A(new THREE.PlaneGeometry(2.4,.75),lm,s*.29,3.0,13.9,null,0,s*Math.PI/2,0);d.renderOrder=1}
  /* train : roue avant jumelée, boggies principaux tandem qui pivotent avant de rentrer */
  const leg=M.std(0xe6e8ea,.5,.2),strut=M.chrome({roughness:.12});
  PV.nose=new THREE.Group();PV.nose.position.set(0,-1.35,-12.6);pvG.add(PV.nose);
  A(new THREE.CylinderGeometry(.11,.11,1.1,14),leg,0,-.55,0,PV.nose);A(new THREE.CylinderGeometry(.075,.075,.45,12),strut,0,-1.0,0,PV.nose);
  A(new THREE.CylinderGeometry(.05,.05,.7,10),dark,0,-1.28,0,PV.nose,0,0,Math.PI/2);
  for(const s of[-1,1])pvWheel(PV.nose,s*.22,-1.28,0,.42,.26);
  for(const s of[-1,1]){
    const g=new THREE.Group();g.position.set(s*1.95,-1.55,1.9);pvG.add(g);g.userData.y0=-1.55;
    A(new THREE.CylinderGeometry(.13,.13,.6,14),leg,0,-.3,0,g);A(new THREE.CylinderGeometry(.09,.09,.4,12),strut,0,-.62,0,g);
    A(RK.rbox(.18,.16,1.7,.05,2),dark,0,-.95,0,g);
    for(const z of[-.75,.75])pvWheel(g,0,-.95,z,.55,.36);
    PV.mains.push(g);
  }
  /* véhicule assorti (visible quand la rampe est ouverte) */
  pvVehicle(pvG,vpaint).position.set(0,-.62,3.2);
  pvG.traverse(o=>{if(o.isMesh)o.castShadow=false});
  setPVColor(...PV.hsv);
}
buildPV();
return {root:pvG,PV,setPVColor};
}
return {buildF35, buildPV40};
}
