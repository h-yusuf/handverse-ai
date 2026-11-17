import {useState} from 'react';
import {handControls,save} from '../services/storage';
import type {HandControls as Controls} from '../services/precision-hand';
export function HandControls(){
 const [value,setValue]=useState(()=>({...handControls}));
 const change=<K extends keyof Controls>(key:K,next:Controls[K])=>{Object.assign(handControls,{[key]:next});setValue({...handControls});save('handControls.v1',handControls);};
 return <details className="holo-hand-settings"><summary>Hand control</summary><div>
 <label>Cursor stabilization<select aria-label="Cursor stabilization" value={value.preset} onChange={e=>change('preset',e.target.value as Controls['preset'])}>{(['Responsive','Balanced','Precision'] as const).map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Cursor sensitivity <output>{value.sensitivity.toFixed(1)}×</output><input aria-label="Cursor sensitivity" type="range" min=".5" max="2" step=".1" value={value.sensitivity} onChange={e=>change('sensitivity',Number(e.target.value))}/></label>
 <label>Micro-movement deadzone <output>{value.deadzone.toFixed(1)} px</output><input aria-label="Micro-movement deadzone" type="range" min="0" max="6" step=".5" value={value.deadzone} onChange={e=>change('deadzone',Number(e.target.value))}/></label>
 <label>Skeleton visibility<select aria-label="Skeleton visibility" value={value.skeleton} onChange={e=>change('skeleton',e.target.value as Controls['skeleton'])}>{(['Hidden','Always visible','Auto fade'] as const).map(p=><option key={p}>{p}</option>)}</select></label>
 <label>Pinch sensitivity <output>{value.pinchSensitivity.toFixed(1)}×</output><input aria-label="Pinch sensitivity" type="range" min=".6" max="1.5" step=".1" value={value.pinchSensitivity} onChange={e=>change('pinchSensitivity',Number(e.target.value))}/></label>
 <label className="holo-diagnostic-toggle">Tracking diagnostics<input aria-label="Tracking diagnostics" type="checkbox" checked={value.diagnostics} onChange={e=>change('diagnostics',e.target.checked)}/></label>
 <small>Saved on this device. Applies to HoloSpace.</small>
 </div></details>;
}
