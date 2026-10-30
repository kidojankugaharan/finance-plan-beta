import fs from 'node:fs';
import zlib from 'node:zlib';
function crc(data){let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([size,t,data,sum]);}
for(const n of [192,512]){
  const pixels=Buffer.alloc(n*(n*4+1));
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const X=x/n*512,Y=y/n*512;let color=[16,13,36,255];
    for(const [cx,top] of [[150,270],[256,220],[362,170]])if(Math.abs(X-cx)<19&&Y>top&&Y<355)color=[239,131,193,255];
    if(X>135&&X<375&&Math.abs(Y-(250-(X-135)*.56))<10)color=[93,228,220,255];
    const i=y*(n*4+1)+1+x*4;pixels.set(color,i);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(n,0);header.writeUInt32BE(n,4);header[8]=8;header[9]=6;
  fs.writeFileSync(`public/icon-${n}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
}
