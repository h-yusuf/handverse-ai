import {validateHandControls} from './precision-hand';
import {identity,type Calibration} from './input';
export type Settings={sound:boolean;overlay:boolean;dwell:boolean;twoPlayer:boolean;particles:boolean;calibration:Calibration};
export type RecordEntry={game:string;score:number;date:string};
export const defaults:Settings={sound:true,overlay:true,dwell:false,twoPlayer:false,particles:true,calibration:identity};
export function load<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem('handverse.'+key)||'null')??fallback;}catch{return fallback;}}
export function save(key:string,value:unknown){try{localStorage.setItem('handverse.'+key,JSON.stringify(value));}catch{/* Storage unavailable: session continues. */}}
export const settings:Settings={...defaults,...load('settings',defaults)};
export const records=()=>load<RecordEntry[]>('records',[]);
export function record(game:string,score:number){save('records',[{game,score,date:new Date().toISOString()},...records()].slice(0,100));}

export const handControls=validateHandControls(load('handControls.v1',null));
