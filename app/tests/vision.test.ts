import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadMediaPipe,type Landmarker} from '../src/services/mediapipe';
import {runSelfTest} from '../src/selftest';
import {createNativeTracker} from '../src/services/native-tracking';
vi.mock('../src/services/mediapipe',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/services/mediapipe')>();
 return {...actual,loadMediaPipe:vi.fn().mockRejectedValue(new Error('Tracking model missing')),initializeLandmarker:(runtime:Parameters<typeof actual.initializeLandmarker>[0],log:Parameters<typeof actual.initializeLandmarker>[1],current:Parameters<typeof actual.initializeLandmarker>[2])=>actual.initializeLandmarker(runtime,log,current,false)};
});
const runtimeFiles={wasmLoaderPath:'http://localhost/wasm/vision_wasm_internal.js',wasmBinaryPath:'http://localhost/wasm/vision_wasm_internal.wasm'};
vi.mock('../src/services/native-tracking',()=>({createNativeTracker:vi.fn().mockResolvedValue(null)}));
const video={autoplay:false,playsInline:false,muted:false,srcObject:null,play:vi.fn().mockResolvedValue(undefined),pause:vi.fn()};
const devices=[{kind:'videoinput',deviceId:'phone',label:'iPhone Camera'},{kind:'videoinput',deviceId:'mac',label:'FaceTime HD Camera'}];
function stream(id:string){const track={stop:vi.fn(),getSettings:()=>({deviceId:id}),addEventListener:vi.fn()};return {getTracks:()=>[track],getVideoTracks:()=>[track]};}
beforeEach(()=>{vi.mocked(createNativeTracker).mockReset().mockResolvedValue(null);vi.mocked(loadMediaPipe).mockReset().mockRejectedValue(new Error('Tracking model missing'));vi.stubGlobal('document',{baseURI:'http://localhost/',createElement:()=>video,addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('location',{origin:'http://localhost'});vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('cancelAnimationFrame',vi.fn());vi.stubGlobal('navigator',{mediaDevices:{enumerateDevices:vi.fn().mockResolvedValue(devices),getUserMedia:vi.fn()}});});
describe('Mac camera connection',()=>{
 it('prefers the built-in camera after permission and keeps preview when tracking assets are unavailable',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();const phone=stream('phone'),mac=stream('mac');
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(phone as unknown as MediaStream).mockResolvedValueOnce(mac as unknown as MediaStream);
  await vision.start();
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({audio:false,video:expect.objectContaining({deviceId:{exact:'mac'}})}));
  expect(phone.getTracks()[0].stop).toHaveBeenCalled();expect(vision.data.cameraActive).toBe(true);expect(vision.data.status).toBe('error');expect(vision.data.message).toContain('Camera connected.');expect(video.srcObject).toBe(mac);
  vision.stop();expect(mac.getTracks()[0].stop).toHaveBeenCalled();expect(vision.data.cameraActive).toBe(false);expect(video.srcObject).toBeNull();
 });
 it('honors an explicitly selected camera',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(stream('phone') as unknown as MediaStream);
  await vision.start('phone');expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({video:expect.objectContaining({deviceId:{exact:'phone'}})}));vision.stop();
 });
 it('provides Mac camera permission guidance',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(Object.assign(new Error('Denied'),{name:'NotAllowedError'}));
  await vision.start();expect(vision.data.cameraActive).toBe(false);expect(vision.data.message).toContain('System Settings');
 });
 it('releases a delayed camera stream if stopped while permission is pending',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();const late=stream('mac');let resolve!:(s:MediaStream)=>void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  const pending=vision.start();vision.stop();resolve(late as unknown as MediaStream);await pending;
  expect(late.getTracks()[0].stop).toHaveBeenCalled();expect(vision.data.cameraActive).toBe(false);
 });
 it('passes gesture, mapping, collision and scoring checks',()=>{expect(runSelfTest().passed).toBe(true);});
});

// These promises reproduce stopping or reconnecting during asynchronous model startup.
describe('Tracking startup cancellation',()=>{
 it('initializes local VIDEO tracking for two hands and falls back to CPU',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision(),close=vi.fn();
  vi.stubGlobal('requestAnimationFrame',vi.fn());
  Object.assign(video,{readyState:0,currentTime:0});
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream('mac') as unknown as MediaStream);
  const files=vi.fn().mockResolvedValue(runtimeFiles);
  const create=vi.fn().mockRejectedValueOnce(new Error('GPU unavailable')).mockResolvedValueOnce({close,detectForVideo:vi.fn()});
  vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:files},HandLandmarker:{createFromOptions:create}});
  await vision.start('mac');
  expect(files).toHaveBeenCalledWith('http://localhost/wasm');
  expect(create).toHaveBeenNthCalledWith(1,runtimeFiles,expect.objectContaining({runningMode:'VIDEO',numHands:2,baseOptions:{modelAssetPath:'http://localhost/models/hand_landmarker.task',delegate:'GPU'}}));
  expect(create).toHaveBeenNthCalledWith(2,runtimeFiles,expect.objectContaining({baseOptions:{modelAssetPath:'http://localhost/models/hand_landmarker.task',delegate:'CPU'}}));
  expect(vision.data.status).toBe('active');expect(vision.data.delegate).toBe('CPU');expect(createNativeTracker).not.toHaveBeenCalled();
  vision.stop();expect(close).toHaveBeenCalledTimes(1);
 });
 it('discards an asynchronous inference result after stopping',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();
  vi.stubGlobal('requestAnimationFrame',vi.fn());
  Object.assign(video,{readyState:2,currentTime:1});
  let resolve!:(value:{landmarks:[];handedness:[]})=>void;
  const detectForVideo=vi.fn(()=>new Promise<{landmarks:[];handedness:[]}>(r=>{resolve=r;}));
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream('mac') as unknown as MediaStream);
  vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue(runtimeFiles)},HandLandmarker:{createFromOptions:vi.fn().mockResolvedValue({close:vi.fn(),detectForVideo})}});
  await vision.start('mac');expect(detectForVideo).toHaveBeenCalled();vision.stop();
  resolve({landmarks:[],handedness:[]});await Promise.resolve();
  expect(vision.data.status).toBe('off');expect(vision.data.message).toBe('Camera is off');
  Object.assign(video,{readyState:0,currentTime:0});
 });
 async function pendingModel(){
  const {Vision}=await import('../src/services/vision');
  const vision=new Vision(),camera=stream('mac');
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(camera as unknown as MediaStream);
  let resolve!:(value:Landmarker)=>void,reject!:(error:Error)=>void;
  const pending=new Promise<Landmarker>((yes,no)=>{resolve=yes;reject=no;});
  const create=vi.fn();
  const entered=vi.fn();
  vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue(runtimeFiles)},HandLandmarker:{createFromOptions:create.mockImplementationOnce(()=>{entered();return pending;})}});
  const start=vision.start('mac');
  await vi.waitFor(()=>expect(entered).toHaveBeenCalled());
  return {vision,camera,start,create,resolve,reject};
 }
 it('does not initialize a tracker after stopping during runtime loading',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream('mac') as unknown as MediaStream);
  let resolve!:(value:Awaited<ReturnType<typeof loadMediaPipe>>)=>void;
  vi.mocked(loadMediaPipe).mockReturnValue(new Promise(r=>{resolve=r;}));
  const start=vision.start('mac');await vi.waitFor(()=>expect(loadMediaPipe).toHaveBeenCalled());
  vision.stop();const files=vi.fn();
  resolve({FilesetResolver:{forVisionTasks:files},HandLandmarker:{createFromOptions:vi.fn()}});
  await start;expect(files).not.toHaveBeenCalled();expect(vision.data.status).toBe('off');
 });
 it('closes a tracker that finishes loading after stop without restoring the delegate',async()=>{
  const {vision,camera,start,resolve}=await pendingModel();vision.stop();const close=vi.fn();
  resolve({close,detectForVideo:vi.fn()});await start;
  expect(close).toHaveBeenCalledTimes(1);expect(camera.getTracks()[0].stop).toHaveBeenCalled();
  expect(vision.model).toBeNull();expect(vision.data.delegate).toBe('—');expect(vision.data.status).toBe('off');
 });
 it('does not start CPU fallback after a cancelled GPU attempt fails',async()=>{
  const {vision,start,create,reject}=await pendingModel();vision.stop();reject(new Error('GPU unavailable'));await start;
  expect(create).toHaveBeenCalledTimes(1);expect(vision.data.status).toBe('off');expect(vision.data.delegate).toBe('—');
 });
});

describe('global service lifetime',()=>{
 it('reuses an active stream/model and survives page subscriber changes with a single loop',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision(),camera=stream('mac'),close=vi.fn();
  Object.assign(video,{readyState:0,currentTime:0});
  const raf=vi.fn();vi.stubGlobal('requestAnimationFrame',raf);
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(camera as unknown as MediaStream);
  const create=vi.fn().mockResolvedValue({close,detectForVideo:vi.fn()});
  vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue(runtimeFiles)},HandLandmarker:{createFromOptions:create}});
  const first=vision.start('mac');await vision.start('mac');await first;
  for(let i=0;i<20;i++){
   const unsubscribe=vision.subscribe(vi.fn()),unsubscribeHands=vision.subscribeHands(vi.fn());
   unsubscribe();unsubscribeHands();await vision.start('mac');
  }
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);expect(raf).toHaveBeenCalledTimes(1);
  expect(camera.getTracks()[0].stop).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
  vision.stop();expect(close).toHaveBeenCalledTimes(1);expect(camera.getTracks()[0].stop).toHaveBeenCalledTimes(1);
 });
 it('skips inference while hidden and resumes the same engine when visible',async()=>{
  const {Vision}=await import('../src/services/vision');const vision=new Vision();
  const callbacks:FrameRequestCallback[]=[];vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{callbacks.push(cb);return callbacks.length;}));
  Object.assign(document,{hidden:true});Object.assign(video,{readyState:2,currentTime:1});
  const detectForVideo=vi.fn().mockReturnValue({landmarks:[],handedness:[]});
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream('mac') as unknown as MediaStream);
  const create=vi.fn().mockResolvedValue({close:vi.fn(),detectForVideo});
  vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue(runtimeFiles)},HandLandmarker:{createFromOptions:create}});
  await vision.start('mac');expect(detectForVideo).not.toHaveBeenCalled();
  Object.assign(document,{hidden:false});await callbacks.shift()!(performance.now());
  expect(detectForVideo).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);vision.stop();
 });
});

it('does not reschedule inference when a gesture handler stops the camera',async()=>{
 const {Vision}=await import('../src/services/vision');const vision=new Vision();
 Object.assign(video,{readyState:2,currentTime:1});
 const raf=vi.fn();vi.stubGlobal('requestAnimationFrame',raf);
 vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream('mac') as unknown as MediaStream);
 vi.mocked(loadMediaPipe).mockResolvedValue({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue(runtimeFiles)},HandLandmarker:{createFromOptions:vi.fn().mockResolvedValue({close:vi.fn(),detectForVideo:vi.fn().mockReturnValue({landmarks:[],handedness:[]})})}});
 // Subscribe after start() sends its initial empty-hand notification.
 const start=vision.start('mac');
 const off=vision.subscribeHands(()=>{off();vision.stop();});
 await start;await Promise.resolve();
 expect(vision.data.status).toBe('off');expect(raf).not.toHaveBeenCalled();
});
