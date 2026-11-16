import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Pause,Play,RotateCcw,Volume2,VolumeX} from 'lucide-react';
import {useHandTracking} from '../../HandTrackingProvider';
import {settings,record} from '../../services/storage';
import {sound} from '../../services/audio';
import {observeGame} from '../../selftest';
import {Engine} from '../engine';
import {PongSimulation,WIDTH as W,HEIGHT as H,type Difficulty} from './simulation';
import './pong.css';
export function PongView({practice,onBack}:{practice:boolean;onBack:()=>void}){
 const vision=useHandTracking(),canvas=useRef<HTMLCanvasElement>(null),sim=useRef(new PongSimulation()),probe=useRef(new Engine('pong'));
 const [difficulty,setDifficulty]=useState<Difficulty>('normal'),[phase,setPhase]=useState<'menu'|'playing'|'paused'|'over'>('menu'),[muted,setMuted]=useState(!settings.sound);
 const [hud,setHud]=useState({player:0,ai:0,countdown:3,tracked:false});
 const phaseRef=useRef(phase);phaseRef.current=phase;
 const start=()=>{sim.current=new PongSimulation(difficulty);setHud({player:0,ai:0,countdown:3,tracked:false});setPhase('playing');};
 useEffect(()=>observeGame(()=>probe.current),[]);
 useEffect(()=>{
  // A subscription receives each inference exactly once; no camera/model lifecycle here.
  let selected='';
  return vision.subscribeHands(hands=>{const hand=hands.find(h=>h.id===selected)??hands[0];if(hand){selected=hand.id;sim.current.input.sample(hand.palm.y,performance.now());}});
 },[vision]);
 useEffect(()=>{
  const down=new Set<string>();
  const keyDown=(e:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','KeyW','KeyS','Escape','Space','KeyR'].includes(e.code)&&!(e.target instanceof HTMLElement&&(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||(e.code==='Space'&&e.target.tagName==='BUTTON')))){e.preventDefault();down.add(e.code);if(e.repeat)return;if(e.code==='Escape'||e.code==='Space')setPhase(p=>p==='playing'?'paused':p==='paused'?'playing':p);if(e.code==='KeyR'&&phaseRef.current!=='menu')start();}};
  const keyUp=(e:KeyboardEvent)=>down.delete(e.code);
  const blur=()=>{down.clear();setPhase(p=>p==='playing'?'paused':p);};
  const visible=()=>{if(document.hidden)blur();};
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visible);
  const c=canvas.current!.getContext('2d')!;
  // Bounded visual pools; physics and input never depend on these effects.
  const trail=Array.from({length:18},()=>({x:W/2,y:H/2}));let trailIndex=0;
  const sparks=Array.from({length:48},()=>({x:0,y:0,vx:0,vy:0,life:0}));let sparkIndex=0;
  let raf=0,last=performance.now(),refresh=0,recorded=false;
  const draw=(now:number)=>{
   const g=sim.current,dt=Math.max(0,(now-last)/1000);last=now;
   if(phase==='playing'){
    const keyboard=Number(down.has('ArrowDown')||down.has('KeyS'))-Number(down.has('ArrowUp')||down.has('KeyW'));
    g.advance(dt,now,keyboard);
    for(const event of g.events){sound(event,settings.sound);if(event==='hit'&&settings.particles)for(let i=0;i<8;i++){const p=sparks[sparkIndex++%sparks.length],a=i*Math.PI/4;Object.assign(p,{x:g.ball.x,y:g.ball.y,vx:Math.cos(a)*90,vy:Math.sin(a)*90,life:.3});}}
    g.events.length=0;
    if(g.over&&!recorded){setHud({player:g.playerScore,ai:g.aiScore,countdown:0,tracked:now-g.input.last<350});recorded=true;record('pong',g.playerScore*100);setPhase('over');}
   }
   const alpha=g.alpha,bx=g.previous.x+(g.ball.x-g.previous.x)*alpha,by=g.previous.y+(g.ball.y-g.previous.y)*alpha;
   Object.assign(probe.current,{paddle:g.paddle,opponent:g.opponent,ball:g.ball,playerScore:g.playerScore,aiScore:g.aiScore,hits:g.hits,score:g.playerScore*100,started:phase!=='menu',paused:phase==='paused',over:g.over});
   c.fillStyle='#0b101a';c.fillRect(0,0,W,H);
   c.strokeStyle='#ffffff14';c.lineWidth=2;c.setLineDash([6,14]);c.beginPath();c.moveTo(W/2,25);c.lineTo(W/2,H-25);c.stroke();c.setLineDash([]);
   if(phase==='playing'&&g.countdown===0&&g.serve===0){trail[trailIndex].x=bx;trail[trailIndex].y=by;trailIndex=(trailIndex+1)%trail.length;}
   if(g.serve===0&&g.countdown===0)for(let i=0;i<trail.length;i++){const p=trail[(trailIndex+i)%trail.length];c.globalAlpha=i/trail.length*.22;c.fillStyle='#A8ECF7';c.beginPath();c.arc(p.x,p.y,3+i/trail.length*5,0,7);c.fill();}c.globalAlpha=1;
   c.fillStyle='#A8ECF7';c.fillRect(34,g.previousPaddle+(g.paddle-g.previousPaddle)*alpha-52,16,104);c.fillStyle='#D6C5FF';c.fillRect(W-50,g.previousOpponent+(g.opponent-g.previousOpponent)*alpha-52,16,104);
   c.shadowColor='#A8ECF7';c.shadowBlur=8;c.fillStyle='#fff';c.beginPath();c.arc(bx,by,11,0,7);c.fill();c.shadowBlur=0;
   if(settings.particles)for(const p of sparks){if(p.life<=0)continue;if(phase==='playing'){p.life-=Math.min(dt,.05);p.x+=p.vx*dt;p.y+=p.vy*dt;}c.globalAlpha=Math.max(0,p.life/.3);c.fillStyle='#D6C5FF';c.fillRect(p.x,p.y,3,3);}c.globalAlpha=1;
   if(g.feedback>0){c.fillStyle=`rgba(168,236,247,${g.feedback*.12})`;c.fillRect(0,0,W,H);}
   c.font='500 16px Arial';c.textAlign='left';c.fillStyle='#A8ECF7';c.fillText('You',34,H-22);c.textAlign='right';c.fillStyle='#D6C5FF';c.fillText(`${difficulty[0].toUpperCase()+difficulty.slice(1)} AI`,W-34,H-22);
   if(now-refresh>100){setHud({player:g.playerScore,ai:g.aiScore,countdown:Math.ceil(g.countdown),tracked:now-g.input.last<350});refresh=now;}
   if(phase==='playing')raf=requestAnimationFrame(draw);
  };
  draw(performance.now());
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visible);};
 },[phase,difficulty]);
 return <div className="game-page pong-page"><div className="page-heading"><div className="heading-inline"><button className="icon-button" aria-label="Back to arcade" onClick={onBack}><ArrowLeft size={20}/></button><h1>Hand Pong</h1></div><div className="game-actions"><button className="icon-button" aria-label={muted?'Enable sound':'Mute sound'} onClick={()=>{settings.sound=muted;setMuted(!muted);}}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><button className="secondary" disabled={phase==='menu'||phase==='over'} onClick={()=>setPhase(phase==='paused'?'playing':'paused')}>{phase==='paused'?<Play size={16}/>:<Pause size={16}/>} {phase==='paused'?'Resume':'Pause'}</button><button className="secondary" disabled={phase==='menu'} onClick={start}><RotateCcw size={16}/> Restart</button></div></div>
 <div className="game-hud pong-score" aria-live="polite"><div><span>You</span><strong>{hud.player}</strong></div><div><span>First to 7</span><strong>Solo vs AI</strong></div><div><span>{difficulty} AI</span><strong>{hud.ai}</strong></div></div>
 <div className="game-stage"><canvas ref={canvas} width={W} height={H} aria-label="Hand Pong game area" onPointerMove={e=>{if(practice){const rect=e.currentTarget.getBoundingClientRect();sim.current.input.sample((e.clientY-rect.top)/rect.height,performance.now());}}}/>
 {phase==='menu'&&<div className="stage-cover start-overlay"><div className="dialog pong-menu"><h2>Choose your match</h2><p>Solo vs AI · First to 7 points</p><fieldset><legend>AI difficulty</legend><div className="pong-difficulties">{(['easy','normal','hard'] as const).map(d=><button key={d} aria-pressed={difficulty===d} className={difficulty===d?'primary':'secondary'} onClick={()=>setDifficulty(d)}>{d[0].toUpperCase()+d.slice(1)}</button>)}</div></fieldset><p className="pong-difficulty-hint">{difficulty==='easy'?'Relaxed reactions with room for a winning shot.':difficulty==='normal'?'A balanced rally with an opponent that anticipates.':'Fast, precise returns. Use the corners to win.'}</p><button className="primary pong-start" onClick={start}><Play size={16}/> Start round</button><div className="pong-upcoming"><button disabled>Local Multiplayer — Coming Soon</button><button disabled>Online Multiplayer — Coming Soon</button></div></div></div>}
 {phase==='playing'&&hud.countdown>0&&<div className="stage-center pong-countdown" aria-live="polite"><strong>{hud.countdown}</strong><span>Get ready</span></div>}
 {phase==='paused'&&<div className="stage-cover"><div className="dialog"><h2>Match paused</h2><p>Your next return can wait.</p><button className="primary" onClick={()=>setPhase('playing')}><Play size={16}/> Resume</button><button className="secondary" onClick={start}>Restart match</button><button className="text-button" onClick={()=>setPhase('menu')}>Change difficulty</button></div></div>}
 {phase==='over'&&<div className="stage-cover"><div className="dialog"><h2>{sim.current.playerScore>=7?'You take the match!':'AI takes the match'}</h2><p>{sim.current.playerScore} – {sim.current.aiScore} · {difficulty} AI</p><button className="primary" onClick={start}>Play again</button><button className="secondary" onClick={()=>setPhase('menu')}>Choose difficulty</button><button className="text-button" onClick={onBack}>Back to arcade</button></div></div>}
 </div><div className="game-instructions"><span>Move your palm up and down · ↑ / ↓ or W / S · Space to pause · R to restart</span><span>{practice?'Pointer practice':hud.tracked?'Hand tracked':'Holding paddle · Show your hand or use keyboard'}</span></div></div>;
}
