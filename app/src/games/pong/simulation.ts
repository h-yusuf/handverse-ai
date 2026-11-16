// Logical court coordinates stay independent of CSS size and device pixel ratio.
export const WIDTH=1100, HEIGHT=620, HALF=52, RADIUS=11, STEP=1/120;
export type Difficulty='easy'|'normal'|'hard';
export const AI={easy:{speed:230,reaction:.32,error:100,miss:.2,prediction:.3},normal:{speed:370,reaction:.17,error:48,miss:.07,prediction:.75},hard:{speed:510,reaction:.09,error:19,miss:.02,prediction:1}};
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const paddleBounds=(y:number)=>clamp(y,HALF,HEIGHT-HALF);
export function reflectedY(y:number){const span=HEIGHT-2*RADIUS,period=span*2;const p=((y-RADIUS)%period+period)%period;return RADIUS+(p<=span?p:period-p);}
export function predictLanding(b:{x:number;y:number;vx:number;vy:number},x=WIDTH-61){return b.vx>0?reflectedY(b.y+b.vy*Math.max(0,(x-b.x)/b.vx)):HEIGHT/2;}
export function bounce(offset:number,speed:number,direction:number){const angle=clamp(offset,-1,1)*Math.PI/3,s=clamp(speed,340,850);return {vx:direction*s*Math.cos(angle),vy:s*Math.sin(angle)};}
/** One Euro filter: derivative and position use the measured interval between inference callbacks. */
export class PaddleInput {
 value=HEIGHT/2; target=HEIGHT/2; last=-Infinity; raw=HEIGHT/2; derivative=0;
 sample(normalizedY:number,now:number){
  if(!Number.isFinite(normalizedY)||!Number.isFinite(now)||now<=this.last)return;
  const y=paddleBounds(clamp(normalizedY,0,1)*HEIGHT),dt=(now-this.last)/1000;
  if(!Number.isFinite(dt)||dt>.3){this.raw=y;this.target=y;this.derivative=0;}
  else {const alpha=(cutoff:number)=>1/(1+1/(2*Math.PI*cutoff*dt));this.derivative+=alpha(1)*((y-this.raw)/dt-this.derivative);this.target+=alpha(1.6+.025*Math.abs(this.derivative))*(y-this.target);this.raw=y;}
  this.last=now;
 }
 step(dt:number,now:number){if(now-this.last<350)this.value=paddleBounds(this.value+clamp(this.target-this.value,-1300*dt,1300*dt));return this.value;}
}
export type PongEvent='hit'|'bonus'|'bad';
export class PongSimulation {
 ball={x:WIDTH/2,y:HEIGHT/2,vx:340,vy:135};previous={x:WIDTH/2,y:HEIGHT/2};paddle=HEIGHT/2;opponent=HEIGHT/2;previousPaddle=HEIGHT/2;previousOpponent=HEIGHT/2;
 playerScore=0;aiScore=0;hits=0;over=false;countdown=3;serve=0;elapsed=0;accumulator=0;alpha=0;aiTimer=0;aiTarget=HEIGHT/2;feedback=0;
 events:PongEvent[]=[];input=new PaddleInput();difficulty:Difficulty;clock=0;
 constructor(difficulty:Difficulty='normal',public rng:()=>number=Math.random){this.difficulty=difficulty;}
 advance(dt:number,now:number,keyboard=0){
  if(this.over||!Number.isFinite(dt)||dt<=0)return;
  // Drop long suspension time; never fast-forward a hidden or stalled game.
  this.accumulator+=Math.min(dt,.1);this.clock=now-this.accumulator*1000;
  while(this.accumulator+1e-10>=STEP){this.clock+=STEP*1000;this.step(STEP,this.clock,keyboard);this.accumulator-=STEP;}
  this.alpha=Math.max(0,this.accumulator/STEP);
 }
 step(dt:number,now:number,keyboard=0){
  if(this.over)return;
  const b=this.ball;
  if(![b.x,b.y,b.vx,b.vy,this.paddle,this.opponent].every(Number.isFinite)){this.resetBall(1);this.paddle=this.opponent=HEIGHT/2;return;}
  this.previous.x=b.x;this.previous.y=b.y;this.previousPaddle=this.paddle;this.previousOpponent=this.opponent;
  if(keyboard){this.paddle=paddleBounds(this.paddle+keyboard*650*dt);this.input.value=this.paddle;}else this.paddle=this.input.step(dt,now);
  this.feedback=Math.max(0,this.feedback-dt);this.elapsed+=dt;
  if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);return;}
  if(this.serve>0){this.serve=Math.max(0,this.serve-dt);return;}
  const ai=AI[this.difficulty];this.aiTimer-=dt;
  if(this.aiTimer<=0){this.aiTimer=ai.reaction;const predicted=predictLanding(b);this.aiTarget=paddleBounds(b.vx>0?b.y+(predicted-b.y)*ai.prediction+(this.rng()*2-1)*ai.error+(this.rng()<ai.miss?(this.rng()<.5?-130:130):0):HEIGHT/2);}
  this.opponent=paddleBounds(this.opponent+clamp(this.aiTarget-this.opponent,-ai.speed*dt,ai.speed*dt));
  // Swept time-of-impact against walls, paddle fronts and goals. Resolve the
  // earliest contact, then consume remaining time, including corner bounces.
  let remaining=dt;
  for(let iteration=0;iteration<8&&remaining>1e-9;iteration++){
   let t=remaining,kind=0;
   const candidate=(time:number,type:number)=>{if(time>=-1e-9&&time<=t){t=Math.max(0,time);kind=type;}};
   if(b.vy<0)candidate((RADIUS-b.y)/b.vy,1);else if(b.vy>0)candidate((HEIGHT-RADIUS-b.y)/b.vy,1);
   const face=b.vx<0?61:WIDTH-61,py=b.vx<0?this.paddle:this.opponent;
   if(b.vx!==0){const pt=(face-b.x)/b.vx;if(pt>=-1e-9&&Math.abs(b.y+b.vy*pt-py)<=HALF+RADIUS)candidate(pt,2);candidate(((b.vx<0?-RADIUS:WIDTH+RADIUS)-b.x)/b.vx,3);}
   b.x+=b.vx*t;b.y+=b.vy*t;remaining-=t;
   if(kind===1){b.y=clamp(b.y,RADIUS,HEIGHT-RADIUS);b.vy=-b.vy;}
   else if(kind===2){const direction=b.vx<0?1:-1;Object.assign(b,bounce((b.y-py)/HALF,Math.hypot(b.vx,b.vy)*1.045,direction));b.x+=direction*.0001;this.hits++;this.events.push('hit');}
   else if(kind===3){const scored=b.vx>0;if(scored)this.playerScore++;else this.aiScore++;this.events.push(scored?'bonus':'bad');this.feedback=.4;this.over=this.playerScore>=7||this.aiScore>=7;this.resetBall(scored?-1:1);this.serve=.85;return;}
   else break;
  }
 }
 resetBall(direction:number){Object.assign(this.ball,{x:WIDTH/2,y:HEIGHT/2,vx:direction*340,vy:(this.rng()-.5)*260});Object.assign(this.previous,this.ball);}
}
