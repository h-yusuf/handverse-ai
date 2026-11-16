import {WIDTH,HEIGHT,type Stroke,type View} from './engine';
export function drawInk(c:CanvasRenderingContext2D,strokes:Stroke[],view:View,until=Infinity,now=performance.now()){
 c.clearRect(0,0,WIDTH,HEIGHT);c.save();c.translate(view.x,view.y);c.scale(view.zoom,view.zoom);c.lineCap='round';c.lineJoin='round';
 for(const s of strokes){
  c.save();c.globalCompositeOperation=s.eraser?'destination-out':'source-over';
  const light=s.light||s.brush==='Neon Light';const fade=s.light&&!s.persistent?Math.exp(-Math.max(0,now-(s.points.at(-1)?.t??now))/4500):1;
  c.globalAlpha=s.opacity*fade*(s.brush==='Soft Marker'?.45:1);c.shadowBlur=light&&!s.eraser?18:0;c.shadowColor=s.color;
  const points=s.points;for(let i=0;i<points.length;i++){
   const b=points[i];if(b.t>until)break;const a=points[Math.max(0,i-1)],prev=points[Math.max(0,i-2)];
   c.lineWidth=s.width*(s.eraser?4:s.brush==='Soft Marker'?3:1)*(s.light?Math.max(.4,1.6-b.v*.6):1);
   const color=s.brush==='Rainbow Trail'?`hsl(${(b.t/12)%360} 90% 80%)`:s.color;c.strokeStyle=color;c.fillStyle=color;
   c.beginPath();if(i===0){c.arc(b.x,b.y,c.lineWidth/2,0,Math.PI*2);c.fill();}else{c.moveTo((prev.x+a.x)/2,(prev.y+a.y)/2);c.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);c.stroke();if(i===points.length-1||points[i+1].t>until){c.beginPath();c.moveTo((a.x+b.x)/2,(a.y+b.y)/2);c.lineTo(b.x,b.y);c.stroke();}}
   if(!s.eraser&&(s.brush==='Spark Brush'||s.light)&&i%3===0){const angle=i*2.4;const r=s.width*2+Math.sin(i)*6;c.fillRect(b.x+Math.cos(angle)*r,b.y+Math.sin(angle)*r,2,2);}
  }c.restore();
 }c.restore();
}
export function drawCamera(c:CanvasRenderingContext2D,video:HTMLVideoElement){c.clearRect(0,0,WIDTH,HEIGHT);if(video.readyState<2)return;const scale=Math.max(WIDTH/video.videoWidth,HEIGHT/video.videoHeight);const w=video.videoWidth*scale,h=video.videoHeight*scale;c.save();c.translate(WIDTH,0);c.scale(-1,1);c.drawImage(video,(WIDTH-w)/2,(HEIGHT-h)/2,w,h);c.restore();}
export function supportedVideo(){if(typeof MediaRecorder==='undefined')return '';return ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))??'';}
