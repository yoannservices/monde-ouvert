/* Repris de simulateur-moto/js/main.js, adapté en module (three r165). */
export function createRK(THREE){
return (()=>{
const TAU=Math.PI*2,Y=new THREE.Vector3(0,1,0);
const K={ENV:null,srgb:false};
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function canvasTex(w,h,draw,o){
  o=o||{};const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  if(o.color&&K.srgb)t.colorSpace=THREE.SRGBColorSpace;if(o.repeat)t.repeat.set(o.repeat[0],o.repeat[1]);return t;
}
/* ---------- environnement HDR procédural (reflets réalistes sur peinture, chrome, vitres) ---------- */
function setEnv(renderer,o){
  o=o||{};K.srgb=true;
  const r=rng(o.seed||7),W=512,H=256,hz=H*.5;
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  let gr=g.createLinearGradient(0,0,0,hz);gr.addColorStop(0,o.top||'#2d67b0');gr.addColorStop(.7,o.mid||'#9fc4e6');gr.addColorStop(1,o.hor||'#e8f0f5');
  g.fillStyle=gr;g.fillRect(0,0,W,hz);
  for(let i=0;i<55;i++){const x=r()*W,y=hz*(.2+r()*.7),rw=15+r()*60,rh=3+r()*9;g.fillStyle='rgba(255,255,255,'+(.06+r()*.2)+')';g.beginPath();g.ellipse(x,y,rw,rh,0,0,TAU);g.fill()}
  gr=g.createLinearGradient(0,hz,0,H);gr.addColorStop(0,o.gnd1||'#8a8b84');gr.addColorStop(.2,o.gnd2||'#5b5d57');gr.addColorStop(1,o.gnd3||'#262724');
  g.fillStyle=gr;g.fillRect(0,hz,W,H-hz);
  if(o.city){for(let x=0;x<W;){const bw=4+r()*18,bh=4+r()*o.city*44,l=46+r()*60|0;g.fillStyle='rgb('+l+','+(l+5)+','+(l+12)+')';g.fillRect(x,hz-bh,bw,bh+1);
    g.fillStyle='rgba(255,255,255,.16)';for(let wy=hz-bh+2;wy<hz-2;wy+=3)g.fillRect(x+1,wy,bw-2,1);x+=bw+r()*3}}
  if(o.hills){g.fillStyle=o.hillCol||'#56685a';g.beginPath();g.moveTo(0,hz+1);for(let x=0;x<=W;x+=4)g.lineTo(x,hz-(Math.sin(x*.025+1)*.5+.5)*o.hills*16-(Math.sin(x*.083)*.5+.5)*o.hills*6);g.lineTo(W,hz+1);g.fill()}
  const img=g.getImageData(0,0,W,H).data,data=new Float32Array(W*H*4);
  const su=o.sunU!=null?o.sunU:.3,sv=o.sunV!=null?o.sunV:.3,sx=su*W,sy=sv*hz,si=o.sunI!=null?o.sunI:14;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=(y*W+x)*4,kd=((H-1-y)*W+x)*4;let dx=Math.abs(x-sx);dx=Math.min(dx,W-dx);const d2=(dx*dx+(y-sy)*(y-sy));
    const sun=si*Math.exp(-d2/18)+si*.06*Math.exp(-d2/900);
    for(let ch=0;ch<3;ch++){let v=img[k+ch]/255;if(K.srgb)v=Math.pow(v,2.2);data[kd+ch]=v*(o.gain||1)+sun*(ch===2?.92:1)}
    data[kd+3]=1;
  }
  /* bandes lumineuses douces (comme un studio) pour dessiner de beaux reflets sur les carrosseries */
  for(const b of (o.strips||[[.62,.12,1.6],[.85,.2,1.1]]))for(let y=Math.floor(b[1]*H);y<Math.floor((b[1]+.06)*H);y++)for(let x=Math.floor(b[0]*W);x<Math.floor((b[0]+.08)*W);x++){const k=((H-1-y)*W+x)*4;for(let ch=0;ch<3;ch++)data[k+ch]+=b[2]}
  const t=new THREE.DataTexture(data,W,H,THREE.RGBAFormat,THREE.FloatType);t.needsUpdate=true;
  t.mapping=THREE.EquirectangularReflectionMapping;t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.flipY=false;
  try{const pm=new THREE.PMREMGenerator(renderer);K.ENV=pm.fromEquirectangular(t).texture;pm.dispose()}catch(e){K.ENV=null}
  return K.ENV;
}
/* ---------- matériaux ---------- */
function E(o){if(K.ENV&&o.envMap===undefined)o.envMap=K.ENV;return o}
const M={
  std:(c,r,m,o)=>new THREE.MeshStandardMaterial(E(Object.assign({color:c,roughness:r==null?.5:r,metalness:m||0},o||{}))),
  paint:(c,o)=>new THREE.MeshPhysicalMaterial(E(Object.assign({color:c,roughness:.3,metalness:.3,clearcoat:1,clearcoatRoughness:.03},o||{}))),
  chrome:o=>M.std(0xffffff,.06,1,o),
  alu:(c,o)=>M.std(c==null?0xc5cad0:c,.3,1,o),
  dark:(c,o)=>M.std(c==null?0x1f2124:c,.42,.65,o),
  plastic:(c,o)=>M.std(c==null?0x121315:c,.6,0,o),
  rubber:o=>M.std(0x1a1b1d,.92,0,o),
  glass:(c,o)=>new THREE.MeshPhysicalMaterial(E(Object.assign({color:c==null?0x0c141a:c,roughness:.02,metalness:.15,clearcoat:1,clearcoatRoughness:.02,transparent:true,opacity:.62,envMapIntensity:1.4},o||{}))),
  lens:o=>new THREE.MeshPhysicalMaterial(E(Object.assign({color:0xffffff,roughness:.02,metalness:0,clearcoat:1,transparent:true,opacity:.22,depthWrite:false},o||{}))),
  glow:(c,i,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,emissive:c,emissiveIntensity:i==null?1.3:i,roughness:.35,metalness:0},o||{}))
};
/* ---------- textures procédurales ---------- */
const TC={};
function treadTex(kind,v0,v1){
  const key=kind+v0+v1;if(TC[key])return TC[key];
  return TC[key]=canvasTex(1024,256,(g,w,h)=>{
    const y0=Math.round((1-v1)*h),y1=Math.round((1-v0)*h),bh=y1-y0,cy=(y0+y1)/2;
    g.fillStyle='#505154';g.fillRect(0,0,w,h);
    g.fillStyle='rgba(0,0,0,.25)';for(let y=0;y<h;y+=5)if(y<y0-6||y>y1+6)g.fillRect(0,y,w,1);
    g.fillStyle='#6a6b6e';g.fillRect(0,y0,w,bh);
    g.fillStyle='#08080a';g.strokeStyle='#08080a';
    if(kind==='road'){
      for(const f of[.3,.5,.7])g.fillRect(0,y0+bh*f-3,w,6);
      g.lineWidth=2;for(let x=0;x<w;x+=16){g.beginPath();g.moveTo(x,y0+2);g.lineTo(x+5,y0+bh*.27);g.moveTo(x+8,y0+bh*.34);g.lineTo(x+11,y0+bh*.46);g.moveTo(x+8,y0+bh*.54);g.lineTo(x+5,y0+bh*.66);g.moveTo(x,y0+bh*.74);g.lineTo(x+5,y1-2);g.stroke()}
    }else if(kind==='sport'){
      g.lineWidth=5;for(let x=0;x<w;x+=64){for(const s of[-1,1]){g.beginPath();g.moveTo(x+(s>0?0:32),cy+s*bh*.06);g.bezierCurveTo(x+(s>0?14:46),cy+s*bh*.2,x+(s>0?30:62),cy+s*bh*.3,x+(s>0?52:84),cy+s*bh*.42);g.stroke()}}
    }else if(kind==='knobby'){
      g.fillStyle='#08080a';g.fillRect(0,y0,w,bh);g.fillStyle='#6a6b6e';
      for(let x=0;x<w;x+=22)for(let j=0;j<4;j++){const off=(j%2)*11;g.fillRect(x+off,y0+bh*(.05+j*.24),14,bh*.17)}
    }else{
      g.lineWidth=4;g.beginPath();for(let x=0;x<=w;x+=12)g.lineTo(x,cy+((x/12)%2?-1:1)*bh*.08);g.stroke();
      g.lineWidth=3;for(let x=0;x<w;x+=24){g.beginPath();g.moveTo(x,y0+bh*.12);g.lineTo(x+8,y0+bh*.34);g.moveTo(x+12,y1-bh*.12);g.lineTo(x+20,y1-bh*.34);g.stroke()}
    }
  });
}
function noiseTex(base,amp,size,seed,o){
  const key='n'+base+amp+size+seed;if(TC[key])return TC[key];const r=rng(seed||1);
  return TC[key]=canvasTex(size,size,(g,w,h)=>{const d=g.createImageData(w,h);const b=parseInt(base.slice(1),16),br=b>>16&255,bg=b>>8&255,bb=b&255;
    for(let i=0;i<w*h;i++){const n=(r()-.5)*amp;d.data[i*4]=br+n;d.data[i*4+1]=bg+n;d.data[i*4+2]=bb+n;d.data[i*4+3]=255}g.putImageData(d,0,0)},o);
}
function carbonTex(){
  if(TC.carbon)return TC.carbon;
  return TC.carbon=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#16171a';g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){const on=((x+y)/8)%2;const gr=on?g.createLinearGradient(x,y,x+8,y):g.createLinearGradient(x,y,x,y+8);
      gr.addColorStop(0,'#1c1d21');gr.addColorStop(.5,on?'#3a3c42':'#2d2f34');gr.addColorStop(1,'#16171a');g.fillStyle=gr;g.fillRect(x,y,8,8)}},{color:true,repeat:[6,6]});
}
function labelTex(draw,w,h){return canvasTex(w||512,h||128,draw,{color:true})}
/* ---------- géométries ---------- */
const cr=(p0,p1,p2,p3,t)=>.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);
/* Loft : sections superelliptiques le long de Z (z croissant). {z,w,t,b,y,x,n,tw}
   w = demi-largeur, t/b = hauteur au-dessus/au-dessous du centre y, n = exposant (2 ellipse, 4+ carré arrondi), tw = largeur relative du dessus */
function loft(secs,o){
  o=o||{};const S=o.sides||32,sub=o.sub||4,keys=['z','w','t','b','y','x','n','tw'],full=[];
  const sec=secs.map(s=>({z:s.z,w:s.w,t:s.t,b:s.b==null?s.t:s.b,y:s.y||0,x:s.x||0,n:s.n||2,tw:s.tw==null?1:s.tw}));
  for(let j=0;j<sec.length-1;j++)for(let k=0;k<sub;k++){
    const f=k/sub,p0=sec[Math.max(0,j-1)],p1=sec[j],p2=sec[j+1],p3=sec[Math.min(sec.length-1,j+2)],s={};
    for(const q of keys)s[q]=q==='z'||o.linear?p1[q]+(p2[q]-p1[q])*f:cr(p0[q],p1[q],p2[q],p3[q],f);
    s.w=Math.max(s.w,1e-4);s.t=Math.max(s.t,1e-4);s.b=Math.max(s.b,1e-4);s.n=Math.max(s.n,.6);full.push(s);
  }
  full.push(sec[sec.length-1]);
  const pos=[],uv=[],idx=[],R=full.length;
  for(let j=0;j<R;j++){const s=full[j];
    for(let i=0;i<=S;i++){const a=-Math.PI/2+i/S*TAU,c=Math.cos(a),sn=Math.sin(a),e=2/s.n;
      const yy=Math.sign(sn)*Math.pow(Math.abs(sn),e),xx=Math.sign(c)*Math.pow(Math.abs(c),e)*s.w*(yy>0?1+(s.tw-1)*yy:1);
      pos.push(s.x+xx,s.y+(yy>0?s.t:s.b)*yy,s.z);uv.push(i/S,j/(R-1))}}
  for(let j=0;j<R-1;j++)for(let i=0;i<S;i++){const a=j*(S+1)+i,b=a+1,d=a+S+1,c=d+1;idx.push(a,b,d,b,c,d)}
  if(o.cap!==false){
    for(const end of[0,1]){const j=end?R-1:0,s=full[j],ci=pos.length/3;pos.push(s.x,s.y+(s.t-s.b)*.3,s.z);uv.push(.5,end);
      const b0=pos.length/3;for(let i=0;i<=S;i++){const a=(j*(S+1)+i)*3;pos.push(pos[a],pos[a+1],pos[a+2]);uv.push(i/S,end)}
      for(let i=0;i<S;i++){const a=b0+i;if(end)idx.push(ci,a,a+1);else idx.push(ci,a+1,a)}}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx);geo.computeVertexNormals();geo.userData.S=S;geo.userData.R=R;
  const n=geo.attributes.normal;for(let j=0;j<R;j++){const a=j*(S+1),b=a+S;const x=n.getX(a)+n.getX(b),y=n.getY(a)+n.getY(b),z=n.getZ(a)+n.getZ(b),l=Math.hypot(x,y,z)||1;n.setXYZ(a,x/l,y/l,z/l);n.setXYZ(b,x/l,y/l,z/l)}
  return geo;
}
/* Boîte arrondie à normales lisses */
function rbox(w,h,d,r,s){
  s=s||3;r=Math.max(1e-4,Math.min(r==null?Math.min(w,h,d)*.15:r,w/2-1e-4,h/2-1e-4,d/2-1e-4));
  const n=2*s+1,g=new THREE.BoxGeometry(1,1,1,n,n,n),P=g.attributes.position,N=g.attributes.normal,half=[w/2,h/2,d/2],c=[0,0,0],inr=[0,0,0],dv=[0,0,0];
  for(let i=0;i<P.count;i++){
    c[0]=P.getX(i);c[1]=P.getY(i);c[2]=P.getZ(i);
    for(let a=0;a<3;a++){const k=Math.round((c[a]+.5)*n);const v=k<=s?-half[a]+r*(k/s):half[a]-r*((n-k)/s);inr[a]=Math.max(-(half[a]-r),Math.min(half[a]-r,v));dv[a]=v-inr[a]}
    const l=Math.hypot(dv[0],dv[1],dv[2]);
    if(l>1e-6){P.setXYZ(i,inr[0]+dv[0]/l*r,inr[1]+dv[1]/l*r,inr[2]+dv[2]/l*r);N.setXYZ(i,dv[0]/l,dv[1]/l,dv[2]/l)}
    else P.setXYZ(i,inr[0],inr[1],inr[2]);
  }
  return g;
}
const lathe=(pts,seg,ps,pl)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(Math.max(p[0],1e-4),p[1])),seg||32,ps||0,pl||TAU);
function limbGeo(L,r1,r2,bulge,seg){
  const p=[];for(let k=0;k<=5;k++){const a=-Math.PI/2+k/5*Math.PI/2;p.push([r1*Math.cos(a),r1*Math.sin(a)])}
  if(bulge)p.push([(r1+r2)/2*bulge,L*.38]);
  for(let k=0;k<=5;k++){const a=k/5*Math.PI/2;p.push([r2*Math.cos(a),L+r2*Math.sin(a)])}
  return lathe(p,seg||14);
}
function tube(pts,r,o){o=o||{};const c=new THREE.CatmullRomCurve3(pts.map(p=>p.isVector3?p:new THREE.Vector3(p[0],p[1],p[2])),!!o.closed,'catmullrom',o.tension==null?.5:o.tension);
  return new THREE.TubeGeometry(c,o.seg||Math.max(8,pts.length*8),r,o.radial||10,!!o.closed)}
function extrude(shape,depth,o){o=o||{};const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:o.bevel!==0,bevelThickness:o.bevel||depth*.25,bevelSize:o.bevelSize==null?(o.bevel||depth*.25):o.bevelSize,bevelSegments:o.bs||2,curveSegments:o.cs||24,steps:1});
  g.translate(0,0,-depth/2);return g}
function polyShape(pts){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();return s}
/* Pneu : profil tourné autour de l'axe X. Retourne la géométrie (UV : u autour, v le long du profil). */
function tireGeo(R,W,rimR,o){
  o=o||{};const h=R-rimR,round=o.round||0,p=[];
  const side=s=>[[rimR*.99,s*W*.38],[rimR+h*.12,s*W*.46],[rimR+h*.45,s*W*.5],[rimR+h*.78,s*W*.48],[R-h*.06*(1-round),s*W*(.42-round*.08)]];
  const lo=side(-1),hi=side(1).reverse(),tr=[];const n=7;
  for(let i=0;i<=n;i++){const t=-1+2*i/n,yy=t*W*(.36-round*.06);tr.push([R-h*(round*.45+.03)*t*t,yy])}
  p.push(...lo,...tr,...hi);
  const g=lathe(p.map(q=>[q[0],q[1]]),o.seg||48);g.rotateZ(-Math.PI/2);
  g.userData={v0:lo.length/(p.length-1),v1:(lo.length+tr.length-1)/(p.length-1)};
  return g;
}
function tireMat(kind,g){const key='m'+kind+g.userData.v0+g.userData.v1;if(TC[key])return TC[key];const t=treadTex(kind,g.userData.v0,g.userData.v1);return TC[key]=M.std(0x2a2b2e,.88,0,{map:t,bumpMap:t,bumpScale:.012})}
/* Jante alliage : voile à bâtons découpés + fût + moyeu. Axe X. */
function rimGeo(R,W,o){
  o=o||{};const n=o.spokes||5,sw=o.spokeW||R*.16,ri=R*(o.hub||.3),ro=R*(o.inner||.83),depth=o.depth||W*.22,split=o.split||0;
  const s=new THREE.Shape();s.absarc(0,0,R*.97,0,TAU,false);
  const win=(a0,a1)=>{const hw0=(sw*.5)/ro;let rI=ri,hw1=(sw*.62)/rI;if(a1-a0-2*hw1<.06){const q=(a1-a0)/2-.03;if(q<=0)return;rI=(sw*.62)/q;hw1=(sw*.62)/rI}
    if(rI>ro*.82||a1-a0-2*hw0<.04)return;const h=new THREE.Path(),A0o=a0+hw0,A1o=a1-hw0,A0i=a0+hw1,A1i=a1-hw1;h.absarc(0,0,ro,A0o,A1o,false);h.absarc(0,0,rI,A1i,A0i,true);h.closePath();s.holes.push(h)};
  for(let k=0;k<n;k++){const a0=k/n*TAU,a1=(k+1)/n*TAU;if(split){const m=(a0+a1)/2;win(a0,m-split/2);win(m-split/2,m+split/2);win(m+split/2,a1)}else win(a0,a1)}
  const face=extrude(s,depth,{bevel:depth*.3,bs:1,cs:o.cs||Math.max(10,n*3)});face.rotateY(Math.PI/2);face.translate(o.offset||0,0,0);
  const barrel=lathe([[R*1.0,W*.5],[R*.95,W*.47],[R*.92,W*.38],[R*.92,-W*.38],[R*.95,-W*.47],[R*1.0,-W*.5]],o.seg||32);barrel.rotateZ(-Math.PI/2);
  const hub=lathe([[0,-W*.35],[R*.13,-W*.35],[R*.17,-W*.32],[R*.15,depth*.6],[R*.11,depth*.88],[R*.0,depth*.9]],24);hub.rotateZ(-Math.PI/2);hub.translate(o.offset||0,0,0);
  return{face,barrel,hub};
}
/* Disque de frein percé */
function discGeo(R,ri,th,o){
  o=o||{};const s=new THREE.Shape();s.absarc(0,0,R,0,TAU,false);const h=new THREE.Path();h.absarc(0,0,ri,0,TAU,true);s.holes.push(h);
  const nh=o.holes==null?24:o.holes;for(let k=0;k<nh;k++){const a=k/nh*TAU,rr=ri+(R-ri)*(k%2?.38:.66),hp=new THREE.Path();hp.absarc(Math.cos(a)*rr,Math.sin(a)*rr,(R-ri)*.07,0,TAU,true);s.holes.push(hp)}
  const g=extrude(s,th,{bevel:th*.2,bs:1,cs:o.cs||(nh?12:32)});g.rotateY(Math.PI/2);return g;
}
/* Aile à profil NACA entre deux sections : {x,y,z(bord d'attaque),c(corde),t(épaisseur relative)} ; corde le long de +Z */
function wing(root,tip,o){
  o=o||{};const K2=o.chord||18,ST=o.span||6,pos=[],idx=[],uv=[],loop=[];
  for(let k=0;k<=K2;k++)loop.push((1-Math.cos(Math.PI*k/K2))/2);
  const th=x=>5*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x*x*x-.1036*x*x*x*x);
  const L=K2*2;
  for(let j=0;j<=ST;j++){const f=j/ST,X=root.x+(tip.x-root.x)*f,Yb=root.y+(tip.y-root.y)*f,Z=root.z+(tip.z-root.z)*f,C=root.c+(tip.c-root.c)*f,T=root.t+(tip.t-root.t)*f;
    for(let i=0;i<L;i++){let x,sgn;if(i<=K2){x=loop[K2-i];sgn=1}else{x=loop[i-K2];sgn=-1}
      const ht=th(x)*T*C*(sgn>0?(o.camber?1+o.camber:1):(o.camber?1-o.camber:1));pos.push(X,Yb+sgn*ht,Z+x*C);uv.push(i/L,f)}}
  for(let j=0;j<ST;j++)for(let i=0;i<L;i++){const a=j*L+i,b=j*L+(i+1)%L,d=a+L,c=b+L;idx.push(a,d,b,b,d,c)}
  for(const end of[0,1]){const j=end?ST:0,b0=pos.length/3;for(let i=0;i<L;i++){const q=(j*L+i)*3;pos.push(pos[q],pos[q+1],pos[q+2]);uv.push(0,0)}for(let i=1;i<L-1;i++){const a=b0,b=b0+i,c=b0+i+1;if(end)idx.push(a,c,b);else idx.push(a,b,c)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const nr=g.attributes.normal;if(nr.getY(Math.floor(K2/2))<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t}g.computeVertexNormals()}
  return g;
}
/* Pièce découpée sur la surface d'un loft (vitres, phares, joncs) : lignes z dans [zA,zB], angles dans [a0,a1] (0 = côté +X, PI/2 = dessus) */
function loftPatch(geo,zA,zB,a0,a1,off){
  const S=geo.userData.S,R=geo.userData.R,P=geo.attributes.position,N=geo.attributes.normal,rows=[];
  for(let j=0;j<R;j++){const z=P.getZ(j*(S+1));if(z>=zA-1e-6&&z<=zB+1e-6)rows.push(j)}
  const toI=a=>Math.round((a+Math.PI/2)/TAU*S),i0=toI(a0),i1=toI(a1),pos=[],nor=[],uv=[],idx=[],C=i1-i0+1;
  if(rows.length<2||C<2)return null;
  for(let r=0;r<rows.length;r++)for(let c=0;c<C;c++){const i=((i0+c)%S+S)%S,k=rows[r]*(S+1)+i;
    pos.push(P.getX(k)+N.getX(k)*off,P.getY(k)+N.getY(k)*off,P.getZ(k)+N.getZ(k)*off);nor.push(N.getX(k),N.getY(k),N.getZ(k));uv.push(c/(C-1),r/(rows.length-1))}
  for(let r=0;r<rows.length-1;r++)for(let c=0;c<C-1;c++){const a=r*C+c,b=a+1,d=a+C,e=d+1;idx.push(a,b,d,b,e,d)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
}
/* ---------- placement ---------- */
function add(par,geo,mat,x,y,z,rx,ry,rz,o){
  const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);
  m.castShadow=!(o&&o.noShadow);m.receiveShadow=!!(o&&o.recv);if(par)par.add(m);return m;
}
const v3=(a)=>a.isVector3?a.clone():new THREE.Vector3(a[0],a[1],a[2]);
function between(par,geoFn,mat,a,b){a=v3(a);b=v3(b);const d=b.clone().sub(a),L=d.length();const m=add(par,geoFn(L),mat,a.x,a.y,a.z);m.quaternion.setFromUnitVectors(Y,d.normalize());return m}
function rod(par,a,b,r,mat,seg){return between(par,L=>new THREE.CylinderGeometry(r,r,L,seg||14).translate(0,L/2,0),mat,a,b)}
function bone(par,a,b,r1,r2,mat,bulge){
  a=v3(a);b=v3(b);const g=new THREE.Group();g.position.copy(a);par.add(g);const d=b.clone().sub(a),L=d.length();
  const m=add(g,limbGeo(L,r1,r2,bulge),mat);m.quaternion.setFromUnitVectors(Y,d.clone().normalize());g.userData.tip=d;g.userData.mesh=m;return g;
}
function ik2(S,T,a,b,pole){
  S=v3(S);T=v3(T);const d=T.clone().sub(S);let L=d.length();const dir=d.clone().normalize();L=Math.min(L,a+b-1e-3);
  const ca=(a*a+L*L-b*b)/(2*a*L),sa=Math.sqrt(Math.max(0,1-ca*ca));const p=v3(pole);p.addScaledVector(dir,-p.dot(dir)).normalize();
  return S.clone().addScaledVector(dir,a*ca).addScaledVector(p,a*sa);
}
/* ---------- fusion statique (une seule géométrie par matériau) ---------- */
function merge(group){
  group.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(group.matrixWorld).invert(),bk=new Map(),mx=new THREE.Matrix4(),nm=new THREE.Matrix3(),v=new THREE.Vector3();
  group.traverse(m=>{
    if(!m.isMesh)return;let g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;
    mx.multiplyMatrices(inv,m.matrixWorld);nm.getNormalMatrix(mx);const P=g.attributes.position,N=g.attributes.normal,U=g.attributes.uv,flip=mx.determinant()<0;
    const key=m.material.uuid;let b=bk.get(key);if(!b){b={mat:m.material,p:[],n:[],u:[],cast:false,recv:false,ro:m.renderOrder};bk.set(key,b)}b.cast=b.cast||m.castShadow;b.recv=b.recv||m.receiveShadow;
    for(let i=0;i<P.count;i++){const j=flip?(i%3===1?i+1:i%3===2?i-1:i):i;
      v.fromBufferAttribute(P,j).applyMatrix4(mx);b.p.push(v.x,v.y,v.z);
      v.fromBufferAttribute(N,j).applyMatrix3(nm).normalize();b.n.push(v.x,v.y,v.z);
      if(U)b.u.push(U.getX(j),U.getY(j));else b.u.push(0,0)}
  });
  const out=new THREE.Group();
  for(const b of bk.values()){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));g.computeBoundingSphere();
    const m=new THREE.Mesh(g,b.mat);m.castShadow=b.cast;m.receiveShadow=b.recv;m.renderOrder=b.ro;out.add(m)}
  return out;
}
/* ---------- casque intégral ---------- */
function helmet(par,shell,visor,o){
  o=o||{};const r=o.r||.155,g=new THREE.Group();par.add(g);
  if(o.style==='urban'){add(g,new THREE.SphereGeometry(r,32,16,0,TAU,0,Math.PI*.56),shell,0,0,0).scale.set(.94,1,1.1);add(g,new THREE.SphereGeometry(r*.97,24,12,0,TAU,0,Math.PI*.56),M.plastic(0x1a1a1a,{side:THREE.BackSide}),0,0,0).scale.set(.94,1,1.1)}
  else add(g,new THREE.SphereGeometry(r,32,22),shell,0,0,0).scale.set(.94,1,1.1);
  if(o.style==='jet'){
    add(g,new THREE.SphereGeometry(r*1.035,28,14,Math.PI/2-1.25,2.5,1.05,.85),visor,0,.005,.0).scale.set(.94,1,1.1);
    add(g,lathe([[0,0],[r*.32,0],[r*.36,r*.18],[r*.3,r*.42],[0,r*.46]],18),M.plastic(0x2a2c2e),0,-r*.45,r*.78,1.9);
    add(g,tube([[r*.28,-r*.72,r*.7],[r*.55,-r*1.3,r*.55],[r*.75,-r*2.1,r*.15]],r*.07),M.plastic(0x3a3d35),0,0,0);
    add(g,rbox(r*.5,r*.18,r*.5,r*.08),shell,0,r*.92,-r*.1);
  }else if(o.style==='urban'){
    add(g,rbox(r*1.7,r*.12,r*.5,r*.05),shell,0,r*.15,r*1.0,.25);
    for(let i=-1;i<=1;i++)add(g,rbox(r*.1,r*.05,r*.45,r*.02),M.plastic(0x222222),i*r*.3,r*.93,-r*.05);
  }else{
    add(g,new THREE.SphereGeometry(r*1.02,28,12,Math.PI/2-1.1,2.2,1.15,.72),visor,0,0,0).scale.set(.94,1,1.1);
    const chin=add(g,new THREE.SphereGeometry(r*.98,24,10,Math.PI/2-.9,1.8,1.95,.75),shell,0,-r*.02,r*.05);chin.scale.set(.94,1,1.14);
    if(o.spoiler!==false)add(g,rbox(r*.9,r*.14,r*.5,r*.06),shell,0,r*.55,-r*.95,-.5);
    for(const s of[-1,1])add(g,new THREE.CylinderGeometry(r*.13,r*.13,r*.05,16),M.plastic(0x1a1a1a),s*r*.93,-r*.02,r*.12,0,0,Math.PI/2);
  }
  return g;
}
return Object.assign(K,{rng,canvasTex,setEnv,M,treadTex,noiseTex,carbonTex,labelTex,loft,loftPatch,rbox,lathe,limbGeo,tube,extrude,polyShape,tireGeo,tireMat,rimGeo,discGeo,wing,add,between,rod,bone,ik2,merge,helmet,TAU});
})();
}
