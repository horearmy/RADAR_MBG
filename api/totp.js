const crypto = require('crypto');
const secret = 'OUKJAIUXDHRHCQVADWEH3BBG6VA5ISII';
function base32(s){
 const b='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 s=s.toUpperCase().replace(/=+$/,'');
 let bits='';
 for(let i=0;i<s.length;i++){
   const v=b.indexOf(s[i]);
   if(v<0)throw new Error('bad');
   bits+=v.toString(2).padStart(5,'0');
 }
 const bytes=[];
 for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.substr(i,8),2));
 return Buffer.from(bytes);
}
const key=base32(secret);
const t=Math.floor(Date.now()/30000);
const msg=Buffer.alloc(8);
msg.writeBigUInt64BE(BigInt(t));
const h=crypto.createHmac('sha1',key).update(msg).digest();
const o=h[h.length-1]&0xf;
const c=((h[o]<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])&0x7fffffff)%1000000;
console.log(c.toString().padStart(6,'0'));
