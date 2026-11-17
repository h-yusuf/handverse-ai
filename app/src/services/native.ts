type TauriWindow=Window & {__TAURI_INTERNALS__?:{invoke:<T>(command:string,args?:Record<string,unknown>)=>Promise<T>}};
export const isTauri=()=>Boolean((window as TauriWindow).__TAURI_INTERNALS__);
export function invoke<T=void>(command:string,args?:Record<string,unknown>):Promise<T>{const bridge=(window as TauriWindow).__TAURI_INTERNALS__;return bridge?bridge.invoke<T>(command,args):Promise.reject(new Error('Native command unavailable'));}

// Native automation keeps canvas rendering alive while the window is inactive.
export const isAutomatedRun=()=>Boolean((window as Window & {__HANDVERSE_AUTOMATION__?:boolean}).__HANDVERSE_AUTOMATION__);
