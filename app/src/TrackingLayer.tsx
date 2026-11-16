import {useEffect,useRef} from 'react';
import {useHandTracking} from './HandTrackingProvider';
import {settings} from './services/storage';
import {PinchGate,interactiveAt,activate,ownsUI} from './services/hand-navigation';
export {connections} from './services/hand-landmarks';
export function TrackingLayer(){
 const vision=useHandTracking(),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0,hover:HTMLElement|null=null,since=0,dwelled=false,primary:string|undefined;
  let feedback:{x:number;y:number;at:number}|null=null;
  const insideOwnedRegion=(x:number,y:number)=>{const el=document.elementFromPoint(x,y);return !!el?.closest('[data-ar-region],[data-air-region]')&&!el.closest('[data-air-tools]');};
  const gate=new PinchGate(),history:{x:number;y:number}[]=[];
  const clearHover=()=>{hover?.classList.remove('hand-hover');hover=null;since=0;dwelled=false;};
  const choose=(x:number,y:number)=>{const target=interactiveAt(x,y);if(target){feedback={x,y,at:performance.now()};activate(target);dwelled=true;}};
  const unsubscribe=vision.subscribeHands(hands=>{
   primary=hands.find(h=>h.id===primary)?.id??hands[0]?.id;
   for(const hand of hands){const pressed=gate.update(hand);if(pressed&&hand.id===primary&&!document.hidden&&!(vision.interactionScope==='canvas'&&vision.ownsCanvasInput?.(hand))&&ownsUI(vision.interactionScope,insideOwnedRegion(hand.cursor.x*innerWidth,hand.cursor.y*innerHeight)))choose(Math.min(innerWidth-1,hand.cursor.x*innerWidth),Math.min(innerHeight-1,hand.cursor.y*innerHeight));}
  });
  const frame=(now:number)=>{
   const el=canvas.current!,c=el.getContext('2d')!;
   if(el.width!==innerWidth||el.height!==innerHeight){el.width=innerWidth;el.height=innerHeight;history.length=0;}
   c.clearRect(0,0,el.width,el.height);
   const cursorHand=vision.data.hands.find(h=>h.id===primary);
   if(cursorHand&&((vision.interactionScope==='canvas'&&vision.ownsCanvasInput?.(cursorHand))||!ownsUI(vision.interactionScope,insideOwnedRegion(cursorHand.cursor.x*innerWidth,cursorHand.cursor.y*innerHeight)))){history.length=0;feedback=null;clearHover();raf=requestAnimationFrame(frame);return;}
   const hand=!document.hidden&&vision.data.hands.find(h=>h.id===primary);
   if(hand){
    const x=Math.min(innerWidth-1,hand.cursor.x*innerWidth),y=Math.min(innerHeight-1,hand.cursor.y*innerHeight),color=hand.id==='Left'?'#ba9aff':'#65edff';
    history.push({x,y});if(history.length>9)history.shift();c.strokeStyle=color;c.lineWidth=2;
    for(let i=1;i<history.length;i++){c.globalAlpha=i/history.length*.45;c.beginPath();c.moveTo(history[i-1].x,history[i-1].y);c.lineTo(history[i].x,history[i].y);c.stroke();}
    c.globalAlpha=1;c.shadowColor=color;c.shadowBlur=16;c.fillStyle=color;c.beginPath();c.arc(x,y,3,0,7);c.fill();c.lineWidth=hand.pinching?4:1.5;c.beginPath();c.arc(x,y,hand.pinching?10:19,0,7);c.stroke();c.shadowBlur=0;
    const target=interactiveAt(x,y);
    if(target!==hover){clearHover();hover=target;hover?.classList.add('hand-hover');since=now;}
    if(hover&&settings.dwell&&!dwelled&&!hand.pinching){const t=Math.min(1,(now-since)/1100);c.lineWidth=3;c.beginPath();c.arc(x,y,24,-Math.PI/2,-Math.PI/2+t*Math.PI*2);c.stroke();if(t>=1)choose(x,y);}
   }else{history.length=0;clearHover();}
   if(feedback&&now-feedback.at<280){c.strokeStyle='#8ce7ed';c.globalAlpha=1-(now-feedback.at)/280;c.lineWidth=3;c.beginPath();c.arc(feedback.x,feedback.y,20+(now-feedback.at)/10,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
   raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);return()=>{unsubscribe();cancelAnimationFrame(raf);clearHover();};
 },[vision]);
 return <canvas ref={canvas} className="tracking-layer" aria-hidden="true"/>;
}
