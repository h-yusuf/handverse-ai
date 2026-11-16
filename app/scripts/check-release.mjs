import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const pkg=read('package.json'),lock=read('package-lock.json'),config=read('tauri.conf.json');
const cargo=readFileSync(new URL('../Cargo.toml',import.meta.url),'utf8');
const cargoVersion=cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
assert.match(pkg.version,/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
for(const version of [config.version,cargoVersion,lock.version,lock.packages[''].version])assert.equal(version,pkg.version,'Version mismatch');
assert.equal(config.productName,'HANDVERSE');
if(process.env.GITHUB_REF_TYPE==='tag')assert.equal(process.env.GITHUB_REF_NAME,'v'+pkg.version,'Tag must match app version');
console.log(`HANDVERSE ${pkg.version}: package, lockfile, Cargo and Tauri versions match.`);
if(process.argv.includes('--notes')) {
 const notes=readFileSync(new URL('../docs/RELEASE-NOTES.md',import.meta.url),'utf8').replaceAll('__VERSION__',pkg.version);
 writeFileSync('release-notes.md',notes);
}
