import type {Point} from './input';
export type Detection={landmarks:Point[][];handedness:{categoryName:string;score:number}[][]};
export type Landmarker={detectForVideo:(video:HTMLVideoElement,time:number)=>Detection|Promise<Detection>;close:()=>void};
export type VisionFiles={wasmLoaderPath:string;wasmBinaryPath:string};
type MediaPipe={FilesetResolver:{forVisionTasks:(path:string)=>Promise<unknown>};HandLandmarker:{createFromOptions:(files:unknown,options:unknown)=>Promise<Landmarker>}};
export type DiagnosticLog=(message:string)=>void;
export function runtimeURL(path:string){return new URL(path,document.baseURI).href;}
export function errorText(error:unknown){return error instanceof Error?`${error.name}: ${error.message}`:String(error);}

// Fetching is deliberate: a successful script load event alone does not prove that
// the Tauri protocol returned JavaScript (its SPA fallback can return index.html).
export async function inspectRuntimeAsset(url:string,kind:'js'|'wasm'|'model',log:DiagnosticLog){
 try{
  const response=await fetch(url);const type=response.headers.get('content-type')||'(missing)';
  const bytes=new Uint8Array(await response.arrayBuffer());
  log(`Asset ${response.status} ${type} · ${bytes.length} bytes · ${url}`);
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  if(/html/i.test(type)||new TextDecoder().decode(bytes.subarray(0,100)).trimStart().startsWith('<'))throw new Error('HTML fallback returned instead of runtime asset');
  if(kind==='js'&&!/^(text|application)\/(javascript|ecmascript)(;|$)/i.test(type))throw new Error(`JavaScript MIME type is ${type}`);
  if(kind==='wasm'&&(!/^application\/wasm(;|$)/i.test(type)||![0,97,115,109].every((b,i)=>bytes[i]===b)))throw new Error('Invalid WASM content or MIME type');
  if(kind==='model'&&!(bytes[2]===80&&bytes[3]===75&&bytes.length>1000000))throw new Error('Invalid Hand Landmarker task archive');
 }catch(error){log(`Asset failed · ${url} · ${errorText(error)}`);throw error;}
}
export async function loadMediaPipe(log:DiagnosticLog=()=>{}):Promise<MediaPipe>{
 const url=runtimeURL('vendor/vision_bundle.mjs');
 await inspectRuntimeAsset(url,'js',log);
 try{return await import(/* @vite-ignore */url) as MediaPipe;}
 catch(error){log(`JavaScript import failed · ${url} · ${errorText(error)}`);throw error;}
}

// MediaPipe consumes and clears self.ModuleFactory. Serialize startup across
// reconnects so an obsolete attempt cannot consume the next attempt's factory.
let pending:Promise<unknown>=Promise.resolve();
export function initializeLandmarker(runtime:MediaPipe,log:DiagnosticLog=()=>{},current=()=>true,verifyAssets=true){
 const run=async()=>{
  if(!current())return null;
  const modelURL=runtimeURL('models/hand_landmarker.task');log(`Model · ${modelURL}`);
  if(verifyAssets)await inspectRuntimeAsset(modelURL,'model',log);
  // forVisionTasks adds its own slash. A trailing slash produces /wasm//...,
  // which misses Tauri's embedded asset key and returns the HTML SPA fallback.
  const selected=await runtime.FilesetResolver.forVisionTasks(runtimeURL('wasm')) as VisionFiles;
  const variants=[selected];
  if(!selected.wasmLoaderPath.includes('_nosimd_'))variants.push({wasmLoaderPath:runtimeURL('wasm/vision_wasm_nosimd_internal.js'),wasmBinaryPath:runtimeURL('wasm/vision_wasm_nosimd_internal.wasm')});
  let last:unknown;
  for(const files of variants){
   const variant=files.wasmLoaderPath.includes('_nosimd_')?'non-SIMD':'SIMD';
   log(`Runtime ${variant} · loader ${files.wasmLoaderPath} · binary ${files.wasmBinaryPath}`);
   try{
    if(!current())return null;
    if(verifyAssets){await inspectRuntimeAsset(files.wasmLoaderPath,'js',log);await inspectRuntimeAsset(files.wasmBinaryPath,'wasm',log);}
    for(const delegate of ['GPU','CPU'] as const){
     if(!current())return null;
     log(`Initializing ${variant} / ${delegate}`);
     try{
      const model=await runtime.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:modelURL,delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
      if(!current()){model.close();return null;}
      log(`Ready · ${variant} / ${delegate}`);return {model,delegate,variant};
     }catch(error){last=error;log(`Initialization failed · ${variant} / ${delegate} · ${errorText(error)}`);}
    }
   }catch(error){last=error;log(`Runtime failed · ${variant} · ${errorText(error)}`);}
   if(current())log(`${variant} exhausted; trying matching non-SIMD assets if available`);
  }
  if(!current())return null;
  throw new Error(`Local hand tracking could not initialize. ${errorText(last)}`);
 };
 const result=pending.then(run);pending=result.catch(()=>{});return result;
}
