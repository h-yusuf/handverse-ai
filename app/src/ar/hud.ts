import {connections} from '../services/hand-landmarks';
import type {ARInteraction,ARSettings,ARHand,Effect} from './interaction';
import type {Point} from '../services/input';
// Fixed particle seeds are reused for the lifetime of the renderer, including orb/collapse transitions.
export class HandHUD {
 private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 private particles=Array.from({length:80},(_,i)=>({angle:i*2.399963,phase:(i*.618034)%1}));
 private effects=new Map<string,{kind:Effect;alpha:number}>();
 constructor(private canvas:HTMLCanvasElement){}
 render(engine:ARInteraction,s:ARSettings,w:number,h:number,now:number,low:boolean,dt:number){
  const dpr=Math.min(devicePixelRatio||1,low?1:1.5),canvas=this.canvas;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const c=canvas.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';c.font='11px system-ui';
  const line=(a:Point,b:Point)=>{c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();};
  const ring=(p:Point,r:number,start=0,end=Math.PI*2)=>{c.beginPath();c.arc(p.x,p.y,Math.max(0,r),start,end);c.stroke();};
  const text=(label:string,p:Point)=>{const x=Math.max(8,Math.min(w-c.measureText(label).width-8,p.x)),y=Math.max(45,Math.min(h-45,p.y));c.fillText(label,x,y);};
  const motion=this.reducedMotion.matches?0:now;
  for(const hand of engine.hands.values()){
   const fade=Math.max(0,1-(now-hand.seen)/300);if(!fade){this.effects.delete(hand.id);continue;}
   const p=hand.points,palm=hand.anchor,a=p[4],b=p[8],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   c.globalAlpha=fade*s.opacity;c.strokeStyle=s.primary;c.fillStyle=s.primary;c.lineWidth=s.thickness;
   if(s.skeleton){for(const [i,j] of connections)line(p[i],p[j]);for(const v of p){c.beginPath();c.arc(v.x,v.y,s.pointSize/2,0,7);c.fill();}}
   c.strokeStyle=s.accent;c.lineWidth=1;ring(palm,4);line({x:palm.x-7,y:palm.y},{x:palm.x+7,y:palm.y});
   if(s.numbers)p.forEach((v,i)=>text(String(i),{x:v.x+6,y:v.y-6}));
   if(s.coordinates)[4,8,12,16,20].forEach(i=>text(`${i}: ${Math.round(p[i].x)}, ${Math.round(p[i].y)} px`,{x:p[i].x+12,y:p[i].y-16}));
   if(s.brackets){const xs=p.map(v=>v.x),ys=p.map(v=>v.y),left=Math.min(...xs)-14,right=Math.max(...xs)+14,top=Math.min(...ys)-14,bottom=Math.max(...ys)+14;for(const [x,dx] of [[left,1],[right,-1]])for(const [y,dy] of [[top,1],[bottom,-1]]){line({x,y:y+dy*12},{x,y});line({x,y},{x:x+dx*12,y});}}
   if(s.diagnostics){const label={x:palm.x+45,y:palm.y+48};line(palm,label);text(`${hand.id} · ${hand.pose.gesture} · ${hand.pose.phase}`,label);text(`Pose ${Math.round(hand.pose.confidence*100)}% · handedness ${Math.round(hand.confidence*100)}%`,{x:label.x,y:label.y+16});if(hand.pose.motion)text(hand.pose.motion,{x:label.x,y:label.y+32});}
   if(s.mode!=='reactive')continue;
   let state=this.effects.get(hand.id);if(!state){state={kind:hand.effect||'radial',alpha:0};this.effects.set(hand.id,state);}
   if(hand.effect&&state.kind!==hand.effect){state.alpha*=.65;state.kind=hand.effect;}
   state.alpha+=((hand.effect?1:0)-state.alpha)*(1-Math.exp(-dt/120));
   c.globalAlpha=fade*s.opacity*state.alpha;c.lineWidth=1;c.strokeStyle=s.primary;c.fillStyle=s.accent;
   const progress=state.alpha;
   c.save();if(state.kind!=='collapse'){const amount=engine.collapse;c.translate(engine.collapseAnchor.x*amount,engine.collapseAnchor.y*amount);c.scale(1-amount,1-amount);c.globalAlpha*=1-amount;}
   if(state.kind==='frame'){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.max(14,Math.abs(a.x-b.x)),height=Math.max(14,Math.abs(a.y-b.y))*progress;
    c.fillStyle=s.accent+'12';c.fillRect(x,y,width,height);c.strokeRect(x,y,width,height);c.strokeStyle=s.accent;
    for(const [cx,dx] of [[x,1],[x+width,-1]])for(const [cy,dy] of [[y,1],[y+height,-1]]){line({x:cx+dx*8,y:cy},{x:cx,y:cy});line({x:cx,y:cy},{x:cx,y:cy+dy*8});}
    c.fillStyle=s.primary;text(`${Math.round(width)} × ${Math.round(height)} px`,{x,y:y-10});
   }else if(state.kind==='orb'){
    const r=(8+s.intensity*7+Math.sin(motion/260)*2)*progress;c.fillStyle=s.accent;c.shadowColor=s.accent;c.shadowBlur=8*s.intensity;c.beginPath();c.arc(mid.x,mid.y,r,0,7);c.fill();c.shadowBlur=0;
    c.strokeStyle=s.accent;ring(mid,r+7);ring(mid,r+14,now/1000,now/1000+4);
    this.particles.slice(0,low?Math.min(12,s.particleDensity):s.particleDensity).forEach(v=>{const phase=(v.phase+motion/2200)%1,rad=(1-phase)*65+r;c.globalAlpha=fade*state!.alpha*phase*s.intensity;c.fillRect(mid.x+Math.cos(v.angle)*rad,mid.y+Math.sin(v.angle)*rad,2,2);});
    hand.trail.forEach((v,i)=>{c.globalAlpha=fade*state!.alpha*i/hand.trail.length*.25;c.fillRect(v.x,v.y,2,2);});
   }else if(state.kind==='radial'){
    const radius=Math.max(35,Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y))*.85*progress;
    ring(palm,radius,motion/2500,motion/2500+5);c.strokeStyle=s.accent;ring(palm,radius+12,-motion/3500,5-motion/3500);
    for(let i=0;i<24;i++){const t=i*Math.PI/12;line({x:palm.x+Math.cos(t)*(radius+17),y:palm.y+Math.sin(t)*(radius+17)},{x:palm.x+Math.cos(t)*(radius+21),y:palm.y+Math.sin(t)*(radius+21)});}
    c.fillStyle=s.primary;text(`${hand.id} · palm linked`,{x:palm.x+radius+22,y:palm.y});
   }else if(state.kind==='collapse'){
    c.strokeStyle='#D6C5FF';c.fillStyle='#D6C5FF';const phase=(motion%900)/900;
    c.globalAlpha*=1-phase;ring(palm,(1-phase)*90);ring(palm,(1-phase)*65);
    this.particles.slice(0,s.particleDensity).forEach(v=>{const r=(1-phase)*(25+v.phase*100);c.fillRect(palm.x+Math.cos(v.angle)*r,palm.y+Math.sin(v.angle)*r,2,2);});
   }else if(state.kind==='laser'){
    const dx=b.x-p[6].x,dy=b.y-p[6].y,len=Math.max(1,Math.hypot(dx,dy)),tip={x:Math.max(10,Math.min(w-10,b.x+dx/len*180)),y:Math.max(45,Math.min(h-45,b.y+dy/len*180))};line(b,tip);c.strokeStyle=s.accent;
    const hit=Math.hypot(tip.x-(engine.dual.x||w/2),tip.y-(engine.dual.y||h/2))<65*engine.dual.scale||[...engine.hands.values()].some(v=>v.codeOpacity>.2&&v.panels.slice(0,2).some(panel=>Math.abs(tip.x-panel.x)<150*panel.scale&&Math.abs(tip.y-panel.y)<100*panel.scale));ring(tip,hit?12:7);line({x:tip.x-12,y:tip.y},{x:tip.x+12,y:tip.y});line({x:tip.x,y:tip.y-12},{x:tip.x,y:tip.y+12});if(s.coordinates)text('Pointer',{x:tip.x+15,y:tip.y});
   }
   c.restore();
  }
  const dual=engine.dual;if(s.mode==='reactive'){
   // Perspective-projected wireframe: relative 2.5D, no camera depth estimate.
   const cx=dual.x||w/2,cy=dual.y||h/2,size=55*dual.scale;
   c.globalAlpha=s.opacity;c.strokeStyle=s.accent;c.lineWidth=1;
   c.fillStyle=s.primary;text(`${Math.round(dual.scale*100)}% · ${dual.active?dual.motion:'Pinch with both hands to manipulate'}`,{x:cx-85,y:cy+size+28});
   if(dual.active){const pinches=[...engine.hands.values()].filter(v=>v.pose.gesture==='PINCH');if(pinches.length===2){const midpoint=(v:ARHand)=>({x:(v.points[4].x+v.points[8].x)/2,y:(v.points[4].y+v.points[8].y)/2});line(midpoint(pinches[0]),midpoint(pinches[1]));text(`${Math.round(dual.distance)} px`,{x:cx,y:cy-20});}}
  }
  c.globalAlpha=1;
 }
}
