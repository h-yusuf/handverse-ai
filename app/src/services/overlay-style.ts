// Presentation only: shared by the camera preview and the AR landmark renderer.
export const trackingWhite=[1,1,1];
export const trackingAccent=(id:string)=>id==='Left'?[.81,.96,.9]:[.79,.94,1];
export const trackingCSS=(color:number[])=>`rgb(${color.map(v=>Math.round(v*255)).join(',')})`;
export const isFingertip=(index:number)=>index===4||index===8||index===12||index===16||index===20;
export function emphasizedLandmark(index:number,pinching:boolean,gesture:string,swiping=false){
 return (pinching&&(index===4||index===8))||
  (gesture==='Pointing'&&index===8)||
  ((gesture==='Fist'||swiping)&&isFingertip(index));
}
