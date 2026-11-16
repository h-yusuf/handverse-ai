import {clamp,distance,type Point} from '../services/input';
export const gestures=['L_SHAPE','PINCH','OPEN_PALM','FIST','POINT','PEACE'] as const;
export type Pose=typeof gestures[number];
export type Gesture=Pose|'NONE';
export type Phase='ENTER'|'ACTIVE'|'EXIT'|'IDLE';
export type GestureOptions={hold:number;sensitivity:number;smoothing:number};
export const gestureDefaults:GestureOptions={hold:120,sensitivity:1,smoothing:65};
export function classify(p:Point[],held=false,sensitivity=1):{gesture:Gesture;confidence:number;ratio:number}{
 if(p.length!==21||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return {gesture:'NONE',confidence:0,ratio:Infinity};
 const palm=Math.max(.0001,distance(p[0],p[9])),ratio=distance(p[4],p[8])/palm;
 const extended=[8,12,16,20].map(t=>distance(p[t],p[0])/Math.max(.0001,distance(p[t-2],p[0]))>1.16&&distance(p[t],p[t-3])/palm>.55);
 const thumb=distance(p[4],p[17])/palm>1.25&&distance(p[4],p[2])/palm>.5;
 const [i,m,r,k]=extended;let gesture:Gesture='NONE';
 // Pinch owns the thumb/index pair. L requires a separate extended thumb.
 if(ratio<(held?.48:.30)*sensitivity)gesture='PINCH';
 else if(i&&!m&&!r&&!k&&thumb)gesture='L_SHAPE';
 else if(i&&m&&r&&k&&thumb)gesture='OPEN_PALM';
 else if(!i&&!m&&!r&&!k&&!thumb)gesture='FIST';
 else if(i&&m&&!r&&!k)gesture='PEACE';
 else if(i&&!m&&!r&&!k&&!thumb)gesture='POINT';
 const margins=[8,12,16,20].map(t=>Math.abs(distance(p[t],p[0])/Math.max(.0001,distance(p[t-2],p[0]))-1.16));
 const margin=gesture==='PINCH'?clamp(1-ratio/(.55*sensitivity)):gesture==='NONE'?0:clamp(.5+Math.min(...margins)*2,.5,1);
 return {gesture,confidence:margin,ratio};
}
export class PoseState {
 gesture:Gesture='NONE';phase:Phase='IDLE';confidence=0;points:Point[]=[];motion='';
 private candidate:Gesture='NONE';private since=0;private seen=-Infinity;private exited=-Infinity;private history:{p:Point;t:number}[]=[];private angle:number|null=null;private cooldown=-Infinity;
 update(input:Point[]|null,now:number,options:GestureOptions=gestureDefaults){
  this.phase=this.gesture==='NONE'?'IDLE':'ACTIVE';this.motion='';
  if(!input){if(now-this.seen>250){if(this.gesture!=='NONE'){this.phase='EXIT';this.exited=now;}this.gesture='NONE';this.candidate='NONE';this.points=[];this.history=[];this.angle=null;this.confidence=0;}return;}
  const elapsed=now-this.seen;if(elapsed>250){this.gesture='NONE';this.candidate='NONE';this.points=[];this.history=[];this.angle=null;}
  const alpha=options.smoothing===0?1:1-Math.exp(-Math.min(80,Math.max(1,elapsed))/options.smoothing);
  this.points=input.map((p,i)=>this.points[i]?{x:this.points[i].x+(p.x-this.points[i].x)*alpha,y:this.points[i].y+(p.y-this.points[i].y)*alpha}:{...p});this.seen=now;
  const result=classify(this.points,this.gesture==='PINCH',options.sensitivity);this.confidence=result.confidence;
  if(result.gesture!==this.candidate){this.candidate=result.gesture;this.since=now;}
  if(this.candidate!==this.gesture&&now-this.since>=options.hold){
   if(this.gesture!=='NONE'){this.gesture='NONE';this.phase='EXIT';this.exited=now;}
   else if(now-this.exited>=100){this.gesture=this.candidate;this.phase=this.gesture==='NONE'?'IDLE':'ENTER';}
  }
  const palm=this.points[9],size=Math.max(.001,distance(this.points[0],palm));
  this.history=this.history.filter(h=>now-h.t<320);this.history.push({p:{...palm},t:now});
  const first=this.history[0],dx=palm.x-first.p.x,dy=palm.y-first.p.y;
  const angle=Math.atan2(this.points[5].y-this.points[17].y,this.points[5].x-this.points[17].x);
  const turn=this.angle===null?0:Math.atan2(Math.sin(angle-this.angle),Math.cos(angle-this.angle));
  if(now-this.cooldown>850&&this.phase==='ACTIVE'){
   if(this.gesture==='OPEN_PALM'&&now-first.t>=110&&Math.abs(dx)>size*1.2&&Math.abs(dy)<size*.65){this.motion=dx>0?'SWIPE_RIGHT':'SWIPE_LEFT';this.cooldown=now;this.history=[];}
   else if(Math.abs(turn)>.35){this.motion='PALM_ROTATION';this.cooldown=now;this.angle=angle;}
  }
  if(this.angle===null||this.gesture==='NONE')this.angle=angle;
 }
}
export class TwoHandTransform {
 scale=1;rotation=0;x=0;y=0;active=false;motion='';distance=0;private baseDistance=0;private baseAngle=0;private baseScale=1;private baseRotation=0;
 update(a:Point|null,b:Point|null){
  this.motion='';if(!a||!b){this.active=false;return;}
  const d=distance(a,b),angle=Math.atan2(b.y-a.y,b.x-a.x);this.distance=d;
  if(!this.active){this.baseDistance=Math.max(20,d);this.baseAngle=angle;this.baseScale=this.scale;this.baseRotation=this.rotation;}
  this.active=true;const x=(a.x+b.x)/2,y=(a.y+b.y)/2;this.x=this.x?this.x+(x-this.x)*.25:x;this.y=this.y?this.y+(y-this.y)*.25:y;
  const target=clamp(this.baseScale*d/this.baseDistance,.25,3);this.scale+=(target-this.scale)*.25;
  const turn=Math.atan2(Math.sin(angle-this.baseAngle),Math.cos(angle-this.baseAngle));this.rotation+=(clamp(this.baseRotation+turn,-Math.PI,Math.PI)-this.rotation)*.25;
  this.motion=Math.abs(d/this.baseDistance-1)>.08?'TWO_HAND_DISTANCE_CHANGE':'TWO_HAND_PINCH';
 }
}
