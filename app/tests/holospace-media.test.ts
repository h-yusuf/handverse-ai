import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {youtubeId,soundscapes,clock} from '../src/holospace/media';
describe('YouTube video links',()=>{
 it('accepts watch, short, mobile, live and embed URLs',()=>{
 for(const url of ['aqz-KE-bpKQ','https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12','https://youtu.be/aqz-KE-bpKQ?si=abc','https://m.youtube.com/shorts/aqz-KE-bpKQ','https://youtube.com/live/aqz-KE-bpKQ','https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'])expect(youtubeId(url)).toBe('aqz-KE-bpKQ');
 });
 it('rejects other hosts, scripts, playlists and malformed IDs',()=>{
 for(const url of ['https://youtube.com.evil.com/watch?v=aqz-KE-bpKQ','javascript:alert(1)','https://evil.com/aqz-KE-bpKQ','https://youtube.com/playlist?list=PL123','https://youtu.be/bad','', 'file://youtube.com/watch?v=aqz-KE-bpKQ'])expect(youtubeId(url)).toBeNull();
 });
});
describe('offline music',()=>{
 it('ships a playable asset for every original track',()=>{expect(soundscapes).toHaveLength(3);for(const t of soundscapes)expect(existsSync(`public${t.src}`)).toBe(true);});
 it('formats real playback times and tolerates loading metadata',()=>{expect(clock(125.7)).toBe('2:05');expect(clock(NaN)).toBe('0:00');expect(clock(Infinity)).toBe('0:00');});
});
