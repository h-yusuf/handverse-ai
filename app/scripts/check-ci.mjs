// Run the same checks on Windows and macOS and preserve useful output on failure.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('logs',{recursive:true});
const target=process.argv[2];
const checks=[['version','node',['scripts/check-release.mjs']],['assets','node',['scripts/setup-tracking.mjs','--check']],['frontend','npm',['run','build']],['tests','npm',['test']],['rust','cargo',['check','--locked',...(target?['--target',target]:[])]]];
for(const [name,command,args] of checks){
 const result=spawnSync(command,args,{encoding:'utf8',shell:process.platform==='win32',maxBuffer:32*1024*1024});
 const output=(result.stdout||'')+(result.stderr||'')+(result.error?.message||'');
 writeFileSync(`logs/${name}.log`,output);process.stdout.write(output);
 if(result.status!==0)process.exit(result.status||1);
}
