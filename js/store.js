const DB='moje-hudba-v1', VERSION=1;
let connection;
export function openDB(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks',{keyPath:'id'});
      if(!db.objectStoreNames.contains('audio')) db.createObjectStore('audio',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>resolve(req.result);
  });return connection;
}
async function op(store,mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const s=tx.objectStore(store);let result;const r=fn(s);if(r){r.onsuccess=()=>{result=r.result};r.onerror=()=>reject(r.error)}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('Databáze není dostupná'));tx.onabort=()=>reject(tx.error||new Error('Operace byla přerušena'));});}
export const tracks={all:()=>op('tracks','readonly',s=>s.getAll()),put:t=>op('tracks','readwrite',s=>s.put(t)),remove:id=>op('tracks','readwrite',s=>s.delete(id)),clear:()=>op('tracks','readwrite',s=>s.clear())};
export const audioFiles={get:id=>op('audio','readonly',s=>s.get(id)),put:(id,blob)=>op('audio','readwrite',s=>s.put({id,blob})),remove:id=>op('audio','readwrite',s=>s.delete(id)),clear:()=>op('audio','readwrite',s=>s.clear())};
export const settings={get:async (k,fallback)=>{const v=await op('settings','readonly',s=>s.get(k));return v?.value??fallback},put:(key,value)=>op('settings','readwrite',s=>s.put({key,value}))};
