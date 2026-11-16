import {describe,it,expect} from 'vitest';
import {GestureMachine,identity,type Point} from '../src/services/input';
import {Engine,W,H,type Player} from '../src/games/engine';
function landmarks(x=.2,y=.4){
 const p:Point[]=Array.from({length:21},()=>({x:.5,y:.6}));
 p[0]={x:.5,y:.9};p[9]={x:.5,y:.6};p[8]={x,y};p[4]={x:.8,y:.4};return p;
}
describe('camera landmarks to game input',()=>{
 it('mirrors the index fingertip exactly once and pops a bubble at that location',()=>{
  const hand=new GestureMachine().update(landmarks(),100,identity);
  expect(hand.cursor).toEqual({x:.8,y:.4});
  const player:Player={id:'Left',x:hand.cursor.x*W,y:hand.cursor.y*H,palmX:hand.palm.x*W,palmY:hand.palm.y*H,active:hand.pinching,gesture:hand.gesture,speed:hand.speed};
  const engine=new Engine('bubble');engine.started=true;
  engine.objects=[{x:.8*W,y:.4*H,r:25,vx:0,vy:0,alive:true,kind:'bubble',angle:0,color:'#65edff'}];
  engine.update(.016,[player]);expect(engine.hits).toBe(1);expect(engine.score).toBe(20);
  engine.update(.016,[player]);expect(engine.hits).toBe(1);
 });
 it('smooths movement and requires release before another pinch press',()=>{
  const m=new GestureMachine(),p=landmarks();m.update(p,0,identity);
  p[8]={x:.8,y:.4};p[4]={x:.79,y:.4};
  const first=m.update(p,50,identity);expect(first.pressed).toBe(true);
  expect(first.cursor.x).toBeGreaterThan(.2);expect(first.cursor.x).toBeLessThan(.8);
  expect(m.update(p,500,identity).pressed).toBe(false);
  p[4]={x:.95,y:.4};expect(m.update(p,550,identity).pinching).toBe(false);
  p[4]={x:.79,y:.4};expect(m.update(p,600,identity).pressed).toBe(true);
 });
});
