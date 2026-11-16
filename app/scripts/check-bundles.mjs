import {readdirSync,statSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const target=process.argv[2];assert.ok(target,'Target required');
const root=join('target',target,'release');
const walk=p=>readdirSync(p).flatMap(n=>statSync(join(p,n)).isDirectory()?walk(join(p,n)):[join(p,n)]);
const installers=walk(join(root,'bundle'));
for(const ext of target.includes('windows')?['.exe','.msi']:['.dmg']) {
 assert.ok(installers.some(p=>p.endsWith(ext)&&statSync(p).size>100000),`Missing or empty ${ext} installer`);
}
const binary=join(root,target.includes('windows')?'handverse.exe':'handverse');
const audit=join('logs','embedded-assets');
const result=spawnSync(binary,['--audit-runtime-assets',audit],{encoding:'utf8'});
process.stdout.write(result.stdout||'');assert.equal(result.status,0,result.stderr||result.error?.message);
for(const file of ['vendor/vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm','models/hand_landmarker.task']) {
 assert.ok(readFileSync(join('public',file)).equals(readFileSync(join(audit,file))),`Embedded asset mismatch: ${file}`);
}
console.log('Installers present; all six embedded MediaPipe assets byte-match local originals.');
