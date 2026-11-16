import type {TwoHandTransform} from './gestures';
import type {ARHand,ARSettings} from './interaction';
type V={x:number;y:number;z:number};
const cube:V[]=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>({x,y,z}))));
function geometry(kind:number):[V,V][]{
 if(kind===0)return cube.flatMap((a,i)=>cube.slice(i+1).filter(b=>[a.x!==b.x,a.y!==b.y,a.z!==b.z].filter(Boolean).length===1).map(b=>[a,b] as [V,V]));
 if(kind===1){const edges:[V,V][]=[];for(let axis=0;axis<3;axis++)for(let i=0;i<48;i++){const point=(t:number)=>axis===0?{x:Math.cos(t),y:Math.sin(t),z:0}:axis===1?{x:Math.cos(t),y:0,z:Math.sin(t)}:{x:0,y:Math.cos(t),z:Math.sin(t)};edges.push([point(i*Math.PI/24),point((i+1)*Math.PI/24)]);}return edges;}
 const points=[{x:0,y:-1.3,z:0},{x:-1,y:.7,z:-.7},{x:1,y:.7,z:-.7},{x:0,y:.7,z:1}];return points.flatMap((a,i)=>points.slice(i+1).map(b=>[a,b] as [V,V]));
}
const shapes=[geometry(0),geometry(1),geometry(2)];
export class ARRenderer {
 private lines:number[]=[];private dots:number[]=[];private vertices=new Float32Array(32768);
 private gl:WebGLRenderingContext;private camera:WebGLProgram;private ink:WebGLProgram;private quad:WebGLBuffer;private buffer:WebGLBuffer;private texture:WebGLTexture;private lastVideo=-1;private available=false;
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});if(!gl)throw new Error('WebGL is unavailable. Enable hardware acceleration and reopen AR Playground.');this.gl=gl;
  const program=(vertex:string,fragment:string)=>{const p=gl.createProgram()!;for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('AR shader could not compile.');gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('AR renderer could not start.');return p;};
  this.camera=program('attribute vec2 p; varying vec2 uv; void main(){gl_Position=vec4(p,0.,1.);uv=(p+1.)*.5;}', 'precision mediump float; varying vec2 uv; uniform sampler2D video; uniform vec2 crop; uniform float mirror; uniform float ready; void main(){vec2 t=(uv-.5)*crop+.5; t.y=1.-t.y; if(mirror>.5)t.x=1.-t.x; gl_FragColor=ready>.5?vec4(texture2D(video,t).rgb*.72,1.):vec4(.025,.043,.065,1.);}');
  this.ink=program('attribute vec2 p; attribute vec4 color; attribute float size; varying vec4 tint; uniform vec2 view; uniform float dpr; void main(){gl_Position=vec4(p.x/view.x*2.-1.,1.-p.y/view.y*2.,0.,1.);gl_PointSize=size*dpr;tint=color;}', 'precision mediump float; varying vec4 tint; uniform float dots; void main(){float a=1.;if(dots>.5){float d=distance(gl_PointCoord,vec2(.5));a=1.-smoothstep(.25,.5,d);}gl_FragColor=vec4(tint.rgb,tint.a*a);}');
  this.quad=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.byteLength,gl.DYNAMIC_DRAW);this.texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([6,11,17,255]));
 }
 render(video:HTMLVideoElement,hands:Iterable<ARHand>,settings:ARSettings,width:number,height:number,now:number,low:boolean,dual?:TwoHandTransform,collapse=0,collapseAnchor={x:0,y:0}){
  const gl=this.gl,dpr=Math.min(devicePixelRatio||1,low?1:1.5);
  if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}gl.viewport(0,0,this.canvas.width,this.canvas.height);
  gl.disable(gl.BLEND);gl.useProgram(this.camera);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const p=gl.getAttribLocation(this.camera,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  const ready=video.readyState>=2&&video.videoWidth>0&&!!video.srcObject;
  if(ready&&video.currentTime!==this.lastVideo){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);this.lastVideo=video.currentTime;this.available=true;}
  const aspect=width/height,va=(video.videoWidth||4)/(video.videoHeight||3);gl.uniform2f(gl.getUniformLocation(this.camera,'crop'),aspect<va?aspect/va:1,aspect>va?va/aspect:1);gl.uniform1f(gl.getUniformLocation(this.camera,'mirror'),settings.mirror?1:0);gl.uniform1f(gl.getUniformLocation(this.camera,'ready'),ready&&this.available?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.disableVertexAttribArray(p);
  const lines=this.lines,dots=this.dots;lines.length=0;dots.length=0;
  const add=(dest:number[],p:{x:number;y:number},c:number[],alpha=1,size=4)=>dest.push(p.x,p.y,...c,alpha,size);
  const tracked=[...hands];
  for(const h of tracked){
   const age=now-h.seen,fade=Math.max(0,1-age/300);if(fade<=0)continue;const color=[1,1,1];
   if(settings.intensity>.1&&!low){h.trail.forEach((point,i)=>add(dots,point,color,fade*i/h.trail.length*.35*settings.intensity,2+i*.2));}
   if(settings.mode==='lab'&&h.opacity>.01){h.panels.forEach((panel,index)=>{
    const shape=shapes[(index+panel.snippet)%3],angle=h.angle+(h.grab===index?(h.anchor.x-panel.x)/140:now/5000),s=panel.scale*57;
    const transform=(v:V)=>{const x=v.x*Math.cos(angle)+v.z*Math.sin(angle),z=-v.x*Math.sin(angle)+v.z*Math.cos(angle),y=v.y*Math.cos(.4)-z*Math.sin(.4),depth=1/(1+(z*Math.cos(.4)+v.y*Math.sin(.4))*.18);return {x:panel.x+x*s*depth,y:panel.y+y*s*depth};};
    for(const [a,b] of shape){add(lines,transform(a),color,h.opacity*.9);add(lines,transform(b),color,h.opacity*.9);}
    if(h.grab===index)add(dots,panel,[1,1,1],h.opacity,14);
   });}
  }
  if(settings.mode==='reactive'&&dual){
   const shrink=1-collapse;
   const color=[1,1,1],size=55*dual.scale*shrink,cx=(dual.x||width/2)*(1-collapse)+collapseAnchor.x*collapse,cy=(dual.y||height/2)*(1-collapse)+collapseAnchor.y*collapse,angle=dual.rotation;
   const transform=(v:V)=>{const x=v.x*Math.cos(angle)+v.z*Math.sin(angle),z=v.z*Math.cos(angle)-v.x*Math.sin(angle);return {x:cx+x*size/(1+z*.15),y:cy+(v.y*.9-z*.35)*size/(1+z*.15)};};
   for(const [a,b] of shapes[0]){add(lines,transform(a),color,settings.opacity);add(lines,transform(b),color,settings.opacity);}
  }
  gl.useProgram(this.ink);gl.uniform2f(gl.getUniformLocation(this.ink,'view'),width,height);gl.uniform1f(gl.getUniformLocation(this.ink,'dpr'),dpr);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const attributes=[['p',2,0],['color',4,8],['size',1,24]] as const;for(const [name,n,offset] of attributes){const a=gl.getAttribLocation(this.ink,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,28,offset);}
  gl.lineWidth(1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  for(const [values,mode] of [[lines,gl.LINES],[dots,gl.POINTS]] as const){this.vertices.set(values);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.vertices.subarray(0,values.length));gl.uniform1f(gl.getUniformLocation(this.ink,'dots'),mode===gl.POINTS?1:0);gl.drawArrays(mode,0,values.length/7);}
  for(const [name] of attributes)gl.disableVertexAttribArray(gl.getAttribLocation(this.ink,name));
 }
 dispose(){const gl=this.gl;gl.deleteBuffer(this.buffer);gl.deleteBuffer(this.quad);gl.deleteTexture(this.texture);gl.deleteProgram(this.camera);gl.deleteProgram(this.ink);}
}
