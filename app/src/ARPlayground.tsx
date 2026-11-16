import {useEffect,useRef,useState} from 'react';
import {Camera,ScanLine,Maximize2,Minimize2,RotateCcw,Hand,Activity,Box,Code2,Power,ArrowRight} from 'lucide-react';
import {useHandTracking,useTrackingSnapshot} from './HandTrackingProvider';
import {load,save} from './services/storage';
import {ARInteraction,arDefaults,sanitizeSettings,type ARSettings,type ARMode} from './ar/interaction';
import {ARRenderer} from './ar/renderer';
import {HandHUD} from './ar/hud';
import {GestureStudio} from './ar/GestureStudio';
import {snippets} from './ar/snippets';
import './ar/playground.css';
const modes:{id:ARMode;label:string;icon:typeof Code2;description:string}[]=[{id:'reactive',label:'Gesture Reactive',icon:Hand,description:'L shape → frame · pinch → orb · palm → dashboard · fist → collapse · point → laser · peace → code.'},{id:'code',label:'Floating Code',icon:Code2,description:'Open your palm to reveal code. Pinch a window to move it.'},{id:'lab',label:'Hologram Lab',icon:Box,description:'Open your palm to reveal 3D shapes. Pinch a shape to carry it; swipe to change it.'},{id:'visualizer',label:'Gesture Visualizer',icon:Activity,description:'Explore all 21 landmarks, palm anchors, and live gesture recognition.'}];
export function ARPlayground(){
 const vision=useHandTracking(),data=useTrackingSnapshot();
 const [tab,setTab]=useState<'playground'|'studio'>('playground');
 const [config,setConfig]=useState(()=>sanitizeSettings(load<Partial<ARSettings>>('ar',arDefaults))),[immersive,setImmersive]=useState(false),[rendererError,setRendererError]=useState(''),[fps,setFps]=useState(0),[restart,setRestart]=useState(0);
 const live=useRef(config);live.current=config;
 const stage=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),hudCanvas=useRef<HTMLCanvasElement>(null),engine=useRef(new ARInteraction()),panels=useRef(new Map<string,HTMLDivElement>());
 const change=<K extends keyof ARSettings>(key:K,value:ARSettings[K])=>setConfig(old=>{const next={...old,[key]:value};save('ar',next);return next;});
 const reset=()=>engine.current.reset();
 useEffect(()=>{reset();},[config.mode,config.mirror,immersive]);
 useEffect(()=>{
  vision.interactionScope=tab==='studio'?'ui':'ar';
  return()=>{vision.interactionScope='global';};
 },[vision,tab]);
 useEffect(()=>{
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setImmersive(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[]);
 useEffect(()=>{
  let renderer:ARRenderer;
  try{renderer=new ARRenderer(canvas.current!);setRendererError('');}catch(e){setRendererError((e as Error).message);return;}
  const hud=new HandHUD(hudCanvas.current!);
  let raf=0,last=performance.now(),epoch=last,frames=0,qualityLow=false,lastQualityChange=0,renderCost=0,lastDraw=0,width=1,height=1;
  const resize=()=>{const bounds=stage.current!.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);engine.current.reset();};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new ResizeObserver(resize);observer.observe(stage.current!);resize();
  const unsubscribe=vision.subscribeHands(hands=>{if(document.hidden)return;engine.current.settings=live.current;engine.current.update(hands,performance.now(),width,height,vision.video.videoWidth||640,vision.video.videoHeight||480,live.current.mirror);});
  const lost=(event:Event)=>{event.preventDefault();setRendererError('The graphics context was interrupted. Reload the renderer to continue.');cancelAnimationFrame(raf);};
  canvas.current!.addEventListener('webglcontextlost',lost);
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);if(document.hidden){last=now;return;}
   const config=live.current,low=config.quality==='low'||(config.quality==='auto'&&qualityLow);
   if(low&&now-lastDraw<32)return;
   const dt=Math.min(100,now-last);last=now;lastDraw=now;engine.current.animate(now,dt,width,height);
   const beforeRender=performance.now();
   renderer.render(vision.video,engine.current.hands.values(),{...config,skeleton:false},width,height,now,low,engine.current.dual,engine.current.collapse,engine.current.collapseAnchor);
   hud.render(engine.current,config,width,height,now,low,dt);
   renderCost=renderCost*.9+(performance.now()-beforeRender)*.1;
   for(const [key,node] of panels.current){const split=key.lastIndexOf(':'),h=engine.current.hands.get(key.slice(0,split)),index=Number(key.slice(split+1)),p=h?.panels[index];if(!h||!p){node.style.opacity='0';continue;}
    const bob=reducedMotion.matches?0:Math.sin(now/950+index)*3*config.intensity;
    node.style.opacity=String(config.mode==='reactive'?h.codeOpacity:h.opacity);node.style.transform=`translate3d(${p.x*(1-engine.current.collapse)+engine.current.collapseAnchor.x*engine.current.collapse}px, ${(p.y*(1-engine.current.collapse)+engine.current.collapseAnchor.y*engine.current.collapse)+bob}px, 0) translate(-50%, -50%) perspective(700px) rotateY(${h.angle*12}deg) rotateX(${-h.angle*6}deg) scale(${p.scale})`;node.classList.toggle('is-grabbed',h.grab===index);
   }
   frames++;if(now-epoch>1000){const rate=Math.round(frames*1000/(now-epoch));setFps(rate);if(config.quality==='auto'&&now-lastQualityChange>5000){if(!qualityLow&&rate<43){qualityLow=true;lastQualityChange=now;}else if(qualityLow&&rate>=29&&renderCost<5&&vision.data.latency<25){qualityLow=false;lastQualityChange=now;}}frames=0;epoch=now;}
  };
  raf=requestAnimationFrame(tick);
  return()=>{unsubscribe();observer.disconnect();cancelAnimationFrame(raf);canvas.current?.removeEventListener('webglcontextlost',lost);renderer.dispose();engine.current.reset();};
 },[vision,restart]);
 const hands=[...engine.current.hands.values()].filter(h=>performance.now()-h.seen<500),mode=modes.find(m=>m.id===config.mode)!;
 const trackReady=data.status==='active',visibleHands=hands.filter(h=>h.opacity>.05);
 return <section className={'ar-playground '+(immersive?'ar-immersive':'')} data-ui>
  <header className="ar-heading"><div><h1>AR Playground</h1><p>A little code. A little light. All in your hands.</p></div><div className="ar-heading-actions"><button className="secondary" onClick={()=>setImmersive(v=>!v)}>{immersive?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {immersive?'Exit immersive':'Go immersive'}</button><button className={data.cameraActive?'secondary':'primary'} disabled={data.status==='loading'} onClick={()=>data.cameraActive?vision.stop():void vision.start()}>{data.cameraActive?<Power size={15}/>:<Camera size={15}/>} {data.status==='loading'?'Connecting…':data.cameraActive?'Stop camera':'Start camera'}</button></div></header>
  <nav className="ar-tabs" aria-label="AR Playground pages"><button aria-pressed={tab==='playground'} onClick={()=>setTab('playground')}>Playground</button><button aria-pressed={tab==='studio'} onClick={()=>setTab('studio')}>Gesture Studio</button></nav>
  <div className="ar-workspace">
   <div className="ar-stage" data-ar-region ref={stage} aria-label="Live augmented reality camera workspace">
    <canvas ref={canvas} className="ar-canvas" aria-hidden="true"/><canvas ref={hudCanvas} className="ar-canvas ar-hud" aria-hidden="true"/>
    {config.scanlines&&<div className="ar-scanlines" aria-hidden="true"/>}
    <div className="ar-stage-heading"><span><i className={trackReady?'connected':''}/>{trackReady?'Live workspace':data.cameraActive?'Camera connected':'Workspace offline'}</span><span>{config.mirror?'Mirrored':'Unmirrored'} · Local only</span></div>
    <div className="ar-objects" aria-hidden="true" style={{'--panel-opacity':config.opacity,'--ar-glow':config.intensity} as React.CSSProperties}>
     {(config.mode==='code'||config.mode==='reactive')&&hands.flatMap(h=>(config.mode==='reactive'?h.panels.slice(0,2):h.panels).map((p,i)=>{const snippet=snippets[p.snippet];return <div className={'ar-code-panel '+(h.id==='Left'?'ar-purple':'')} key={h.id+':'+i} ref={node=>{const key=h.id+':'+i;if(node)panels.current.set(key,node);else panels.current.delete(key);}}><div className="ar-code-title"><span><i/><i/><i/></span><strong>{snippet.file}</strong><Code2 size={13}/></div><pre>{snippet.lines.map((tokens,line)=><div key={line}><span className="ar-line-number">{line+1}</span><code>{Array.from({length:Math.floor(tokens.length/2)},(_,n)=><span key={n} className={'ar-token-'+tokens[n*2]}>{tokens[n*2+1]}</span>)}{line===snippet.lines.length-1&&<span className="ar-cursor">▌</span>}</code></div>)}</pre><div className="ar-code-footer"><span>{snippet.language}</span><span>{h.grab===i?'Grabbed · release to drop':p.dropped?'Anchored in workspace':'Palm linked'} · {h.id}</span></div></div>;}))}
    </div>

    {config.mode==='lab'&&visibleHands.length>0&&<div className="ar-lab-key">Pinch a shape to grab · Move your palm closer to scale · Swipe to change shape</div>}
    {!rendererError&&!data.cameraActive&&<div className="ar-entry"><div className="ar-entry-symbol"><ScanLine size={58} strokeWidth={1}/><span/></div><h2>Your hands.<br/>Your interface.</h2><p>Bring floating code and holograms into your space.<br/>Start your camera, then show an open palm.</p><button className="primary" disabled={data.status==='loading'} onClick={()=>void vision.start()}><Camera size={16}/>{data.status==='loading'?'Preparing your workspace…':'Enter the playground'}<ArrowRight size={16}/></button><small>On-device tracking · No recording or uploads</small></div>}
    {!rendererError&&data.cameraActive&&!visibleHands.length&&!hands.some(h=>h.effect)&&config.mode!=='visualizer'&&<div className="ar-palm-prompt"><Hand size={30}/><strong>{engine.current.hidden?'Panels hidden':'Show an open palm'}</strong><span>{engine.current.hidden?'Open your palm to reveal your workspace.':trackReady?'Keep your entire hand in view, with fingers spread.':'Preparing local hand tracking…'}</span></div>}
    {rendererError&&<div className="ar-entry" role="alert"><ScanLine size={38}/><h2>Renderer paused</h2><p>{rendererError}</p><button className="secondary" onClick={()=>setRestart(v=>v+1)}>Reload renderer</button></div>}
    <div className="ar-stage-footer"><span><ScanLine size={14}/>{hands.length} / 2 hands</span><span>{fps?fps+' render fps':'— render fps'}</span><span>2.5D palm anchoring</span></div>
   </div>
   <aside className="ar-controls" aria-label="AR controls"><section><h2>Choose your reality</h2><div className="ar-mode-options">{modes.map(({id,label,icon:Icon})=><button key={id} aria-pressed={config.mode===id} className={config.mode===id?'selected':''} onClick={()=>change('mode',id)}><Icon size={17}/><span>{label}</span><i/></button>)}</div><p>{mode.description}</p></section>
    <section><h2>Make it yours</h2><label className="ar-range">Effect intensity <output>{Math.round(config.intensity*100)}%</output><input type="range" min="0" max="1" step=".05" value={config.intensity} onChange={e=>change('intensity',Number(e.target.value))}/></label><label className="ar-range">Panel opacity <output>{Math.round(config.opacity*100)}%</output><input type="range" min=".15" max="1" step=".05" value={config.opacity} onChange={e=>change('opacity',Number(e.target.value))}/></label>
     {([{key:'skeleton',label:'Hand skeleton'},{key:'numbers',label:'Landmark numbers'},{key:'coordinates',label:'Fingertip coordinates'},{key:'brackets',label:'Tracking brackets'},{key:'mirror',label:'Mirror camera'},{key:'diagnostics',label:'Tracking diagnostics'},{key:'scanlines',label:'Scanlines'}] as const).map(({key,label})=><label key={key} className="ar-check"><span>{label}</span><input type="checkbox" checked={config[key]} onChange={e=>change(key,e.target.checked)}/></label>)}
     <label className="ar-quality">Performance<select value={config.quality} onChange={e=>change('quality',e.target.value as ARSettings['quality'])}><option value="auto">Adaptive</option><option value="high">High · up to 60 fps</option><option value="low">Eco · 30 fps</option></select></label><button className="secondary ar-reset" onClick={reset}><RotateCcw size={14}/> Reset positions</button>
    </section><div className="ar-control-note"><Hand size={17}/><p>Hands control the scene here.<br/>Use your mouse or keyboard for menus.</p></div>
   </aside>
  </div>
  {tab==='studio'&&<GestureStudio settings={config} change={change} reset={()=>{const next=sanitizeSettings({});setConfig(next);save('ar',next);}}/>}
  {data.status==='error'&&<div className="ar-error" role="alert">{data.message}<button className="text-button" onClick={()=>void vision.start()}>Retry camera & tracking</button></div>}
  <div className="ar-gesture-guide">{[{gesture:'L shape',action:'Holographic frame'},{gesture:'Peace',action:'Dual code panels'},{gesture:'Open palm',action:'Radial dashboard'},{gesture:'Pinch + move',action:'Grab & carry'},{gesture:'Release',action:'Drop in place'},{gesture:'Swipe',action:'Switch snippets / shapes'},{gesture:'Closed fist',action:'Hide holograms'}].map(item=><div key={item.gesture}><strong>{item.gesture}</strong><span>{item.action}</span></div>)}</div>
  {(config.diagnostics||config.mode==='visualizer'||tab==='studio')&&<section className="ar-diagnostics"><h2><Activity size={16}/> Live tracking</h2><div className="ar-metrics"><span>Inference<strong>{trackReady?data.fps.toFixed(0)+' fps':'—'}</strong></span><span>Latency<strong>{trackReady?data.latency.toFixed(1)+' ms':'—'}</strong></span><span>Delegate<strong>{data.delegate}</strong></span><span>Camera<strong>{vision.video.videoWidth?vision.video.videoWidth+' × '+vision.video.videoHeight:'—'}</strong></span></div>{hands.length?hands.map(h=><div className="ar-hand-diagnostic" key={h.id}><strong>{h.id} hand</strong><span>{h.pose.gesture} · {h.pose.phase}</span><span>Pose {Math.round(h.pose.confidence*100)}%</span><span>{h.pose.motion}</span><span>{Math.round(h.confidence*100)}% handedness</span><span>Anchor {Math.round(h.anchor.x)}, {Math.round(h.anchor.y)}</span><span>{h.grab!==null?'Holding object '+(h.grab+1):'Not holding'}</span></div>):<p>{data.message}</p>}<p>Palm positions and scale come from webcam landmarks. Depth is a visual estimate; this camera does not provide metric spatial tracking.</p></section>}
 </section>;
}
