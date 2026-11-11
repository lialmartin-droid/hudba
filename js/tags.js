// Self-contained MP3 ID3v2 and M4A/MP4 metadata reader. No external dependencies or CDN.
const decoder=new TextDecoder('utf-8',{fatal:false});
const bytesToText=(a,encoding)=>{
  try{
    if(encoding===1||encoding===2){let data=a;let codec='utf-16be';if(encoding===1){if(a[0]===255&&a[1]===254){codec='utf-16le';data=a.slice(2)}else if(a[0]===254&&a[1]===255){data=a.slice(2)}else codec='utf-16le'}return new TextDecoder(codec).decode(data).replace(/\0/g,'').trim()}
    return new TextDecoder(encoding===0?'windows-1252':'utf-8').decode(a).replace(/\0/g,'').trim()
  }catch{return decoder.decode(a).replace(/\0/g,'').trim()}
};
const string=(a)=>String.fromCharCode(...a);
const uint=(view,pos)=>view.getUint32(pos,false);
const safeBase64=(bytes,type)=>{if(!bytes?.length||bytes.length>1100000)return null;let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return `data:${type};base64,${btoa(s)}`};
function readID3(data){
  const u=new Uint8Array(data),view=new DataView(data),res={};if(u.length<10||string(u.slice(0,3))!=='ID3')return res;
  const v=u[3],flags=u[5];let size=((u[6]&127)<<21)|((u[7]&127)<<14)|((u[8]&127)<<7)|(u[9]&127);
  let pos=10,end=Math.min(u.length,10+size);
  if(flags&0x40){if(v===3)pos+=4+uint(view,pos);else if(v===4){let ext=((u[pos]&127)<<21)|((u[pos+1]&127)<<14)|((u[pos+2]&127)<<7)|(u[pos+3]&127);pos+=ext}}
  while(pos+10<=end){const id=string(u.slice(pos,pos+4));if(!/^[A-Z0-9]{4}$/.test(id))break;let n=v===4?((u[pos+4]&127)<<21)|((u[pos+5]&127)<<14)|((u[pos+6]&127)<<7)|(u[pos+7]&127):uint(view,pos+4);pos+=10;if(n<1||pos+n>end)break;const body=u.slice(pos,pos+n);pos+=n;
    if(id==='TIT2')res.title=bytesToText(body.slice(1),body[0]);
    if(id==='TPE1')res.artist=bytesToText(body.slice(1),body[0]);
    if(id==='TALB')res.album=bytesToText(body.slice(1),body[0]);
    if(id==='APIC'){
      let i=1;while(i<body.length&&body[i])i++;const mime=decoder.decode(body.slice(1,i))||'image/jpeg';i+=2;const enc=body[0],step=enc===1||enc===2?2:1;while(i+step<=body.length){if(step===2&&body[i]===0&&body[i+1]===0){i+=2;break}if(step===1&&body[i]===0){i++;break}i+=step}
      res.cover=safeBase64(body.slice(i),/^image\//.test(mime)?mime:'image/jpeg');
    }
  }return res;
}
// Parse MP4 atom tree, including iTunes 'ilst' metadata and embedded cover art.
function readMP4(data){
  const u=new Uint8Array(data),v=new DataView(data),res={};let seen=0;
  const containers=new Set(['moov','udta','meta','ilst']);
  function walk(start,end,depth=0,parent=''){
    if(depth>7)return;
    let p=start;
    while(p+8<=end&&seen++<25000){let size=uint(v,p);const type=string(u.slice(p+4,p+8));let hdr=8;if(size===1&&p+16<=end){const large=Number(v.getBigUint64(p+8,false));if(!Number.isSafeInteger(large))break;size=large;hdr=16}if(size===0)size=end-p;if(size<hdr||p+size>end)break;const a=p+hdr,b=p+size;
      if(containers.has(type))walk(type==='meta'?a+4:a,b,depth+1,type);
      else if(parent==='ilst'&&['©nam','©ART','aART','©alb','covr'].includes(type)){
        let q=a;
        while(q+16<=b){const n=uint(v,q),t=string(u.slice(q+4,q+8));if(n<16||q+n>b)break;if(t==='data'){
          const typeId=uint(v,q+8),content=u.slice(q+16,q+n);
          if(type==='covr'){const mime=typeId===14?'image/png':'image/jpeg';res.cover=safeBase64(content,mime)}
          else{const txt=decoder.decode(content).replace(/\0/g,'').trim();if(type==='©nam')res.title=txt;if(type==='©ART'||type==='aART'&&!res.artist)res.artist=txt;if(type==='©alb')res.album=txt}
        }q+=n;}
      }
      p+=size;
    }
  }walk(0,u.length);return res;
}
export async function extractMetadata(file){
  const filename=file.name.replace(/\.[^.]+$/,'');const meta={title:filename,artist:'Neznámý interpret',album:'Neznámé album',cover:null};
  try{
    const slice=await file.slice(0,Math.min(file.size,8*1024*1024)).arrayBuffer();
    const u=new Uint8Array(slice);let result={};
    if(u.length>10&&String.fromCharCode(...u.slice(0,3))==='ID3')result=readID3(slice);
    else if(u.length>12&&String.fromCharCode(...u.slice(4,8))==='ftyp')result=readMP4(slice);
    Object.assign(meta,Object.fromEntries(Object.entries(result).filter(([k,val])=>val)));
    if(!result.title&&file.name.includes(' - ')){const parts=filename.split(' - ');meta.artist=parts.shift();meta.title=parts.join(' - ')}
  }catch(e){console.warn('Metadata:',e)}
  return meta;
}
