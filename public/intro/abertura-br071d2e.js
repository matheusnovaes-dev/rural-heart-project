function X(a,n,o){let e=(t,f)=>{let u=a.createShader(t);if(!u)return null;if(a.shaderSource(u,f),a.compileShader(u),!a.getShaderParameter(u,a.COMPILE_STATUS))return a.deleteShader(u),null;return u},r=e(a.VERTEX_SHADER,n),s=e(a.FRAGMENT_SHADER,o);if(!r||!s)return null;let c=a.createProgram();if(!c)return null;if(a.attachShader(c,r),a.attachShader(c,s),a.linkProgram(c),!a.getProgramParameter(c,a.LINK_STATUS))return null;return c}var k=null;function ct(){try{let n=document.createElement("canvas").getContext("webgl");if(!n)return"";let o=n.getExtension("WEBGL_debug_renderer_info"),e=String(n.getParameter(o?o.UNMASKED_RENDERER_WEBGL:n.RENDERER)??"");return n.getExtension("WEBGL_lose_context")?.loseContext(),e}catch{return""}}function lt(a,n,o){let e=a.toLowerCase();if(!e)return"baixa";if(/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|mesa offscreen|software rasterizer/.test(e))return"baixa";let r=e.includes("intel");if(r&&!/iris|uhd|arc/.test(e)){if(/gma|hd graphics (2000|2500|3000|4000|4200|4400|4600|5000|5100|5200|5300|5500|5600|6000|6100)\b/.test(e))return"baixa";if(/hd graphics(?! \d)/.test(e))return"baixa"}if(n<=2||o<=2)return"baixa";if(r&&!/iris\(r\) xe|iris xe|arc/.test(e))return"media";if(/radeon.*(\br[2-7]\b|vega (3|6|8)\b|graphics)/.test(e))return"media";if(n<=4||o<=4)return"media";return"alta"}function tt(){if(k)return k;let a=navigator;if(k=lt(ct(),a.hardwareConcurrency??4,a.deviceMemory??8),typeof document<"u")document.documentElement.dataset.fxNivel=k;return k}var et=3000;function at(a){let n=a>>>0;return()=>{n=n+1831565813>>>0;let o=Math.imul(n^n>>>15,1|n);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296}}function ut(a,n,o){let e=at(2310),r=[],s=[],c=[],t=Math.min(704,a*0.66),f=n*0.5,u=o==="alta"?9:7,w=7;function b(i){let v=[{x:i.x,y:i.y,t:i.t0,w:i.w0}],{x:m,y:_,ang:A}=i,M=0,F=Math.ceil(i.comp/7);for(let h=1;h<=F;h++){if(i.alvo){let S=Math.atan2(i.alvo.y-_,i.alvo.x-m)-A;while(S>Math.PI)S-=Math.PI*2;while(S<-Math.PI)S+=Math.PI*2;A+=S*(0.035+0.12*(h/F)**2)}else A+=i.curva;A+=Math.sin(h*0.31+i.fase)*0.035,m+=Math.cos(A)*7,_+=Math.sin(A)*7,M+=7;let L=h/F;if(v.push({x:m,y:_,t:i.t0+M/i.vel,w:i.w0*(1-L*0.72)}),i.alvo&&Math.hypot(i.alvo.x-m,i.alvo.y-_)<10.5)break}return v}for(let i=0;i<u;i++){let v=i/(u-1),m=e()*0.85,_=!1,A=a*(0.1+0.8*v)+(e()-0.5)*50,M=n+24,F=(v-0.5)*0.92+(e()-0.5)*0.08,h={x:a/2+F*t,y:f+n*0.05+(e()-0.5)*24},L=Math.hypot(h.x-A,h.y-M),I=0+e()*0.12,S=0.95+e()*0.25,B=L*1.25/(S-I),U=-Math.PI/2+(e()-0.5)*0.5,x=b({x:A,y:M,ang:U,alvo:h,comp:L*1.6,t0:I,vel:B,w0:6.2-m*2.6,curva:0,fase:e()*6.28});r.push({pts:x,z:m,principal:!0});let g=x[x.length-1];c.push({x:g.x,y:g.y,z:m,t:g.t});let Z=x[Math.max(0,x.length-4)];s.push({x:g.x,y:g.y,z:m,ang:Math.atan2(g.y-Z.y,g.x-Z.x),tam:30+e()*12,t:g.t-0.05,tipo:1});let q=40+e()*50,D=0;for(let C=1;C<x.length-4;C++){if(D+=7,D<q)continue;if(D=0,q=45+e()*70,e()>0.5)continue;let p=x[C],W=x[C+1],N=Math.atan2(W.y-p.y,W.x-p.x),E=e()>0.5?1:-1,y=b({x:p.x,y:p.y,ang:N+E*(0.5+e()*0.45),comp:36+e()*120,t0:p.t,vel:B*(1.05+e()*0.4),w0:p.w*0.6,curva:-E*(0.02+e()*0.035),fase:e()*6.28});r.push({pts:y,z:m,principal:!1});let z=y[y.length-1];if(s.push({x:z.x,y:z.y,z:m,ang:N+E*0.9,tam:15+e()*12,t:z.t,tipo:0}),e()<0.2&&y.length>6){let T=y[Math.floor(y.length/2)],V=y[Math.floor(y.length/2)+1],G=Math.atan2(V.y-T.y,V.x-T.x),d=b({x:T.x,y:T.y,ang:G-E*(0.6+e()*0.3),comp:18+e()*46,t0:T.t,vel:B*1.3,w0:T.w*0.6,curva:E*0.03,fase:e()*6.28});r.push({pts:d,z:m,principal:!1});let R=d[d.length-1];s.push({x:R.x,y:R.y,z:m,ang:G-E*0.8,tam:11+e()*9,t:R.t,tipo:0})}if(e()<0.5)s.push({x:p.x,y:p.y,z:m,ang:N-E*1.1,tam:12+e()*10,t:p.t+0.05,tipo:0})}}return{ramos:r,folhas:s,rajadas:c}}var J=`
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
  float onda = (uTime - (0.9 + aT * 0.38)) * 5.0;
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
    a = (0.12 + (1.0 - aZ) * 0.3) * smoothstep(0.0, 0.8, uTime);
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
}`;function ht(a){let n=[];for(let o of a)for(let e=0;e<o.pts.length-1;e++){let r=o.pts[e],s=o.pts[e+1],c=s.x-r.x,t=s.y-r.y,f=Math.hypot(c,t)||1,u=-t/f,w=c/f,b=(v)=>[r.x,r.y,u,w,o.z,v,r.t,r.w],i=(v)=>[s.x,s.y,u,w,o.z,v,s.t,s.w];n.push(...b(-1),...b(1),...i(-1),...b(1),...i(1),...i(-1))}return new Float32Array(n)}function xt(a){let n=[],o=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];for(let e of a)for(let[r,s]of o)n.push(e.x,e.y,r,s,e.z,e.ang,e.tam,e.t,e.tipo);return new Float32Array(n)}function gt(a,n,o,e){let r=at(77),s=[],c=o==="alta"?60:40;for(let t=0;t<c;t++){let f=r();s.push(r()*a,r()*(n+80),f,2+(1-f)*(1-f)*9,r(),-1,0,0)}for(let t of e)for(let f=0;f<6;f++){let u=f/14*Math.PI*2+r()*0.4,w=0.4+r()*0.8;s.push(t.x,t.y,t.z,3+r()*7,r(),t.t,Math.cos(u)*w,Math.sin(u)*w-0.3)}return{dados:new Float32Array(s),qtd:s.length/8}}function ot(a,n,o,e=!1){let r=tt();if(r==="baixa"&&!e)return!1;let s=r==="baixa"?"media":r,c=document.createElement("canvas");c.setAttribute("aria-hidden","true"),c.className="intro-canvas";let t=c.getContext("webgl",{alpha:!0,antialias:!0,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:"high-performance"});if(!t)return!1;let f=X(t,ft,mt),u=X(t,dt,vt),w=X(t,pt,bt);if(!f||!u||!w)return!1;let{innerWidth:b,innerHeight:i}=window,v=Math.min(window.devicePixelRatio||1,s==="alta"?2:1.25),m=()=>{c.width=Math.round(b*v),c.height=Math.round(i*v),t.viewport(0,0,c.width,c.height)};m(),document.body.appendChild(c);let{ramos:_,folhas:A,rajadas:M}=ut(b,i,s),F=t.createBuffer(),h=ht(_);t.bindBuffer(t.ARRAY_BUFFER,F),t.bufferData(t.ARRAY_BUFFER,h,t.STATIC_DRAW);let L=t.createBuffer(),I=xt(A);t.bindBuffer(t.ARRAY_BUFFER,L),t.bufferData(t.ARRAY_BUFFER,I,t.STATIC_DRAW);let S=t.createBuffer(),B=gt(b,i,s,M);t.bindBuffer(t.ARRAY_BUFFER,S),t.bufferData(t.ARRAY_BUFFER,B.dados,t.STATIC_DRAW);let U=(d,R,j)=>{t.useProgram(d),t.bindBuffer(t.ARRAY_BUFFER,R);let K=j.reduce((P,[,O])=>P+O,0)*4,H=0,l=[];for(let[P,O]of j){let Y=t.getAttribLocation(d,P);if(Y>=0)t.enableVertexAttribArray(Y),t.vertexAttribPointer(Y,O,t.FLOAT,!1,K,H),l.push(Y);H+=O*4}return()=>l.forEach((P)=>t.disableVertexAttribArray(P))},x=(d)=>(R)=>t.getUniformLocation(d,R);t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE);let g=0,Z=0,q=0,D=0,C=(d)=>{q=(d.clientX/b-0.5)*2,D=(d.clientY/i-0.5)*2};window.addEventListener("pointermove",C,{passive:!0});let p=0,W=0,N=!1,E=0,y=0,z=document.documentElement,T=()=>{if(N)return;N=!0,cancelAnimationFrame(W),window.removeEventListener("pointermove",C),V.disconnect(),t.getExtension("WEBGL_lose_context")?.loseContext(),c.remove(),o()},V=new MutationObserver(()=>{if(!z.classList.contains("intro-ativa"))T()});V.observe(z,{attributes:!0,attributeFilter:["class"]});let G=(d)=>{if(N)return;if(!p)p=d,n();let R=(d-p)/1000;if(y&&d-y>28)E++;if(y=d,E>12&&v>1)v=1,E=-1000,m();g+=(q-g)*0.06,Z+=(D-Z)*0.06;let j=1+0.07*(1-Math.exp(-R*0.55)),K=1-Math.min(1,Math.max(0,(R-2.9)/0.2));t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT);let H=(l)=>{t.uniform2f(l("uRes"),b,i),t.uniform1f(l("uCam"),j),t.uniform2f(l("uMouse"),-g,-Z),t.uniform1f(l("uTime"),R),t.uniform1f(l("uFade"),K),t.uniform1f(l("uDpr"),v)};t.blendFunc(t.ONE,t.ONE);{let l=x(w),P=U(w,S,[["aPos",2],["aZ",1],["aTam",1],["aExtra",4]]);H(l),t.drawArrays(t.POINTS,0,B.qtd),P()}{let l=x(f),P=U(f,F,[["aPos",2],["aNrm",2],["aZ",1],["aSide",1],["aT",1],["aW",1]]);H(l);let O=h.length/8;t.blendFunc(t.ONE,t.ONE),t.uniform1f(l("uHalo"),1),t.uniform1f(l("uLarg"),6),t.uniform1f(l("uForca"),0.09),t.drawArrays(t.TRIANGLES,0,O),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.uniform1f(l("uHalo"),0),t.uniform1f(l("uLarg"),1),t.drawArrays(t.TRIANGLES,0,O),P()}{let l=x(u),P=U(u,L,[["aPos",2],["aCanto",2],["aZ",1],["aAng",1],["aTam",1],["aT",1],["aTipo",1]]);H(l),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.drawArrays(t.TRIANGLES,0,I.length/9),P()}if(d-p>et+1500){T();return}W=requestAnimationFrame(G)};return W=requestAnimationFrame(G),!0}var nt=et;var it=window,Q=document.documentElement,rt=it.__intro3d??={comecou:!1,caiu:!1};function yt(){let a=document.querySelector(".intro-svg"),n=document.querySelector("header a[href='/'] span");if(!a||!n)return;let o=a.getBoundingClientRect(),e=n.getBoundingClientRect();if(!o.width||!e.width)return;let r=o.width*0.9307,s=o.left+o.width/2,c=o.top+o.height*0.4613,t=e.width/r*1.15;a.style.setProperty("--voa-x",`${Math.round(e.left+e.width/2-s)}px`),a.style.setProperty("--voa-y",`${Math.round(e.top+e.height/2-c)}px`),a.style.setProperty("--voa-s",t.toFixed(3))}function st(){if(rt.caiu||!Q.classList.contains("intro-3d"))return;let a=document.querySelector(".intro-cobertura");if(!document.body||!a){requestAnimationFrame(st);return}let n=/[?&]intro=3d/.test(location.search);if(!ot(a,()=>{rt.comecou=!0,Q.classList.add("intro-3d-rodando"),window.setTimeout(yt,1500),window.setTimeout(()=>Q.classList.remove("intro-ativa"),nt)},()=>{},n))it.__introCair?.()}st();
