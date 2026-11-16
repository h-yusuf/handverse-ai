import {describe,it,expect} from 'vitest';
import {ARInteraction,arDefaults,project,sanitizeSettings} from '../src/ar/interaction';
import {type Hand,type Point} from '../src/services/input';
function hand(id='Right',gesture:Hand['gesture']='Open palm',shift=0):Hand {
 const points:Point[]=Array.from({length:21},()=>({x:.5+shift,y:.5}));
 points[0]={x:.5+shift,y:.7};points[5]={x:.45+shift,y:.5};points[9]={x:.5+shift,y:.5};points[13]={x:.55+shift,y:.52};points[17]={x:.6+shift,y:.56};
 return {id,gesture,points,pinching:gesture==='Pinch',pressed:false,confidence:.95,cursor:{x:0,y:0},palm:{x:0,y:0},raw:{x:0,y:0},speed:0,vx:0,vy:0};
}
const update=(engine:ARInteraction,hands:Hand[],time:number)=>engine.update(hands,time,800,600,800,600,false);
function open(engine:ARInteraction,hands=[hand()]){update(engine,hands,0);update(engine,hands,100);engine.animate(100,100,800,600);}
function pinchAt(h:Hand,p:Point){h.gesture='Pinch';h.pinching=true;h.points[4]={x:p.x/800,y:p.y/600};h.points[8]={x:p.x/800,y:p.y/600};return h;}
describe('AR uses the shared landmark stream',()=>{
 it('projects the same cover crop and mirror as the webcam at different aspect ratios',()=>{
  expect(project({x:0,y:0},800,600,640,480,false)).toEqual({x:0,y:0});
  expect(project({x:.25,y:.5},800,600,640,480,true)).toEqual({x:600,y:300});
  expect(project({x:0,y:0},1200,600,640,480,false)).toEqual({x:0,y:-150});
  expect(project({x:.5,y:.5},400,800,640,480,true)).toEqual({x:200,y:400});
 });
 it('requires a stable open palm and follows real palm movement with smoothing',()=>{
  const e=new ARInteraction();update(e,[hand()],0);expect(e.hands.get('Right')!.visible).toBe(false);
  update(e,[hand()],100);expect(e.hands.get('Right')!.visible).toBe(true);
  const initial=e.hands.get('Right')!.anchor.x;update(e,[hand('Right','Open palm',.1)],150);
  expect(e.hands.get('Right')!.anchor.x).toBeGreaterThan(initial);expect(e.hands.get('Right')!.anchor.x).toBeLessThan(initial+80);
 });
 it('grabs only the hit panel, moves with the pinch, and leaves the dropped panel in place',()=>{
  const e=new ARInteraction();open(e);const h=e.hands.get('Right')!,target={...h.panels[0]};
  const raw=pinchAt(hand(),target);update(e,[raw],130);expect(h.grab).toBeNull();update(e,[raw],230);expect(h.grab).toBe(0);
  raw.points[4].x+=.1;raw.points[8].x+=.1;update(e,[raw],280);expect(h.panels[0].x).toBeCloseTo(target.x+80);expect(h.panels[1].dropped).toBe(false);
  update(e,[hand()],330);expect(h.grab).toBeNull();const dropped=h.panels[0].x;e.animate(350,30,800,600);expect(h.panels[0].x).toBe(dropped);
 });
 it('supports independent grabs with two hands and ignores low confidence',()=>{
  const e=new ARInteraction();open(e,[hand('Left','Open palm',-.2),hand('Right','Open palm',.2)]);
  const left=e.hands.get('Left')!,right=e.hands.get('Right')!;
  const a=pinchAt(hand('Left'),left.panels[0]),b=pinchAt(hand('Right'),right.panels[1]);update(e,[a,b],130);update(e,[a,b],230);
  expect(left.grab).toBe(0);expect(right.grab).toBe(1);
  const bad=hand('Unknown');bad.confidence=.4;update(e,[a,b,bad],250);expect(e.hands.size).toBe(2);
 });
 it('switches snippets once per swipe cooldown and excludes pinch motion',()=>{
  const e=new ARInteraction();open(e);const h=e.hands.get('Right')!;
  update(e,[hand('Right','Open palm',.15)],220);expect(h.panels[0].snippet).toBe(1);
  update(e,[hand('Right','Open palm',.3)],300);update(e,[hand('Right','Open palm',.5)],450);expect(h.panels[0].snippet).toBe(1);
  update(e,[hand('Right','Pinch',.6)],500);update(e,[hand('Right','Pinch',.8)],600);expect(h.panels[0].snippet).toBe(1);
 });
 it('fades on loss, releases ownership, and requires opening again after reappearance',()=>{
  const e=new ARInteraction();open(e);const h=e.hands.get('Right')!;const raw=pinchAt(hand(),h.panels[0]);update(e,[raw],130);update(e,[raw],230);expect(h.grab).toBe(0);
  update(e,[],600);e.animate(600,100,800,600);expect(h.grab).toBeNull();expect(h.visible).toBe(false);expect(h.opacity).toBeLessThan(.5);
  update(e,[raw],650);update(e,[raw],750);expect(h.grab).toBeNull();expect(h.visible).toBe(false);
  update(e,[hand()],800);update(e,[hand()],900);expect(h.visible).toBe(true);
 });
 it('hides legacy holograms on a stable fist and restores on an open palm',()=>{
  const e=new ARInteraction();e.settings={...arDefaults,mode:'code'};open(e);update(e,[hand('Right','Fist')],130);expect(e.hidden).toBe(false);update(e,[hand('Right','Fist')],230);expect(e.hidden).toBe(true);
  update(e,[hand()],300);update(e,[hand()],400);expect(e.hidden).toBe(false);expect(e.hands.get('Right')!.visible).toBe(true);
 });
 it('validates persisted settings and resets workspace positions',()=>{
  expect(sanitizeSettings({intensity:9,opacity:-2,quality:'invalid' as 'auto',mode:'invalid' as 'code'})).toMatchObject({intensity:1,opacity:.15,mode:'reactive',quality:'auto'});
  const e=new ARInteraction();open(e);e.reset();expect(e.hands.size).toBe(0);expect(e.hidden).toBe(false);
 });
});
