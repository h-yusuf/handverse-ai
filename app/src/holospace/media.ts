export function youtubeId(input:string):string|null {
 const raw=input.trim();if(/^[\w-]{11}$/.test(raw))return raw;
 try {const url=new URL(raw);if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
 const host=url.hostname.replace(/^www\./,'');let id:string|null=null;
 if(host==='youtu.be')id=url.pathname.split('/')[1];
 if(host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com')id=url.searchParams.get('v')??(/^\/(embed|shorts|live)\//.test(url.pathname)?url.pathname.split('/')[2]:null);
 return id&&/^[\w-]{11}$/.test(id)?id:null;}catch{return null;}
}
export const soundscapes=[
 {id:'stillwater',title:'Stillwater',artist:'HoloSpace Originals',mood:'A little room to breathe',color:'#A8ECF7'},
 {id:'violet-hour',title:'Violet hour',artist:'HoloSpace Originals',mood:'Find your evening rhythm',color:'#D6C5FF'},
 {id:'soft-focus',title:'Soft focus',artist:'HoloSpace Originals',mood:'Settle into your flow',color:'#B6F2D5'}
].map(t=>({...t,src:`/holospace/${t.id}.wav`}));
export type Track=typeof soundscapes[number];
export const clock=(seconds:number)=>`${Math.floor((Number.isFinite(seconds)?seconds:0)/60)}:${String(Math.floor((Number.isFinite(seconds)?seconds:0)%60)).padStart(2,'0')}`;
