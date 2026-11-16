import {mkdir,copyFile,readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check');
const source=path.join(root,'node_modules/@mediapipe/tasks-vision');
const model=path.join(root,'public/models/hand_landmarker.task');
const modelURL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const assets=['vision_bundle.mjs',...['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'].map(f=>'wasm/'+f)];
// Google's task bundle has a two-byte prefix before its ZIP header. Validate
// the complete pinned model instead of rejecting that legitimate prefix.
const modelSHA256='fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
function validModel(b){return createHash('sha256').update(b).digest('hex')===modelSHA256;}
try{
 const pkg=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
 if(pkg.version!=='0.10.32')throw new Error('Expected @mediapipe/tasks-vision 0.10.32; run npm install.');
 for(const asset of assets){
  const destination=path.join(root,'public',asset.startsWith('wasm/')?asset:'vendor/'+asset);
  const original=await readFile(path.join(source,asset));
  if(check){if(!(await readFile(destination)).equals(original))throw new Error('Runtime asset does not match installed MediaPipe: '+asset);}
  else{await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(source,asset),destination);}
 }
 let installed=false;
 try{installed=validModel(await readFile(model));}catch{}
 if(!installed){
  if(check)throw new Error('Official Hand Landmarker model is missing or incomplete.');
  const response=await fetch(modelURL,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Model download HTTP '+response.status);
  const buffer=Buffer.from(await response.arrayBuffer());
  if(!validModel(buffer))throw new Error('Downloaded model is incomplete or is not a MediaPipe task archive.');
  await mkdir(path.dirname(model),{recursive:true});
  await writeFile(model+'.download',buffer);await rename(model+'.download',model);
 }
 console.log('Verified local MediaPipe 0.10.32 runtime, SIMD/non-SIMD WASM and official Hand Landmarker model.');
}catch(error){
 console.error('MediaPipe setup failed:',error.message,error.cause?.message||'');
 console.error('Tracking is NOT ready. With network access, run npm install and npm run setup:tracking, then npm run build.');
 process.exitCode=1;
}
