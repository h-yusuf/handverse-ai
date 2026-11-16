import {PoseState,TwoHandTransform,gestures,type Pose} from './gestures';
import {clamp,distance,type Hand,type Point} from '../services/input';
export type ARMode='reactive'|'code'|'lab'|'visualizer';
export type Effect='frame'|'orb'|'radial'|'collapse'|'laser'|'code';
export type ARSettings={primary:string;accent:string;particleDensity:number;thickness:number;pointSize:number;smoothing:number;sensitivity:number;hold:number;numbers:boolean;coordinates:boolean;brackets:boolean;mapping:Record<Pose,Effect>;mode:ARMode;intensity:number;skeleton:boolean;opacity:number;mirror:boolean;diagnostics:boolean;quality:'auto'|'high'|'low';scanlines:boolean};
export const arDefaults:ARSettings={primary:'#FFFFFF',accent:'#A8ECF7',particleDensity:32,thickness:1.5,pointSize:4,smoothing:65,sensitivity:1,hold:120,numbers:false,coordinates:false,brackets:true,mapping:{L_SHAPE:'frame',PINCH:'orb',OPEN_PALM:'radial',FIST:'collapse',POINT:'laser',PEACE:'code'},mode:'reactive',intensity:.65,skeleton:true,opacity:.72,mirror:true,diagnostics:false,quality:'auto',scanlines:false};
export function sanitizeSettings(value:Partial<ARSettings>):ARSettings {
 const result={...arDefaults};
 if(['reactive','code','lab','visualizer'].includes(value.mode!))result.mode=value.mode!;
 if(['auto','high','low'].includes(value.quality!))result.quality=value.quality!;
 for(const key of ['skeleton','mirror','diagnostics','scanlines','numbers','coordinates','brackets'] as const)if(typeof value[key]==='boolean')result[key]=value[key]!;
 for(const key of ['intensity','opacity'] as const)if(Number.isFinite(value[key]))result[key]=clamp(value[key]!,key==='opacity'?.15:0,1);
 for(const [key,min,max] of [['particleDensity',0,80],['thickness',.5,4],['pointSize',2,10],['smoothing',0,180],['sensitivity',.65,1.4],['hold',80,500]] as const)if(Number.isFinite(value[key]))result[key]=clamp(value[key]!,min,max);
 for(const key of ['primary','accent'] as const)if(/^#[0-9a-f]{6}$/i.test(value[key]||''))result[key]=value[key]!;
 result.mapping={...arDefaults.mapping};for(const pose of gestures)if(['frame','orb','radial','collapse','laser','code'].includes(value.mapping?.[pose]||''))result.mapping[pose]=value.mapping![pose];
 return result;
}
// Same object-fit: cover projection for the video and uncalibrated MediaPipe landmarks.
export function project(p:Point,width:number,height:number,videoWidth:number,videoHeight:number,mirror:boolean):Point {
 const scale=Math.max(width/videoWidth,height/videoHeight),w=videoWidth*scale,h=videoHeight*scale;
 return {x:(mirror?1-p.x:p.x)*w+(width-w)/2,y:p.y*h+(height-h)/2};
}
export type ARPanel={x:number;y:number;scale:number;offset:Point;dropped:boolean;snippet:number};
export type ARHand={pose:PoseState;effect:Effect|null;effectAlpha:number;codeOpacity:number;id:string;anchor:Point;scale:number;angle:number;visible:boolean;opacity:number;seen:number;gesture:string;candidate:string;candidateAt:number;pinching:boolean;armed:boolean;grab:number|null;grabOffset:Point;panels:ARPanel[];history:{x:number;y:number;at:number}[];swipeAt:number;points:Point[];confidence:number;trail:Point[]};
const offsets=[{x:-210,y:-135},{x:145,y:-10},{x:-105,y:150}];
export class ARInteraction {
 collapse=0;collapseAnchor:Point={x:0,y:0};settings=arDefaults;dual=new TwoHandTransform();hands=new Map<string,ARHand>();hidden=false;
 reset(){this.hands.clear();this.hidden=false;this.collapse=0;this.dual=new TwoHandTransform();}
 update(input:Hand[],now:number,width:number,height:number,vw:number,vh:number,mirror:boolean){
  const assigned=new Set<string>();
  for(const raw of input){
   if(raw.confidence<.7||raw.points.length!==21||raw.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
   const points=raw.points.map(p=>project(p,width,height,vw,vh,mirror));
   const palm=[0,5,9,13,17].reduce((s,i)=>({x:s.x+points[i].x/5,y:s.y+points[i].y/5}),{x:0,y:0});
   const scale=clamp(distance(points[0],points[9])/120,.52,1.25);
   const nearest=[...this.hands.values()].filter(h=>now-h.seen<250&&!assigned.has(h.id)).sort((a,b)=>distance(a.anchor,palm)-distance(b.anchor,palm))[0];
   const stableId=nearest&&distance(nearest.anchor,palm)<Math.max(30,distance(points[0],points[9])*.7)?nearest.id:raw.id;
   if(assigned.has(stableId))continue;assigned.add(stableId);
   let h=this.hands.get(stableId);
   if(!h){h={pose:new PoseState(),effect:null,effectAlpha:0,codeOpacity:0,id:stableId,anchor:palm,scale,angle:0,visible:false,opacity:0,seen:now,gesture:'Relaxed',candidate:'',candidateAt:now,pinching:false,armed:false,grab:null,grabOffset:{x:0,y:0},panels:offsets.map((offset,i)=>({x:palm.x+offset.x*scale,y:palm.y+offset.y*scale,scale,offset:{...offset},dropped:false,snippet:i})),history:[],swipeAt:-Infinity,points,confidence:raw.confidence,trail:[]};this.hands.set(stableId,h);}
   h.pose.update(raw.points.map(p=>({x:(mirror?1-p.x:p.x)*vw/vh,y:p.y})),now,{hold:this.settings.hold,sensitivity:this.settings.sensitivity,smoothing:this.settings.smoothing});
   h.effect=h.pose.gesture==='NONE'?null:this.settings.mapping[h.pose.gesture];
   const elapsed=now-h.seen,lost=elapsed>250,alpha=1-Math.exp(-Math.max(1,Math.min(elapsed,80))/Math.max(1,this.settings.smoothing));
   if(lost){h.visible=false;h.grab=null;h.armed=false;h.history=[];h.candidate='';h.trail=[];}
   h.anchor={x:h.anchor.x+(palm.x-h.anchor.x)*alpha,y:h.anchor.y+(palm.y-h.anchor.y)*alpha};
   h.scale+=(scale-h.scale)*alpha;h.angle=clamp((points[5].y-points[17].y)/Math.max(30,distance(points[5],points[17])),-.5,.5);
   h.seen=now;h.points=points.map((p,i)=>({x:h!.points[i].x+(p.x-h!.points[i].x)*alpha,y:h!.points[i].y+(p.y-h!.points[i].y)*alpha}));h.confidence=raw.confidence;
   if(h.candidate!==raw.gesture){h.candidate=raw.gesture;h.candidateAt=now;}
   if(now-h.candidateAt>=80)h.gesture=h.candidate;
   if(!raw.pinching){h.armed=true;h.pinching=false;h.grab=null;}
   if(h.gesture==='Open palm')h.visible=true;
   if(h.gesture==='Fist'){h.visible=false;h.grab=null;}
   const tip={x:(points[4].x+points[8].x)/2,y:(points[4].y+points[8].y)/2};
   if(raw.pinching&&h.gesture==='Pinch'&&!h.pinching&&h.armed&&h.visible){
    h.pinching=true;h.armed=false;
    let nearest=-1,best=Infinity;
    h.panels.forEach((panel,i)=>{const d=distance(tip,panel);if(Math.abs(tip.x-panel.x)<155*panel.scale&&Math.abs(tip.y-panel.y)<105*panel.scale&&d<best){nearest=i;best=d;}});
    if(nearest>=0){h.grab=nearest;h.grabOffset={x:h.panels[nearest].x-tip.x,y:h.panels[nearest].y-tip.y};}
   }
   if(h.grab!==null){const p=h.panels[h.grab];p.x=clamp(tip.x+h.grabOffset.x,30,width-30);p.y=clamp(tip.y+h.grabOffset.y,35,height-35);p.dropped=true;h.history=[];}
   else if(h.gesture==='Open palm'&&!raw.pinching){
    h.history=h.history.filter(p=>now-p.at<350);h.history.push({...palm,at:now});
    const first=h.history[0],dx=palm.x-first.x,dy=palm.y-first.y;
    if(now-first.at>=110&&Math.abs(dx)>width*.13&&Math.abs(dy)<height*.12&&now-h.swipeAt>850){for(const p of h.panels)p.snippet=(p.snippet+(dx>0?1:2))%3;h.swipeAt=now;h.history=[];}
   }else h.history=[];
   h.trail.push(points[8]);if(h.trail.length>14)h.trail.shift();
  }
  for(const [id,h] of this.hands){if(now-h.seen>250){h.pose.update(null,now);h.effect=null;}if(now-h.seen>250){h.grab=null;h.visible=false;h.history=[];h.armed=false;}if(now-h.seen>2500)this.hands.delete(id);}
  const pair=[...this.hands.values()].filter(h=>now-h.seen<250&&h.pose.gesture==='PINCH').sort((a,b)=>a.id.localeCompare(b.id));
  const midpoint=(h:ARHand)=>({x:(h.points[4].x+h.points[8].x)/2,y:(h.points[4].y+h.points[8].y)/2});
  this.dual.update(pair.length===2?midpoint(pair[0]):null,pair.length===2?midpoint(pair[1]):null);
  this.hidden=[...this.hands.values()].some(h=>now-h.seen<250&&(this.settings.mode==='reactive'?h.effect==='collapse':h.gesture==='Fist'));
 }
 animate(now:number,dt:number,width:number,height:number){
  const alpha=1-Math.exp(-dt/75);
  this.collapse+=((this.hidden?1:0)-this.collapse)*alpha;
  const source=[...this.hands.values()].find(h=>h.effect==='collapse');if(source)this.collapseAnchor={...source.anchor};
  for(const h of this.hands.values()){
   if(now-h.seen>250){h.grab=null;h.visible=false;h.armed=false;}
   if(now-h.seen>250){h.pose.update(null,now);h.effect=null;this.dual.update(null,null);}
   h.codeOpacity+=((h.effect==='code'&&!this.hidden?1:0)-h.codeOpacity)*alpha;
   h.effectAlpha+=((h.effect?1:0)-h.effectAlpha)*alpha;
   if(this.settings.mode==='reactive'&&h.effect==='code'){
    h.panels.slice(0,2).forEach((p,i)=>{if(!p.dropped){const tip=h.points[i?12:8];p.x+=(clamp(tip.x+(i?165:-165),90,width-90)-p.x)*alpha;p.y+=(clamp(tip.y-70,80,height-80)-p.y)*alpha;}});
   }
   h.opacity+=((h.visible&&!this.hidden&&now-h.seen<250?1:0)-h.opacity)*alpha;
   for(const [i,p] of h.panels.entries()){
    p.scale+=(h.scale-p.scale)*alpha;
    if(h.grab!==i&&!p.dropped){p.x+=(clamp(h.anchor.x+p.offset.x*h.scale,85,width-85)-p.x)*alpha;p.y+=(clamp(h.anchor.y+p.offset.y*h.scale,70,height-70)-p.y)*alpha;}
   }
  }
 }
}
