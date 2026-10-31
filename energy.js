/* Full-run energy history, coarsened uniformly when the sample budget is reached.
   Keeps t=0 permanently; the current endpoint is evaluated when drawing. */
class EnergyHistory {
  constructor(){this.reset();}
  reset(){this.rows=[];this.stride=16;}
  record(time,bodies,p){
    const data=new Float64Array(bodies.length*2);
    bodies.forEach((b,i)=>{const e=PendulumPhysics.energies(b.theta,b.omega,p);data[2*i]=e.kinetic;data[2*i+1]=e.potential;});
    this.rows.push({time,data});
    if(this.rows.length>=6000){this.rows=this.rows.filter((_,i)=>i%2===0);this.stride*=2;}
  }
}
function drawEnergyGraph(canvas,history,bodies,p,time,kind){
  const width=Math.max(260,canvas.parentElement.clientWidth-32),height=300,dpr=Math.min(window.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width='100%';canvas.style.height=height+'px';}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  const rows=history.rows.slice();
  if(!rows.length||rows[rows.length-1].time<time){const data=new Float64Array(bodies.length*2);bodies.forEach((b,i)=>{const e=PendulumPhysics.energies(b.theta,b.omega,p);data[i*2]=e.kinetic;data[i*2+1]=e.potential;});rows.push({time,data});}
  const value=(row,i)=>kind==='kinetic'?row.data[2*i]:kind==='potential'?row.data[2*i+1]:row.data[2*i]+row.data[2*i+1];
  let max=0;for(const row of rows)for(let i=0;i<bodies.length;i++)max=Math.max(max,value(row,i));max=max>1e-12?max*1.08:1;
  const r={x:66,y:25,w:width-85,h:height-75},end=Math.max(time,.001);
  const x=t=>r.x+t/end*r.w,y=e=>r.y+r.h*(1-e/max);
  c.font='11px system-ui';c.lineWidth=1;
  for(let i=0;i<=4;i++){
    c.strokeStyle='#2a3446';c.beginPath();c.moveTo(r.x,r.y+r.h*i/4);c.lineTo(r.x+r.w,r.y+r.h*i/4);c.stroke();
    c.fillStyle='#a7b4c8';c.textAlign='right';c.fillText((max*(1-i/4)).toPrecision(3),r.x-8,r.y+r.h*i/4+4);
    c.textAlign='center';c.fillText((time*i/4).toFixed(time<10?2:1),r.x+r.w*i/4,r.y+r.h+20);
  }
  c.textAlign='left';c.fillText('J/kg',r.x,13);c.textAlign='center';c.fillText('Time (s)',r.x+r.w/2,height-8);
  c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
  for(let i=0;i<bodies.length;i++){
    c.strokeStyle=bodies[i].color;c.fillStyle=bodies[i].color;c.lineWidth=1.3;c.globalAlpha=.8;c.beginPath();
    rows.forEach((row,k)=>{const px=x(row.time),py=y(value(row,i));if(k===0)c.moveTo(px,py);else c.lineTo(px,py);});c.stroke();
    const last=rows[rows.length-1];if(last){c.beginPath();c.arc(x(last.time),y(value(last,i)),2,0,2*Math.PI);c.fill();}
  }c.restore();
}
if(typeof module!=='undefined'&&module.exports)module.exports={EnergyHistory};
