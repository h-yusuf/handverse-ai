import {loadMediaPipe,initializeLandmarker,errorText,type Landmarker} from './mediapipe';
import {GestureMachine,identity,type Hand,type Calibration} from './input';
export type Tracking={status:'off'|'loading'|'active'|'error';cameraActive:boolean;message:string;hands:Hand[];fps:number;latency:number;delegate:string;devices:MediaDeviceInfo[];diagnostics?:string[]};
export class Vision {
 video=document.createElement('video');stream:MediaStream|null=null;model:Landmarker|null=null;
 data:Tracking={status:'off',cameraActive:false,message:'Camera is off',hands:[],fps:0,latency:0,delegate:'—',devices:[]};
 interactionScope:'global'|'ar'|'ui'|'canvas'='global';
 ownsCanvasInput:((hand:Hand)=>boolean)|null=null;
 calibration:Calibration=identity;quality=30;private timer=0;private generation=0;private machines=new Map<string,GestureMachine>();private lastVideo=-1;private lastInference=0;private lastTimestamp=-1;private lastFound=0;private notifyAt=0;private frames=0;private epoch=0;
 private changes=new Set<()=>void>();private handListeners=new Set<(hands:Hand[])=>void>();
 subscribe=(listener:()=>void)=>{this.changes.add(listener);return()=>{this.changes.delete(listener);};};
 subscribeHands=(listener:(hands:Hand[])=>void)=>{this.handListeners.add(listener);return()=>{this.handListeners.delete(listener);};};
 private onChange=()=>{for(const listener of this.changes)listener();};
 private onHands=(hands:Hand[])=>{for(const listener of this.handListeners)listener(hands);};
 private selectedDevice?:string;
 constructor(){this.video.autoplay=true;this.video.playsInline=true;this.video.muted=true;}
 async start(deviceId?:string){
 if((this.data.status==='loading'||this.data.status==='active')&&deviceId===this.selectedDevice)return;
 this.stop();this.selectedDevice=deviceId;const generation=++this.generation;this.data.status='loading';this.data.message='Requesting camera permission…';this.onChange();
 try{
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires the desktop app or a secure browser connection.');
 const constraints={width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}};
 let stream=await navigator.mediaDevices.getUserMedia({video:{...constraints,...(deviceId?{deviceId:{exact:deviceId}}:{})},audio:false});
 if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
 this.stream=stream;
 // Device labels become available only after camera permission has been granted.
 let devices=await navigator.mediaDevices.enumerateDevices();
 if(generation!==this.generation)return;
 if(!deviceId){
 const builtIn=devices.find(d=>d.kind==='videoinput'&&/facetime|built.?in|macbook/i.test(d.label));
 if(builtIn&&builtIn.deviceId!==stream.getVideoTracks()[0]?.getSettings().deviceId){
 stream.getTracks().forEach(t=>t.stop());
 stream=await navigator.mediaDevices.getUserMedia({video:{...constraints,deviceId:{exact:builtIn.deviceId}},audio:false});
 if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
 this.stream=stream;
 }
 }
 this.video.srcObject=stream;await this.video.play();
 if(generation!==this.generation)return;
 this.data.cameraActive=true;this.data.devices=devices;
 stream.getVideoTracks()[0].addEventListener('ended',()=>{if(generation===this.generation){this.stop();this.data.status='error';this.data.message='Camera disconnected. Reconnect it and try again.';this.onChange();}});
 this.data.message='Camera connected. Loading local hand tracking…';this.onChange();
 this.data.diagnostics=[];
 const log=(message:string)=>{console.info('[HANDVERSE tracking]',message);if(generation===this.generation){this.data.diagnostics=[...(this.data.diagnostics||[]),message].slice(-40);this.onChange();}};
 log(`Origin · ${location.origin} · base ${document.baseURI}`);
 const scriptError=(event:Event)=>{const e=event as ErrorEvent;const src=(event.target as HTMLScriptElement)?.src;if(src||e.message)log(`JavaScript error · ${src||e.filename||''} · ${e.message||'script loading failed'}`);};
 const cspError=(event:SecurityPolicyViolationEvent)=>log(`CSP blocked · ${event.violatedDirective} · ${event.blockedURI}`);
 window.addEventListener('error',scriptError,true);document.addEventListener('securitypolicyviolation',cspError);
 let initialized;
 try{
 const runtime=await loadMediaPipe(log);
 if(generation!==this.generation)return;
 initialized=await initializeLandmarker(runtime,log,()=>generation===this.generation);
 }finally{window.removeEventListener('error',scriptError,true);document.removeEventListener('securitypolicyviolation',cspError);}
 if(!initialized||generation!==this.generation)return;
 this.model=initialized.model;this.data.delegate=initialized.delegate;
 this.data.status='active';this.epoch=performance.now();this.frames=0;this.lastVideo=-1;this.lastInference=0;this.lastTimestamp=-1;this.quality=30;this.lastFound=performance.now();this.onChange();this.tick();
 }catch(e){if(generation!==this.generation)return;console.error('[HANDVERSE tracking]',errorText(e));const cameraConnected=this.data.cameraActive;if(!cameraConnected)this.stop();this.data.status='error';const name=(e as Error).name;this.data.message=cameraConnected?'Camera connected. Hand tracking is unavailable: '+(e as Error).message:name==='NotAllowedError'?'Camera permission was denied. Allow HANDVERSE in System Settings → Privacy & Security → Camera on macOS, or enable desktop app camera access in Windows Settings → Privacy → Camera, then try again.':name==='NotFoundError'?'No camera found. Connect a webcam and try again.':name==='NotReadableError'?'Camera is busy. Close other camera apps and try again.':(e as Error).message;this.onChange();}
 }
 private tick=async()=>{
 if(this.data.status!=='active'||!this.model)return;
 const generation=this.generation,now=performance.now();
 if(document.hidden){if(this.data.hands.length){this.data.hands=[];this.onHands([]);this.onChange();}this.timer=requestAnimationFrame(this.tick);return;}
 if(this.video.readyState>=2&&this.video.currentTime!==this.lastVideo&&now-this.lastInference>=1000/this.quality){
 this.lastVideo=this.video.currentTime;this.lastInference=now;
 try{const before=performance.now();const timestamp=Math.max(now,this.lastTimestamp+.001);this.lastTimestamp=timestamp;const result=await this.model.detectForVideo(this.video,timestamp);if(generation!==this.generation)return;this.data.latency=performance.now()-before;
 this.data.hands=result.landmarks.map((p,i)=>{const id=result.handedness[i]?.[0]?.categoryName||String(i);let machine=this.machines.get(id);if(!machine){machine=new GestureMachine();this.machines.set(id,machine);}return {id,confidence:result.handedness[i]?.[0]?.score??0,...machine.update(p,now,this.calibration)};}).filter(h=>h.confidence>=.6);

 if(this.data.hands.length)this.lastFound=now;this.data.message=this.data.hands.length?`${this.data.hands.length} hand${this.data.hands.length>1?'s':''} detected`:now-this.lastFound>1500?'Show your hands to the camera':'Finding your hands…';
 this.onHands(this.data.hands);if(generation!==this.generation)return;this.frames++;if(now-this.epoch>=1000){this.data.fps=this.frames*1000/(now-this.epoch);this.frames=0;this.epoch=now;}
 if(this.data.latency>40)this.quality=15;else if(this.data.latency<24)this.quality=30;
 }catch(e){if(generation!==this.generation)return;this.stop();this.data.status='error';this.data.message=`Tracking stopped: ${(e as Error).message}. Try reconnecting.`;this.onChange();return;}
 }
 if(generation!==this.generation)return;
 if(now-this.notifyAt>120){this.onChange();this.notifyAt=now;}this.timer=requestAnimationFrame(this.tick);
 }
 stop(){this.generation++;cancelAnimationFrame(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;this.model?.close();this.model=null;this.machines.clear();this.data={...this.data,status:'off',cameraActive:false,message:'Camera is off',hands:[],fps:0,latency:0,delegate:'—'};this.onHands([]);this.onChange();}
}
export const vision=new Vision();
