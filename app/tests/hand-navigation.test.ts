import {describe,it,expect,vi} from 'vitest';
import {PinchGate,interactiveAt,activate} from '../src/services/hand-navigation';
describe('global pinch navigation',()=>{
 it('clicks once per open-to-pinch transition across held frames and reacquisition',()=>{
  const gate=new PinchGate();const h={id:'Right',pinching:true};
  expect(gate.update(h)).toBe(false); // Already pinched when first seen.
  h.pinching=false;expect(gate.update(h)).toBe(false);
  h.pinching=true;expect(gate.update(h)).toBe(true);
  for(let i=0;i<100;i++)expect(gate.update({...h})).toBe(false);
  // No update during hand loss or a route change: latch survives both.
  expect(gate.update({...h})).toBe(false);
  h.pinching=false;gate.update(h);h.pinching=true;expect(gate.update(h)).toBe(true);
 });
 it('keeps independent release state for two hands',()=>{
  const gate=new PinchGate();gate.update({id:'Left',pinching:false});
  expect(gate.update({id:'Right',pinching:true})).toBe(false);
  expect(gate.update({id:'Left',pinching:true})).toBe(true);
 });
 it('hit-tests viewport coordinates, rejects unavailable controls, and activates once',()=>{
  const target={isConnected:true,matches:vi.fn(()=>false),closest:vi.fn(()=>null),getClientRects:()=>[{}],focus:vi.fn(),click:vi.fn()};
  const elementFromPoint=vi.fn(()=>({closest:()=>target}));
  vi.stubGlobal('document',{elementFromPoint});
  vi.stubGlobal('getComputedStyle',()=>({visibility:'visible',opacity:'1',pointerEvents:'auto'}));
  vi.stubGlobal('HTMLSelectElement',class {});
  expect(interactiveAt(320,240)).toBe(target);expect(elementFromPoint).toHaveBeenCalledWith(320,240);
  activate(target as unknown as HTMLElement);expect(target.click).toHaveBeenCalledTimes(1);
  target.matches.mockReturnValue(true);expect(interactiveAt(320,240)).toBeNull();
  target.matches.mockReturnValue(false);target.isConnected=false;expect(interactiveAt(320,240)).toBeNull();
  target.isConnected=true;vi.stubGlobal('getComputedStyle',()=>({visibility:'hidden',opacity:'1'}));expect(interactiveAt(320,240)).toBeNull();
 });
});
