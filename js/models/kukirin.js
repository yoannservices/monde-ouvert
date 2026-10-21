/* Repris de kukirin/js/main.js (trottinettes électriques), adapté en module (three r165). */
export function createKukirinModel(THREE, RK){
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const SCOOTERS=[
 {id:'g2',name:'KUKIRIN G2',tier:1,price:0,vmax:45,acc:2.6,brake:3.6,grip:5.5,range:14,color:'#ff6a1a',desc:'Ta première trottinette. Légère, simple, parfaite pour apprendre la ville.'},
 {id:'m4pro',name:'KUKIRIN M4 Pro',tier:2,price:650,vmax:50,acc:2.9,brake:3.9,grip:5.8,range:17,color:'#2b8cff',desc:'Plus nerveuse que la G2, avec une meilleure autonomie.'},
 {id:'g2pro',name:'KUKIRIN G2 Pro',tier:3,price:1400,vmax:55,acc:3.2,brake:4.4,grip:6.1,range:20,color:'#e8e8e8',desc:'Le bon compromis : puissante et confortable.'},
 {id:'g2max',name:'KUKIRIN G2 Max',tier:4,price:2400,vmax:60,acc:3.5,brake:4.8,grip:6.4,range:23,color:'#26c281',desc:'Grosse batterie et vraies relances.'},
 {id:'s1pro',name:'KUKIRIN S1 Pro',tier:5,price:3600,vmax:62,acc:3.8,brake:5.2,grip:6.7,range:23,color:'#9a5cff',desc:'Stable et rapide, elle aime les grandes avenues.'},
 {id:'g3',name:'KUKIRIN G3',tier:6,price:5200,vmax:65,acc:4.1,brake:5.6,grip:7.0,range:25,color:'#ffcf24',desc:'Châssis renforcé, grosses suspensions.'},
 {id:'g3pro',name:'KUKIRIN G3 Pro',tier:7,price:7500,vmax:70,acc:4.6,brake:6.0,grip:7.3,range:27,color:'#ff3d5a',desc:'Double moteur : elle décolle du feu rouge.'},
 {id:'g4',name:'KUKIRIN G4',tier:8,price:10500,vmax:80,acc:5.3,brake:6.6,grip:7.8,range:30,color:'#16d3d3',desc:'Une vraie machine de performance.'},
 {id:'g5',name:'KUKIRIN G5',tier:9,price:15000,vmax:90,acc:6.1,brake:7.2,grip:8.2,range:33,color:'#f2f2f2',desc:'Très rapide, à manier avec respect.'},
 {id:'g6',name:'KUKIRIN G6',tier:10,price:22000,vmax:120,acc:8.2,brake:8.0,grip:8.6,range:37,color:'#111418',desc:'Le sommet de la gamme. 120 km/h et une accélération redoutable.'}
];
const SC_BY_ID={};SCOOTERS.forEach(s=>SC_BY_ID[s.id]=s);
/* ---------- modèle de trottinette (réaliste : PBR, pneus à profil, jantes alliage, fourche suspendue) ---------- */
const matDark=RK.M.plastic(0x16181b);
const matMetal=RK.M.alu(0x9aa3ab);
const matTire=RK.M.rubber();
const matHead=new THREE.MeshBasicMaterial({color:0xfff5c4});
const matTail=RK.M.glow(0xff2a2a,1.7);
const matSkin=RK.M.std(0xd6a07c,.6,0);
const matJacket=RK.M.std(0x2d3640,.78,0);
const matPants=RK.M.std(0x2c3b57,.86,0);
function bx(w,h,d,mat,x,y,z,par){const m=new THREE.Mesh(RK.rbox(w,h,d,Math.min(w,h,d)*.22,2),mat);m.position.set(x,y,z);m.castShadow=true;(par||null)&&par.add(m);return m}
function scooterRod(a,b,r,mat,par,segments){return RK.rod(par,a,b,r,mat,segments||12)}
function scooterSpring(a,b,r,wire,mat,par){
  const start=new THREE.Vector3(a[0],a[1],a[2]),axis=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),length=axis.length();
  axis.normalize();const ref=Math.abs(axis.y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const u=new THREE.Vector3().crossVectors(axis,ref).normalize(),v=new THREE.Vector3().crossVectors(axis,u).normalize(),points=[];
  for(let i=0;i<=60;i++){const t=i/60,angle=t*Math.PI*14;points.push(start.clone().addScaledVector(axis,length*t).addScaledVector(u,Math.cos(angle)*r).addScaledVector(v,Math.sin(angle)*r))}
  const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),140,wire,6,false),mat);tube.castShadow=true;par.add(tube);return tube;
}
function scooterPart(geometry,material,position,scale,parent){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(position[0],position[1],position[2]);mesh.scale.set(scale[0],scale[1],scale[2]);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
/* garde-boue : coque fine tournée autour de l'axe X, de l'angle a0 à a1 (0 = vers l'avant, PI/2 = dessus) */
function fenderGeo(R,W,a0,a1,th){
  th=th||.012;const p=[[R+.004,-W*.6],[R+th*1.6,-W*.5],[R+th*2.2,0],[R+th*1.6,W*.5],[R+.004,W*.6],[R,W*.56],[R+th*.9,W*.46],[R+th*1.3,0],[R+th*.9,-W*.46],[R,-W*.56],[R+.004,-W*.6]];
  const g=RK.lathe(p,36,Math.PI*1.5-a1+Math.PI/2,a1-a0);g.rotateZ(-Math.PI/2);return g;
}
const SCOOTER_DESIGNS={
  g2:{wheel:.24,front:.56,rear:-.52,deck:1,width:.3,handle:1.38,handleWidth:.62,battery:.5,suspension:0,motors:1,tread:0},
  m4pro:{wheel:.27,front:.59,rear:-.56,deck:1.08,width:.34,handle:1.4,handleWidth:.7,battery:.66,suspension:1,motors:1,tread:0},
  g2pro:{wheel:.28,front:.61,rear:-.58,deck:1.1,width:.35,handle:1.4,handleWidth:.72,battery:.58,suspension:2,motors:1,tread:0},
  g2max:{wheel:.3,front:.64,rear:-.62,deck:1.18,width:.38,handle:1.42,handleWidth:.76,battery:.76,suspension:1,motors:1,tread:0},
  s1pro:{wheel:.21,front:.51,rear:-.48,deck:.91,width:.27,handle:1.43,handleWidth:.58,battery:.38,suspension:0,motors:1,tread:0},
  g3:{wheel:.31,front:.64,rear:-.62,deck:1.2,width:.39,handle:1.43,handleWidth:.78,battery:.68,suspension:2,motors:1,tread:0},
  g3pro:{wheel:.32,front:.67,rear:-.65,deck:1.24,width:.4,handle:1.45,handleWidth:.82,battery:.74,suspension:2,motors:2,tread:0},
  g4:{wheel:.33,front:.69,rear:-.67,deck:1.27,width:.41,handle:1.46,handleWidth:.86,battery:.8,suspension:2,motors:2,tread:0},
  g5:{wheel:.35,front:.72,rear:-.7,deck:1.3,width:.43,handle:1.47,handleWidth:.9,battery:.84,suspension:2,motors:2,tread:1},
  g6:{wheel:.36,front:.74,rear:-.72,deck:1.34,width:.44,handle:1.49,handleWidth:.92,battery:.9,suspension:2,motors:2,tread:1}
};
const SCOOTER_STYLE={
  g2:{spokes:5,cowl:0},m4pro:{spokes:6,cowl:0,skirts:1},g2pro:{spokes:5,split:.42,cowl:1},g2max:{spokes:6,cowl:0,rack:1},s1pro:{spokes:5,cowl:0,latch:1},
  g3:{spokes:6,cowl:2,guards:1},g3pro:{spokes:5,split:.42,cowl:2,leds:1,signals:1},g4:{spokes:5,split:.42,cowl:1,fins:1,leds:1,signals:1},
  g5:{spokes:6,cowl:2,tail:1,leds:1,signals:1},g6:{spokes:6,cowl:3,leds:1,fins:1,signals:1}
};
function buildScooter(scooterId,color){
  const D=SCOOTER_DESIGNS[scooterId]||SCOOTER_DESIGNS.g2,ST=SCOOTER_STYLE[scooterId]||SCOOTER_STYLE.g2,M=RK.M,A=RK.add,V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const root=new THREE.Group(),tilt=new THREE.Group(),body=new THREE.Group();root.add(tilt);tilt.add(body);
  /* --- matériaux --- */
  const accent=M.paint(color,{metalness:.42,roughness:.3}),
    satin=M.std(0x1c1e21,.48,.45),black=M.plastic(0x111214),alu=M.alu(0xb8bfc6),aluDark=M.alu(0x3b4046,{roughness:.36}),chrome=M.chrome(),
    rimMat=M.alu(scooterId==='g6'?0x28d9d1:scooterId==='g5'?0xd6dbe0:scooterId==='g4'||scooterId==='g3pro'?0x2a2d31:0x7b8590,{roughness:.26}),
    discMat=M.std(0xcfd4d8,.2,1),caliperMat=M.paint(scooterId==='g6'||scooterId==='g5'?0xd9a31c:0xc0261d,{metalness:.2}),
    glow=M.glow(scooterId==='g6'?0x45f3dc:color,1.8),lens=M.lens(),led=M.glow(0xfff4dc,2.4),amber=M.glow(0xff9a14,1.1),
    gripTex=RK.noiseTex('#2c2d30',46,128,5,{color:true,repeat:[3,9]}),
    grip=M.std(0xffffff,.97,0,{map:gripTex,bumpMap:gripTex,bumpScale:.003});
  /* --- cotes --- */
  const R=D.wheel*.6+.012,W=R*(D.tread?.78:.64),rimR=R*.6,front=D.front,rear=D.rear;
  const dh=.075+D.battery*.05,deckY=R*.86+dh/2,dTop=deckY+dh/2+.008;
  const z0=rear+R*.92,z1=front-R-.035,deckL=z1-z0,deckZ=(z0+z1)/2,dw=D.width*.82;
  /* pivot du wheelie sur l'axe de la roue arrière */
  tilt.position.set(0,R,rear);body.position.set(0,-R,-rear);
  const rake=.13,axisDir=V(0,1,-rake).normalize(),axle=V(0,R,front);
  const pAxis=y=>V(0,y,front-rake*(y-R));
  const headY=dTop+.2,head=pAxis(headY),barY=D.handle,barP=pAxis(barY),barZ=barP.z,hw=D.handleWidth/2;
  /* --- plateau : coque peinte, batterie intégrée, grip, jonc alu, fond noir --- */
  A(body,RK.rbox(dw,dh,deckL,.03,3),accent,0,deckY,deckZ);
  A(body,RK.rbox(dw*.94,.022,deckL*.97,.01,2),black,0,deckY-dh/2-.006,deckZ);
  A(body,RK.rbox(dw*.86,.008,deckL*.88,.003,1),grip,0,dTop-.003,deckZ,0,0,0,{recv:true});
  for(const s of[-1,1]){
    A(body,RK.rbox(.008,.018,deckL*.9,.004,1),alu,s*(dw/2+.002),dTop-.02,deckZ);
    A(body,RK.rbox(.02,.03,.05,.008,1),black,s*(dw/2-.004),deckY-dh/2-.004,z1-.06);
    if(ST.leds)A(body,RK.rbox(.012,.012,deckL*.82,.005,1),glow,s*(dw/2-.014),deckY-dh/2-.012,deckZ,0,0,0,{noShadow:true});
    if(ST.skirts){A(body,RK.rbox(.03,dh+.08,deckL*.62,.012,2),accent,s*(dw/2+.016),deckY+.015,deckZ);A(body,RK.rbox(.006,.04,deckL*.4,.003,1),M.glow(0xff7a1a,.6),s*(dw/2+.033),deckY+.03,deckZ-.04)}
    if(ST.guards)RK.rod(body,[s*(dw/2+.03),dTop+.01,z0+.06],[s*(dw/2+.03),dTop+.01,z1-.08],.011,alu);
    if(ST.fins)for(let i=0;i<6;i++)A(body,RK.rbox(.012,dh*.7,.018,.004,1),aluDark,s*(dw/2+.006),deckY,deckZ-deckL*.2+i*.04);
  }
  if(ST.guards)for(const z of[z0+.06,z1-.08])for(const s of[-1,1])RK.rod(body,[s*(dw/2+.03),dTop+.01,z],[s*(dw/2-.005),deckY,z],.009,alu);
  /* logo latéral */
  const logo=document.createElement('canvas');logo.width=320;logo.height=80;
  const lg=logo.getContext('2d');lg.clearRect(0,0,320,80);lg.fillStyle='rgba(12,16,22,.0)';lg.fillRect(0,0,320,80);
  lg.fillStyle='#f1f5f8';lg.font='italic 900 38px Arial';lg.fillText('KUKIRIN',12,44);
  lg.fillStyle='rgba(255,255,255,.75)';lg.font='bold 20px Arial';lg.fillText(SC_BY_ID[scooterId].name.replace('KUKIRIN ','').toUpperCase(),16,70);
  const logoTexture=new THREE.CanvasTexture(logo),logoMat=new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const side of[-1,1]){
    const badge=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(.34,deckL*.5),Math.min(.085,dh*.85)),logoMat);
    badge.position.set(side*(dw/2+.0015),deckY-.004,deckZ+.02);badge.rotation.y=side*Math.PI/2;body.add(badge);
  }
  /* --- col de direction : pièce coulée qui relie le plateau à la colonne --- */
  RK.between(body,L=>RK.rbox(dw*.42,L,.07,.03,2).translate(0,L/2,0),accent,V(0,deckY,z1-.05),V(0,headY-.03,head.z-.015));
  A(body,RK.rbox(dw*.5,dh*.9,.12,.035,2),accent,0,deckY+.01,z1-.03);
  /* charnière de pliage, collier, levier */
  const hingeG=A(body,new THREE.CylinderGeometry(.036,.036,dw*.5,20),aluDark,0,headY-.05,head.z-.03,0,0,Math.PI/2);
  A(body,new THREE.CylinderGeometry(.044,.044,.07,24),alu,head.x,head.y+.04,head.z).quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axisDir);
  const lever=A(body,RK.rbox(.03,.14,.022,.01,2),black,.045,head.y+.05,head.z-.03);lever.rotation.set(-.15,0,.12);
  if(ST.latch)A(body,new THREE.TorusGeometry(.05,.008,8,24),alu,0,head.y+.1,head.z-.012,Math.PI/2+.13,0,0);
  /* --- colonne + guidon --- */
  const stemR=.022+D.motors*.004,stemMat=D.motors===2?aluDark:satin;
  RK.rod(body,pAxis(headY-.02),pAxis(barY-.03),stemR,stemMat,20);
  A(body,new THREE.CylinderGeometry(stemR*1.35,stemR*1.35,.05,20),alu,0,0,0).position.copy(pAxis(headY+.16));
  /* carénage avant de colonne avec phare */
  const shroudY=barY-.26,shP=pAxis(shroudY);
  RK.between(body,L=>RK.rbox(.075,L,.05,.022,2).translate(0,L/2,0),accent,pAxis(headY+.2).add(V(0,0,.028)),pAxis(barY-.12).add(V(0,0,.028)));
  const lamp=new THREE.Group();lamp.position.copy(shP).add(V(0,0,.055));body.add(lamp);
  A(lamp,RK.lathe([[.0,-.03],[.038,-.03],[.046,-.01],[.048,.02],[.044,.026]],24),black,0,0,0,Math.PI/2,0,0);
  A(lamp,new THREE.CircleGeometry(.04,24),M.chrome({roughness:.12}),0,0,.024);
  A(lamp,new THREE.CircleGeometry(.016,16),led,0,0,.026,0,0,0,{noShadow:true});
  A(lamp,new THREE.SphereGeometry(.044,24,10,0,Math.PI*2,0,Math.PI/2.6),lens,0,0,.012,Math.PI/2,0,0,{noShadow:true});
  /* potence, cintre, poignées, leviers, gâchette */
  A(body,RK.rbox(.07,.05,.06,.018,2),satin,0,barY,barZ);
  const barPts=[[-hw,barY+.004,barZ-.035],[-hw*.6,barY+.006,barZ-.008],[0,barY,barZ],[hw*.6,barY+.006,barZ-.008],[hw,barY+.004,barZ-.035]];
  A(body,RK.tube(barPts,.0145,{seg:40,radial:12}),satin,0,0,0);
  const gripProf=[];for(let i=0;i<=14;i++){const t=i/14;gripProf.push([.021+(i%2?.002:0)+(i===0||i===14?.004:0),-.065+t*.13])}
  for(const s of[-1,1]){
    const gp=A(body,RK.lathe(gripProf,18),black,s*(hw-.06),barY+.004,barZ-.03);gp.rotation.z=Math.PI/2;gp.rotation.x=s*.1;
    A(body,new THREE.CylinderGeometry(.024,.024,.012,18),aluDark,s*(hw+.004),barY+.004,barZ-.036,0,0,Math.PI/2);
    A(body,RK.rbox(.04,.03,.035,.01,2),black,s*(hw-.15),barY+.012,barZ-.012);
    A(body,RK.tube([[s*(hw-.15),barY+.01,barZ+.012],[s*(hw-.1),barY+.0,barZ+.05],[s*(hw-.02),barY-.012,barZ+.048]],.0055,{radial:6}),alu,0,0,0);
    A(body,RK.tube([[s*(hw-.16),barY-.005,barZ+.0],[s*(hw*.4),barY-.07,barZ+.04],[s*.04,shroudY+.02,barZ+.07],[s*.03,headY+.05,head.z+.06]],.005,{radial:5,seg:30}),black,0,0,0);
    if(ST.signals){A(body,RK.rbox(.03,.02,.025,.008,1),amber,s*(hw+.018),barY+.004,barZ-.036,0,0,0,{noShadow:true})}
  }
  A(body,RK.rbox(.03,.035,.012,.006,1),black,hw-.17,barY-.012,barZ-.032).rotation.x=-.5;
  A(body,RK.rbox(.05,.03,.03,.01,1),black,-(hw-.17),barY+.01,barZ-.03);
  /* phares additionnels pour les modèles double optique */
  const headCount=scooterId==='g3pro'||scooterId==='g4'||scooterId==='g5'||scooterId==='g6'?2:1;
  if(headCount===2)for(const s of[-1,1]){const g=new THREE.Group();g.position.set(s*.11,barY-.05,barZ+.045);body.add(g);
    A(g,RK.lathe([[0,-.03],[.026,-.03],[.032,.0],[.03,.018]],18),black,0,0,0,Math.PI/2,0,0);A(g,new THREE.CircleGeometry(.024,18),led,0,0,.019,0,0,0,{noShadow:true});
    RK.rod(body,[s*.11,barY-.05,barZ+.02],[s*.06,barY-.01,barZ+.005],.006,satin)}
  /* écran : boîtier incliné vers le pilote */
  const dispN=V(0,Math.sin(.45),-Math.cos(.45)),dispC=V(0,barY+.06,barZ+.01);
  const hous=A(body,RK.rbox(ST.tail?.27:.24,.125,.035,.015,2),black,dispC.x,dispC.y,dispC.z);hous.rotation.set(.45,Math.PI,0);
  /* --- fourche avant --- */
  const crownY=headY-.06,fx=W/2+.026,legTop=V(0,crownY,front-rake*(crownY-R));
  A(body,RK.rbox(fx*2+.05,.04,.06,.016,2),satin,0,crownY,legTop.z);
  for(const s of[-1,1]){
    const top=V(s*fx,crownY,legTop.z),bot=V(s*fx,R,front),mid=top.clone().lerp(bot,.48);
    if(D.suspension){
      RK.rod(body,top,mid,.014,M.chrome({roughness:.1}),14);
      RK.rod(body,mid.clone().add(V(0,.02*axisDir.y,0)),bot.clone().add(V(0,-.02,0)),.019,D.motors===2?aluDark:satin,14);
      scooterSpring([top.x,top.y-.01,top.z],[mid.x,mid.y+.02,mid.z+rake*.02],.024,.0042,accent,body);
    }else RK.between(body,L=>RK.rbox(.022,L,.04,.009,2).translate(0,L/2,0),satin,bot.clone().add(V(0,-.03,0)),top);
    A(body,RK.rbox(.026,.05,.06,.01,2),D.motors===2?aluDark:satin,s*fx,R,front);
    A(body,new THREE.CylinderGeometry(.011,.011,.012,6),alu,s*(fx+.016),R,front,0,0,Math.PI/2);
  }
  A(body,fenderGeo(R,W*1.05,.15,2.25,.01),accent,0,R,front);
  /* --- bras arrière, amortisseurs --- */
  for(const s of[-1,1]){
    const x=s*(W/2+.02);
    RK.between(body,L=>RK.rbox(.016,L,.055,.007,2).translate(0,L/2,0),satin,V(x,R,rear),V(x,deckY-.01,z0+.03));
    A(body,new THREE.CylinderGeometry(.011,.011,.012,6),alu,x+s*.01,R,rear,0,0,Math.PI/2);
    if(D.suspension>0){
      const a=V(x,dTop+.05,z0+.05),b=V(x,R+.03,rear+.06);
      RK.rod(body,b,a,.008,M.chrome({roughness:.1}),10);RK.rod(body,b,b.clone().lerp(a,.45),.014,aluDark,12);
      scooterSpring([b.x,b.y+.02,b.z],[a.x,a.y-.01,a.z],.019,.0036,accent,body);
    }
  }
  A(body,fenderGeo(R,W*1.08,1.0,3.05,.011),accent,0,R,rear);
  const tailZ=rear-Math.cos(Math.PI-3.05)*R*1.02,tailY=R+Math.sin(3.05)*R*1.02;
  A(body,RK.rbox(.085,.028,.03,.01,2),matTail,0,R+R*.17,tailZ-.004,0,0,0,{noShadow:true});
  A(body,RK.rbox(W*.7,.07,.006,.003,1),black,0,R*1.08-.04,tailZ+.004);
  /* --- roues : pneu à profil + jante alliage + disque percé + moteur-moyeu --- */
  const wheels=[];
  const tg=RK.tireGeo(R,W,rimR,{round:.55,seg:44}),tm=RK.tireMat(D.tread?'knobby':'scooter',tg);
  for(const [z,isFront] of[[front,true],[rear,false]]){
    const wg=new THREE.Group();wg.position.set(0,R,z);wg.userData.r=R;body.add(wg);wheels.push(wg);
    A(wg,tg,tm,0,0,0);
    const motor=isFront?D.motors===2:true,rg=RK.rimGeo(rimR,W*.82,{spokes:ST.spokes,split:ST.split,hub:motor?.62:.3,inner:.86,spokeW:rimR*(motor?.13:.17)});
    A(wg,rg.face,rimMat,0,0,0);A(wg,rg.barrel,rimMat,0,0,0);
    if(motor){
      const drum=[];for(let i=0;i<=10;i++){const t=i/10;drum.push([rimR*.6+(i%2&&i>1&&i<9?.004:0),-W*.36+t*W*.72])}
      A(wg,RK.lathe(drum,32),black,0,0,0,0,0,-Math.PI/2);
      for(const s of[-1,1]){A(wg,new THREE.CylinderGeometry(rimR*.28,rimR*.32,.012,24),aluDark,s*W*.37,0,0,0,0,Math.PI/2);
        for(let b=0;b<6;b++){const a=b/6*Math.PI*2;A(wg,new THREE.CylinderGeometry(.005,.005,.008,6),alu,s*W*.38,Math.sin(a)*rimR*.45,Math.cos(a)*rimR*.45,0,0,Math.PI/2)}}
    }else A(wg,rg.hub,rimMat,0,0,0);
    A(wg,new THREE.CylinderGeometry(.012,.012,W*1.1,10),alu,0,0,0,0,0,Math.PI/2);
    const dr=rimR*.92;A(wg,RK.discGeo(dr,dr*.62,.004,{holes:18}),discMat,-(W*.44+.006),0,0);
    for(let k=0;k<5;k++){const a=k/5*Math.PI*2;RK.rod(wg,[-(W*.44+.006),Math.sin(a)*dr*.62,Math.cos(a)*dr*.62],[-(W*.44+.006),Math.sin(a)*rimR*.3,Math.cos(a)*rimR*.3],.006,aluDark,6)}
    const ca=isFront?2.3:.9;
    A(body,RK.rbox(.03,.055,.07,.012,2),caliperMat,-(W*.44+.006),R+Math.sin(ca)*dr*.86,z+Math.cos(ca)*dr*.86,-ca+Math.PI/2,0,0);
  }
  /* béquille */
  RK.rod(body,[-dw*.38,deckY-dh/2,z0+.16],[-dw*.42-.04,deckY-dh/2-.03,z0-.06],.009,alu,8);
  /* --- équipements spécifiques --- */
  if(ST.cowl){
    const cz=head.z+.02,cy=headY+.08,k=ST.cowl;
    const cg=RK.loft([{z:cz-.1,w:.07,t:.07,b:.06,y:cy,n:2.4},{z:cz-.03,w:.1+k*.012,t:.11+k*.01,b:.09,y:cy,n:2.6},{z:cz+.06,w:.095+k*.012,t:.09+k*.012,b:.08,y:cy-.01,n:2.6},{z:cz+.11+k*.02,w:.05,t:.04,b:.04,y:cy-.02,n:2.2}],{sides:28,sub:5});
    A(body,cg,accent,0,0,0);
    A(body,RK.rbox(.11+k*.02,.016,.01,.006,1),led,0,cy-.01,cz+.105+k*.02,-.5,0,0,{noShadow:true});
    if(k>=2)for(const s of[-1,1])A(body,RK.rbox(.02,.012,.08,.005,1),glow,s*(.1+k*.012),cy,cz+.01,0,0,0,{noShadow:true});
  }
  if(ST.rack){
    const ry=R*2+.06;for(const s of[-1,1]){RK.rod(body,[s*.11,dTop,z0+.02],[s*.11,ry,rear+.02],.008,satin);RK.rod(body,[s*.11,ry,rear+.02],[s*.11,ry,rear-.18],.008,satin)}
    for(const z of[rear+.02,rear-.08,rear-.18])RK.rod(body,[-.11,ry,z],[.11,ry,z],.007,satin);
    A(body,RK.rbox(dw*.8,.06,deckL*.6,.02,2),black,0,deckY-dh/2-.035,deckZ);
  }
  if(ST.tail){A(body,RK.loft([{z:rear-.05,w:.05,t:.03,y:R*2+.03},{z:rear+.1,w:.09,t:.05,y:R*2+.035},{z:z0+.02,w:.11,t:.06,y:dTop+.04}],{sides:24}),accent,0,0,0)}
  /* --- pilote : humain articulé (plié aux genoux, mains sur les poignées) --- */
  const rider=new THREE.Group();body.add(rider);
  const shoes=M.std(0xe9e9e6,.7,0),sole=M.std(0x2a2a2a,.85,0),gloveMat=M.std(0x18191b,.65,0),helmShell=M.paint(0xf2f2f0,{metalness:.1,roughness:.35}),visorMat=M.std(0x0b0c0e,.2,.4);
  const lean=.2,thigh=.44,shin=.43,upper=.29,fore=.27;
  const pelvisH=dTop+.88,torsoL=.5;
  let zc=deckZ-.02;
  const shoulderOff=V(0,torsoL*Math.cos(lean)-.04,torsoL*Math.sin(lean));
  { /* recule ou avance le pilote pour que les bras atteignent le guidon avec les coudes pliés */
    const sy=pelvisH+shoulderOff.y,dy=barY-sy,dx=(hw-.07)-.18,want=.47,dz=Math.sqrt(Math.max(.02,want*want-dy*dy-dx*dx));
    zc=clamp(barZ-.03-dz-shoulderOff.z,z0+.22,z1-.2);
  }
  const hips=new THREE.Group();hips.position.set(0,pelvisH,zc);rider.add(hips);
  const torso=new THREE.Group();hips.add(torso);torso.rotation.x=lean;
  const tsecs=[{z:0,w:.165,t:.105,b:.1,n:2.4},{z:.12,w:.155,t:.095,b:.09},{z:.24,w:.15,t:.085,b:.095},{z:.36,w:.185,t:.1,b:.115,n:2.6},{z:.46,w:.205,t:.095,b:.09,n:2.9},{z:.52,w:.12,t:.06,b:.06},{z:.56,w:.055,t:.05,b:.05}];
  const tg2=RK.loft(tsecs,{sides:24,sub:4});tg2.rotateX(-Math.PI/2);A(torso,tg2,matJacket,0,-.05,0);
  A(torso,RK.lathe([[.0,0],[.06,0],[.065,.03],[.055,.06]],16),matJacket,0,.46,0);
  const headG=new THREE.Group();headG.position.set(0,torsoL-.03,.0);torso.add(headG);
  A(headG,new THREE.CylinderGeometry(.045,.05,.09,14),matSkin,0,.04,0);
  const face=A(headG,new THREE.SphereGeometry(.1,20,16),matSkin,0,.16,.015);face.scale.set(.86,1.08,.98);
  const hm=RK.helmet(headG,helmShell,visorMat,{r:.135,style:'urban'});hm.position.set(0,.2,-.005);
  for(const s of[-1,1])RK.rod(headG,[s*.1,.2,.02],[s*.07,.08,.06],.005,M.plastic(0x222222),6);
  const joints=[torso,headG];
  const feet=[[V(-.055,dTop,zc+.15),.0],[V(.07,dTop,zc-.15),.35]];
  for(const [s,ft] of[[-1,feet[0]],[1,feet[1]]]){
    const hipJ=V(s*.09,0,0),ankle=ft[0].clone().sub(hips.position).add(V(0,.075,0));
    const knee=RK.ik2(hipJ,ankle,thigh,shin,V(s*.15,0,1));
    const leg=RK.bone(hips,hipJ,knee,.075,.06,matPants,1.12);
    const kneeG=RK.bone(leg,leg.userData.tip,leg.userData.tip.clone().add(ankle.clone().sub(knee)),.058,.045,matPants,1.08);
    const foot=new THREE.Group();foot.position.copy(ankle.clone().sub(knee));kneeG.add(foot);foot.rotation.y=ft[1];
    A(foot,RK.rbox(.1,.075,.27,.035,2),shoes,0,-.035,.06);A(foot,RK.rbox(.105,.025,.28,.01,1),sole,0,-.07,.06);
    joints.push(leg);
  }
  rider.updateMatrixWorld(true);
  const arms=[];
  for(const s of[-1,1]){
    const shL=V(s*.19,torsoL-.07,.01),grip=V(s*(hw-.065),barY+.004,barZ-.03);
    const gT=torso.worldToLocal(rider.localToWorld(grip.clone()));
    const handL=gT.clone().add(V(-s*.0,0,-.015));
    const elb=RK.ik2(shL,handL,upper,fore,V(s*1,-.7,-.5));
    const arm=RK.bone(torso,shL,elb,.052,.045,matJacket,1.1);
    const fa=RK.bone(arm,arm.userData.tip,arm.userData.tip.clone().add(handL.clone().sub(elb)),.043,.034,matJacket,1.05);
    const hand=new THREE.Group();hand.position.copy(handL.clone().sub(elb));fa.add(hand);
    A(hand,RK.rbox(.05,.075,.09,.022,2),gloveMat,0,0,.012);
    joints.push(arm);arms.push({g:arm,sh:shL,rest:handL.clone().sub(shL).normalize(),grip});
  }
  /* --- écran de vitesse (vue à la première personne) --- */
  const display=document.createElement('canvas');display.width=256;display.height=128;
  const dg=display.getContext('2d'),displayTexture=new THREE.CanvasTexture(display);
  const displayMesh=new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.1),new THREE.MeshBasicMaterial({map:displayTexture,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
  displayMesh.position.copy(dispC).addScaledVector(dispN,.019);displayMesh.rotation.set(.45,Math.PI,0);displayMesh.renderOrder=5;body.add(displayMesh);
  root.traverse(o=>{if(o.isMesh&&o.material!==lens&&o.material!==logoMat)o.receiveShadow=true});
  root.userData={accent,wheels,tilt,rider,riderBody:body,ragdollJoints:joints,display,displayMesh,dg,displayTexture,designId:scooterId,
    hips,torso,arms,feet:V(0,dTop,zc),standY:pelvisH-dTop,rearZ:rear,wheelR:R,jrest:joints.map(j=>j.quaternion.clone())};
  return root;
}
return {SCOOTERS, buildScooter};
}
