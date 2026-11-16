import {type Point,clamp,distance} from '../services/input';
export function circleHit(a:Point,b:Point,r:number){return distance(a,b)<=r;}
export function segmentHit(a:Point,b:Point,p:Point,r:number){const dx=b.x-a.x,dy=b.y-a.y;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1));return circleHit({x:a.x+t*dx,y:a.y+t*dy},p,r);}
export function award(base:number,combo:number){return base*Math.min(5,1+Math.floor(combo/5));}
export function paddleHit(x:number,y:number,px:number,py:number,w:number,h:number,r:number){return x+r>=px&&x-r<=px+w&&y+r>=py&&y-r<=py+h;}
