import {distance,type Hand,type Point} from '../services/input';
export const WIDTH=1280,HEIGHT=960;
export type Brush='Fine Pen'|'Soft Marker'|'Neon Light'|'Rainbow Trail'|'Spark Brush';
export const brushes:Brush[]=['Fine Pen','Soft Marker','Neon Light','Rainbow Trail','Spark Brush'];
export type BrushSettings={brush:Brush;color:string;width:number;opacity:number;eraser:boolean;light:boolean;persistent:boolean};
export type InkPoint=Point&{t:number;v:number};
export type Stroke=BrushSettings&{points:InkPoint[]};
export type View={x:number;y:number;zoom:number};
export const defaultBrush:BrushSettings={brush:'Fine Pen',color:'#ffffff',width:5,opacity:1,eraser:false,light:false,persistent:true};
export function world(p:Point,view:View):Point{return {x:(p.x-view.x)/view.zoom,y:(p.y-view.y)/view.zoom};}
export function cameraPoint(p:Point,vw=640,vh=480):Point{const s=Math.max(WIDTH/vw,HEIGHT/vh);return {x:(1-p.x)*vw*s+(WIDTH-vw*s)/2,y:p.y*vh*s+(HEIGHT-vh*s)/2};}
export function zoomAt(view:View,p:Point,zoom:number){const w=world(p,view);view.zoom=Math.max(.25,Math.min(4,zoom));view.x=p.x-w.x*view.zoom;view.y=p.y-w.y*view.zoom;}
export function pose(h:Hand){const e=[8,12,16,20].map(i=>distance(h.points[i],h.points[0])>distance(h.points[i-2],h.points[0])*1.2);return e.every(Boolean)?'palm':e[0]&&e[1]&&!e[2]&&!e[3]?'peace':e[0]&&e[1]&&e[2]&&!e[3]?'pan':'point';}
export class AirEngine {
 timeOffset=0;strokes:Stroke[]=[];redoStack:Stroke[]=[];active:Stroke|null=null;view:View={x:0,y:0,zoom:1};settings={...defaultBrush};cursor:Point|null=null;radial=false;status='Point to move · pinch to draw';revision=0;
 private smooth:Point|null=null;private last=0;private id='';private armed=false;private candidate='';private since=0;private cooldown=0;private dual:{distance:number;zoom:number;anchor:Point;world:Point}|null=null;private pan:Point|null=null;
 end(){if(this.active){this.active=null;this.revision++;}this.smooth=null;}
 lost(){this.end();this.cursor=null;this.armed=false;this.id='';this.dual=null;this.pan=null;this.candidate='';this.since=0;}
 begin(p:Point,t:number){t+=this.timeOffset;this.redoStack=[];this.active={...this.settings,points:[{...p,t,v:0}]};this.strokes.push(this.active);this.revision++;}
 add(p:Point,t:number){t+=this.timeOffset;if(!this.active)return;const last=this.active.points.at(-1)!;if(distance(last,p)<.5)return;const v=distance(last,p)/Math.max(1,t-last.t);this.active.points.push({...p,t,v});this.revision++;}
 undo(){this.end();const s=this.strokes.pop();if(s)this.redoStack.push(s);this.revision++;}
 redo(){this.end();const s=this.redoStack.pop();if(s)this.strokes.push(s);this.revision++;}
 clear(){this.lost();this.strokes=[];this.redoStack=[];this.revision++;}
 update(hands:Hand[],now:number,map:(p:Point)=>Point,inside:(p:Point)=>boolean){
  const valid=hands.filter(h=>h.confidence>=.7);const h=valid.find(h=>h.id===this.id)??valid[0];
  if(!h||now-this.last>220){this.lost();if(!h){this.last=now;return;}}
  this.last=now;
  if(h.id!==this.id){this.end();this.armed=false;this.id=h.id;}
  const p=map(h.points[8]);this.cursor=p;
  if(!inside(p)){this.lost();return;}
  if(valid.length===2&&valid.every(h=>h.pinching)&&valid.every(h=>inside(map(h.points[8])))){
   this.end();this.armed=false;this.pan=null;const a=map(valid[0].points[8]),b=map(valid[1].points[8]),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},d=Math.max(20,distance(a,b));
   if(!this.dual)this.dual={distance:d,zoom:this.view.zoom,anchor:mid,world:world(mid,this.view)};
   this.view.zoom=Math.max(.25,Math.min(4,this.dual.zoom*d/this.dual.distance));this.view.x=mid.x-this.dual.world.x*this.view.zoom;this.view.y=mid.y-this.dual.world.y*this.view.zoom;this.revision++;this.status='Two-hand zoom';return;
  }
  if(this.dual){this.dual=null;this.armed=false;}
  const gesture=h.pinching?'pinch':pose(h);
  if(gesture!==this.candidate){this.candidate=gesture;this.since=now;this.pan=null;}
  if(!h.pinching){this.end();this.armed=true;}
  if(gesture==='palm'||gesture==='peace'||gesture==='pan'){
   this.end();if(now-this.since<600)return;
   if(gesture==='pan'){if(this.pan){this.view.x+=p.x-this.pan.x;this.view.y+=p.y-this.pan.y;this.revision++;}this.pan=p;this.status='Three-finger pan';}
   else if(now>this.cooldown){if(gesture==='palm')this.radial=true;else this.settings.eraser=true;this.cooldown=now+1600;this.status=gesture==='palm'?'Choose a tool':'Eraser active';}return;
  }
  this.pan=null;
  if(this.radial){this.end();return;}
  if(h.pinching&&this.armed){
   const target=world(p,this.view);const previous=this.active?.points.at(-1);
   if(previous&&distance(previous,target)>180/this.view.zoom){this.end();this.armed=false;return;}
   const alpha=this.smooth?Math.min(.9,.35+distance(this.smooth,target)/55):1;
   this.smooth=this.smooth?{x:this.smooth.x+(target.x-this.smooth.x)*alpha,y:this.smooth.y+(target.y-this.smooth.y)*alpha}:target;
   if(!this.active)this.begin(this.smooth,now);else this.add(this.smooth,now);this.status=this.settings.eraser?'Erasing':'Drawing';
  }else this.status=this.armed?'Ready · pinch to draw':'Release pinch to begin';
 }
}
export function serialize(engine:AirEngine){return JSON.stringify({format:'handverse-air',version:1,width:WIDTH,height:HEIGHT,strokes:engine.strokes,view:engine.view});}
export function restore(text:string,engine:AirEngine){
 if(text.length>20_000_000)throw new Error('Project is too large');const p=JSON.parse(text);
 const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
 if(p.format!=='handverse-air'||p.version!==1||p.width!==WIDTH||p.height!==HEIGHT||!Array.isArray(p.strokes)||p.strokes.length>10000)throw new Error('Unsupported Air Canvas project');
 let count=0;
 for(const s of p.strokes){if(!brushes.includes(s.brush)||!/^#[0-9a-f]{6}$/i.test(s.color)||!finite(s.width)||s.width<1||s.width>80||!finite(s.opacity)||s.opacity<0||s.opacity>1||!['eraser','light','persistent'].every(k=>typeof s[k]==='boolean')||!Array.isArray(s.points)||!s.points.length)throw new Error('Invalid stroke');let last=-Infinity;for(const pt of s.points){if(![pt.x,pt.y,pt.t,pt.v].every(finite)||Math.abs(pt.x)>1e6||Math.abs(pt.y)>1e6||pt.t<0||pt.t<last||pt.v<0)throw new Error('Invalid point');last=pt.t;if(++count>250000)throw new Error('Too many points');}}
 if(!p.view||![p.view.x,p.view.y,p.view.zoom].every(finite)||p.view.zoom<.25||p.view.zoom>4)throw new Error('Invalid viewport');
 engine.clear();engine.strokes=p.strokes;engine.view=p.view;let last=0;for(const s of engine.strokes)last=Math.max(last,s.points.at(-1)!.t);engine.timeOffset=Math.max(0,last+30-performance.now());engine.revision++;
}
