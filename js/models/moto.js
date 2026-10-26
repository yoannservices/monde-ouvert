/* Repris de moto-rider/js/main.js (superbikes), adapté en module (three r165). */
export function createMotoModel(THREE, RK){
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const BIKES=[
 {id:'h2r',name:'Kawasaki Ninja H2R',eng:'998 cc · 4 cyl. compresseur',hp:326,kg:216,vtop:372,red:14000,pk:13000,col:[0x0b0d0f,0x2bd66b,0x8a8f96],note:'Circuit uniquement'},
 {id:'v4r',name:'Ducati Panigale V4 R',eng:'998 cc · V4 Desmosedici',hp:240,kg:172,vtop:310,red:16500,pk:15500,col:[0xd8141b,0x14171b,0xe9e9e9],note:''},
 {id:'rsv4',name:'Aprilia RSV4 Factory',eng:'1 099 cc · V4 65°',hp:220,kg:202,vtop:305,red:13600,pk:13000,col:[0x15181c,0xd1202a,0x9aa0a8],note:''},
 {id:'m1000',name:'BMW M 1000 RR',eng:'999 cc · 4 cyl. en ligne',hp:212,kg:192,vtop:306,red:15100,pk:14500,col:[0xf2f4f7,0x1f5fbf,0xc4161c],note:''},
 {id:'h2',name:'Kawasaki Ninja H2',eng:'998 cc · 4 cyl. compresseur',hp:240,kg:238,vtop:300,red:14000,pk:11500,col:[0x1a1d21,0x39d36e,0x8a8f96],note:''},
 {id:'cbr',name:'Honda CBR1000RR-R SP',eng:'999 cc · 4 cyl. en ligne',hp:215,kg:201,vtop:299,red:15000,pk:14500,col:[0xc8161d,0x1a1c20,0xe8e8e8],note:''}
];
function lambert(c,o){return RK.M.std(c,(o&&o.roughness!=null)?o.roughness:.38,(o&&o.metalness!=null)?o.metalness:.35,o)}
function limb(a,b,r,mat){
  const d=new THREE.Vector3().subVectors(b,a),len=d.length();
  const m=new THREE.Mesh(RK.limbGeo(len,r,r*.9,1.06),mat);
  m.position.copy(a);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.castShadow=true;return m;
}
function ell(x,y,z,sx,sy,sz,mat){const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m}
const BIKE_STYLE={
  h2r:{trellis:1,wings:1,ram:1,mirrors:0,fork:0x1a1a1a,rim:'h2',cal:0xc8a23a,can:'short',name:'H2R'},
  v4r:{trellis:0,wings:1,ram:0,mirrors:1,fork:0xc8a12c,rim:'y',cal:0xc81e1e,can:'stack',single:1,name:'V4 R'},
  rsv4:{trellis:0,wings:1,ram:0,mirrors:1,fork:0xc8a12c,rim:'y',cal:0xc81e1e,can:'side',name:'RSV4'},
  m1000:{trellis:0,wings:1,ram:0,mirrors:1,fork:0x1d2a5a,rim:'5',cal:0x2050c0,can:'side',name:'M RR'},
  h2:{trellis:1,wings:0,ram:1,mirrors:1,fork:0x1a1a1a,rim:'h2',cal:0xc8a23a,can:'side',name:'H2'},
  cbr:{trellis:0,wings:1,ram:1,mirrors:1,fork:0xc8a12c,rim:'5',cal:0xc81e1e,can:'side',name:'CBR'}
};
function makeWheel(rear,ST,rimMat,discMat){
  const g=new THREE.Group(),sp=new THREE.Group(),M=RK.M;
  const R=rear?.316:.305,W=rear?.19:.122,rr=.215;
  const tg=RK.tireGeo(R,W,rr,{round:.9,seg:44});RK.add(sp,tg,RK.tireMat('sport',tg));
  const sty=ST.rim==='y'?{spokes:5,split:.22,spokeW:.03}:ST.rim==='h2'?{spokes:5,split:.3,spokeW:.026}:{spokes:5,spokeW:.036};
  const rg=RK.rimGeo(rr,W*.86,Object.assign({hub:.26,inner:.88,seg:36},sty));
  for(const gg of[rg.face,rg.barrel,rg.hub])RK.add(sp,gg,rimMat);
  RK.add(sp,new THREE.TorusGeometry(rr*.99,.004,6,48),M.chrome(),W*.43,0,0,0,Math.PI/2,0,{noShadow:true});
  RK.add(sp,new THREE.TorusGeometry(rr*.99,.004,6,48),M.chrome(),-W*.43,0,0,0,Math.PI/2,0,{noShadow:true});
  if(rear){
    RK.add(sp,RK.discGeo(.11,.06,.005,{holes:12}),discMat,.09,0,0);
    const spr=new THREE.Shape();const n=42;for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2,r=i%2?.112:.104;if(i)spr.lineTo(Math.cos(a)*r,Math.sin(a)*r);else spr.moveTo(r,0)}
    const hole=new THREE.Path();hole.absarc(0,0,.05,0,Math.PI*2,true);spr.holes.push(hole);
    RK.add(sp,RK.extrude(spr,.006,{bevel:.001,cs:4}).rotateY(Math.PI/2),M.alu(0x8b8f95),-.09,0,0);
  }else for(const s of[-1,1]){
    RK.add(sp,RK.discGeo(.165,.12,.005,{holes:30}),discMat,s*.074,0,0);
    RK.add(sp,RK.discGeo(.12,.045,.007,{holes:6}),M.alu(ST.cal===0xc8a23a?0xc8a23a:0x3a3d42),s*.072,0,0);
  }
  g.add(sp);g.userData.spin=sp;return g;
}
/* texture de livrée appliquée en UV de loft (u = tour de section, v = longueur) */
function liveryTex(b,ST){
  const c0='#'+b.col[0].toString(16).padStart(6,'0'),c1='#'+b.col[1].toString(16).padStart(6,'0'),c2='#'+b.col[2].toString(16).padStart(6,'0');
  return RK.canvasTex(512,512,(g,w,h)=>{
    g.fillStyle=c0;g.fillRect(0,0,w,h);
    const side=(u,rot)=>{g.save();g.translate(u*w,h*.5);g.rotate(rot);
      g.fillStyle=c1;g.beginPath();g.moveTo(-h*.5,-w*.035);g.lineTo(h*.3,-w*.07);g.lineTo(h*.5,-w*.02);g.lineTo(h*.5,w*.02);g.lineTo(-h*.5,w*.0);g.fill();
      if(b.id==='m1000'){g.fillStyle='#1f5fbf';g.fillRect(-h*.45,w*.04,h*.8,w*.025);g.fillStyle='#6ac0ff';g.fillRect(-h*.45,w*.07,h*.8,w*.015);g.fillStyle='#c4161c';g.fillRect(-h*.45,w*.09,h*.8,w*.02)}
      if(b.id==='cbr'){g.fillStyle='#1b3fae';g.fillRect(-h*.5,w*.05,h*.9,w*.04);g.fillStyle='#ffffff';g.fillRect(-h*.5,w*.035,h*.9,w*.012)}
      g.fillStyle=b.id==='m1000'||b.id==='h2'?'#111':'#fff';if(b.id==='v4r')g.fillStyle='#fff';
      g.font='italic 900 '+(w*.07)+'px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(ST.name,-h*.05,-w*.13);g.restore()};
    side(.27,Math.PI/2);side(.73,-Math.PI/2);
  },{color:true});
}
function buildBike(b){
  const ST=BIKE_STYLE[b.id]||BIKE_STYLE.cbr,M=RK.M,A=RK.add,V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const [c0,c1,c2]=b.col;
  const liv=liveryTex(b,ST);
  const body=M.paint(0xffffff,{map:liv,metalness:.35,roughness:.28}),plain=M.paint(c0,{metalness:.35,roughness:.28}),acc=M.paint(c1,{metalness:.3,roughness:.3}),
    met=M.alu(c2,{roughness:.3}),blk=M.plastic(0x121315),carbon=M.std(0xffffff,.32,.3,{map:RK.carbonTex()}),eng=M.std(0x26282c,.45,.7),
    mag=M.std(0x5b5650,.45,.75),ti=M.std(0xffffff,.28,.95,{map:RK.canvasTex(256,32,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,'#8a8d92');gr.addColorStop(.5,'#9aa0aa');gr.addColorStop(.75,'#7c6f9a');gr.addColorStop(1,'#6a6f80');g.fillStyle=gr;g.fillRect(0,0,w,h)},{color:true})}),
    chrome=M.chrome(),forkMat=M.std(ST.fork,.25,.9),rimMat=M.std(ST.rim==='h2'?0x141414:b.id==='v4r'?0x1a1a1a:b.id==='m1000'?0x1c1c1c:0x161616,.35,.6),
    discMat=M.std(0xc5c9ce,.22,1),cal=M.paint(ST.cal,{metalness:.3}),seatMat=M.std(0x18191b,.9,0,{map:RK.noiseTex('#1c1d1f',22,64,3,{color:true,repeat:[4,4]})}),
    glass=M.glass(0x1a2026,{opacity:.5}),led=M.glow(0xf2f6ff,2.2),red=M.glow(0xff1a1a,1.6),amber=M.glow(0xff9214,.9),trellisMat=M.paint(ST.trellis?(b.id==='h2r'||b.id==='h2'?0x2bd66b:c1):c2,{metalness:.5,roughness:.3});
  const root=new THREE.Group(),leanG=new THREE.Group(),pitchG=new THREE.Group(),inner=new THREE.Group();
  root.add(leanG);leanG.position.y=.14;leanG.add(pitchG);pitchG.position.set(0,.31,-.72);pitchG.add(inner);inner.position.set(0,-.31,.72);
  const rw=makeWheel(true,ST,rimMat,discMat);rw.position.set(0,.316,-.72);inner.add(rw);
  /* --- moteur 4 cylindres / V4 --- */
  A(inner,RK.rbox(.34,.26,.44,.05,2),eng,0,.4,.1);
  A(inner,RK.rbox(.4,.12,.3,.04,2),eng,0,.27,.12);
  const cyl=new THREE.Group();cyl.position.set(0,.6,.28);cyl.rotation.x=.55;inner.add(cyl);
  A(cyl,RK.rbox(.38,.2,.2,.03,2),eng,0,0,0);for(let i=0;i<5;i++)A(cyl,RK.rbox(.4,.008,.22,.003,1),eng,0,-.08+i*.04,0);
  A(cyl,RK.rbox(.39,.08,.21,.03,2),mag,0,.13,0);
  if(b.id==='v4r'||b.id==='rsv4'){const c2g=new THREE.Group();c2g.position.set(0,.66,.02);c2g.rotation.x=-.5;inner.add(c2g);A(c2g,RK.rbox(.34,.2,.18,.03,2),eng,0,0,0);A(c2g,RK.rbox(.35,.07,.19,.03,2),mag,0,.12,0)}
  for(const s of[-1,1])A(inner,RK.lathe([[0,-.03],[.1,-.03],[.115,-.01],[.11,.02],[.06,.03],[0,.03]],28),s<0?mag:eng,s*.18,.38,.04,0,0,s*Math.PI/2);
  A(inner,RK.rbox(.44,.34,.05,.03,2),M.std(0x111111,.6,.6,{map:RK.canvasTex(64,64,(g,w,h)=>{g.fillStyle='#0a0a0a';g.fillRect(0,0,w,h);g.fillStyle='#3a3a3a';for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1.5)},{color:true,repeat:[4,4]})}),0,.64,.48,.3,0,0);
  /* --- cadre : double poutre alu ou treillis tubulaire --- */
  if(ST.trellis){
    const pts=s=>[[s*.07,.96,.45],[s*.17,.86,.15],[s*.15,.52,-.12],[s*.16,.84,-.22],[s*.09,.95,.45]];
    for(const s of[-1,1]){const p=pts(s);for(let i=0;i<p.length-1;i++)RK.rod(inner,p[i],p[i+1],.011,trellisMat,8);RK.rod(inner,p[0],p[2],.011,trellisMat,8);RK.rod(inner,p[1],p[3],.011,trellisMat,8);RK.rod(inner,[s*.17,.86,.15],[s*.16,.62,.3],.011,trellisMat,8)}
  }else for(const s of[-1,1]){
    RK.between(inner,L=>RK.rbox(.035,L,.1,.015,2).translate(0,L/2,0),met,V(s*.07,.95,.44),V(s*.17,.84,.08));
    RK.between(inner,L=>RK.rbox(.035,L,.12,.015,2).translate(0,L/2,0),met,V(s*.17,.84,.1),V(s*.15,.48,-.13));
  }
  A(inner,new THREE.CylinderGeometry(.04,.04,.12,18),met,0,0,0).position.set(0,.95,.47);
  /* --- bras oscillant (simple ou double branche), amortisseur, chaîne --- */
  for(const s of(ST.single?[-1]:[-1,1])){
    RK.between(inner,L=>RK.rbox(ST.single?.05:.035,L,ST.single?.11:.08,.02,2).translate(0,L/2,0),met,V(s*.12,.31,-.72),V(s*.13,.46,-.14));
  }
  if(ST.single)A(inner,RK.lathe([[0,-.05],[.07,-.05],[.075,.0],[.05,.05],[0,.05]],20),met,-.13,.316,-.72,0,0,Math.PI/2);
  A(inner,new THREE.CylinderGeometry(.025,.025,.34,12),met,0,.46,-.14,0,0,Math.PI/2);
  RK.rod(inner,[0,.42,-.38],[0,.66,-.2],.014,chrome,10);RK.rod(inner,[0,.42,-.38],[0,.5,-.31],.024,M.std(0x2a2a2a,.4,.6),12);
  {const sp=[];for(let i=0;i<=40;i++){const t=i/40,a=t*Math.PI*14,p=V(0,.5,-.31).lerp(V(0,.64,-.21),t);sp.push(V(Math.cos(a)*.03,p.y+Math.sin(a)*.03*.55,p.z-Math.sin(a)*.03*.84))}
   A(inner,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp),120,.005,6,false),M.paint(b.id==='v4r'||b.id==='rsv4'||b.id==='cbr'?0xe8c21a:0xd11a1a,{metalness:.2}))}
  {const ch=[];const fz=-.05,fy=.4,rz=-.72,ry=.316;for(let i=0;i<=24;i++){const a=Math.PI/2+i/24*Math.PI;ch.push([-.095,ry+Math.sin(a)*.108,rz+Math.cos(a)*.108])}for(let i=0;i<=12;i++){const a=-Math.PI/2+i/12*Math.PI;ch.push([-.095,fy+Math.sin(a)*.05,fz+Math.cos(a)*.05])}
   A(inner,RK.tube(ch,.007,{closed:true,seg:120,radial:5}),M.std(0x3a3b3d,.5,.8))}
  /* --- échappement : collecteurs + silencieux titane --- */
  const hdr=[];for(let k=0;k<2;k++){const x=k?.06:-.06;hdr.push(A(inner,RK.tube([[x,.56,.44],[x*1.4,.38,.48],[x*1.6,.22,.32],[.08,.2,.0],[.16,.26,-.2]],.024,{seg:40,radial:10}),ti))}
  if(ST.can==='stack'){for(const y of[.42,.5])RK.between(inner,L=>RK.lathe([[0,0],[.045,0],[.05,.02],[.05,L-.02],[.044,L],[0,L]],20),ti,V(.2,y-.1,-.22),V(.24,y+.02,-.6))}
  else{const L=ST.can==='short'?.3:.42;const can=RK.between(inner,L2=>RK.lathe([[0,0],[.05,0],[.065,.03],[.07,L2*.5],[.062,L2-.02],[.055,L2],[0,L2]],24),ti,V(.19,.3,-.22),V(.23,.48,-.22-L));
    RK.between(inner,L2=>RK.lathe([[0,0],[.058,0],[.06,L2],[0,L2]],24),carbon,V(.19+.04*(L/.42),.3+.18*(L/.42)*.95,-.22-L*.95),V(.235,.485,-.22-L*1.02))}
  /* --- réservoir, selle, coque arrière, feu --- */
  A(inner,RK.loft([{z:-.26,w:.14,t:.05,b:.08,y:.97},{z:-.05,w:.19,t:.1,b:.1,y:.99,n:2.6},{z:.2,w:.2,t:.1,b:.1,y:1.0,n:2.6},{z:.38,w:.13,t:.05,b:.06,y:.98}],{sides:32,sub:5}),body,0,0,0);
  A(inner,RK.loft([{z:-.6,w:.1,t:.03,b:.03,y:.93},{z:-.45,w:.135,t:.04,b:.04,y:.925,n:3},{z:-.25,w:.15,t:.04,b:.04,y:.93,n:3},{z:-.18,w:.12,t:.025,b:.03,y:.94}],{sides:28}),seatMat,0,0,0);
  const tail=RK.loft([{z:-1.07,w:.025,t:.02,b:.03,y:1.03},{z:-.9,w:.085,t:.05,b:.07,y:1.0,n:2.2},{z:-.6,w:.14,t:.06,b:.12,y:.93,n:2.4},{z:-.3,w:.17,t:.07,b:.16,y:.87,n:2.6},{z:-.18,w:.17,t:.05,b:.16,y:.85}],{sides:36,sub:4});A(inner,tail,body,0,0,0);
  A(inner,RK.rbox(.12,.025,.03,.01,1),red,0,1.0,-1.035,0,0,0,{noShadow:true});A(inner,RK.rbox(.13,.03,.035,.012,1),M.lens(),0,1.0,-1.04,0,0,0,{noShadow:true});
  if(b.id!=='h2r'){RK.rod(inner,[0,.88,-.95],[0,.68,-1.08],.012,blk);A(inner,new THREE.PlaneGeometry(.2,.13),M.std(0xf2f2f2,.5,0),0,.62,-1.1,0,Math.PI,0);for(const s of[-1,1]){RK.rod(inner,[s*.03,.75,-1.04],[s*.12,.76,-1.06],.006,blk);A(inner,RK.rbox(.03,.02,.04,.008,1),amber,s*.13,.76,-1.06,0,0,0,{noShadow:true})}}
  A(inner,RK.rbox(.03,.05,.12,.012,1),blk,.16,.9,-.85);A(inner,RK.rbox(.025,.07,.06,.01,1),cal,.105,.42,-.8,.4,0,0);
  /* --- carénages latéraux / sabot moteur --- */
  const side=RK.loft([{z:-.16,w:.16,t:.18,b:.2,y:.6,n:2.6},{z:.0,w:.25,t:.3,b:.24,y:.62,n:3.2},{z:.25,w:.28,t:.3,b:.25,y:.62,n:3.4},{z:.43,w:.25,t:.24,b:.18,y:.66,n:3},{z:.5,w:.12,t:.15,b:.1,y:.7,n:2.4}],{sides:44,sub:4});
  A(inner,side,body,0,0,0);
  for(const s of[-1,1]){const px=RK.loftPatch(side,.05,.3,s>0?-.05:Math.PI-.15,s>0?.15:Math.PI+.05,.003);if(px)A(inner,px,blk,0,0,0,0,0,0,{noShadow:true})}
  for(const s of[-1,1])for(let i=0;i<3;i++)A(inner,RK.rbox(.006,.012,.14,.004,1),blk,s*.283,.54+i*.04,.18,0,s*.12,0,{noShadow:true});
  A(inner,RK.loft([{z:-.1,w:.12,t:.03,b:.05,y:.3},{z:.2,w:.16,t:.04,b:.06,y:.28,n:2.6},{z:.42,w:.12,t:.08,b:.05,y:.33}],{sides:28}),carbon,0,0,0);
  /* --- tête de fourche : carénage avant, bulle, phares, entrée d'air, ailerons, rétros --- */
  const hl=new THREE.Group();inner.add(hl);
  const cowl=RK.loft([{z:.32,w:.27,t:.18,b:.17,y:.86,n:2.8},{z:.58,w:.24,t:.16,b:.17,y:.86,n:2.8},{z:.82,w:.16,t:.1,b:.11,y:.85,n:2.3},{z:.96,w:.08,t:.05,b:.06,y:.85,n:2},{z:1.02,w:.03,t:.02,b:.03,y:.85}],{sides:44,sub:5});
  A(hl,cowl,body,0,0,0);
  for(const [a0,a1] of[[-.75,-.1],[Math.PI+.1,Math.PI+.75]]){const p=RK.loftPatch(cowl,.8,.98,a0,a1,.004);if(p){A(hl,p,led,0,0,0,0,0,0,{noShadow:true});const q=RK.loftPatch(cowl,.8,.98,a0,a1,.01);A(hl,q,M.lens(),0,0,0,0,0,0,{noShadow:true})}}
  if(ST.ram)A(hl,RK.rbox(ST.trellis?.14:.09,.07,.12,.03,2),blk,0,.82,.97);
  A(hl,RK.loft([{z:.44,w:.18,t:.08,b:.02,y:1.0,n:2.2},{z:.62,w:.16,t:.06,b:.02,y:.98,n:2.2},{z:.82,w:.1,t:.02,b:.02,y:.93}],{sides:28,sub:4}),glass,0,.005,0).renderOrder=2;
  if(ST.wings)for(const s of[-1,1])A(hl,RK.wing({x:s*.22,y:.82,z:.55,c:.16,t:.12},{x:s*.36,y:.84,z:.6,c:.1,t:.1},{chord:8,span:2}),carbon,0,0,0);
  if(ST.mirrors)for(const s of[-1,1]){RK.rod(hl,[s*.24,.95,.55],[s*.3,1.0,.53],.008,blk);A(hl,RK.rbox(.12,.05,.06,.02,2),plain,s*.33,1.01,.53);A(hl,RK.rbox(.1,.04,.006,.015,1),chrome,s*.33,1.01,.499);A(hl,RK.rbox(.05,.01,.01,.004,1),amber,s*.36,1.0,.562,0,0,0,{noShadow:true})}
  /* tableau de bord TFT */
  const dashC=document.createElement('canvas');dashC.width=256;dashC.height=128;const dashX=dashC.getContext('2d'),dashT=new THREE.CanvasTexture(dashC);dashT.colorSpace=THREE.SRGBColorSpace;
  A(inner,RK.rbox(.17,.1,.03,.012,2),blk,0,1.02,.47,.6,0,0);
  const dashM=A(inner,new THREE.PlaneGeometry(.15,.075),new THREE.MeshBasicMaterial({map:dashT,toneMapped:false}),0,1.02+.016*Math.cos(.6)*0,.47-.017,-.6+Math.PI,0,Math.PI,{noShadow:true});
  dashM.position.set(0,1.02+.0155*Math.sin(.6),.47-.0155*Math.cos(.6));dashM.rotation.set(.6,Math.PI,0);
  let dashLast=-1;
  const dash=(st,bk)=>{const v=Math.round(st.v*3.6),gr=st.v<1&&st.rpm<2000?'N':String(st.gear),key=v*100+(st.rpm/250|0)+gr;if(key===dashLast)return;dashLast=key;
    const g=dashX;g.fillStyle='#05080b';g.fillRect(0,0,256,128);const f=clamp(st.rpm/bk.red,0,1.05);
    for(let i=0;i<24;i++){const on=i/24<f;g.fillStyle=on?(i>19?'#ff3030':i>15?'#ffb020':'#4dff9a'):'#1a2228';g.fillRect(10+i*10,10,8,16)}
    g.fillStyle='#e8f4ff';g.font='bold 58px Arial';g.textAlign='right';g.fillText(v,170,92);g.font='bold 15px Arial';g.fillText('km/h',170,114);
    g.fillStyle='#4dff9a';g.font='bold 60px Arial';g.textAlign='center';g.fillText(gr,218,96);dashT.needsUpdate=true};
  /* --- fourche inversée, tés, demi-guidons, garde-boue, étriers radiaux --- */
  const fp=new THREE.Group();fp.position.set(0,.98,.5);fp.rotation.x=-.38;inner.add(fp);
  const st=new THREE.Group();fp.add(st);
  for(const s of[-1,1]){
    RK.rod(st,[s*.09,.06,0],[s*.09,-.46,0],.029,forkMat,16);
    RK.rod(st,[s*.09,-.46,0],[s*.09,-.68,0],.021,M.std(0x2b2d30,.18,.9),14);
    A(st,RK.rbox(.05,.09,.07,.015,2),M.std(0x1c1d20,.4,.7),s*.09,-.71,0);
    A(st,RK.rbox(.03,.09,.11,.012,2),cal,s*.085,-.6,-.11,.25,0,0);
    A(st,new THREE.CylinderGeometry(.012,.012,.03,10),chrome,s*.09,.08,0);
    const gp0=V(s*.075,.055,.01),gp1=V(s*.31,.035,-.06);
    RK.rod(st,gp0,gp1,.012,M.alu(0x2a2c30),10);
    const grip=A(st,RK.lathe(Array.from({length:12},(_,i)=>[.017+(i%2?.002:0),i/11*.12]),14),blk,0,0,0);grip.position.copy(V(s*.19,.042,-.035));grip.quaternion.setFromUnitVectors(V(0,1,0),gp1.clone().sub(gp0).normalize());
    A(st,RK.rbox(.012,.012,.14,.005,1),M.alu(0x9aa0a6),s*.22,.05,.05,0,s*.25,0);
    A(st,new THREE.CylinderGeometry(.02,.02,.04,14),M.std(0x111111,.3,.2),s*.13,.09,.02);
  }
  A(st,RK.rbox(.26,.03,.09,.012,2),met,0,.0,-.0);A(st,RK.rbox(.26,.035,.1,.012,2),met,0,-.18,-.0);
  const fw=makeWheel(false,ST,rimMat,discMat);fw.position.set(0,-.72,0);st.add(fw);
  {const p=[[.31,-.07],[.325,-.06],[.33,0],[.325,.06],[.31,.07],[.306,.064],[.318,.054],[.322,0],[.318,-.054],[.306,-.064],[.31,-.07]];
   const fg=RK.lathe(p,32,Math.PI*2-2.3,1.9);fg.rotateZ(-Math.PI/2);A(st,fg,b.id==='h2r'?carbon:plain,0,-.72,0)}
  const gp=new THREE.Object3D();gp.position.set(0,-.30,.22);st.add(gp);
  /* --- repose-pieds / commandes reculées --- */
  for(const s of[-1,1]){A(inner,RK.rbox(.02,.12,.1,.008,1),met,s*.16,.46,-.28);RK.rod(inner,[s*.16,.42,-.28],[s*.24,.42,-.28],.009,M.alu(0x9aa0a6),8)}
  /* ===== pilote : combinaison cuir, bosse aéro, casque intégral ===== */
  const suitMain=M.std(new THREE.Color(b.id==='m1000'||c1===0x14171b||c1===0x1a1c20?0xf0f0f0:c1),.55,.05),suitDark=M.std(0x141518,.6,.05),suitW=M.std(0xf0f0f0,.6,.05),
    helmShell=M.paint(c0,{metalness:.25,roughness:.25}),visor=M.std(0x0a0a0c,.05,.85),glove=M.std(0x1a1a1c,.65,0);
  const rider=new THREE.Group();inner.add(rider);
  const hip=V(0,.95,-.42),sh=V(0,1.22,.06),d=sh.clone().sub(hip),Lt=d.length();
  const torso=new THREE.Group();torso.position.copy(hip);torso.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());rider.add(torso);
  const tg=RK.loft([{z:-.04,w:.165,t:.11,b:.1,n:2.4},{z:.15,w:.15,t:.1,b:.09},{z:.3,w:.17,t:.11,b:.1,n:2.5},{z:.44,w:.2,t:.1,b:.09,n:2.9},{z:.52,w:.12,t:.07,b:.06},{z:.56,w:.06,t:.05,b:.05}],{sides:24,sub:4});tg.rotateX(-Math.PI/2);
  A(torso,tg,suitMain,0,0,0);
  A(torso,RK.loft([{z:.2,w:.05,t:.02,b:.01},{z:.42,w:.11,t:.1,b:.01,n:2.4},{z:.56,w:.06,t:.07,b:.01}],{sides:20}).rotateX(-Math.PI/2),suitMain,0,0,-.1);
  A(torso,RK.rbox(.2,.08,.18,.04,2),suitDark,0,.02,.0);
  const head=new THREE.Group();head.position.copy(sh).add(V(0,.07,.08));rider.add(head);
  const hm=RK.helmet(head,helmShell,visor,{r:.145});hm.rotation.x=-.18;
  const arms=[],armRig=[];
  rider.updateMatrixWorld(true);
  for(const s of[-1,1]){
    const shd=V(s*.19,0,0).applyQuaternion(torso.quaternion).add(sh).add(V(0,-.04,0));
    fp.updateMatrixWorld(true);const grip=inner.worldToLocal(st.localToWorld(V(s*.25,.04,-.045)));
    const elb=RK.ik2(shd,grip,.3,.28,V(s*.9,-.6,-.3));
    const a1=limb(shd,elb,.052,suitMain),a2=limb(elb,grip,.043,suitDark),gl=A(null,RK.rbox(.055,.075,.1,.022,2),glove,grip.x,grip.y,grip.z);
    rider.add(a1,a2,gl);arms.push(a1,a2,gl);
    armRig.push({shd0:shd.clone(),grip:grip.clone(),pole:V(s*.9,-.6,-.3),a1,a2,L1:shd.distanceTo(elb),L2:elb.distanceTo(grip)});
    const hp=V(s*.1,.93,-.42),peg=V(s*.2,.47,-.29),knee=RK.ik2(hp,peg,.45,.43,V(s*.5,.25,1));
    const th=limb(hp,knee,.08,suitMain),sn=limb(knee,peg.clone().add(V(0,.05,0)),.058,suitDark);
    const kn=A(null,RK.rbox(.06,.1,.05,.02,2),suitW,knee.x+s*.07,knee.y-.03,knee.z);
    const boot=new THREE.Group();boot.position.copy(peg);rider.add(boot);
    A(boot,RK.rbox(.09,.16,.24,.04,2),suitDark,0,.06,.04,-.3,0,0);A(boot,RK.rbox(.095,.03,.25,.01,1),M.std(0x2a2a2a,.8,0),0,-.02,.04,-.3,0,0);
    rider.add(th,sn,kn);
  }
  rider.traverse(o=>{if(o.isMesh)o.castShadow=true});
  /* ombre au sol */
  const sc=document.createElement('canvas');sc.width=sc.height=64;const sx=sc.getContext('2d');const gr=sx.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(0,0,0,.6)');gr.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=gr;sx.fillRect(0,0,64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.17;root.add(shadow);
  return {root,leanG,pitchG,inner,rider,head,torso,arms,armRig,st,fp,fw,rw,gp,shadow,hm,hl,dash};
}
return {BIKES, buildBike};
}
