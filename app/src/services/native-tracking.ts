import {invoke,isTauri} from './native';
import type {Detection,Landmarker} from './mediapipe';

export async function createNativeTracker():Promise<Landmarker|null>{
 if(!isTauri()||!await invoke<boolean>('native_tracking_available'))return null;
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
 const context=canvas.getContext('2d');if(!context)throw new Error('Camera frame capture is unavailable.');
 let closed=false;
 return {
  async detectForVideo(video){
   if(closed)throw new Error('Tracker is closed');
   context.drawImage(video,0,0,640,480);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not capture camera frame')),'image/jpeg',.8));
   if(closed)return {landmarks:[],handedness:[]};
   const result=await invoke<Detection & {error?:string}>('track_hands',{frame:Array.from(new Uint8Array(await blob.arrayBuffer()))});
   if(result.error)throw new Error(result.error);
   return result;
  },
  close(){closed=true;canvas.width=0;canvas.height=0;}
 };
}
