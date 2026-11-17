export const apps=['YouTube','Music','Maps','Notes','Timer','Calculator'] as const;
export type AppName=typeof apps[number];
export type SpatialWindow={id:AppName;x:number;y:number;w:number;h:number;z:number;minimized:boolean;text:string};
export type Layout={version:1;windows:SpatialWindow[];dim:number};
export const emptyLayout=():Layout=>({version:1,windows:[],dim:.28});
export function bounds(win:SpatialWindow,width:number,height:number):SpatialWindow{
 const maxW=Math.max(1,width),maxH=Math.max(1,height-144);
 const w=Math.min(maxW,Math.max(Math.min(260,maxW),win.w*width));
 const h=Math.min(maxH,Math.max(Math.min(180,maxH),win.h*height));
 let x=Math.max(0,Math.min(width-w,win.x*width)),y=Math.max(72,Math.min(height-72-h,win.y*height));
 if(x<16)x=0;if(width-w-x<16)x=width-w;if(y<88)y=72;if(height-72-h-y<16)y=height-72-h;
 return {...win,x:x/width,y:y/height,w:w/width,h:h/height};
}
export function focus(layout:Layout,id:AppName):Layout{
 const sorted=[...layout.windows].sort((a,b)=>a.z-b.z).filter(w=>w.id!==id);const target=layout.windows.find(w=>w.id===id);
 return {...layout,windows:(target?[...sorted,{...target,minimized:false}]:sorted).map((w,z)=>({...w,z:z+1}))};
}
export function open(layout:Layout,id:AppName,width:number,height:number):Layout{
 if(layout.windows.some(w=>w.id===id))return focus(layout,id);
 const n=layout.windows.length;
 return focus({...layout,windows:[...layout.windows,bounds({id,x:.12+n*.035,y:.18+n*.025,w:(id==='YouTube'?680:id==='Music'?500:380)/width,h:(id==='YouTube'?640:id==='Music'?670:340)/height,z:n+1,minimized:false,text:''},width,height)]},id);
}
export function close(layout:Layout,id:AppName):Layout{return {...layout,windows:layout.windows.filter(w=>w.id!==id)};}
export function minimize(layout:Layout,id:AppName):Layout{return {...layout,windows:layout.windows.map(w=>w.id===id?{...w,minimized:true}:w)};}
export function move(win:SpatialWindow,dx:number,dy:number,width:number,height:number,resize=false){return bounds({...win,...(resize?{w:win.w+dx/width,h:win.h+dy/height}:{x:win.x+dx/width,y:win.y+dy/height})},width,height);}
export function restore(value:unknown,width:number,height:number):Layout|null{
 if(!value||typeof value!=='object')return null;const v=value as Layout;
 if(v.version!==1||!Array.isArray(v.windows)||typeof v.dim!=='number'||!Number.isFinite(v.dim))return null;
 const ids=new Set<string>();const windows:SpatialWindow[]=[];
 for(const w of v.windows){if(!w||!apps.includes(w.id)||ids.has(w.id)||!['x','y','w','h','z'].every(k=>typeof w[k as keyof SpatialWindow]==='number'&&Number.isFinite(w[k as keyof SpatialWindow]))||typeof w.minimized!=='boolean'||typeof w.text!=='string')continue;
 ids.add(w.id);windows.push(bounds({...w,text:w.text.slice(0,20000)},width,height));}
 return {version:1,dim:Math.max(.2,Math.min(.85,v.dim)),windows:windows.sort((a,b)=>a.z-b.z).map((w,i)=>({...w,z:i+1}))};
}
// The global gesture engine provides pinch hysteresis; this gate adds hold and loss recovery.
export class SpatialGesture {
 id:string|null=null;armed=false;heldAt=0;palmAt:number|null=null;palmLatched=false;last=0;
 cancel(){this.id=null;this.armed=false;this.heldAt=0;this.palmAt=null;this.palmLatched=false;}
 update(hand:{id:string;pinching:boolean;gesture:string}|undefined,now:number){
 if(!hand){this.cancel();return 'cancel';}
 if(this.id!==hand.id||now-this.last>350){this.cancel();this.id=hand.id;}this.last=now;
 if(!hand.pinching){const release=this.heldAt>0;this.armed=true;this.heldAt=0;
 if(hand.gesture==='Open palm'){this.palmAt??=now;if(!this.palmLatched&&now-this.palmAt>=850){this.palmLatched=true;return 'launcher';}}else{this.palmAt=null;this.palmLatched=false;}
 return release?'release':'hover';}
 this.palmAt=null;if(this.armed){this.armed=false;this.heldAt=now;return 'press';}
 return this.heldAt&&now-this.heldAt>=220?'hold':'idle';
 }
}
