import {useEffect,useRef} from 'react';
import {useHandTracking} from './HandTrackingProvider';
import {isAutomatedRun} from './services/native';
import {connections} from './services/hand-landmarks';
import {settings,handControls} from './services/storage';
import {PinchGate,interactiveAt,activate,ownsUI,allowsGlobalActivation} from './services/hand-navigation';
export {connections} from './services/hand-landmarks';
export function TrackingLayer(){
 const vision=useHandTracking(),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0,hover:HTMLElement|null=null,since=0,dwelled=false,primary:string|undefined;
  let lastSample=0,acquired=0,hadHand=false;
  let feedback:{x:number;y:number;at:number}|null=null;
  const insideOwnedRegion=(x:number,y:number)=>{const el=document.elementFromPoint(x,y);return !!el?.closest('[data-ar-region],[data-air-region]')&&!el.closest('[data-air-tools]');};
  const gate=new PinchGate(),history:{x:number;y:number}[]=[];
  const clearHover=()=>{hover?.classList.remove('hand-hover');hover=null;since=0;dwelled=false;};
  const choose=(x:number,y:number)=>{const target=interactiveAt(x,y);if(target){feedback={x,y,at:performance.now()};activate(target);dwelled=true;}};
  const unsubscribe=vision.subscribeHands(hands=>{
   lastSample=performance.now();if(hands.length&&!hadHand)acquired=lastSample;hadHand=hands.length>0;
   primary=hands.find(h=>h.id===primary)?.id??hands[0]?.id;
   for(const hand of hands){const pressed=gate.update(hand);if(allowsGlobalActivation(vision.interactionScope)&&pressed&&hand.id===primary&&!document.hidden&&!(vision.interactionScope==='canvas'&&vision.ownsCanvasInput?.(hand))&&ownsUI(vision.interactionScope,insideOwnedRegion(hand.cursor.x*innerWidth,hand.cursor.y*innerHeight)))choose(Math.min(innerWidth-1,hand.cursor.x*innerWidth),Math.min(innerHeight-1,hand.cursor.y*innerHeight));}
  });
  const frame=(now:number)=>{
   const el=canvas.current!,c=el.getContext('2d')!;
   if(el.width!==innerWidth||el.height!==innerHeight){el.width=innerWidth;el.height=innerHeight;history.length=0;}
   c.clearRect(0,0,el.width,el.height);
   const cursorHand=vision.data.hands.find(h=>h.id===primary);
   if(cursorHand&&((vision.interactionScope==='canvas'&&vision.ownsCanvasInput?.(cursorHand))||!ownsUI(vision.interactionScope,insideOwnedRegion(cursorHand.cursor.x*innerWidth,cursorHand.cursor.y*innerHeight)))){history.length=0;feedback=null;clearHover();raf=requestAnimationFrame(frame);return;}
   const hand=(!document.hidden||(vision.interactionScope==='holospace'&&isAutomatedRun()))&&now-lastSample<300&&vision.data.hands.find(h=>h.id===primary);
   if(vision.interactionScope==='holospace'&&hand){
    if(handControls.skeleton!=='Hidden'){
     const opacity=handControls.skeleton==='Always visible'?1:Math.max(0,1-(now-acquired-700)/600);
     const vw=vision.video.videoWidth||640,vh=vision.video.videoHeight||480,scale=Math.max(innerWidth/vw,innerHeight/vh),ox=(innerWidth-vw*scale)/2,oy=(innerHeight-vh*scale)/2;
     const point=(i:number)=>({x:(1-hand.points[i].x)*vw*scale+ox,y:hand.points[i].y*vh*scale+oy});
     c.globalAlpha=opacity*.8;c.strokeStyle='#fff';c.lineWidth=1.25;c.shadowColor='#bceef3';c.shadowBlur=2;
     for(const [a,b] of connections){const p=point(a),q=point(b);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}
     hand.points.forEach((_,i)=>{const p=point(i);c.fillStyle=i===8||(i===4&&hand.pinching)?'#b4f4ff':'#fff';c.beginPath();c.arc(p.x,p.y,i===8?2.5:1.7,0,Math.PI*2);c.fill();});
     c.globalAlpha=1;c.shadowBlur=0;
    }
    if(handControls.diagnostics){c.font='12px system-ui';c.fillStyle='#fff';c.fillText(`${vision.data.fps.toFixed(0)} fps · inference ${vision.data.latency.toFixed(0)} ms · ${handControls.preset} · ${hand.pinching?'Pinch held':'Released'}`,24,innerHeight-125);}
   }
   if(hand){
    const x=Math.min(innerWidth-1,hand.cursor.x*innerWidth),y=Math.min(innerHeight-1,hand.cursor.y*innerHeight),color=hand.id==='Left'?'#ba9aff':'#65edff';
    history.push({x,y});if(history.length>9)history.shift();c.strokeStyle=color;c.lineWidth=2;
    for(let i=1;i<history.length;i++){c.globalAlpha=i/history.length*.45;c.beginPath();c.moveTo(history[i-1].x,history[i-1].y);c.lineTo(history[i].x,history[i].y);c.stroke();}
    c.globalAlpha=1;c.shadowColor=color;c.shadowBlur=16;c.fillStyle=color;c.beginPath();c.arc(x,y,3,0,7);c.fill();c.lineWidth=hand.pinching?4:1.5;c.beginPath();c.arc(x,y,hand.pinching?10:19,0,7);c.stroke();c.shadowBlur=0;
    const target=interactiveAt(x,y);
    if(target!==hover){clearHover();hover=target;hover?.classList.add('hand-hover');since=now;}
    if(allowsGlobalActivation(vision.interactionScope)&&hover&&settings.dwell&&!dwelled&&!hand.pinching){const t=Math.min(1,(now-since)/1100);c.lineWidth=3;c.beginPath();c.arc(x,y,24,-Math.PI/2,-Math.PI/2+t*Math.PI*2);c.stroke();if(t>=1)choose(x,y);}
   }else{history.length=0;clearHover();}
   if(feedback&&now-feedback.at<280){c.strokeStyle='#8ce7ed';c.globalAlpha=1-(now-feedback.at)/280;c.lineWidth=3;c.beginPath();c.arc(feedback.x,feedback.y,20+(now-feedback.at)/10,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
   raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);return()=>{unsubscribe();cancelAnimationFrame(raf);clearHover();};
 },[vision]);
 return <canvas ref={canvas} className="tracking-layer" aria-hidden="true"/>;
}
