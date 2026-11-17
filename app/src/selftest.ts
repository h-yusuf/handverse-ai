import {type Engine,W,H} from './games/engine';
let currentGame:(()=>Engine)|undefined;
export function observeGame(read:()=>Engine){currentGame=read;return ()=>{if(currentGame===read)currentGame=undefined;};}
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function click(selector:string){const element=document.querySelector<HTMLButtonElement>(selector);if(!element)throw new Error('Missing game control: '+selector+'; buttons: '+Array.from(document.querySelectorAll('button')).map(b=>b.className+':'+b.textContent?.slice(0,35)).join('; '));element.click();}
function move(x:number,y:number){const canvas=document.querySelector('.game-stage canvas')!;const rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:rect.left+x/W*rect.width,clientY:rect.top+y/H*rect.height}));}
export async function runGameplaySelfTest(){
 const steps:{step:string;passed:boolean;detail:string}[]=[];
 try{
  click('[aria-label="HANDVERSE home"]');await delay(150);
  const all=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='All games');all?.click();await delay(150);
  click('.game-pong');await delay(150);
  const practice=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Try pointer practice'));
  if(!practice)throw new Error('Pointer practice control missing');practice.click();await delay(150);
  click('.start-overlay .pong-start');await delay(150);
  const before=currentGame!().paddle;
  // Specialized Pong input expects successive samples, as a real pointer produces.
  for(let i=0;i<12;i++){move(300,160);await delay(25);}
  const after=currentGame!().paddle;
  steps.push({step:'move',passed:Math.abs(after-before)>50,detail:`Pointer moved the Pong paddle from ${before.toFixed(1)} to ${after.toFixed(1)}`});
  click('[aria-label="Back to arcade"]');await delay(150);click('.game-bubble');await delay(150);click('.start-overlay button');await delay(150);
  const game=currentGame!();const startScore=game.score;const startHits=game.hits;
  for(let i=0;i<90;i++){const target=game.objects.find(o=>o.alive);if(target)move(target.x,target.y);await delay(33);}
  steps.push({step:'act',passed:game.hits>startHits&&game.score>startScore,detail:`Popped ${game.hits-startHits} bubbles through pointer input; score ${startScore} → ${game.score}`});
  await delay(200);
  const hud=document.querySelector('.game-hud');const displayed=hud?.querySelector('strong')?.textContent?.replace(/,/g,'');
  steps.push({step:'hud',passed:Number(displayed)===game.score&&!!hud?.textContent?.includes('Time')&&!!hud?.textContent?.includes('Multiplier'),detail:`Visible score ${displayed}, game score ${game.score}; timer and multiplier displayed`});
  const air=await runAirCanvasSelfTest();steps.push(...air);
  const {runHoloSpaceSmokeTest}=await import('./holospace/smoke-test');
  steps.push(...await runHoloSpaceSmokeTest());
  const rules=runSelfTest();steps.push({step:'rules',passed:rules.passed,detail:JSON.stringify(rules.checks)});
 }catch(error){steps.push({step:'gameplay',passed:false,detail:String(error)});}
 return {version:1,steps};
}
import {award,circleHit,segmentHit,paddleHit} from './games/physics';
import {GestureMachine,identity,mapPoint,type Point} from './services/input';
export function runSelfTest(){
 const checks:Record<string,boolean>={
  circleCollision:circleHit({x:0,y:0},{x:3,y:4},5)&&!circleHit({x:0,y:0},{x:3,y:4},4),
  swipeCollision:segmentHit({x:0,y:0},{x:1,y:0},{x:.5,y:.05},.1),
  paddleCollision:paddleHit(10,10,5,5,10,10,1)&&!paddleHit(30,30,5,5,10,10,1),
  comboScore:award(10,0)===10&&award(10,5)===20&&award(10,100)===50,
  coordinateMapping:mapPoint({x:.25,y:.5},identity).x===.25&&mapPoint({x:2,y:-1},identity).y===0,
 };
 const points:Point[]=Array.from({length:21},()=>({x:.5,y:.5}));
 points[0]={x:.5,y:.9};points[9]={x:.5,y:.6};points[8]={x:.4,y:.3};points[4]={x:.41,y:.3};
 const machine=new GestureMachine();
 const first=machine.update(points,0,identity),held=machine.update(points,500,identity);
 points[4]={x:.7,y:.3};const released=machine.update(points,600,identity);
 points[4]={x:.41,y:.3};const again=machine.update(points,1000,identity);
 checks.pinchTransitions=first.pressed&&!held.pressed&&!released.pinching&&again.pressed;
 return {passed:Object.values(checks).every(Boolean),checks};
}

async function runAirCanvasSelfTest(){
 const steps:{step:string;passed:boolean;detail:string}[]=[];
 const studio=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Creative Studio');if(!studio)throw new Error('Creative Studio navigation missing');studio.click();await delay(150);
 const canvas=document.querySelector<HTMLCanvasElement>('.air-ink')!,r=canvas.getBoundingClientRect();
 const send=(type:string,x:number,y:number)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:42,clientX:r.left+x/1280*r.width,clientY:r.top+y/960*r.height}));
 send('pointerdown',200,220);send('pointermove',260,260);send('pointermove',330,290);send('pointerup',330,290);await delay(80);
 const pixels=()=>{const d=canvas.getContext('2d')!.getImageData(0,0,1280,960).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i])count++;return count;};
 const count=pixels();steps.push({step:'air-draw',passed:count>100,detail:`Pointer stroke rendered ${count} ink pixels`});
 click('[aria-label="Undo"]');await delay(50);const empty=pixels()===0;click('[aria-label="Redo"]');await delay(50);steps.push({step:'air-history',passed:empty&&pixels()===count,detail:'Undo clears ink, redo restores matching ink'});
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));const bytes=blob?new DataView(await blob.arrayBuffer()):null;
 steps.push({step:'air-png',passed:!!bytes&&bytes.getUint32(16)===1280&&bytes.getUint32(20)===960,detail:'Actual PNG IHDR is 1280 × 960; transparent canvas background'});
 const fullscreen=Array.from(document.querySelectorAll<HTMLButtonElement>('.air-heading button')).find(b=>b.textContent?.includes('Fullscreen'));fullscreen?.click();await delay(150);const entered=!!document.querySelector('.air-immersive');const exit=Array.from(document.querySelectorAll<HTMLButtonElement>('.air-heading button')).find(b=>b.textContent?.includes('Exit'));exit?.click();await delay(150);
 steps.push({step:'air-fullscreen',passed:entered&&!document.querySelector('.air-immersive')&&pixels()===count,detail:'Immersive enter/exit preserves structured drawing'});
 click('[aria-label="HANDVERSE home"]');await delay(100);return steps;
}
