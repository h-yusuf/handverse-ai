import {appendFileSync} from 'node:fs';
const names=['APPLE_CERTIFICATE','APPLE_CERTIFICATE_PASSWORD','APPLE_SIGNING_IDENTITY','APPLE_ID','APPLE_PASSWORD','APPLE_TEAM_ID'];
if(names.some(n=>process.env[n])) {
 for(const name of names) {
  const value=process.env[name];
  if(!value)throw new Error(`Incomplete macOS signing configuration: ${name} required`);
  if(/[\r\n]/.test(value))throw new Error(`${name} must be a single line (use base64 without wrapping for the certificate)`);
  appendFileSync(process.env.GITHUB_ENV,`${name}=${value}\n`);
 }
 console.log('Production macOS signing and notarization configured.');
} else console.log('No Apple credentials: unsigned/ad-hoc testing build.');
