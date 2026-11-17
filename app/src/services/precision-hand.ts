import {clamp,distance,mapPoint,type Calibration,type Point} from './input';

export type HandControls={preset:'Responsive'|'Balanced'|'Precision';sensitivity:number;deadzone:number;skeleton:'Hidden'|'Always visible'|'Auto fade';pinchSensitivity:number;diagnostics:boolean};
export const defaultHandControls:HandControls={preset:'Balanced',sensitivity:1,deadzone:1.5,skeleton:'Hidden',pinchSensitivity:1,diagnostics:false};
export function validateHandControls(value:Partial<HandControls>|null):HandControls {
 const v=value??{},number=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?clamp(n,min,max):fallback;
 return {preset:['Responsive','Balanced','Precision'].includes(v.preset!)?v.preset!:defaultHandControls.preset,sensitivity:number(v.sensitivity,1,.5,2),deadzone:number(v.deadzone,1.5,0,6),skeleton:['Hidden','Always visible','Auto fade'].includes(v.skeleton!)?v.skeleton!:'Hidden',pinchSensitivity:number(v.pinchSensitivity,1,.6,1.5),diagnostics:v.diagnostics===true};
}
const alpha=(dt:number,cutoff:number)=>1/(1+1/(2*Math.PI*cutoff*dt));
const presets={Responsive:{min:2,beta:.035},Balanced:{min:.9,beta:.025},Precision:{min:.45,beta:.02}};
// One state per tracked hand, updated once per inference (never per render frame).
export class OneEuroCursor {
 private previous:Point|null=null;private filtered:Point|null=null;private last:number|null=null;private velocity:Point={x:0,y:0};
 private recoverUntil=0;
 speed=0;
 resize(sx:number,sy:number){if(this.filtered){this.filtered={x:this.filtered.x*sx,y:this.filtered.y*sy};this.previous={x:this.previous!.x*sx,y:this.previous!.y*sy};this.velocity={x:this.velocity.x*sx,y:this.velocity.y*sy};}}
 update(target:Point,now:number,options:HandControls):Point {
  if(this.last!==null&&now<=this.last)return {...this.filtered!};
  if(!this.filtered){this.filtered={...target};this.previous={...target};this.last=now;return {...target};}
  const elapsed=(now-this.last!)/1000,recovering=elapsed>.25,dt=recovering?.05:elapsed;
  const dx=target.x-this.previous!.x,dy=target.y-this.previous!.y;
  if(recovering){this.velocity={x:0,y:0};this.recoverUntil=now+250;}
  else {const a=alpha(dt,1);this.velocity.x+=a*(dx/dt-this.velocity.x);this.velocity.y+=a*(dy/dt-this.velocity.y);}
  this.speed=Math.hypot(this.velocity.x,this.velocity.y);
  const {min,beta}=presets[options.preset],a=alpha(dt,min+beta*this.speed);
  // A soft radial deadzone shrinks with intentional speed; it never accumulates drift.
  const radius=options.deadzone/(1+this.speed/80),delta={x:target.x-this.filtered.x,y:target.y-this.filtered.y},length=Math.hypot(delta.x,delta.y);
  const gain=length>radius?(length-radius)/length:0;
  let step={x:delta.x*gain*a,y:delta.y*gain*a};
  // Bound discontinuities (including reacquisition) without resetting to a new location.
  const limit=(now<this.recoverUntil?300:2600)*dt,size=Math.hypot(step.x,step.y);
  if(size>limit)step={x:step.x*limit/size,y:step.y*limit/size};
  this.filtered={x:this.filtered.x+step.x,y:this.filtered.y+step.y};this.previous={...target};this.last=now;
  return {...this.filtered};
 }
}

export class StablePinch {
 pinching=false;candidate=false;private since=0;private last:number|null=null;private armed=false;
 update(ratio:number,now:number,sensitivity:number){
  if(this.last!==null&&now<=this.last)return {pinching:this.pinching,pressed:false,pending:this.candidate};
  if(this.last===null||now-this.last>250){this.pinching=false;this.candidate=false;this.armed=false;this.since=now;}
  this.last=now;
  const wants=ratio<(this.pinching?.48:.30)*sensitivity;
  if(wants!==this.candidate){this.candidate=wants;this.since=now;}
  let pressed=false;
  if(this.candidate!==this.pinching&&now-this.since>=45){
   if(!this.candidate){this.pinching=false;this.armed=true;}
   else if(this.armed){this.pinching=true;pressed=true;this.armed=false;}
  }
  // First acquisition must show a stable open hand before it can click.
  if(!this.candidate&&!this.pinching&&now-this.since>=45)this.armed=true;
  return {pinching:this.pinching,pressed,pending:this.candidate};
 }
}

export class PrecisionHand {
 private cursor=new OneEuroCursor();private viewport:Point|null=null;private pinch=new StablePinch();private anchor:Point|null=null;private openOffset:Point|null=null;private last:number|null=null;
 update(points:Point[],now:number,calibration:Calibration,options:HandControls,width:number,height:number){
  const gap=this.last!==null&&now-this.last>250;this.last=now;if(gap){this.anchor=null;this.openOffset=null;}
  // Palm normalization in camera pixels avoids aspect-ratio-dependent pinch thresholds.
  const cameraPoint=(p:Point)=>({x:p.x*width,y:p.y*height});
  const ratio=distance(cameraPoint(points[4]),cameraPoint(points[8]))/Math.max(1,distance(cameraPoint(points[0]),cameraPoint(points[9])));
  const state=this.pinch.update(ratio,now,options.pinchSensitivity);
  const index={x:1-points[8].x,y:points[8].y},palm={x:1-(points[0].x+points[9].x)/2,y:(points[0].y+points[9].y)/2};
  // Preserve the pre-pinch index-to-palm offset throughout closure, hold and release.
  if(!state.pending&&!state.pinching){this.anchor=null;this.openOffset={x:index.x-palm.x,y:index.y-palm.y};}
  if((state.pending||state.pinching)&&!this.anchor)this.anchor=this.openOffset??{x:index.x-palm.x,y:index.y-palm.y};
  const raw=this.anchor?{x:palm.x+this.anchor.x,y:palm.y+this.anchor.y}:index;
  const mapped=mapPoint(raw,calibration);
  return {state,mapped,ratio};
 }
 track(target:Point,now:number,options:HandControls,width:number,height:number){
  if(this.viewport&&(this.viewport.x!==width||this.viewport.y!==height))this.cursor.resize(width/this.viewport.x,height/this.viewport.y);
  this.viewport={x:width,y:height};
  const pixel=this.cursor.update({x:clamp(.5+(target.x-.5)*options.sensitivity)*width,y:clamp(.5+(target.y-.5)*options.sensitivity)*height},now,options);
  return {x:clamp(pixel.x/width),y:clamp(pixel.y/height)};
 }
}
