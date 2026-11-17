import {vision} from '../services/vision';
import {GestureMachine,identity,type Hand,type Point} from '../services/input';
import {handControls} from '../services/storage';
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// Packaged automation only: synthetic landmarks and pointer events, never a webcam claim.
export async function runHoloSpaceSmokeTest(){
 const steps:{step:string;passed:boolean;detail:string}[]=[];
 const previousLayout=localStorage.getItem('handverse.holospace.v1'),previousControls={...handControls};
 const click=(selector:string)=>{const el=document.querySelector<HTMLElement>(selector);if(!el)throw Error(`Missing HoloSpace control: ${selector}`);el.click();};
 const rect=()=>document.querySelector<HTMLElement>('[data-spatial-window="Notes"]')!.getBoundingClientRect();
 const machine=new GestureMachine();
 const publish=(x:number,y:number,pinch:boolean)=>{
  const p:Point[]=Array.from({length:21},()=>({x:1-x/innerWidth,y:y/innerHeight+.1}));
  p[8]={x:1-x/innerWidth,y:y/innerHeight};p[4]={x:p[8].x+(pinch?.005:.18),y:p[8].y};p[0]={x:p[8].x,y:p[8].y+.28};p[9]={x:p[8].x,y:p[8].y+.12};
  const hand:Hand={id:'Right',confidence:1,...machine.update(p,performance.now(),identity,{options:handControls,width:innerWidth,height:innerHeight,cameraWidth:640,cameraHeight:480})};
  vision.data.hands=[hand];(vision as unknown as {onHands:(hands:Hand[])=>void}).onHands([hand]);
 };
 const hold=async(x:number,y:number,pinch:boolean,frames=12)=>{for(let i=0;i<frames;i++){publish(x,y,pinch);await delay(34);}};
 const center=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
 try{
  localStorage.removeItem('handverse.holospace.v1');Object.assign(handControls,{preset:'Balanced',sensitivity:1,deadzone:1.5,pinchSensitivity:1,skeleton:'Hidden',diagnostics:false});
  Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='HoloSpace')!.click();await delay(160);click('.holo-actions .primary');await delay(350);
  const apps=center('.holo-dock [aria-label="Open Apps"]');await hold(apps.x,apps.y,false,28);await hold(apps.x,apps.y,true,18);
  steps.push({step:'holo-pinch',passed:!!document.querySelector('.holo-launcher'),detail:'Synthetic landmark pinch opens the dock launcher once and keeps it open through held frames'});
  await hold(apps.x,apps.y,false,4);
  const notes=center('.launcher-apps>button:nth-child(4)');await hold(notes.x,notes.y,false,30);await hold(notes.x,notes.y,true,5);await hold(notes.x,notes.y,false,4);
  steps.push({step:'holo-launcher',passed:!!document.querySelector('[data-spatial-window="Notes"]')&&!document.querySelector('.holo-launcher'),detail:'Synthetic pinch selects Notes from the launcher'});
  const title=center('[data-spatial-window="Notes"] .holo-title'),before=rect();await hold(title.x,title.y,false,30);await hold(title.x,title.y,true,12);await hold(title.x+90,title.y+55,true,22);await hold(title.x+90,title.y+55,false,4);const dragged=rect();
  steps.push({step:'holo-drag',passed:dragged.x>before.x+40&&dragged.y>before.y+20,detail:`Synthetic held pinch moves Notes by ${(dragged.x-before.x).toFixed(1)}, ${(dragged.y-before.y).toFixed(1)} CSS px`});
  const resize=center('[data-spatial-window="Notes"] [data-spatial-resize]');await hold(resize.x,resize.y,false,30);await hold(resize.x,resize.y,true,12);await hold(resize.x+70,resize.y+40,true,22);await hold(resize.x+70,resize.y+40,false,4);const resized=rect();
  steps.push({step:'holo-resize',passed:resized.width>dragged.width+25&&resized.height>dragged.height+15,detail:`Synthetic held pinch resizes Notes by ${(resized.width-dragged.width).toFixed(1)}, ${(resized.height-dragged.height).toFixed(1)} CSS px`});
  const nextTitle=center('[data-spatial-window="Notes"] .holo-title');await hold(nextTitle.x,nextTitle.y,false,30);await hold(nextTitle.x,nextTitle.y,true,12);
  vision.data.hands=[];(vision as unknown as {onHands:(hands:Hand[])=>void}).onHands([]);await delay(400);await hold(nextTitle.x+60,nextTitle.y,true,12);
  steps.push({step:'holo-loss',passed:!document.querySelector('[data-manipulating]'),detail:'Tracking loss cancels manipulation; reacquiring a held pinch does not restart it'});
  await hold(nextTitle.x,nextTitle.y,false,4);
  const titleEl=document.querySelector<HTMLElement>('[data-spatial-window="Notes"] .holo-title')!,mouseBefore=rect();
  titleEl.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:nextTitle.x,clientY:nextTitle.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:nextTitle.x+45,clientY:nextTitle.y+25}));window.dispatchEvent(new PointerEvent('pointerup'));await delay(80);const mouseAfter=rect();
  steps.push({step:'holo-mouse',passed:mouseAfter.x>mouseBefore.x+20,detail:'Normal pointer dragging remains functional after hand tracking loss'});
  click('[aria-label="Workspace controls"]');await delay(80);click('.holo-hand-settings summary');await delay(80);
  steps.push({step:'holo-settings',passed:!!document.querySelector('.holo-hand-settings[open] [aria-label="Cursor stabilization"]')&&getComputedStyle(document.querySelector('.tracking-layer')!).pointerEvents==='none',detail:'Hand settings expand within existing controls; tracking canvas cannot intercept pointers'});
  const overlay=document.querySelector<HTMLCanvasElement>('.tracking-layer')!,ctx=overlay.getContext('2d')!;
  const ink=()=>{const pixels=ctx.getImageData(0,0,overlay.width,overlay.height).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])n++;return n;};
  // Keep the synthetic hand fresh while checking the overlay's independent rendering.
  await hold(nextTitle.x,nextTitle.y,false,12);const hidden=ink();
  handControls.skeleton='Always visible';await hold(nextTitle.x,nextTitle.y,false,12);const visible=ink();
  handControls.skeleton='Auto fade';await hold(nextTitle.x,nextTitle.y,false,45);const faded=ink();
  steps.push({step:'holo-skeleton',passed:visible>hidden+100&&faded>0&&faded<visible,detail:`Synthetic hand overlay pixels: hidden ${hidden}, visible ${visible}, auto faded ${faded}; cursor retained`});
 }catch(e){steps.push({step:'holospace',passed:false,detail:String(e)});}
 finally{
  document.querySelector<HTMLButtonElement>('.holo-exit')?.click();await delay(350);
  if(previousLayout===null)localStorage.removeItem('handverse.holospace.v1');else localStorage.setItem('handverse.holospace.v1',previousLayout);
  Object.assign(handControls,previousControls);vision.data.hands=[];document.querySelector<HTMLButtonElement>('[aria-label="HANDVERSE home"]')?.click();await delay(100);
 }
 return steps;
}
