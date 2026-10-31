/* p5.js global-mode sketch. Controls are ordinary accessible HTML inputs. */
'use strict';
const P = PendulumPhysics;
const H = 1/480;
const S = {length:4,gravity:5,damping:0.03125,count:15,meanAngle:1.5,meanOmega:0,stdAngle:0.02,stdOmega:0.02,seed:42,distribution:'gaussian',arrowDensity:16,arrowLength:14,logGain:1,omegaMax:4,trailSeconds:5,rate:1};
let bodies=[],t=0,ticks=0,accumulator=0,running=true,heat,heatKey='',view,dragging=false,resumeAfterDrag=false;
let smoothedFPS=60,limitedUntil=0,renderTime=0,skipNextFrame=false;
let reference=null,simulationBodies=[],displayedReference=null;
const energyHistory=new EnergyHistory();
let appliedPhysics=null;
const physicsSnapshot=()=>({length:S.length,gravity:S.gravity,damping:S.damping});
const controls={};
const $ = id => document.getElementById(id);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function fieldControl(parent,key,label,min,max,step,unit) {
  const div=document.createElement('div'); div.className='control';
  const row=document.createElement('div'); row.className='row';
  const lab=document.createElement('label'); lab.htmlFor=key; lab.innerHTML=label+' <span class="unit">'+unit+'</span>';
  const number=document.createElement('input'); Object.assign(number,{type:'number',id:key,min,max,step,value:S[key]});
  const range=document.createElement('input'); Object.assign(range,{type:'range',min,max,step,value:S[key]}); range.setAttribute('aria-label',label);
  number.step=key==='count'?'1':'any';
  row.append(lab,number); div.append(row,range); $(parent).append(div); controls[key]={number,range};
  const set=value=>{ const n=Number(value);if(!Number.isFinite(n))return; S[key]=clamp(n,min,max);if(key==='count')S[key]=Math.round(S[key]);number.value=range.value=S[key]; };
  range.addEventListener('input',()=>{set(range.value); changed(key);});
  range.addEventListener('change',()=>{set(range.value);changed(key);});
  number.addEventListener('input',()=>{const value=Number(number.value);if(number.value!==''&&Number.isFinite(value)&&value>=min&&value<=max){S[key]=key==='count'?Math.round(value):value;range.value=S[key];changed(key);}});
  number.addEventListener('change',()=>{set(number.value);changed(key);});
}
function setControl(key,value){S[key]=value;controls[key].number.value=controls[key].range.value=value;}
function changed(key){
  if(['length','gravity','damping'].includes(key)){
    const next=physicsSnapshot();
    if(appliedPhysics&&Object.keys(next).some(k=>next[k]!==appliedPhysics[k])){
      // Preserve theta, omega, the integration clock, and the sampled ensemble.
      // Record both sides of an instantaneous parameter switch at the same time.
      energyHistory.record(t,bodies,appliedPhysics);
      energyHistory.record(t,bodies,next);
      if(next.length!==appliedPhysics.length)for(const b of simulationBodies){
        b.trail.push([b.theta,b.omega,t,appliedPhysics.length]);
        b.trail.push([b.theta,b.omega,t,next.length]);
      }
    }
    appliedPhysics=next;heatKey='';renderEnergy(true);
  }else if(!['omegaMax','trailSeconds','rate','arrowDensity','arrowLength','logGain'].includes(key)) restart();
  else heatKey='';
}
function setRunning(value){running=value;accumulator=0; $('play').textContent=running?'Pause':'Play';}
function bindControls(){
  fieldControl('physical-controls','length','Length',0.2,10,0.1,'m');
  fieldControl('physical-controls','gravity','Gravity',0.1,30,0.1,'m/s²');
  fieldControl('physical-controls','damping','Resistance γ',0,3,0.001,'s⁻¹');
  fieldControl('initial-controls','count','Pendulums',1,200,1,'');
  fieldControl('initial-controls','meanAngle','Mean angle',-Math.PI,Math.PI,0.01,'rad');
  fieldControl('initial-controls','meanOmega','Mean angular velocity',-20,20,0.01,'rad/s');
  fieldControl('initial-controls','stdAngle','Angle σ',0,0.5,0.01,'rad');
  fieldControl('initial-controls','stdOmega','Angular velocity σ',0,0.5,0.01,'rad/s');
  fieldControl('advanced-controls','omegaMax','Velocity axis ±',0.5,40,0.5,'rad/s');
  fieldControl('advanced-controls','arrowDensity','Arrow columns',5,45,1,'');
  fieldControl('advanced-controls','arrowLength','Max arrow length',2,40,1,'px');
  fieldControl('advanced-controls','logGain','Heatmap log gain',0.01,100,0.01,'');
  fieldControl('display-controls','trailSeconds','Trail duration',0,10,0.1,'s');
  fieldControl('display-controls','rate','Simulation speed',0.1,2,0.1,'×');
  $('distribution').addEventListener('change',e=>{S.distribution=e.target.value;restart();});
  $('seed').addEventListener('change',()=>{S.seed=clamp(Math.round(Number($('seed').value)||0),0,4294967295);$('seed').value=S.seed;restart();});
  for(const id of ['main','advanced']){
    const activate=()=>{for(const other of ['main','advanced']){$(other+'-panel').hidden=other!==id;$(other+'-tab').setAttribute('aria-selected',String(other===id));$(other+'-tab').tabIndex=other===id?0:-1;}};
    $(id+'-tab').onclick=activate;
    $(id+'-tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'main':e.key==='End'?'advanced':id==='main'?'advanced':'main';$(next+'-tab').click();$(next+'-tab').focus();}};
  }
  $('energy-toggle').onclick=()=>{const open=$('energy-panel').hidden;$('energy-panel').hidden=!open;$('energy-toggle').setAttribute('aria-expanded',String(open));renderEnergy(true);};
  $('energy-kind').onchange=()=>renderEnergy(true);
  $('play').onclick=()=>setRunning(!running);
  $('restart').onclick=()=>restart();
  $('resample').onclick=()=>{S.seed=(S.seed+1)>>>0;$('seed').value=S.seed;restart();};
  $('step').onclick=()=>{setRunning(false);for(let i=0;i<8;i++)advance();};
  document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|BUTTON|SUMMARY|TEXTAREA/.test(e.target.tagName)){e.preventDefault();setRunning(!running);}});
  document.addEventListener('visibilitychange',()=>{accumulator=0;skipNextFrame=true;});
}
function restart(){
  t=0;ticks=0;accumulator=0;heatKey='';appliedPhysics=physicsSnapshot();
  bodies=P.sampleInitial(S).map((state,i)=>({theta:state[0],omega:state[1],prevTheta:state[0],prevOmega:state[1],color:`hsl(${(215+i*137.508)%360} 78% 68%)`,trail:new P.Ring(602)}));
  // Compute the actual sample mean only once, at initialization.
  const initialMean=P.sampleMean(bodies.map(b=>[b.theta,b.omega]));
  reference=initialMean.theta===null?null:{theta:initialMean.theta,omega:initialMean.omega,prevTheta:initialMean.theta,prevOmega:initialMean.omega,color:'#66eda3',trail:new P.Ring(602)};
  simulationBodies=reference?[...bodies,reference]:bodies;
  simulationBodies.forEach(b=>b.trail.push([b.theta,b.omega,0,S.length]));
  energyHistory.reset();energyHistory.record(0,bodies,S);renderEnergy(true);
  $('distribution-note').textContent=S.distribution==='gaussian'?'Independent Gaussian draws, wrapped at ±π. Angle σ describes the unwrapped Gaussian.':'Independent uniform draws with half-width √3 × σ on each axis. Angles wrap at ±π.';
}
function advance(){
  const nextT=(ticks+1)*H;
  for(const b of simulationBodies){
    b.prevTheta=b.theta;b.prevOmega=b.omega;
    [b.theta,b.omega]=P.rk4(b.theta,b.omega,t,H,S);
  }
  ticks++;t=nextT;
  if(ticks%energyHistory.stride===0)energyHistory.record(t,bodies,S);
  if(ticks%8===0)for(const b of simulationBodies)b.trail.push([b.theta,b.omega,t,S.length]);
}
function setup(){
  const host=$('canvas-host');const w=host.clientWidth;
  const c=createCanvas(w,w>=790?570:830);c.parent(host);c.elt.setAttribute('aria-label','Live pendulum positions and phase-space portrait');c.elt.setAttribute('role','img');
  pixelDensity(Math.min(window.devicePixelRatio||1,2));textFont('system-ui');
  $('loading').remove();heat=createImage(168,112);bindControls();restart();
  new ResizeObserver(()=>{const w=host.clientWidth;if(Math.abs(w-width)>1){resizeCanvas(w,w>=790?570:830);heatKey='';}}).observe(host);
}
function layout(){
  const gap=24,margin=20;
  if(width>=790){const half=(width-3*margin)/2;return {physical:{x:margin,y:76,w:half,h:height-120},phase:{x:half+2*margin+45,y:90,w:half-64,h:height-155},pTitle:half+2*margin};}
  return {physical:{x:margin,y:65,w:width-2*margin,h:265},phase:{x:62,y:410,w:width-86,h:height-475},pTitle:margin};
}
function mapping(){
  const r=view.physical;
  const scale=Math.min((r.w-32)/(2*S.length+0.2),(r.h-30)/(2*S.length+0.2));
  return {scale,cx:r.x+r.w/2,cy:r.y+r.h/2};
}
function position(theta,time,length=S.length){const m=mapping();return [m.cx+m.scale*(length*Math.sin(theta)),m.cy+m.scale*length*Math.cos(theta)];}
function phasePosition(theta,omega){const r=view.phase;return [r.x+(P.wrap(theta)+Math.PI)/P.TAU*r.w,r.y+r.h/2-omega/S.omegaMax*r.h/2];}
function clipRect(r,fn){const c=drawingContext;c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();fn(c);c.restore();}
function colorAt(u){const stops=[[18,10,38],[80,28,106],[165,44,96],[237,112,64],[252,239,179]];const s=clamp(u,0,1)*4,i=Math.min(3,Math.floor(s)),a=s-i;return stops[i].map((v,j)=>v+(stops[i+1][j]-v)*a);}
function paintHeat(time){
  const r=view.phase;
  if(!$('heatmap').checked){noStroke();fill('#111b29');rect(r.x,r.y,r.w,r.h);return;}
  const key=[S.length,S.gravity,S.damping,S.omegaMax,S.logGain].join(',');
  if(key!==heatKey){
    heat.loadPixels();const bound=P.speedBound(S,S.omegaMax),den=Math.log1p(S.logGain*bound);
    for(let j=0;j<heat.height;j++)for(let i=0;i<heat.width;i++){
      const theta=-Math.PI+P.TAU*(i+.5)/heat.width,omega=S.omegaMax*(1-2*(j+.5)/heat.height);
      const rgb=colorAt(Math.log1p(S.logGain*P.speed(theta,omega,time,S))/den),k=4*(j*heat.width+i);
      heat.pixels[k]=rgb[0];heat.pixels[k+1]=rgb[1];heat.pixels[k+2]=rgb[2];heat.pixels[k+3]=255;
    }
    heat.updatePixels();heatKey=key;
  }
  image(heat,r.x,r.y,r.w,r.h);
}
function axes(time){
  const r=view.phase;paintHeat(time);
  stroke(220,235,255,38);strokeWeight(1);
  for(let i=0;i<=4;i++){const x=r.x+r.w*i/4;line(x,r.y,x,r.y+r.h);const y=r.y+r.h*i/4;line(r.x,y,r.x+r.w,y);}
  stroke(230,245,255,90);line(r.x+r.w/2,r.y,r.x+r.w/2,r.y+r.h);line(r.x,r.y+r.h/2,r.x+r.w,r.y+r.h/2);
  noFill();stroke('#43546a');rect(r.x,r.y,r.w,r.h);
  noStroke();fill('#95a9bf');textSize(11);textAlign(CENTER,TOP);
  ['−π','−π/2','0','π/2','π'].forEach((label,i)=>text(label,r.x+r.w*i/4,r.y+r.h+10));
  text('Angle θ (rad)',r.x+r.w/2,r.y+r.h+32);
  textAlign(RIGHT,CENTER);for(let i=0;i<=4;i++)text((S.omegaMax*(1-i/2)).toFixed(1),r.x-9,r.y+r.h*i/4);
  push();translate(r.x-46,r.y+r.h/2);rotate(-HALF_PI);textAlign(CENTER,CENTER);text('Angular velocity ω (rad/s)',0,0);pop();
  if($('arrows').checked){
    stroke(0);strokeWeight(1.15);
    const nx=Math.round(S.arrowDensity),ny=Math.max(3,Math.round(nx*r.h/r.w));
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
      const theta=-Math.PI+P.TAU*(i+.5)/nx,omega=S.omegaMax*(1-2*(j+.5)/ny);
      const vx=omega*r.w/P.TAU,vy=-P.acceleration(theta,omega,time,S)*r.h/(2*S.omegaMax),norm=Math.hypot(vx,vy);if(norm<1e-8)continue;
      const x=r.x+r.w*(i+.5)/nx,y=r.y+r.h*(j+.5)/ny,dx=vx/norm*S.arrowLength,dy=vy/norm*S.arrowLength;
      line(x-dx*.5,y-dy*.5,x+dx*.5,y+dy*.5);
      line(x+dx*.5,y+dy*.5,x+dx*.1-dy*.3,y+dy*.1+dx*.3);line(x+dx*.5,y+dy*.5,x+dx*.1+dy*.3,y+dy*.1-dx*.3);
    }
  }
}
function drawTrails(physical,time){
  if(!$('trails').checked||S.trailSeconds===0)return;
  const r=physical?view.physical:view.phase;
  clipRect(r,c=>{
    c.lineWidth=1;c.globalAlpha=bodies.length>70?.18:.32;
    for(const b of simulationBodies){
      c.strokeStyle=b.color;c.beginPath();let prev=null;
      for(let i=0;i<b.trail.size;i++){
        const s=b.trail.get(i);if(s[2]<time-S.trailSeconds||s[2]>time)continue;
        const xy=physical?position(s[0],s[2],s[3]):phasePosition(s[0],s[1]);
        if(!prev||(!physical&&Math.abs(P.wrap(s[0])-P.wrap(prev[0]))>Math.PI))c.moveTo(...xy);else c.lineTo(...xy);prev=s;
      }c.stroke();
    }
  });
}
function drawPhysical(states,time){
  const r=view.physical,m=mapping(),px=m.cx;
  stroke('#203043');strokeWeight(1);drawingContext.setLineDash([3,6]);line(m.cx,r.y,m.cx,r.y+r.h);line(r.x,m.cy,r.x+r.w,m.cy);drawingContext.setLineDash([]);
  drawTrails(true,time);
  clipRect(r,c=>{
    for(let i=states.length-1;i>=0;i--){const b=bodies[i],xy=position(states[i][0],time);c.strokeStyle=b.color;c.fillStyle=b.color;c.globalAlpha=Math.max(.2,.75/Math.sqrt(bodies.length/10));c.lineWidth=1;c.beginPath();c.moveTo(px,m.cy);c.lineTo(...xy);c.stroke();c.globalAlpha=.8;c.beginPath();c.arc(...xy,3.5,0,P.TAU);c.fill();}
  });
  if(displayedReference.theta!==null){const xy=position(displayedReference.theta,time);stroke('#66eda3');strokeWeight(2.5);line(px,m.cy,...xy);fill('#66eda3');stroke('#e5fff0');strokeWeight(1.4);circle(...xy,14);}
  noStroke();fill('#e5edf7');circle(px,m.cy,8);fill('#94a6bb');textSize(10);textAlign(CENTER,TOP);text('pivot',px,m.cy+10);
  stroke('#71849a');const scaleLength=S.length>=2?1:0.2;const bx=r.x+10,by=r.y+r.h-5;line(bx,by,bx+scaleLength*m.scale,by);line(bx,by-3,bx,by+3);line(bx+scaleLength*m.scale,by-3,bx+scaleLength*m.scale,by+3);
  noStroke();textAlign(LEFT,BOTTOM);text(scaleLength+' m',bx,by-5);
}
function drawPhase(states,time){
  axes(time);
  drawTrails(false,time);
  clipRect(view.phase,c=>{
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i];c.fillStyle=b.color;
      {const xy=phasePosition(...states[i]);c.globalAlpha=1;c.beginPath();c.arc(...xy,3,0,P.TAU);c.fill();}
    }
  });
  if(displayedReference.theta!==null)clipRect(view.phase,c=>{const xy=phasePosition(displayedReference.theta,displayedReference.omega);c.fillStyle='#66eda3';c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.arc(...xy,5.5,0,P.TAU);c.fill();c.stroke();});
  const outside=states.filter(s=>Math.abs(s[1])>S.omegaMax).length;
  if(outside){fill('#f4d494');noStroke();textAlign(RIGHT,TOP);textSize(10);text(outside+' outside velocity range',view.phase.x+view.phase.w-8,view.phase.y+7);}
}
function draw(){
  if(!bodies.length)return;
  const elapsed=document.hidden||skipNextFrame?0:Math.min(Math.max(deltaTime/1000,0),.1);
  skipNextFrame=false;
  if(running&&!dragging&&!document.hidden){
    if(deltaTime>110)limitedUntil=millis()+1200;
    accumulator+=elapsed*S.rate;
    while(accumulator>=H){advance();accumulator-=H;}
  }
  const alpha=running&&!dragging?clamp(accumulator/H,0,1):1;
  renderTime=t>0?t-H+alpha*H:0;
  const states=bodies.map(b=>[b.prevTheta+(b.theta-b.prevTheta)*alpha,b.prevOmega+(b.omega-b.prevOmega)*alpha]);
  displayedReference=reference?{theta:reference.prevTheta+(reference.theta-reference.prevTheta)*alpha,omega:reference.prevOmega+(reference.omega-reference.prevOmega)*alpha}:{theta:null,omega:0};
  $('mean-status').textContent=displayedReference.theta===null?'(reference unavailable: initial circular mean is undefined)':'';
  background('#0d1520');view=layout();
  noStroke();fill('#e6edf5');textSize(14);textAlign(LEFT,TOP);text('Physical space',view.physical.x,22);text('Phase space',view.pTitle,width>=790?22:355);
  fill('#7890a8');textSize(10);text(bodies.length+' independent pendulums, drag to set angle',view.physical.x,44);
  text('Click to place initial ensemble mean',view.pTitle,width>=790?44:377);
  if(width>=790){stroke('#253141');line(view.physical.x+view.physical.w+10,20,view.physical.x+view.physical.w+10,height-20);}else{stroke('#253141');line(20,340,width-20,340);}
  drawPhysical(states,renderTime);drawPhase(states,renderTime);
  smoothedFPS=.95*smoothedFPS+.05*(1000/Math.max(deltaTime,1));
  $('time').textContent=renderTime.toFixed(2)+' s';$('fps').textContent=Math.round(smoothedFPS)+' fps';
  $('speed-bound').textContent=P.speedBound(S,S.omegaMax).toFixed(2);
  renderEnergy();
}
function inside(x,y,r){return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}
function mousePressed(event){
  if(!view||event?.target?.tagName!=='CANVAS')return;
  if(inside(mouseX,mouseY,view.phase)){
    const r=view.phase;setControl('meanAngle',-Math.PI+(mouseX-r.x)/r.w*P.TAU);setControl('meanOmega',clamp((1-2*(mouseY-r.y)/r.h)*S.omegaMax,-20,20));restart();return false;
  }
  if(!displayedReference||displayedReference.theta===null)return;
  const xy=position(displayedReference.theta,renderTime);
  if(inside(mouseX,mouseY,view.physical)&&Math.hypot(mouseX-xy[0],mouseY-xy[1])<28){resumeAfterDrag=running;dragging=true;setRunning(false);dragAngle();return false;}
}
function dragAngle(){const m=mapping();const px=m.cx;setControl('meanAngle',Math.atan2(mouseX-px,mouseY-m.cy));setControl('meanOmega',0);restart();}
function mouseDragged(){if(dragging){dragAngle();return false;}}
function mouseReleased(){if(dragging){dragging=false;setRunning(resumeAfterDrag);return false;}}

let lastEnergyPaint=-Infinity;
function renderEnergy(force=false){
  if(!$('energy-panel')||$('energy-panel').hidden)return;
  const now=performance.now();if(!force&&now-lastEnergyPaint<100)return;
  lastEnergyPaint=now;
  drawEnergyGraph($('energy-canvas'),energyHistory,bodies,S,t,$('energy-kind').value);
  $('energy-note').textContent='0–'+t.toFixed(2)+' s · '+bodies.length+' instances · history spacing '+(energyHistory.stride*H).toFixed(3)+' s. Entire run retained with adaptive sampling.';
}
