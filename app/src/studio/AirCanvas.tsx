import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {Camera,Maximize2,Minimize2,Undo2,Redo2,Eraser,Trash2,Download,Save,FolderOpen,HelpCircle,Play,Video,Palette} from 'lucide-react';
import {useHandTracking,useTrackingSnapshot} from '../HandTrackingProvider';
import {connections} from '../services/hand-landmarks';
import {isAutomatedRun} from '../services/native';
import {AirEngine,brushes,WIDTH,HEIGHT,cameraPoint,world,serialize,restore,type BrushSettings} from './engine';
import {drawInk,drawCamera,supportedVideo} from './render';
import './studio.css';
const colors=[['White','#ffffff'],['Light Cyan','#b9f4ff'],['Soft Mint','#c2f5dc'],['Pale Blue','#c1d9ff'],['Lavender','#dccbff'],['Soft Pink','#ffd0e4']];
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export function AirCanvas(){
 const vision=useHandTracking(),data=useTrackingSnapshot(),engine=useRef(new AirEngine()).current;
 const root=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null),camera=useRef<HTMLCanvasElement>(null),ink=useRef<HTMLCanvasElement>(null),hud=useRef<HTMLCanvasElement>(null),file=useRef<HTMLInputElement>(null),status=useRef<HTMLSpanElement>(null);
 const [config,setConfig]=useState<BrushSettings>(engine.settings),[immersive,setImmersive]=useState(false),[help,setHelp]=useState(false),[clear,setClear]=useState(false),[radial,setRadial]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[,refresh]=useState(0);
 const blocked=useRef(false),playback=useRef<{start:number;first:number;last:number;recorder?:MediaRecorder;output?:HTMLCanvasElement;stream?:MediaStream}|null>(null),pointer=useRef<number|null>(null);
 blocked.current=help||clear||radial||busy;
 const change=(patch:Partial<BrushSettings>)=>{engine.end();engine.settings={...engine.settings,...patch};setConfig({...engine.settings});};
 const sync=()=>{refresh(v=>v+1);setConfig({...engine.settings});};
 const finishPlayback=()=>{const p=playback.current;if(p?.recorder&&p.recorder.state!=='inactive')p.recorder.stop();p?.stream?.getTracks().forEach(t=>t.stop());playback.current=null;setBusy(false);engine.revision++;};
 useEffect(()=>{
  vision.interactionScope='canvas';vision.ownsCanvasInput=hand=>{const p=cameraPoint(hand.points[8],vision.video.videoWidth||640,vision.video.videoHeight||480),r=stage.current!.getBoundingClientRect(),el=document.elementFromPoint(r.left+p.x/WIDTH*r.width,r.top+p.y/HEIGHT*r.height);return !!el?.closest('[data-air-region]')&&!el.closest('button,input,select,[data-air-tools]');};let raf=0,lastRevision=-1,lastLabel='',lastSeen=0,lastEraser=engine.settings.eraser;
  const unsubscribe=vision.subscribeHands(hands=>{
   lastSeen=performance.now();if(document.hidden||blocked.current||pointer.current!==null){engine.lost();return;}
   engine.update(hands,lastSeen,p=>cameraPoint(p,vision.video.videoWidth||640,vision.video.videoHeight||480),p=>{const rect=stage.current!.getBoundingClientRect();const el=document.elementFromPoint(rect.left+p.x/WIDTH*rect.width,rect.top+p.y/HEIGHT*rect.height);return !!el?.closest('[data-air-region]')&&!el.closest('button,input,select,[data-air-tools]');});
   if(engine.radial){engine.radial=false;setRadial(true);}
   if(engine.settings.eraser!==lastEraser){lastEraser=engine.settings.eraser;setConfig({...engine.settings});}
  });
  const frame=(now:number)=>{
   raf=requestAnimationFrame(frame);if(document.hidden&&!isAutomatedRun()){engine.lost();return;}if(now-lastSeen>220&&pointer.current===null)engine.lost();
   const p=playback.current;if(p&&now-p.start>p.last-p.first+400){finishPlayback();}
   drawCamera(camera.current!.getContext('2d')!,vision.video);
   if(engine.revision!==lastRevision||playback.current||engine.strokes.some(s=>s.light&&!s.persistent)){
    drawInk(ink.current!.getContext('2d')!,engine.strokes,engine.view,playback.current?playback.current.first+now-playback.current.start:Infinity,now+engine.timeOffset);lastRevision=engine.revision;
   }
   if(p?.output){const c=p.output.getContext('2d')!;c.fillStyle='#101821';c.fillRect(0,0,WIDTH,HEIGHT);c.drawImage(ink.current!,0,0);}
   const c=hud.current!.getContext('2d')!;c.clearRect(0,0,WIDTH,HEIGHT);c.lineWidth=1.3;c.strokeStyle='#ffffffaa';
   if(!playback.current)for(const hand of vision.data.hands){for(const [a,b] of connections){const x=cameraPoint(hand.points[a],vision.video.videoWidth||640,vision.video.videoHeight||480),y=cameraPoint(hand.points[b],vision.video.videoWidth||640,vision.video.videoHeight||480);c.beginPath();c.moveTo(x.x,x.y);c.lineTo(y.x,y.y);c.stroke();}}
   if(engine.cursor&&!playback.current){c.strokeStyle=engine.settings.eraser?'#ffd0e4':engine.settings.color;c.lineWidth=2;c.beginPath();c.arc(engine.cursor.x,engine.cursor.y,Math.max(7,engine.settings.width*engine.view.zoom/2),0,Math.PI*2);c.stroke();}
   const label=playback.current?'Replaying drawing…':engine.status;if(label!==lastLabel&&status.current){status.current.textContent=label;lastLabel=label;}
  };raf=requestAnimationFrame(frame);
  const hide=()=>engine.lost();document.addEventListener('visibilitychange',hide);
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setImmersive(false);setHelp(false);setRadial(false);}};window.addEventListener('keydown',escape);
  const fullscreen=()=>{if(!document.fullscreenElement)setImmersive(false);engine.lost();};document.addEventListener('fullscreenchange',fullscreen);
  const resize=new ResizeObserver(()=>{engine.lost();engine.revision++;});resize.observe(stage.current!);
  return()=>{unsubscribe();cancelAnimationFrame(raf);resize.disconnect();engine.lost();finishPlayback();vision.interactionScope='global';vision.ownsCanvasInput=null;document.removeEventListener('visibilitychange',hide);window.removeEventListener('keydown',escape);document.removeEventListener('fullscreenchange',fullscreen);};
 },[vision,engine]);
 const toggleFullscreen=async()=>{engine.lost();try{if(immersive){if(document.fullscreenElement)await document.exitFullscreen();setImmersive(false);}else{setImmersive(true);await root.current?.requestFullscreen?.();}}catch{setImmersive(true);}};
 const point=(e:PointerEvent)=>{const r=stage.current!.getBoundingClientRect();return {x:(e.clientX-r.left)*WIDTH/r.width,y:(e.clientY-r.top)*HEIGHT/r.height};};
 const replay=(record=false)=>{
  engine.end();if(!engine.strokes.length){setMessage('Draw something first.');return;}const times=engine.strokes.flatMap(s=>s.points.map(p=>p.t));let first=Infinity,last=0;for(const t of times){first=Math.min(first,t);last=Math.max(last,t);}const p:{start:number;first:number;last:number;recorder?:MediaRecorder;output?:HTMLCanvasElement;stream?:MediaStream}={start:performance.now()+150,first,last};
  if(record){try{const mime=supportedVideo();if(!mime)throw new Error('Video export is unavailable in this browser. PNG and project saving are available.');const out=document.createElement('canvas');out.width=WIDTH;out.height=HEIGHT;if(!out.captureStream)throw new Error('Canvas recording is unavailable.');const stream=out.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:mime}),chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{download(new Blob(chunks,{type:mime}),'handverse-timelapse.'+(mime.includes('mp4')?'mp4':'webm'));stream.getTracks().forEach(t=>t.stop());};recorder.onerror=()=>{setMessage('Video recording failed. Try PNG export.');finishPlayback();};recorder.start();Object.assign(p,{recorder,output:out,stream});}catch(e){setMessage((e as Error).message);return;}}
  engine.lost();playback.current=p;setBusy(true);
 };
 const png=(background:boolean)=>{engine.end();try{const out=document.createElement('canvas');out.width=WIDTH;out.height=HEIGHT;const c=out.getContext('2d')!,drawing=document.createElement('canvas');drawing.width=WIDTH;drawing.height=HEIGHT;drawInk(drawing.getContext('2d')!,engine.strokes,engine.view,Infinity,performance.now()+engine.timeOffset);if(background){if(!data.cameraActive||vision.video.readyState<2)throw new Error('Connect your camera before exporting its background.');drawCamera(c,vision.video);}c.drawImage(drawing,0,0);out.toBlob(blob=>{if(blob)download(blob,'handverse-air-canvas.png');else setMessage('PNG export failed.');},'image/png');}catch(e){setMessage((e as Error).message);}};
 return <section ref={root} className={'creative-studio '+(immersive?'air-immersive':'')}>
  <header className="air-heading"><div><p className="eyebrow">CREATIVE STUDIO / 01</p><h1>Air Canvas</h1><p>A little movement. An open canvas.</p></div><div className="air-actions"><button className="secondary" onClick={()=>setHelp(true)}><HelpCircle size={16}/> Gestures</button><button className="secondary" onClick={()=>void toggleFullscreen()}>{immersive?<Minimize2 size={16}/>:<Maximize2 size={16}/>} {immersive?'Exit':'Fullscreen'}</button><button className="primary" disabled={data.status==='loading'} onClick={()=>data.cameraActive?vision.stop():void vision.start()}><Camera size={16}/>{data.cameraActive?'Stop camera':data.status==='loading'?'Connecting…':'Start camera'}</button></div></header>
  <div ref={stage} className="air-stage" data-air-region>
   <canvas width={WIDTH} height={HEIGHT} ref={camera} className="air-camera" aria-hidden="true"/>
   <canvas width={WIDTH} height={HEIGHT} ref={ink} className="air-ink" aria-label="Air drawing canvas" onPointerDown={e=>{if(blocked.current)return;pointer.current=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* Synthetic input has no active pointer capture. */}engine.lost();engine.begin(world(point(e),engine.view),performance.now());}} onPointerMove={e=>{if(pointer.current===e.pointerId)engine.add(world(point(e),engine.view),performance.now());}} onPointerUp={()=>{pointer.current=null;engine.end();sync();}} onPointerCancel={()=>{pointer.current=null;engine.end();}}/>
   <canvas width={WIDTH} height={HEIGHT} ref={hud} className="air-hud" aria-hidden="true"/>
   <div className="air-stage-label"><span><i className={data.cameraActive?'on':''}/>{data.cameraActive?'LIVE CANVAS':'YOUR NEXT IDEA STARTS HERE'}</span><span>1280 × 960 · Local only</span></div>
   {!data.cameraActive&&!engine.strokes.length&&<div className="air-empty"><Palette size={34}/><h2>Make room for your imagination.</h2><p>Start your camera, point, then pinch to paint.<br/>You can also draw with your mouse or touch.</p></div>}
   <div className="air-toolbar" data-air-tools>
    <label>Brush<select value={config.brush} disabled={busy} onChange={e=>change({brush:e.target.value as BrushSettings['brush'],eraser:false})}>{brushes.map(b=><option key={b}>{b}</option>)}</select></label>
    <div className="air-colors" aria-label="Pastel colors">{colors.map(([name,color])=><button key={name} title={name} aria-label={name} aria-pressed={config.color===color} style={{background:color}} onClick={()=>change({color,eraser:false})}/>)}</div>
    <label>Size <output>{config.width}</output><input aria-label="Brush thickness" type="range" min="1" max="80" value={config.width} onChange={e=>change({width:+e.target.value})}/></label>
    <label>Opacity <output>{Math.round(config.opacity*100)}%</output><input aria-label="Brush opacity" type="range" min=".05" max="1" step=".05" value={config.opacity} onChange={e=>change({opacity:+e.target.value})}/></label>
    <button aria-label="Eraser" aria-pressed={config.eraser} onClick={()=>change({eraser:!config.eraser})}><Eraser size={18}/></button><button aria-label="Undo" disabled={busy} onClick={()=>{engine.undo();sync();}}><Undo2 size={18}/></button><button aria-label="Redo" disabled={busy} onClick={()=>{engine.redo();sync();}}><Redo2 size={18}/></button><button aria-label="Clear canvas" disabled={busy} onClick={()=>setClear(true)}><Trash2 size={18}/></button>
   </div>
   <div className="air-status" data-air-tools><span ref={status}>Point to move · pinch to draw</span><button onClick={()=>{engine.lost();engine.view={x:0,y:0,zoom:1};engine.revision++;}}>Reset view</button></div>
   {radial&&<div className="air-radial" data-air-tools role="dialog" aria-label="Radial brush menu">{brushes.map(b=><button key={b} onClick={()=>{change({brush:b,eraser:false});setRadial(false);}}>{b}</button>)}<button onClick={()=>setRadial(false)}>Close menu</button></div>}
  </div>
  <div className="air-footer"><div className="air-actions"><label><input type="checkbox" checked={config.light} onChange={e=>change({light:e.target.checked})}/> Light painting</label>{config.light&&<label><input type="checkbox" checked={config.persistent} onChange={e=>change({persistent:e.target.checked})}/> Persistent trails</label>}</div><div className="air-actions"><button className="secondary" disabled={busy} onClick={()=>{engine.end();download(new Blob([serialize(engine)],{type:'application/json'}),'handverse.air.json');}}><Save size={15}/> Save project</button><button className="secondary" disabled={busy} onClick={()=>file.current?.click()}><FolderOpen size={15}/> Load</button><details className="air-export"><summary><Download size={15}/> Export</summary><div><button onClick={()=>png(false)}>Transparent PNG</button><button disabled={!data.cameraActive} onClick={()=>png(true)}>PNG with camera</button><button disabled={busy} onClick={()=>replay()}><Play size={14}/> Replay timelapse</button><button disabled={busy} onClick={()=>replay(true)}><Video size={14}/> Export timelapse</button></div></details>{busy&&<button className="secondary" onClick={finishPlayback}>Stop replay</button>}</div></div>
  <input hidden ref={file} type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>20_000_000)throw new Error('Project is too large');restore(await f.text(),engine);sync();setMessage('Project restored.');}catch(err){setMessage((err as Error).message);}e.target.value='';}}/>
  {data.status==='error'&&<p role="alert">{data.message}</p>}{message&&<div className="air-message" role="status">{message}<button onClick={()=>setMessage('')}>Dismiss</button></div>}
  {(help||clear)&&<div className="air-modal"><section className="dialog" role="dialog" aria-modal="true" aria-label={clear?'Clear canvas':'Gesture guide'}>{clear?<><h2>Clear your canvas?</h2><p>Save your project first if you want to keep it.</p><button className="primary" onClick={()=>{engine.clear();setClear(false);sync();}}>Clear canvas</button><button className="secondary" onClick={()=>setClear(false)}>Keep drawing</button></>:<><h2>A canvas in your hands.</h2><p>Point with your index finger to move. Pinch thumb and index to draw; release to stop.</p><p>Hold an open palm for the brush menu. Hold a peace sign for eraser. Pinch with both hands to zoom. Hold three fingers (index, middle, ring) to pan.</p><p>Hold gestures for 0.6 seconds. After tracking loss, release your pinch before drawing again. Drawing gestures stay inside the canvas.</p><button className="primary" onClick={()=>setHelp(false)}>Got it</button></>}</section></div>}
 </section>;
}
