import {vision} from '../services/vision';
// Packaged WKWebView smoke test; no webcam permission or synthetic camera claims.
export async function runARSmokeTest(){
 const steps:{step:string;passed:boolean;detail:string}[]=[];
 const previous=localStorage.getItem('handverse.ar');
 const wait=()=>new Promise(resolve=>setTimeout(resolve,220));
 const click=(text:string)=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()===text);if(!button)throw new Error('Missing AR control: '+text);button.click();};
 try{
  click('AR Playground');await wait();
  const canvas=document.querySelector<HTMLCanvasElement>('.ar-canvas');
  const gl=canvas?.getContext('webgl');
  let program=gl?.getParameter(gl.CURRENT_PROGRAM);
  // A background WKWebView may schedule its first drawing frame after React commits.
  for(let attempt=0;gl&&!program&&attempt<12;attempt++){await wait();program=gl.getParameter(gl.CURRENT_PROGRAM);}
  const graphicsError=gl?.getError(),rendererMessage=document.querySelector('.ar-entry[role="alert"]')?.textContent;
  const linked=!!gl&&!!program&&gl.getProgramParameter(program,gl.LINK_STATUS);
  steps.push({step:'ar-webgl',passed:!!gl&&linked&&graphicsError===gl.NO_ERROR&&!rendererMessage,detail:JSON.stringify({context:!!gl,program:!!program,linked,error:graphicsError,message:rendererMessage,version:gl?.getParameter(gl.VERSION),physicalCameraTested:false})});
  steps.push({step:'ar-input-isolation',passed:vision.interactionScope==='ar',detail:'AR owns hand input while the shared camera service remains unchanged'});
  click('Floating Code');await wait();click('Hologram Lab');await wait();
  const lab=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Hologram Lab');
  click('Gesture Visualizer');await wait();
  steps.push({step:'ar-modes',passed:lab?.getAttribute('aria-pressed')==='false'&&!!document.querySelector('.ar-diagnostics')&&JSON.parse(localStorage.getItem('handverse.ar')||'{}').mode==='visualizer',detail:'Code, lab and visualizer controls switch modes; diagnostics render and mode persists locally'});
  click('Gesture Reactive');click('Gesture Studio');await wait();
  const studio=!!document.querySelector('.gesture-studio')&&vision.interactionScope==='ui';
  click('Playground');await wait();
  steps.push({step:'ar-gesture-studio',passed:studio&&vision.interactionScope==='ar',detail:'Studio settings and live preview mount; UI ownership restores on returning to Playground'});
  click('Reset positions');click('Go immersive');await wait();
  const expanded=!!document.querySelector('.ar-immersive');click('Exit immersive');await wait();
  steps.push({step:'ar-immersive',passed:expanded&&!document.querySelector('.ar-immersive'),detail:'Immersive workspace opens and exits'});
 }catch(error){steps.push({step:'ar-smoke',passed:false,detail:String(error)});}
 finally{
  document.querySelector<HTMLButtonElement>('[aria-label="HANDVERSE home"]')?.click();await wait();
  steps.push({step:'ar-navigation',passed:vision.interactionScope==='global'&&!document.querySelector('.ar-canvas'),detail:'Leaving AR unmounts its renderer and restores global hand navigation'});
  if(previous===null)localStorage.removeItem('handverse.ar');else localStorage.setItem('handverse.ar',previous);
 }
 return steps;
}
