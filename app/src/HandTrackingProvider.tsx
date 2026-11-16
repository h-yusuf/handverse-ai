import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {vision,type Vision} from './services/vision';
import {TrackingLayer} from './TrackingLayer';

const HandTrackingContext=createContext<Vision|null>(null);
export function useHandTracking(){
 const service=useContext(HandTrackingContext);
 if(!service)throw new Error('Hand tracking provider is missing');
 return service;
}
// Only diagnostics/UI subscribers rerender; games and the cursor read the live service.
export function useTrackingSnapshot(){
 const service=useHandTracking();
 const [data,setData]=useState(()=>({...service.data}));
 useEffect(()=>{const update=()=>setData({...service.data});const unsubscribe=service.subscribe(update);update();return unsubscribe;},[service]);
 return data;
}
export function GlobalHandTrackingProvider({children}:{children:ReactNode}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  // Keep the inference video attached and playing independently of page previews.
  host.current!.append(vision.video);
  const unload=(event:PageTransitionEvent)=>{if(!event.persisted)vision.stop();};
  const visibility=()=>{
   vision.data.hands=[];
   if(!document.hidden&&vision.stream)void vision.video.play().catch(()=>{});
  };
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',unload);
  return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',unload);vision.stop();vision.video.remove();};
 },[]);
 return <HandTrackingContext.Provider value={vision}>
  <div ref={host} aria-hidden="true" style={{position:'fixed',width:1,height:1,overflow:'hidden',opacity:.001,pointerEvents:'none'}}/>
  {children}<TrackingLayer/>
 </HandTrackingContext.Provider>;
}
