import type {Hand} from './input';
// Retain the latch across hand loss and routes; an open hand arms each press.
export class PinchGate {
 private held=new Map<string,boolean>();
 update(hand:Pick<Hand,'id'|'pinching'>){const previous=this.held.get(hand.id);this.held.set(hand.id,hand.pinching);return previous===false&&hand.pinching;}
}
export function interactiveAt(x:number,y:number):HTMLElement|null {
 const target=document.elementFromPoint(x,y)?.closest<HTMLElement>('button,a[href],input,select,textarea,[role="button"],[role="switch"],[data-hand-click]')??null;
 if(!target||!target.isConnected||target.matches(':disabled')||target.closest('[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]'))return null;
 const style=getComputedStyle(target);
 if(style.visibility!=='visible'||Number(style.opacity)===0||style.pointerEvents==='none'||!target.getClientRects().length)return null;
 return target;
}
export function activate(target:HTMLElement){
 target.focus({preventScroll:true});
 // Native activation invokes React once, including checkbox change behavior.
 if(target instanceof HTMLSelectElement){try{target.showPicker();}catch{target.click();}}
 else target.click();
}

export function ownsUI(scope:'global'|'ar'|'ui'|'canvas'|'holospace',insideAR:boolean){return scope==='holospace'||scope==='global'||!insideAR;}

// HoloSpace handles selection and manipulation atomically; the shared cursor still renders.
export function allowsGlobalActivation(scope:string){return scope!=='holospace';}
