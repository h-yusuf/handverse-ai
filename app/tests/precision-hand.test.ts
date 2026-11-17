import {describe,it,expect} from 'vitest';
import {OneEuroCursor,StablePinch,PrecisionHand,defaultHandControls,validateHandControls} from '../src/services/precision-hand';
import {GestureMachine,identity,type Point} from '../src/services/input';
const options=defaultHandControls;
const rms=(points:Point[])=>{const mean=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});return Math.sqrt(points.reduce((sum,p)=>sum+(p.x-mean.x)**2+(p.y-mean.y)**2,0)/points.length);};
function landmarks(x=.4){const p=Array.from({length:21},()=>({x:.5,y:.6}));p[0]={x:.5,y:.8};p[9]={x:.5,y:.6};p[8]={x,y:.3};p[4]={x:.8,y:.3};return p;}
describe('HoloSpace precision cursor',()=>{
 it('measures stationary jitter at 30 and 60 Hz with deterministic synthetic camera noise',()=>{
  for(const hz of [30,60]){
   let seed=42;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*8;};
   const machine=new GestureMachine(),raw:Point[]=[],filtered:Point[]=[];
   for(let i=0;i<600;i++){
    const p={x:720+noise(),y:450+noise()},points=landmarks();points[8]={x:1-p.x/1440,y:p.y/900};
    const hand=machine.update(points,i*1000/hz,identity,{options,width:1440,height:900,cameraWidth:640,cameraHeight:480});
    if(i>60){raw.push(p);filtered.push({x:hand.cursor.x*1440,y:hand.cursor.y*900});}
   }
   const reduction=(1-rms(filtered)/rms(raw))*100;
   console.info(`Synthetic ${hz} Hz stationary RMS: raw ${rms(raw).toFixed(3)} px, filtered ${rms(filtered).toFixed(3)} px, reduction ${reduction.toFixed(1)}%`);
   expect(reduction).toBeGreaterThan(70);
  }
 });
 it('responds faster to intentional movement than a fixed low cutoff without overshooting',()=>{
  const f=new OneEuroCursor();f.update({x:0,y:0},0,options);
  let result={x:0,y:0};let maxLag=0;
  for(let i=1;i<=15;i++){const x=i*30;result=f.update({x,y:0},i*1000/30,options);maxLag=Math.max(maxLag,x-result.x);expect(result.x).toBeLessThanOrEqual(x);}
  console.info(`Synthetic 900 px/s motion: maximum lag ${maxLag.toFixed(1)} px (${(maxLag/900*1000).toFixed(1)} ms equivalent)`);
  expect(maxLag).toBeLessThan(60);expect(result.x).toBeGreaterThan(420);
 });
 it('does not advance on duplicate timestamps and bounds loss recovery',()=>{
  const f=new OneEuroCursor();f.update({x:100,y:100},100,options);
  expect(f.update({x:900,y:900},100,options)).toEqual({x:100,y:100});
  const recovered=f.update({x:900,y:900},1000,options);expect(Math.hypot(recovered.x-100,recovered.y-100)).toBeLessThanOrEqual(15.001);
  const next=f.update({x:900,y:900},1033,options);expect(Math.hypot(next.x-recovered.x,next.y-recovered.y)).toBeLessThanOrEqual(9.901);
 });
 it('maps and mirrors once, applies calibration, and preserves position across viewport resizing',()=>{
  const f=new PrecisionHand(),p=landmarks(.2);const sample=f.update(p,0,{sx:1,sy:1,ox:.05,oy:0},options,640,480);
  expect(sample.mapped.x).toBeCloseTo(.85);
  const initial=f.track(sample.mapped,0,options,1000,600);expect(initial.x).toBeCloseTo(.85);expect(initial.y).toBeCloseTo(.3);
  expect(f.track(sample.mapped,33,options,500,300).x).toBeCloseTo(.85);
 });
 it('keeps the interaction anchor stable through fingertip closure while allowing palm dragging',()=>{
  const f=new PrecisionHand(),p=landmarks();f.update(p,0,identity,options,640,480);f.update(p,60,identity,options,640,480);
  p[8].x=.45;p[4]={...p[8]};const close=f.update(p,100,identity,options,640,480);expect(close.mapped.x).toBeCloseTo(.6);
  expect(f.update(p,160,identity,options,640,480).state.pressed).toBe(true);
  p.forEach(point=>point.x+=.05);const moved=f.update(p,200,identity,options,640,480);expect(moved.mapped.x).toBeCloseTo(.55);
 });
 it('keeps game input on its existing behavior when precision is not requested',()=>{
  const p=landmarks(),legacy=new GestureMachine(),spatial=new GestureMachine();
  legacy.update(p,0,identity);spatial.update(p,0,identity,{options,width:1440,height:900,cameraWidth:640,cameraHeight:480});
  p[4]={...p[8]};expect(legacy.update(p,33,identity).pressed).toBe(true);
  expect(spatial.update(p,33,identity,{options,width:1440,height:900,cameraWidth:640,cameraHeight:480}).pressed).toBe(false);
 });
});
describe('stable normalized pinch',()=>{
 it('debounces both edges, uses hysteresis and emits only one click per hold',()=>{
  const g=new StablePinch();g.update(.8,0,1);g.update(.8,60,1);
  expect(g.update(.2,80,1).pressed).toBe(false);expect(g.update(.8,100,1).pressed).toBe(false);
  g.update(.2,120,1);expect(g.update(.2,180,1).pressed).toBe(true);
  expect(g.update(.4,220,1).pinching).toBe(true);expect(g.update(.2,300,1).pressed).toBe(false);
  expect(g.update(.6,320,1).pinching).toBe(true);expect(g.update(.6,380,1).pinching).toBe(false);
  g.update(.2,400,1);expect(g.update(.2,460,1).pressed).toBe(true);
 });
 it('requires a stable open hand after loss, including acquisition while pinched',()=>{
  const g=new StablePinch();g.update(.1,0,1);expect(g.update(.1,80,1).pressed).toBe(false);
  g.update(.8,100,1);g.update(.8,160,1);g.update(.1,180,1);expect(g.update(.1,240,1).pressed).toBe(true);
  expect(g.update(.1,900,1).pinching).toBe(false);expect(g.update(.1,960,1).pressed).toBe(false);
 });
 it('normalizes pinch distances across camera resolution and hand scale',()=>{
  const p=landmarks();p[4]={x:p[8].x+.02,y:p[8].y};
  const a=new PrecisionHand().update(p,0,identity,options,640,480).ratio;
  const b=new PrecisionHand().update(p,0,identity,options,1280,960).ratio;
  const small=p.map(point=>({x:.5+(point.x-.5)*.5,y:.5+(point.y-.5)*.5}));
  const c=new PrecisionHand().update(small,0,identity,options,640,480).ratio;
  expect(a).toBeCloseTo(b);expect(a).toBeCloseTo(c);
 });
 it('validates saved settings',()=>{expect(validateHandControls({sensitivity:Infinity,deadzone:-1,preset:'invalid' as never})).toMatchObject({sensitivity:1,deadzone:0,preset:'Balanced'});});
});
