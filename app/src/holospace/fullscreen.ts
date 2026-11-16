import {invoke,isTauri} from '../services/native';
export type FullscreenPort={enter:()=>Promise<void>;exit:()=>Promise<void>;active:()=>Promise<boolean>};
export function fullscreenPort(root:HTMLElement):FullscreenPort{return isTauri()?{
 enter:()=>invoke('holospace_fullscreen',{enabled:true}),exit:()=>invoke('holospace_fullscreen',{enabled:false}),active:()=>invoke<boolean>('holospace_is_fullscreen')
 }:{enter:async()=>{if(!root.requestFullscreen)throw Error('Fullscreen unavailable');await root.requestFullscreen();},exit:async()=>{if(document.fullscreenElement)await document.exitFullscreen();},active:async()=>!!document.fullscreenElement};}
