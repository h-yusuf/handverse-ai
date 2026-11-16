import {Engine,W,H,palette} from './engine';
export function star(c:CanvasRenderingContext2D,x:number,y:number,r:number,rotation=0){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2+rotation,s=i%2?r*.45:r;c.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}c.closePath();}
function text(c:CanvasRenderingContext2D,s:string,x:number,y:number,size=18,color='#e9ecff'){c.fillStyle=color;c.font=`500 ${size}px 'Arial',sans-serif`;c.textAlign='center';c.fillText(s,x,y);}
export function render(c:CanvasRenderingContext2D,g:Engine,particles=true){
 c.clearRect(0,0,W,H);c.fillStyle='#0a101e';c.fillRect(0,0,W,H);
 const bg=c.createRadialGradient(W*.5,H*.6,0,W*.5,H*.6,W*.65);bg.addColorStop(0,g.id==='stars'?'#17233c':g.id==='fruit'?'#1e1635':'#102136');bg.addColorStop(1,'#090e1a');c.fillStyle=bg;c.fillRect(0,0,W,H);
 c.fillStyle='#8399ce';for(let i=0;i<65;i++){const x=(i*197.39)%W,y=(i*89.3)%H;c.globalAlpha=.1+.2*Math.sin(g.elapsed+i)**2;c.beginPath();c.arc(x,y,i%3===0?1.4:.7,0,Math.PI*2);c.fill();}c.globalAlpha=1;
 if(g.id==='pong'){
 c.strokeStyle='#ffffff12';c.lineWidth=2;c.setLineDash([8,14]);c.beginPath();c.moveTo(W/2,0);c.lineTo(W/2,H);c.stroke();c.setLineDash([]);
 text(c,String(g.playerScore),W*.4,85,52,'#65e9fc');text(c,String(g.aiScore),W*.6,85,52,'#b5a0ff');
 c.shadowBlur=22;c.shadowColor='#54e1ff';c.fillStyle='#63e7ff';c.fillRect(34,g.paddle-52,16,104);c.shadowColor='#b69bff';c.fillStyle='#b69bff';c.fillRect(W-50,g.opponent-52,16,104);
 c.shadowColor='#fff';c.fillStyle='#fff';c.beginPath();c.arc(g.ball.x,g.ball.y,11,0,Math.PI*2);c.fill();c.shadowBlur=0;
 text(c,'YOU',75,H-25,12,'#72abbf');text(c,g.twoPlayer?'HAND 2':'COMPUTER',W-90,H-25,12,'#9b8fb9');
 }
 if(g.id==='stars'){
 c.strokeStyle='#6cf0ff';c.fillStyle='#48d8ef18';c.lineWidth=3;c.shadowColor='#6cf0ff';c.shadowBlur=14;c.beginPath();c.moveTo(g.paddle-72,H-84);c.lineTo(g.paddle-55,H-48);c.quadraticCurveTo(g.paddle,H-25,g.paddle+55,H-48);c.lineTo(g.paddle+72,H-84);c.closePath();c.fill();c.stroke();c.shadowBlur=0;
 }
 for(const o of g.objects){
 c.save();c.translate(o.x,o.y);if(o.kind==='bubble'){
 const fill=c.createRadialGradient(-o.r*.35,-o.r*.4,0,0,0,o.r);fill.addColorStop(0,o.color+'40');fill.addColorStop(.7,o.color+'0b');fill.addColorStop(1,o.color+'65');c.fillStyle=fill;c.strokeStyle=o.color;c.lineWidth=1.7;c.shadowColor=o.color;c.shadowBlur=14;c.beginPath();c.arc(0,0,o.r,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;c.strokeStyle='#ffffffb0';c.lineWidth=2.3;c.beginPath();c.arc(0,0,o.r*.75,Math.PI*1.08,Math.PI*1.46);c.stroke();c.fillStyle='#ffffff80';c.beginPath();c.arc(o.r*.34,o.r*.43,2,0,7);c.fill();
 }else if(['star','gold','danger','bonus'].includes(o.kind)){
 c.rotate(o.angle);c.fillStyle=o.kind==='danger'?'#ff6984':o.kind==='bonus'?'#7affb9':o.color;c.shadowColor=c.fillStyle as string;c.shadowBlur=16;if(o.kind==='danger'){c.rotate(Math.PI/4);c.fillRect(-13,-13,26,26);c.strokeStyle='#401624';c.lineWidth=3;c.beginPath();c.moveTo(-7,-7);c.lineTo(7,7);c.moveTo(7,-7);c.lineTo(-7,7);c.stroke();}else{star(c,0,0,o.r);c.fill();}c.shadowBlur=0;
 }else{
 c.rotate(o.angle);const bomb=o.kind==='bomb';const grad=c.createRadialGradient(-12,-12,2,0,0,o.r);grad.addColorStop(0,bomb?'#737286':o.color);grad.addColorStop(1,bomb?'#242334':o.kind==='orange'?'#dc5e32':o.kind==='melon'?'#2b9b70':'#a13d8d');c.fillStyle=grad;c.beginPath();c.arc(0,0,o.r,0,7);c.fill();c.strokeStyle=bomb?'#fda96d':'#c5ffab';c.lineWidth=4;c.beginPath();c.moveTo(0,-o.r);c.quadraticCurveTo(5,-o.r-18,17,-o.r-13);c.stroke();if(bomb){text(c,'×',0,9,30,'#efdaed');c.fillStyle='#ffe8ae';c.beginPath();c.arc(18,-o.r-13,4,0,7);c.fill();}else{c.fillStyle='#ffffff50';c.beginPath();c.ellipse(-o.r*.35,-o.r*.33,5,10,.6,0,7);c.fill();}
 }c.restore();
 }
 if(particles)for(const p of g.particles){c.globalAlpha=Math.min(1,p.life*2);c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.life*4,0,7);c.fill();}c.globalAlpha=1;
 for(const [i,p] of g.players.entries()){
 const previous=g.previous.get(p.id);c.strokeStyle=palette[i%2];c.shadowColor=c.strokeStyle;c.shadowBlur=16;c.lineWidth=p.active?5:3;if(previous&&g.id==='fruit'){c.beginPath();c.moveTo(previous.x,previous.y);c.lineTo(p.x,p.y);c.stroke();}
 c.beginPath();c.arc(p.x,p.y,p.active?10:15,0,7);c.stroke();c.fillStyle=c.strokeStyle;c.beginPath();c.arc(p.x,p.y,3,0,7);c.fill();c.shadowBlur=0;
 }
 if(g.combo>1&&g.id!=='gesture'){text(c,`${g.combo} COMBO`,W/2,70,20,'#ffe0a2');}
 if(g.id==='gesture'){
 text(c,'SHOW YOUR HAND',W/2,100,14,'#8199bc');text(c,g.target,W/2,174,48);
 drawGesture(c,W/2,H*.56,g.target,1.5,'#7eeed8');
 c.fillStyle='#ffffff15';c.fillRect(W/2-130,H-111,260,5);c.fillStyle='#7eeed8';c.fillRect(W/2-130,H-111,260*Math.min(1,g.gestureHeld/.45),5);
 text(c,`${g.promptTime.toFixed(1)}s to pose  ·  Hold for a moment`,W/2,H-65,17,'#a0b6cb');
 if(g.players[0])text(c,`Recognized: ${g.players[0].gesture}`,W/2,H-30,14,'#74ddc6');
 }
 if(!g.started){c.fillStyle='#090d1abf';c.fillRect(0,0,W,H);text(c,'Ready when you are.',W/2,H/2-30,36);text(c,'Start a round and make your move.',W/2,H/2+12,18,'#9aa9c4');}
}
export function drawGesture(c:CanvasRenderingContext2D,x:number,y:number,gesture:string,scale=1,color='#71dbf4'){
 c.save();c.translate(x,y);c.scale(scale,scale);c.strokeStyle=color;c.fillStyle=color+'18';c.lineWidth=3;c.lineCap='round';c.lineJoin='round';c.shadowColor=color;c.shadowBlur=12;
 c.beginPath();if(gesture==='Fist'){c.roundRect(-38,-32,75,76,18);}else if(gesture==='Pinch'){c.moveTo(-20,55);c.bezierCurveTo(-65,16,-42,-10,-23,7);c.lineTo(-3,27);c.bezierCurveTo(35,2,10,-50,-12,-30);c.bezierCurveTo(-28,-17,-5,5,9,-7);c.lineTo(25,-17);c.bezierCurveTo(50,-5,48,23,27,55);}else{c.moveTo(-28,65);c.lineTo(-53,3);c.bezierCurveTo(-62,-20,-45,-25,-34,-5);c.lineTo(-22,15);c.lineTo(-25,-63);c.bezierCurveTo(-25,-80,-8,-80,-8,-63);c.lineTo(-5,-14);if(gesture==='Pointing'){c.lineTo(25,-18);c.bezierCurveTo(48,-17,44,13,30,63);}else{c.lineTo(-4,-85);c.bezierCurveTo(-4,-103,13,-103,13,-85);c.lineTo(15,-12);c.lineTo(20,-70);c.bezierCurveTo(22,-87,39,-84,37,-65);c.lineTo(33,-3);c.lineTo(43,-43);c.bezierCurveTo(49,-60,63,-52,58,-36);c.lineTo(43,37);c.lineTo(25,65);}}c.closePath();c.fill();c.stroke();c.shadowBlur=0;c.restore();
}
