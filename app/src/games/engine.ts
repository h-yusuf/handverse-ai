import {type Gesture,type Point,clamp,distance} from '../services/input';
import {award,circleHit,segmentHit,paddleHit} from './physics';
export type GameId='fruit'|'bubble'|'stars'|'pong'|'gesture';
export type Player={id:string;x:number;y:number;palmX:number;palmY:number;active:boolean;gesture:Gesture;speed:number};
export type Orb={x:number;y:number;vx:number;vy:number;r:number;color:string;kind:string;alive:boolean;angle:number};
export type Particle={x:number;y:number;vx:number;vy:number;life:number;color:string};
export const W=1100,H=620;
export const palette=['#50e0ff','#a387ff','#ff8bbf','#67f5bd','#ffcb6b'];
export const games=[{id:'fruit' as const,title:'Fruit Ninja',sub:'Hand Slice',tag:'SWIPE & SLICE',description:'Make a little fruit chaos.',color:'#bca0ff',difficulty:'Fast reflexes',icon:'slice'},{id:'bubble' as const,title:'Bubble Pop',sub:'',tag:'POINT & POP',description:'Small bubbles. Big satisfaction.',color:'#56ddf4',difficulty:'Easy to start',icon:'bubbles'},{id:'stars' as const,title:'Catch the Stars',sub:'',tag:'MOVE & CATCH',description:'A handful of stardust.',color:'#f4cc78',difficulty:'Find your flow',icon:'stars'},{id:'pong' as const,title:'Hand Pong',sub:'',tag:'MOVE & RALLY',description:'A classic, with a new touch.',color:'#a9a1ff',difficulty:'Solo vs AI',icon:'pong'},{id:'gesture' as const,title:'Gesture Challenge',sub:'',tag:'POSE & REACT',description:'Think fast. Let your hands talk.',color:'#75dfbf',difficulty:'Test your speed',icon:'hand'}];
export const prompts:Gesture[]=['Open palm','Fist','Pinch','Pointing'];
export class Engine {
 id:GameId;score=0;combo=0;bestCombo=0;lives=3;time=60;elapsed=0;over=false;paused=false;started=false;objects:Orb[]=[];particles:Particle[]=[];players:Player[]=[];previous=new Map<string,Point>();spawn=0;lastHit=-10;hits=0;misses=0;events:('pop'|'hit'|'bonus'|'bad')[]=[];
 paddle=H/2;opponent=H/2;ball={x:W/2,y:H/2,vx:340,vy:135};aiScore=0;playerScore=0;target:Gesture='Open palm';promptTime=5;gestureHeld=0;promptIndex=0;twoPlayer=false;rng:()=>number;
 constructor(id:GameId,rng:()=>number=Math.random){this.id=id;this.rng=rng;if(id==='bubble')for(let i=0;i<12;i++)this.addBubble();}
 addBubble(){const r=20+this.rng()*27;this.objects.push({x:80+this.rng()*(W-160),y:95+this.rng()*(H-180),vx:(this.rng()-.5)*65,vy:-20-this.rng()*25,r,color:palette[Math.floor(this.rng()*5)],kind:'bubble',alive:true,angle:0});}
 burst(o:Orb,bad=false){for(let i=0;i<16;i++){const a=this.rng()*Math.PI*2,s=60+this.rng()*210;if(this.particles.length<360)this.particles.push({x:o.x,y:o.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+this.rng()*.5,color:bad?'#ff6984':o.color});}this.events.push(bad?'bad':'pop');}
 hit(o:Orb,base=10){o.alive=false;this.burst(o);this.combo=this.elapsed-this.lastHit<1.5?this.combo+1:1;this.lastHit=this.elapsed;this.bestCombo=Math.max(this.combo,this.bestCombo);this.score+=award(base,this.combo);this.hits++;}
 bad(o:Orb){o.alive=false;this.burst(o,true);this.lives--;this.combo=0;this.misses++;if(this.lives<=0)this.over=true;}
 nextPrompt(){this.promptIndex++;this.target=prompts[(this.promptIndex+Math.floor(this.rng()*3))%4];this.promptTime=Math.max(2,5-this.score/500);this.gestureHeld=0;}
 update(dt:number,players:Player[]){
 this.players=players;if(this.over||this.paused||!this.started)return;dt=Math.min(dt,.05);this.elapsed+=dt;this.time=Math.max(0,60-this.elapsed);
 if(this.id==='bubble'||this.id==='gesture'){if(this.time<=0)this.over=true;}
 this.particles=this.particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;return p.life>0;});
 if(this.combo&&this.elapsed-this.lastHit>1.5)this.combo=0;
 if(this.id==='bubble')this.updateBubble(dt,players);
 if(this.id==='fruit')this.updateFruit(dt,players);
 if(this.id==='stars')this.updateStars(dt,players);
 if(this.id==='pong')this.updatePong(dt,players);
 if(this.id==='gesture'){
 this.promptTime-=dt;const matched=players.some(p=>p.gesture===this.target);this.gestureHeld=matched?this.gestureHeld+dt:0;
 if(this.gestureHeld>=.45){this.score+=50+this.combo*10;this.combo++;this.hits++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.events.push('bonus');this.nextPrompt();}
 else if(this.promptTime<=0){this.combo=0;this.misses++;this.nextPrompt();this.events.push('bad');}
 }
 this.objects=this.objects.filter(o=>o.alive);this.previous.clear();for(const p of players)this.previous.set(p.id,{x:p.x,y:p.y});
 }
 updateBubble(dt:number,players:Player[]){for(const o of this.objects){o.x+=o.vx*dt;o.y+=o.vy*dt;if(o.x<o.r||o.x>W-o.r)o.vx*=-1;if(o.y<-o.r)o.y=H+o.r;for(const p of players){const prev=this.previous.get(p.id)??p;if(circleHit(p,o,o.r+12)||segmentHit(prev,p,o,o.r+8)){this.hit(o,o.r<30?20:10);break;}}}this.spawn-=dt;if(this.spawn<=0&&this.objects.filter(o=>o.alive).length<18){this.addBubble();this.spawn=Math.max(.16,.6-this.elapsed*.005);}}
 updateFruit(dt:number,players:Player[]){this.spawn-=dt;if(this.spawn<=0){this.spawn=Math.max(.25,.95-this.elapsed*.008);const bomb=this.rng()<.15;this.objects.push({x:120+this.rng()*(W-240),y:H+35,vx:(this.rng()-.5)*220,vy:-560-this.rng()*170,r:30+this.rng()*9,kind:bomb?'bomb':['orange','melon','berry'][Math.floor(this.rng()*3)],color:bomb?'#5b5873':palette[Math.floor(this.rng()*5)],alive:true,angle:0});}
 for(const o of this.objects){o.vy+=700*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=dt*2;for(const p of players){const prev=this.previous.get(p.id);if(prev&&distance(prev,p)/dt>210&&segmentHit(prev,p,o,o.r+12)){if(o.kind==='bomb')this.bad(o);else this.hit(o,25);break;}}if(o.alive&&o.y>H+80&&o.vy>0){o.alive=false;if(o.kind!=='bomb'){this.lives--;this.misses++;if(this.lives<=0)this.over=true;}}}}
 updateStars(dt:number,players:Player[]){if(players.length)this.paddle=clamp(players[0].palmX,75,W-75);this.spawn-=dt;if(this.spawn<=0){this.spawn=Math.max(.18,.7-this.elapsed*.006);const n=this.rng();this.objects.push({x:50+this.rng()*(W-100),y:-30,vx:0,vy:160+this.elapsed*3,r:18,color:n<.17?'#ffe9a0':'#80dfff',kind:n<.12?'danger':n<.29?'gold':n<.33?'bonus':'star',alive:true,angle:0});}
 for(const o of this.objects){o.y+=o.vy*dt;o.angle+=dt*1.4;if(o.y>H-100&&o.y<H-48&&Math.abs(o.x-this.paddle)<88){if(o.kind==='danger')this.bad(o);else if(o.kind==='bonus'){this.hit(o,30);this.lives=Math.min(5,this.lives+1);}else this.hit(o,o.kind==='gold'?50:10);}if(o.alive&&o.y>H+30){o.alive=false;if(o.kind!=='danger'){this.lives--;this.misses++;if(this.lives<=0)this.over=true;}}}}
 updatePong(dt:number,players:Player[]){if(players[0])this.paddle=clamp(players[0].palmY,52,H-52);const target=this.twoPlayer?(players[1]?.palmY??this.opponent):this.ball.y;const speed=this.twoPlayer?1100:225+this.elapsed*1.5;this.opponent+=clamp(target-this.opponent,-speed*dt,speed*dt);this.opponent=clamp(this.opponent,52,H-52);
 const b=this.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<12||b.y>H-12){b.y=clamp(b.y,12,H-12);b.vy*=-1;}
 const left=b.vx<0&&paddleHit(b.x,b.y,34,this.paddle-52,16,104,12);const right=b.vx>0&&paddleHit(b.x,b.y,W-50,this.opponent-52,16,104,12);
 if(left||right){b.x=left?63:W-63;const offset=(b.y-(left?this.paddle:this.opponent))/52;const speed=Math.min(760,Math.hypot(b.vx,b.vy)*1.045);b.vx=(left?1:-1)*speed*Math.cos(offset*.85);b.vy=speed*Math.sin(offset*.85);this.hits++;this.combo++;this.events.push('hit');}
 if(b.x<-25||b.x>W+25){if(b.x>W){this.playerScore++;this.score+=100;}else{this.aiScore++;this.misses++;}this.combo=0;this.ball={x:W/2,y:H/2,vx:b.x<0?340:-340,vy:(this.rng()-.5)*260};this.events.push(b.x>W?'bonus':'bad');if(this.playerScore>=7||this.aiScore>=7)this.over=true;}
 }
}
