import {describe,it,expect,vi} from 'vitest';
import {classify,PoseState,TwoHandTransform,gestureDefaults,gestures,type Pose} from '../src/ar/gestures';
import {ARInteraction,arDefaults,sanitizeSettings} from '../src/ar/interaction';
import {HandHUD} from '../src/ar/hud';
import {ownsUI} from '../src/services/hand-navigation';
import type {Point,Hand} from '../src/services/input';
function pose(kind:Pose):Point[]{
 const p=Array.from({length:21},()=>({x:.5,y:.55}));p[0]={x:.5,y:.8};
 [5,9,13,17].forEach((base,n)=>{const x=.38+n*.1;p[base]={x,y:.55};p[base+1]={x,y:.4};p[base+2]={x,y:.26};p[base+3]={x,y:((kind==='OPEN_PALM'||kind==='L_SHAPE'||kind==='POINT'||kind==='PEACE')&&n===0)||(kind==='PEACE'&&n===1)||kind==='OPEN_PALM'?.12:.68};});
 p[1]={x:.43,y:.72};p[2]={x:.38,y:.65};p[3]={x:.28,y:.58};p[4]=['OPEN_PALM','L_SHAPE'].includes(kind)?{x:.18,y:.48}:{x:.62,y:.7};
 if(kind==='PINCH')p[4]={...p[8]};return p;
}
function hand(kind:Pose,id='Right'):Hand{return {id,points:pose(kind),confidence:.95,gesture:'Relaxed',pinching:false,pressed:false,cursor:{x:0,y:0},raw:{x:0,y:0},palm:{x:0,y:0},vx:0,vy:0,speed:0};}
const opts={...gestureDefaults,smoothing:0};
describe('normalized AR gesture engine',()=>{
 for(const kind of gestures)it(`classifies ${kind} at different scales and orientations`,()=>{
  for(const scale of [.5,1,2])for(const angle of [0,1,3]){const p=pose(kind).map(p=>({x:scale*(p.x*Math.cos(angle)-p.y*Math.sin(angle))+.2,y:scale*(p.x*Math.sin(angle)+p.y*Math.cos(angle))}));expect(classify(p).gesture).toBe(kind);}
 });
 it('gives pinch priority over L and never labels L as POINT',()=>{const p=pose('L_SHAPE');expect(classify(p).gesture).toBe('L_SHAPE');p[4]={...p[8]};expect(classify(p).gesture).toBe('PINCH');});
 it('holds poses across noisy frames and emits ENTER, ACTIVE, EXIT',()=>{const s=new PoseState();s.update(pose('POINT'),0,opts);s.update(pose('FIST'),60,opts);s.update(pose('POINT'),90,opts);expect(s.gesture).toBe('NONE');s.update(pose('POINT'),220,opts);expect(s.phase).toBe('ENTER');s.update(pose('POINT'),250,opts);expect(s.phase).toBe('ACTIVE');s.update(pose('FIST'),280,opts);s.update(pose('FIST'),410,opts);expect(s.phase).toBe('EXIT');s.update(pose('FIST'),450,opts);expect(s.gesture).toBe('NONE');s.update(pose('FIST'),520,opts);expect(s.gesture).toBe('FIST');});
 it('uses wider pinch release hysteresis',()=>{const p=pose('PINCH');p[4].x+=.10;expect(classify(p,false).gesture).not.toBe('PINCH');expect(classify(p,true).gesture).toBe('PINCH');p[4].x+=.1;expect(classify(p,true).gesture).not.toBe('PINCH');});
 it('exits on tracking loss and requires a new hold after recovery',()=>{const s=new PoseState();s.update(pose('PINCH'),0,opts);s.update(pose('PINCH'),130,opts);s.update(null,400,opts);expect(s.phase).toBe('EXIT');expect(s.gesture).toBe('NONE');s.update(pose('PINCH'),420,opts);expect(s.gesture).toBe('NONE');s.update(pose('PINCH'),550,opts);expect(s.phase).toBe('ENTER');});
 it('debounces swipes with an 850ms cooldown',()=>{const s=new PoseState(),p=pose('OPEN_PALM');s.update(p,0,opts);s.update(p,130,opts);s.update(p,160,opts);const shifted=p.map(v=>({...v,x:v.x+.4}));s.update(shifted,250,opts);expect(s.motion).toBe('SWIPE_RIGHT');s.update(p,400,opts);expect(s.motion).toBe('');});
 it('scales relative to initial two-hand distance, retains transform on release, and rebases',()=>{const d=new TwoHandTransform();d.update({x:0,y:0},{x:100,y:0});for(let i=0;i<25;i++)d.update({x:0,y:0},{x:200,y:0});expect(d.scale).toBeCloseTo(2,2);const scale=d.scale;d.update(null,null);expect(d.active).toBe(false);expect(d.scale).toBe(scale);d.update({x:0,y:0},{x:100,y:0});expect(d.scale).toBe(scale);d.update({x:0,y:0},{x:0,y:100});expect(d.rotation).toBeGreaterThan(0);});
 it('protects AR gestures while permitting navigation and Studio UI',()=>{expect(ownsUI('ar',true)).toBe(false);expect(ownsUI('ui',true)).toBe(false);expect(ownsUI('ar',false)).toBe(true);expect(ownsUI('ui',false)).toBe(true);expect(ownsUI('global',false)).toBe(true);});
 it('sanitizes Studio settings and copies mappings without mutating defaults',()=>{const s=sanitizeSettings({hold:0,primary:'bad',mapping:{PINCH:'code'} as never});expect(s.hold).toBe(80);expect(s.primary).toBe('#FFFFFF');expect(s.mapping.PINCH).toBe('code');expect(arDefaults.mapping.PINCH).toBe('orb');});
 for(const kind of gestures)it(`drives the ${arDefaults.mapping[kind]} effect with a held synthetic ${kind}`,()=>{
  const e=new ARInteraction();e.settings={...arDefaults,smoothing:0};e.update([hand(kind)],0,800,600,640,480,false);e.update([hand(kind)],150,800,600,640,480,false);e.animate(150,100,800,600);
  expect(e.hands.get('Right')!.effect).toBe(arDefaults.mapping[kind]);
  if(kind==='FIST')expect(e.hidden).toBe(true);
  const ctx=new Proxy({measureText:()=>({width:80})},{get:(target,key)=>key in target?target[key as keyof typeof target]:vi.fn(),set:(target,key,value)=>{(target as Record<string|symbol,unknown>)[key]=value;return true;}});
  vi.stubGlobal('devicePixelRatio',1);vi.stubGlobal('matchMedia',()=>({matches:false}));
  const canvas={width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
  expect(()=>new HandHUD(canvas).render(e,e.settings,800,600,150,false,16)).not.toThrow();vi.unstubAllGlobals();
 });
});
