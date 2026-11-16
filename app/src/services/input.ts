export type Point = {x:number;y:number};
export type Gesture = 'Open palm'|'Fist'|'Pointing'|'Pinch'|'Relaxed';
export type Hand = {id:string;points:Point[];cursor:Point;palm:Point;raw:Point;gesture:Gesture;pinching:boolean;pressed:boolean;speed:number;vx:number;vy:number;confidence:number};
export type Calibration = {sx:number;sy:number;ox:number;oy:number};
export const identity:Calibration={sx:1,sy:1,ox:0,oy:0};
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export const mapPoint=(p:Point,c:Calibration):Point=>({x:clamp(p.x*c.sx+c.ox),y:clamp(p.y*c.sy+c.oy)});
export function fitCalibration(raw:Point[],targets:Point[]):Calibration {
 const axis=(key:'x'|'y')=>{const n=raw.length, a=raw.reduce((s,p)=>s+p[key],0)/n,b=targets.reduce((s,p)=>s+p[key],0)/n;const den=raw.reduce((s,p)=>s+(p[key]-a)**2,0);const scale=den>.005?raw.reduce((s,p,i)=>s+(p[key]-a)*(targets[i][key]-b),0)/den:1;return [clamp(scale,.4,3),b-scale*a];};const [sx,ox]=axis('x'),[sy,oy]=axis('y');return {sx,ox,sy,oy};
}
export class GestureMachine {
 pinching=false; lastClick=-Infinity; previous:Point|null=null; last=0; smooth:Point|null=null;
 update(points:Point[],now:number,c:Calibration):Omit<Hand,'id'|'confidence'> {
 const palmSize=Math.max(.025,distance(points[0],points[9]));
 const ratio=distance(points[4],points[8])/palmSize;
 const was=this.pinching;this.pinching=ratio<(was?.48:.32);
 const pressed=this.pinching&&!was&&now-this.lastClick>350;if(pressed)this.lastClick=now;
 const extended=[8,12,16,20].map((tip)=>distance(points[tip],points[0])>distance(points[tip-2],points[0])*1.16);
 const count=extended.filter(Boolean).length;
 const gesture:Gesture=this.pinching?'Pinch':count===4?'Open palm':count===0?'Fist':extended[0]&&count===1?'Pointing':'Relaxed';
 const raw={x:1-points[8].x,y:points[8].y}; const target=mapPoint(raw,c);
 const dt=Math.max(.016,(now-this.last)/1000);const alpha=1-Math.exp(-dt*22);
 const cursor=this.smooth?{x:this.smooth.x+(target.x-this.smooth.x)*alpha,y:this.smooth.y+(target.y-this.smooth.y)*alpha}:target;
 const vx=this.previous?(cursor.x-this.previous.x)/dt:0,vy=this.previous?(cursor.y-this.previous.y)/dt:0;
 this.previous=cursor;this.smooth=cursor;this.last=now;
 const palm=mapPoint({x:1-(points[0].x+points[9].x)/2,y:(points[0].y+points[9].y)/2},c);
 return {points,cursor,palm,raw,gesture,pinching:this.pinching,pressed,speed:Math.hypot(vx,vy),vx,vy};
 }
}
