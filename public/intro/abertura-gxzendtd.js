function X(e,n,i){let a=(t,f)=>{let l=e.createShader(t);if(!l)return null;if(e.shaderSource(l,f),e.compileShader(l),!e.getShaderParameter(l,e.COMPILE_STATUS))return e.deleteShader(l),null;return l},r=a(e.VERTEX_SHADER,n),s=a(e.FRAGMENT_SHADER,i);if(!r||!s)return null;let c=e.createProgram();if(!c)return null;if(e.attachShader(c,r),e.attachShader(c,s),e.linkProgram(c),!e.getProgramParameter(c,e.LINK_STATUS))return null;return c}var G=null;function ct(){try{let n=document.createElement("canvas").getContext("webgl");if(!n)return"";let i=n.getExtension("WEBGL_debug_renderer_info"),a=String(n.getParameter(i?i.UNMASKED_RENDERER_WEBGL:n.RENDERER)??"");return n.getExtension("WEBGL_lose_context")?.loseContext(),a}catch{return""}}function lt(e,n,i){let a=e.toLowerCase();if(!a)return"baixa";if(/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|mesa offscreen|software rasterizer/.test(a))return"baixa";let r=a.includes("intel");if(r&&!/iris|uhd|arc/.test(a)){if(/gma|hd graphics (2000|2500|3000|4000|4200|4400|4600|5000|5100|5200|5300|5500|5600|6000|6100)\b/.test(a))return"baixa";if(/hd graphics(?! \d)/.test(a))return"baixa"}if(n<=2||i<=2)return"baixa";if(r&&!/iris\(r\) xe|iris xe|arc/.test(a))return"media";if(/radeon.*(\br[2-7]\b|vega (3|6|8)\b|graphics)/.test(a))return"media";if(n<=4||i<=4)return"media";return"alta"}function tt(){if(G)return G;let e=navigator;if(G=lt(ct(),e.hardwareConcurrency??4,e.deviceMemory??8),typeof document<"u")document.documentElement.dataset.fxNivel=G;return G}var at=4000;function et(e){let n=e>>>0;return()=>{n=n+1831565813>>>0;let i=Math.imul(n^n>>>15,1|n);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296}}function ut(e,n,i){let a=et(2310),r=[],s=[],c=[],t=Math.min(704,e*0.66),f=n*0.5,l=i==="alta"?14:10,F=7;function b(o){let v=[{x:o.x,y:o.y,t:o.t0,w:o.w0}],{x:m,y:S,ang:A}=o,M=0,w=Math.ceil(o.comp/7);for(let h=1;h<=w;h++){if(o.alvo){let _=Math.atan2(o.alvo.y-S,o.alvo.x-m)-A;while(_>Math.PI)_-=Math.PI*2;while(_<-Math.PI)_+=Math.PI*2;A+=_*(0.035+0.12*(h/w)**2)}else A+=o.curva;A+=Math.sin(h*0.31+o.fase)*0.035,m+=Math.cos(A)*7,S+=Math.sin(A)*7,M+=7;let L=h/w;if(v.push({x:m,y:S,t:o.t0+M/o.vel,w:o.w0*(1-L*0.72)}),o.alvo&&Math.hypot(o.alvo.x-m,o.alvo.y-S)<10.5)break}return v}for(let o=0;o<l;o++){let v=o/(l-1),m=a()*0.85,S=o===0||o===l-1,A=S?o===0?-20:e+20:e*(0.06+0.88*v)+(a()-0.5)*60,M=S?n*(0.62+a()*0.2):n+24,w=(v-0.5)*0.92+(a()-0.5)*0.08,h={x:e/2+w*t,y:f+n*0.05+(a()-0.5)*24},L=Math.hypot(h.x-A,h.y-M),I=0+a()*0.18,_=1.3+a()*0.3,Z=L*1.25/(_-I),H=S?o===0?-0.35:Math.PI+0.35:-Math.PI/2+(a()-0.5)*0.5,x=b({x:A,y:M,ang:H,alvo:h,comp:L*1.6,t0:I,vel:Z,w0:4.6-m*2,curva:0,fase:a()*6.28});r.push({pts:x,z:m,principal:!0});let g=x[x.length-1];c.push({x:g.x,y:g.y,z:m,t:g.t});let B=x[Math.max(0,x.length-4)];s.push({x:g.x,y:g.y,z:m,ang:Math.atan2(g.y-B.y,g.x-B.x),tam:30+a()*12,t:g.t-0.05,tipo:1});let q=40+a()*50,D=0;for(let C=1;C<x.length-4;C++){if(D+=7,D<q)continue;if(D=0,q=45+a()*70,a()>0.74)continue;let p=x[C],z=x[C+1],N=Math.atan2(z.y-p.y,z.x-p.x),E=a()>0.5?1:-1,y=b({x:p.x,y:p.y,ang:N+E*(0.5+a()*0.45),comp:36+a()*120,t0:p.t,vel:Z*(1.05+a()*0.4),w0:p.w*0.6,curva:-E*(0.02+a()*0.035),fase:a()*6.28});r.push({pts:y,z:m,principal:!1});let W=y[y.length-1];if(s.push({x:W.x,y:W.y,z:m,ang:N+E*0.9,tam:15+a()*12,t:W.t,tipo:0}),a()<0.4&&y.length>6){let T=y[Math.floor(y.length/2)],V=y[Math.floor(y.length/2)+1],k=Math.atan2(V.y-T.y,V.x-T.x),d=b({x:T.x,y:T.y,ang:k-E*(0.6+a()*0.3),comp:18+a()*46,t0:T.t,vel:Z*1.3,w0:T.w*0.6,curva:E*0.03,fase:a()*6.28});r.push({pts:d,z:m,principal:!1});let R=d[d.length-1];s.push({x:R.x,y:R.y,z:m,ang:k-E*0.8,tam:11+a()*9,t:R.t,tipo:0})}if(a()<0.5)s.push({x:p.x,y:p.y,z:m,ang:N-E*1.1,tam:12+a()*10,t:p.t+0.05,tipo:0})}}return{ramos:r,folhas:s,rajadas:c}}var J=`
uniform vec2 uRes; uniform float uCam; uniform vec2 uMouse;
vec2 projeta(vec2 p, float z){
  vec2 c = uRes * 0.5;
  float persp = uCam / (1.0 + z * 0.75);
  vec2 s = c + (p - c) * persp + uMouse * (1.0 - z) * 18.0;
  return vec2(s.x / uRes.x * 2.0 - 1.0, 1.0 - s.y / uRes.y * 2.0);
}`,ft=`
attribute vec2 aPos; attribute vec2 aNrm; attribute float aZ; attribute float aSide; attribute float aT; attribute float aW;
uniform float uTime; uniform float uLarg; uniform float uDpr;
varying float vSide; varying float vVis; varying float vHead; varying float vZ; varying float vPulso; varying float vW;
${J}
void main(){
  float idade = uTime - aT;
  vVis = clamp(idade / 0.05, 0.0, 1.0);
  vHead = idade >= 0.0 ? exp(-idade * 7.0) : 0.0;
  vSide = aSide; vZ = aZ; vW = clamp((aW - 0.4) / 2.5, 0.0, 1.0);
  // seiva/luz que sobe da base às pontas enquanto a assinatura se escreve
  float onda = (uTime - (1.2 + aT * 0.38)) * 5.0;
  vPulso = exp(-onda * onda);
  float persp = uCam / (1.0 + aZ * 0.75);
  vec2 p = aPos + aNrm * aSide * aW * uLarg / max(persp, 0.3);
  gl_Position = vec4(projeta(p, aZ), 0.0, 1.0);
}`,mt=`
precision mediump float;
uniform float uForca; uniform float uFade; uniform float uHalo;
varying float vSide; varying float vVis; varying float vHead; varying float vZ; varying float vPulso; varying float vW;
void main(){
  float s = vSide;
  if (uHalo > 0.5) {
    float h = exp(-s * s * 1.6) * vVis * uForca * (1.0 - vZ * 0.6) * (0.5 + vPulso * 1.8 + vHead) * uFade;
    gl_FragColor = vec4(vec3(1.0, 0.68, 0.3) * h, h);
    return;
  }
  float tubo = sqrt(max(1.0 - s * s, 0.0));
  float a = smoothstep(1.0, 0.72, abs(s)) * vVis * uFade;
  vec3 oliva = vec3(0.36, 0.40, 0.15);
  vec3 ouro = vec3(0.90, 0.64, 0.27);
  vec3 base = mix(ouro, oliva, vW * 0.7);
  float luz = 0.32 + 0.68 * tubo * (0.72 + 0.28 * s);
  float fio = pow(tubo, 16.0) * 0.4 * (0.5 + 0.5 * s);
  vec3 cor = base * luz + vec3(1.0, 0.9, 0.7) * fio + vec3(1.0, 0.78, 0.4) * (vHead * 0.7 + vPulso * 0.55);
  cor = mix(cor, vec3(0.13, 0.24, 0.18), vZ * 0.5); // atmosfera: o que está longe fica esverdeado e apagado
  a *= 1.0 - vZ * 0.25;
  gl_FragColor = vec4(cor * a, a);
}`,dt=`
attribute vec2 aPos; attribute vec2 aCanto; attribute float aZ; attribute float aAng; attribute float aTam; attribute float aT;
attribute float aTipo;
uniform float uTime;
varying vec2 vUv; varying float vVis; varying float vZ; varying float vTipo;
${J}
void main(){
  float idade = uTime - aT;
  float b = clamp(idade / (aTipo > 0.5 ? 0.35 : 0.5), 0.0, 1.0);
  b = 1.0 - pow(1.0 - b, 3.0);
  float s = aTam * b * (1.0 + 0.12 * sin(clamp(idade, 0.0, 1.0) * 6.0) * (1.0 - b));
  float c = cos(aAng), sn = sin(aAng);
  float largura = aTipo > 0.5 ? 0.3 : 0.42;
  vec2 l = vec2(aCanto.x * s, aCanto.y * s * largura);
  vec2 off = vec2(l.x * c - l.y * sn, l.x * sn + l.y * c);
  vUv = aCanto; vVis = clamp(idade / 0.12, 0.0, 1.0); vZ = aZ; vTipo = aTipo;
  gl_Position = vec4(projeta(aPos + off + vec2(c, sn) * s, aZ), 0.0, 1.0);
}`,vt=`
precision mediump float;
uniform float uFade;
varying vec2 vUv; varying float vVis; varying float vZ; varying float vTipo;
void main(){
  float x = (vUv.x + 1.0) * 0.5;  // 0 na base, 1 na ponta
  float y = vUv.y;                 // -1 a 1 na largura
  float a; vec3 cor;
  if (vTipo > 0.5) {
    float corpo = step(x, 0.78);
    float fila = fract(x * 9.0);
    float lado = mod(floor(x * 9.0), 2.0) * 2.0 - 1.0;
    float grao = smoothstep(1.0, 0.7, length(vec2((fila - 0.5) * 2.2, (y - lado * 0.32) * 1.6))) * corpo * step(0.06, x);
    float barbas = 0.0;
    for (int k = 0; k < 3; k++) {
      float yk = (float(k) - 1.0) * 0.35 * (0.3 + (x - 0.7) * 2.5);
      barbas = max(barbas, smoothstep(0.09, 0.02, abs(y - yk)) * step(0.7, x));
    }
    float haste = smoothstep(0.12, 0.05, abs(y)) * step(x, 0.12);
    a = max(max(grao, barbas * 0.8), haste);
    float sombra = 0.75 + 0.25 * (1.0 - fila) + 0.1 * y;
    cor = mix(vec3(0.78, 0.54, 0.2), vec3(0.98, 0.78, 0.42), grao * (1.0 - fila * 0.5)) * sombra;
  } else {
    float meia = 0.95 * pow(sin(3.14159 * clamp(x, 0.0, 1.0)), 0.75) * (1.0 - x * 0.25);
    a = smoothstep(meia, meia - 0.12, abs(y));
    float nervura = exp(-y * y * 90.0);
    float laterais = smoothstep(0.08, 0.0, abs(fract(x * 5.0 - abs(y) * 1.6) - 0.5) - 0.42) * 0.25;
    vec3 verde = mix(vec3(0.24, 0.40, 0.10), vec3(0.56, 0.62, 0.20), x);
    float sombra = y > 0.0 ? 1.0 : 0.72;
    float borda = smoothstep(meia - 0.05, meia - 0.25, abs(y));
    cor = verde * sombra * (0.7 + 0.3 * borda) + vec3(0.75, 0.8, 0.45) * (nervura * 0.35 + laterais * 0.3);
  }
  cor = mix(cor, vec3(0.13, 0.24, 0.18), vZ * 0.5);
  a *= vVis * uFade * (1.0 - vZ * 0.25);
  gl_FragColor = vec4(cor * a, a);
}`,pt=`
attribute vec2 aPos; attribute float aZ; attribute float aTam; attribute vec4 aExtra; // extra: semente, nascimento, vx, vy
uniform float uTime; uniform float uDpr;
varying float vA;
${J}
void main(){
  vec2 p = aPos;
  float a;
  if (aExtra.y < 0.0) {
    // pólen ambiente: sobe devagar e balança, dá a volta na tela
    float vel = 14.0 + (1.0 - aZ) * 26.0;
    p.y = mod(aPos.y - uTime * vel, uRes.y + 80.0) - 40.0;
    p.x += sin(uTime * 0.6 + aExtra.x * 6.28) * 14.0;
    a = (0.25 + (1.0 - aZ) * 0.6) * smoothstep(0.0, 0.8, uTime);
  } else {
    // rajada: sai do ponto onde o ramo chegou, abre e some
    float idade = uTime - aExtra.y;
    if (idade < 0.0) { gl_Position = vec4(2.0); gl_PointSize = 0.0; vA = 0.0; return; }
    p += vec2(aExtra.z, aExtra.w) * (1.0 - exp(-idade * 2.2)) * 60.0 + vec2(0.0, -idade * 18.0);
    a = exp(-idade * 1.8) * 0.6;
  }
  float persp = uCam / (1.0 + aZ * 0.75);
  vA = a;
  gl_Position = vec4(projeta(p, aZ), 0.0, 1.0);
  gl_PointSize = aTam * persp * uDpr;
}`,bt=`
precision mediump float;
uniform float uFade;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = exp(-d * d * 3.2) * vA * uFade;
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * k, k);
}`;function ht(e){let n=[];for(let i of e)for(let a=0;a<i.pts.length-1;a++){let r=i.pts[a],s=i.pts[a+1],c=s.x-r.x,t=s.y-r.y,f=Math.hypot(c,t)||1,l=-t/f,F=c/f,b=(v)=>[r.x,r.y,l,F,i.z,v,r.t,r.w],o=(v)=>[s.x,s.y,l,F,i.z,v,s.t,s.w];n.push(...b(-1),...b(1),...o(-1),...b(1),...o(1),...o(-1))}return new Float32Array(n)}function xt(e){let n=[],i=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];for(let a of e)for(let[r,s]of i)n.push(a.x,a.y,r,s,a.z,a.ang,a.tam,a.t,a.tipo);return new Float32Array(n)}function gt(e,n,i,a){let r=et(77),s=[],c=i==="alta"?260:150;for(let t=0;t<c;t++){let f=r();s.push(r()*e,r()*(n+80),f,2+(1-f)*(1-f)*18*(r()<0.15?2.2:1),r(),-1,0,0)}for(let t of a)for(let f=0;f<14;f++){let l=f/14*Math.PI*2+r()*0.4,F=0.4+r()*0.8;s.push(t.x,t.y,t.z,3+r()*7,r(),t.t,Math.cos(l)*F,Math.sin(l)*F-0.3)}return{dados:new Float32Array(s),qtd:s.length/8}}function ot(e,n,i,a=!1){let r=tt();if(r==="baixa"&&!a)return!1;let s=r==="baixa"?"media":r,c=document.createElement("canvas");c.setAttribute("aria-hidden","true"),c.className="intro-canvas";let t=c.getContext("webgl",{alpha:!0,antialias:!0,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:"high-performance"});if(!t)return!1;let f=X(t,ft,mt),l=X(t,dt,vt),F=X(t,pt,bt);if(!f||!l||!F)return!1;let{innerWidth:b,innerHeight:o}=window,v=Math.min(window.devicePixelRatio||1,s==="alta"?2:1.25),m=()=>{c.width=Math.round(b*v),c.height=Math.round(o*v),t.viewport(0,0,c.width,c.height)};m(),document.body.appendChild(c);let{ramos:S,folhas:A,rajadas:M}=ut(b,o,s),w=t.createBuffer(),h=ht(S);t.bindBuffer(t.ARRAY_BUFFER,w),t.bufferData(t.ARRAY_BUFFER,h,t.STATIC_DRAW);let L=t.createBuffer(),I=xt(A);t.bindBuffer(t.ARRAY_BUFFER,L),t.bufferData(t.ARRAY_BUFFER,I,t.STATIC_DRAW);let _=t.createBuffer(),Z=gt(b,o,s,M);t.bindBuffer(t.ARRAY_BUFFER,_),t.bufferData(t.ARRAY_BUFFER,Z.dados,t.STATIC_DRAW);let H=(d,R,j)=>{t.useProgram(d),t.bindBuffer(t.ARRAY_BUFFER,R);let K=j.reduce((P,[,O])=>P+O,0)*4,U=0,u=[];for(let[P,O]of j){let Y=t.getAttribLocation(d,P);if(Y>=0)t.enableVertexAttribArray(Y),t.vertexAttribPointer(Y,O,t.FLOAT,!1,K,U),u.push(Y);U+=O*4}return()=>u.forEach((P)=>t.disableVertexAttribArray(P))},x=(d)=>(R)=>t.getUniformLocation(d,R);t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE);let g=0,B=0,q=0,D=0,C=(d)=>{q=(d.clientX/b-0.5)*2,D=(d.clientY/o-0.5)*2};window.addEventListener("pointermove",C,{passive:!0});let p=0,z=0,N=!1,E=0,y=0,W=document.documentElement,T=()=>{if(N)return;N=!0,cancelAnimationFrame(z),window.removeEventListener("pointermove",C),V.disconnect(),t.getExtension("WEBGL_lose_context")?.loseContext(),c.remove(),i()},V=new MutationObserver(()=>{if(!W.classList.contains("intro-ativa"))T()});V.observe(W,{attributes:!0,attributeFilter:["class"]});let k=(d)=>{if(N)return;if(!p)p=d,n();let R=(d-p)/1000;if(y&&d-y>28)E++;if(y=d,E>12&&v>1)v=1,E=-1000,m();g+=(q-g)*0.06,B+=(D-B)*0.06;let j=1+0.07*(1-Math.exp(-R*0.55)),K=1-Math.min(1,Math.max(0,(R-2.9)/0.6));t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT);let U=(u)=>{t.uniform2f(u("uRes"),b,o),t.uniform1f(u("uCam"),j),t.uniform2f(u("uMouse"),-g,-B),t.uniform1f(u("uTime"),R),t.uniform1f(u("uFade"),K),t.uniform1f(u("uDpr"),v)};t.blendFunc(t.ONE,t.ONE);{let u=x(F),P=H(F,_,[["aPos",2],["aZ",1],["aTam",1],["aExtra",4]]);U(u),t.drawArrays(t.POINTS,0,Z.qtd),P()}{let u=x(f),P=H(f,w,[["aPos",2],["aNrm",2],["aZ",1],["aSide",1],["aT",1],["aW",1]]);U(u);let O=h.length/8;t.blendFunc(t.ONE,t.ONE),t.uniform1f(u("uHalo"),1),t.uniform1f(u("uLarg"),6),t.uniform1f(u("uForca"),0.09),t.drawArrays(t.TRIANGLES,0,O),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.uniform1f(u("uHalo"),0),t.uniform1f(u("uLarg"),1),t.drawArrays(t.TRIANGLES,0,O),P()}{let u=x(l),P=H(l,L,[["aPos",2],["aCanto",2],["aZ",1],["aAng",1],["aTam",1],["aT",1],["aTipo",1]]);U(u),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.drawArrays(t.TRIANGLES,0,I.length/9),P()}if(d-p>at+1500){T();return}z=requestAnimationFrame(k)};return z=requestAnimationFrame(k),!0}var nt=at;var it=window,Q=document.documentElement,rt=it.__intro3d??={comecou:!1,caiu:!1};function st(){if(rt.caiu||!Q.classList.contains("intro-3d"))return;let e=document.querySelector(".intro-cobertura");if(!document.body||!e){requestAnimationFrame(st);return}let n=/[?&]intro=3d/.test(location.search);if(!ot(e,()=>{rt.comecou=!0,Q.classList.add("intro-3d-rodando"),window.setTimeout(()=>Q.classList.remove("intro-ativa"),nt)},()=>{},n))it.__introCair?.()}st();
