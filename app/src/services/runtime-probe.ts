import {runARSmokeTest} from '../ar/smoke-test';
import {runGameplaySelfTest} from '../selftest';
import {loadMediaPipe,initializeLandmarker,inspectRuntimeAsset,runtimeURL,errorText} from './mediapipe';
// Run with HANDVERSE.app/Contents/MacOS/handverse --runtime-test /tmp/report.json.
// This exercises the packaged WKWebView and inference, without camera permission.
export async function runRuntimeProbe(){
 const diagnostics:string[]=[];
 const log=(message:string)=>{diagnostics.push(message);console.info('[HANDVERSE runtime probe]',message);};
 const report:Record<string,unknown>={origin:location.origin,userAgent:navigator.userAgent,diagnostics,realHandTested:false};
 const error=(e:ErrorEvent)=>log(`JavaScript error · ${e.message}`);
 const csp=(e:SecurityPolicyViolationEvent)=>log(`CSP blocked · ${e.violatedDirective} · ${e.blockedURI}`);
 window.addEventListener('error',error);document.addEventListener('securitypolicyviolation',csp);
 try{
  const runtime=await loadMediaPipe(log);
  // Explicitly reject the pre-fix path: 200 + HTML must never count as a loader.
  try{await inspectRuntimeAsset(runtimeURL('wasm//vision_wasm_internal.js'),'js',log);report.malformedPathRejected=false;}
  catch{report.malformedPathRejected=true;}
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d')!.fillRect(0,0,640,480);
  const variants=[];
  for(const variant of ['auto','non-SIMD'] as const){
   const selected=variant==='auto'?runtime:{...runtime,FilesetResolver:{forVisionTasks:async()=>({wasmLoaderPath:runtimeURL('wasm/vision_wasm_nosimd_internal.js'),wasmBinaryPath:runtimeURL('wasm/vision_wasm_nosimd_internal.wasm')})}};
   const tracker=await initializeLandmarker(selected,log);
   if(!tracker)throw new Error('Initialization cancelled');
   try{const detection=await tracker.model.detectForVideo(canvas as unknown as HTMLVideoElement,performance.now());variants.push({requested:variant,variant:tracker.variant,delegate:tracker.delegate,initialized:true,inference:true,hands:detection.landmarks.length});}
   finally{tracker.model.close();}
  }
  report.variants=variants;report.passed=true;
 }catch(e){report.error=errorText(e);report.passed=false;}
 finally{window.removeEventListener('error',error);document.removeEventListener('securitypolicyviolation',csp);}
 return report;
}

export async function runPackagedSelfTest(){
 const runtime=await runRuntimeProbe();
 const ar=await runARSmokeTest();
 const gameplay=await runGameplaySelfTest();
 return {...gameplay,runtime,steps:[...gameplay.steps,...ar,{step:'mediapipe-runtime',passed:runtime.passed===true,detail:runtime.passed?'Packaged MediaPipe initialized and inferred on a blank canvas with auto and non-SIMD runtimes; physical hands untested':JSON.stringify(runtime)}]};
}
