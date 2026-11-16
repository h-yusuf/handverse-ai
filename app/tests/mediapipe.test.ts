import {beforeEach,describe,expect,it,vi} from 'vitest';
import {initializeLandmarker,inspectRuntimeAsset} from '../src/services/mediapipe';
beforeEach(()=>{vi.stubGlobal('document',{baseURI:'tauri://localhost/'});});
describe('packaged MediaPipe runtime',()=>{
 it('passes a canonical base and retries matching non-SIMD assets after GPU and CPU fail',async()=>{
  const files={wasmLoaderPath:'tauri://localhost/wasm/vision_wasm_internal.js',wasmBinaryPath:'tauri://localhost/wasm/vision_wasm_internal.wasm'};
  const resolver=vi.fn().mockResolvedValue(files),model={close:vi.fn(),detectForVideo:vi.fn()};
  const create=vi.fn().mockRejectedValueOnce(new Error('SIMD GPU failed')).mockRejectedValueOnce(new Error('SIMD CPU failed')).mockRejectedValueOnce(new Error('No GPU')).mockResolvedValueOnce(model);
  const log=vi.fn();const result=await initializeLandmarker({FilesetResolver:{forVisionTasks:resolver},HandLandmarker:{createFromOptions:create}},log,()=>true,false);
  expect(resolver).toHaveBeenCalledWith('tauri://localhost/wasm');
  expect(result).toEqual({model,delegate:'CPU',variant:'non-SIMD'});
  expect(create.mock.calls[3][0]).toEqual({wasmLoaderPath:'tauri://localhost/wasm/vision_wasm_nosimd_internal.js',wasmBinaryPath:'tauri://localhost/wasm/vision_wasm_nosimd_internal.wasm'});
  expect(log.mock.calls.flat().join('\n')).toContain('SIMD CPU failed');
 });
 it('rejects a successful HTTP response containing the SPA HTML fallback',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<!doctype html><html></html>',{headers:{'content-type':'text/html'}})));
  await expect(inspectRuntimeAsset('tauri://localhost/wasm//vision_wasm_internal.js','js',vi.fn())).rejects.toThrow('HTML fallback');
 });
 it('reports missing scripts and rejects wrong WASM MIME types',async()=>{
  const log=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('missing',{status:404})).mockResolvedValueOnce(new Response(new Uint8Array([0,97,115,109]),{headers:{'content-type':'text/html'}})));
  await expect(inspectRuntimeAsset('tauri://localhost/missing.js','js',log)).rejects.toThrow('HTTP 404');
  await expect(inspectRuntimeAsset('tauri://localhost/bad.wasm','wasm',log)).rejects.toThrow();
  expect(log.mock.calls.flat().join('\n')).toContain('404');
 });
});
