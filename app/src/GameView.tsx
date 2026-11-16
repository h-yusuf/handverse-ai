import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Pause,Play,RotateCcw,Trophy,Heart,Timer,Target,MousePointer2,Hand,Volume2,VolumeX} from 'lucide-react';
import {Engine,W,H,games,type GameId,type Player} from './games/engine';
import {render} from './games/render';
import {useHandTracking} from './HandTrackingProvider';
import {settings,record,records} from './services/storage';
import {sound} from './services/audio';
import {observeGame} from './selftest';
import {PongView} from './games/pong/PongView';
export function GameView(props:{id:GameId;practice:boolean;onBack:()=>void}){
 if(props.id==='pong')return <PongView practice={props.practice} onBack={props.onBack}/>;
 return <ClassicGameView {...props}/>;
}
function ClassicGameView({id,practice,onBack}:{id:GameId;practice:boolean;onBack:()=>void}){
 const vision=useHandTracking();
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef(new Engine(id)),pointer=useRef({x:W/2,y:H/2,active:false,inside:false}),trail=useRef<{x:number;y:number;life:number}[]>([]);
 const [hud,setHud]=useState({score:0,time:60,lives:3,combo:0,over:false,started:false,paused:false,gesture:'—'}),[muted,setMuted]=useState(!settings.sound),[missing,setMissing]=useState(false);
 const game=games.find(g=>g.id===id)!;const best=Math.max(0,...records().filter(r=>r.game===id).map(r=>r.score));
 const restart=()=>{const g=new Engine(id);g.twoPlayer=settings.twoPlayer;g.started=true;engine.current=g;trail.current=[];setHud({score:0,time:60,lives:3,combo:0,over:false,started:true,paused:false,gesture:'—'});};
 const pause=()=>{const g=engine.current;if(g.started&&!g.over){g.paused=!g.paused;setHud(v=>({...v,paused:g.paused}));}};
 useEffect(()=>observeGame(()=>engine.current),[]);
 useEffect(()=>{const g=engine.current;g.twoPlayer=settings.twoPlayer;let raf=0,last=performance.now(),refresh=0,ended=false,missingAt=0;const onKey=(e:KeyboardEvent)=>{if(e.code==='Escape'){e.preventDefault();pause();}};window.addEventListener('keydown',onKey);
 const loop=(now:number)=>{const g=engine.current,rect=canvas.current!.getBoundingClientRect(),dt=Math.min(.05,(now-last)/1000);last=now;
 let players:Player[]=vision.data.hands.map(h=>({id:h.id,x:(h.cursor.x*innerWidth-rect.left)/rect.width*W,y:(h.cursor.y*innerHeight-rect.top)/rect.height*H,palmX:(h.palm.x*innerWidth-rect.left)/rect.width*W,palmY:(h.palm.y*innerHeight-rect.top)/rect.height*H,active:h.pinching,gesture:h.gesture,speed:h.speed}));
 if(practice&&pointer.current.inside){const p=pointer.current;players=[{id:'pointer',x:p.x,y:p.y,palmX:p.x,palmY:p.y,active:p.active,gesture:p.active?'Pinch':'Pointing',speed:1}];}
 if(!practice&&g.started&&!g.over&&!g.paused&&!players.length){missingAt||=now;if(now-missingAt>1500){g.paused=true;setMissing(true);}}else missingAt=0;
 if(practice&&id==='gesture'&&players[0])players[0].gesture=practiceGesture.current;
 g.update(dt,players);g.events.splice(0).forEach(e=>sound(e,settings.sound));
 if(g.over&&!ended){record(id,g.score);ended=true;}if(!g.over)ended=false;
 const c=canvas.current!.getContext('2d')!;render(c,g,settings.particles);
 if(id==='fruit'){if(players[0]&&!g.paused)trail.current.push({x:players[0].x,y:players[0].y,life:.25});trail.current=trail.current.filter(p=>(p.life-=dt)>0);c.lineWidth=4;c.lineCap='round';for(let i=1;i<trail.current.length;i++){c.strokeStyle=`rgba(130,239,255,${trail.current[i].life*3})`;c.beginPath();c.moveTo(trail.current[i-1].x,trail.current[i-1].y);c.lineTo(trail.current[i].x,trail.current[i].y);c.stroke();}}
 if(now-refresh>90){setHud({score:g.score,time:g.time,lives:g.lives,combo:g.combo,over:g.over,started:g.started,paused:g.paused,gesture:players[0]?.gesture??'—'});refresh=now;}
 raf=requestAnimationFrame(loop);
 };raf=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',onKey);};},[id,practice]);
 const practiceGesture=useRef<Player['gesture']>('Pointing');
 const instructions=id==='fruit'?'Swipe quickly through fruit. Avoid bombs. Three misses end the round.':id==='bubble'?'Touch bubbles with your index fingertip. Chain pops for up to 5× points.':id==='stars'?'Move your palm to guide the catcher. Catch gold stars; avoid red hazards.':id==='pong'?`Move your palm up and down. First to 7 wins.${settings.twoPlayer?' Second hand controls the right paddle.':''}`:'Match the shown pose and hold it for 0.45 seconds. Keep your streak alive.';
 return <div className="game-page"><div className="page-heading"><div className="heading-inline"><button className="icon-button" onClick={onBack} aria-label="Back to arcade"><ArrowLeft size={20}/></button><div><p className="eyebrow">{game.tag}</p><h1>{game.title} <span>{game.sub}</span></h1></div></div><div className="game-actions"><span className={'input-mode '+(practice?'practice':'')} >{practice?<MousePointer2 size={14}/>:<Hand size={14}/>} {practice?'Pointer practice':'Hand control'}</span><button className="icon-button" aria-label={muted?'Enable sound':'Mute sound'} onClick={()=>{settings.sound=muted;setMuted(!muted)}}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><button className="secondary" onClick={pause} disabled={!hud.started||hud.over}><Pause size={16}/> Pause</button></div></div>
 <div className="game-hud"><div><Target size={17}/><span>Score</span><strong>{hud.score.toLocaleString().padStart(4,'0')}</strong></div><div><Trophy size={17}/><span>Best</span><strong>{best.toLocaleString()}</strong></div><div>{id==='bubble'||id==='gesture'?<><Timer size={17}/><span>Time</span><strong>{Math.ceil(hud.time)}<small>s</small></strong></>:id==='pong'?<><Target size={17}/><span>Match</span><strong>First to 7</strong></>:<><Heart size={17}/><span>Lives</span><strong>{'♥ '.repeat(Math.max(0,hud.lives))}</strong></>}</div><div><span>Multiplier</span><strong className="cyan">×{Math.min(5,1+Math.floor(hud.combo/5))}</strong></div></div>
 <div className="game-stage"><canvas ref={canvas} width={W} height={H} aria-label={`${game.title} game area`} onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();pointer.current={...pointer.current,x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H,inside:true};}} onPointerLeave={()=>pointer.current.inside=false} onPointerDown={()=>pointer.current.active=true} onPointerUp={()=>pointer.current.active=false}/>
 {!hud.started&&<div className="stage-center start-overlay"><button className="primary" onClick={restart}><Play size={17} fill="currentColor"/> Start round</button><span>{practice?'Move your pointer to play':'Show your hand, then pinch to start'}</span></div>}
 {hud.paused&&!hud.over&&<div className="stage-cover"><div className="dialog"><Pause size={27} className="cyan"/><h2>{missing?'Hands out of view':'Take a breather.'}</h2><p>{missing?'Show your hand to the camera, then pinch Resume.':'Your round is right where you left it.'}</p><button className="primary" onClick={()=>{engine.current.paused=false;setMissing(false);setHud(v=>({...v,paused:false}));}}><Play size={16}/> Resume</button><button className="secondary" onClick={restart}><RotateCcw size={16}/> Restart round</button><button className="text-button" onClick={onBack}>Back to arcade</button></div></div>}
 {hud.over&&<div className="stage-cover"><div className="dialog"><Trophy size={32} className="cyan"/><p className="eyebrow">ROUND COMPLETE</p><h2>{id==='pong'?(engine.current.playerScore>=7?'You take the match!':'A worthy opponent.'):'Nicely played.'}</h2><div className="final-score">{hud.score.toLocaleString()}<span>points</span></div><p>{engine.current.hits} successful hits · Best combo {engine.current.bestCombo}</p><button className="primary" onClick={restart}><RotateCcw size={16}/> Play again</button><button className="secondary" onClick={onBack}>Back to arcade</button></div></div>}
 </div><div className="game-instructions"><span><span className="tiny-dot"/>{instructions}</span><span>{practice?'Practice mode · Camera off':`Tracking: ${hud.gesture}`}</span></div>
 {practice&&id==='gesture'&&<div className="practice-gestures"><span>Practice poses</span>{(['Open palm','Fist','Pinch','Pointing'] as const).map(g=><button className={hud.gesture===g?'selected':''} key={g} onClick={()=>practiceGesture.current=g}>{g}</button>)}</div>}
 </div>;
}
