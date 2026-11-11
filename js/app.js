import {openDB,tracks as dbTracks,audioFiles,settings} from './store.js';
import {extractMetadata} from './tags.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state={songs:[],favorites:[],playlists:[],cloudBase:'',filter:'all',search:'',page:'library',queue:[],queueIndex:0,currentId:null,repeat:'off',shuffle:false,objectURL:null,playlistId:null,actionsId:null,theme:'dark'};
const audio=$('audio');let toastTimeout;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2900)}
const byId=id=>state.songs.find(t=>t.id===id);
const fmt=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';
const isOffline=t=>t?.origin==='local'||Boolean(t?.offline);
const art=t=>t?.cover||null;
function coverHtml(t,cls='song-cover'){const cover=art(t);return `<span class="cover ${cls}">${cover?`<img loading="lazy" src="${esc(cover)}" alt="">`:'♪'}</span>`}
function setCover(el,src){el.replaceChildren();if(src){const im=document.createElement('img');im.alt='';im.src=src;im.onerror=()=>{el.textContent='♪'};el.append(im)}else el.textContent='♪'}
function visibleSongs(){let list=state.songs.filter(t=>state.filter==='all'||state.filter==='offline'&&isOffline(t)||state.filter==='favorite'&&state.favorites.includes(t.id)||state.filter===t.origin);
  const q=state.search.trim().toLocaleLowerCase('cs');if(q)list=list.filter(t=>[t.title,t.artist,t.album].some(v=>v?.toLocaleLowerCase('cs').includes(q)));return list.sort((a,b)=>a.title.localeCompare(b.title,'cs'))}
function renderLibrary(){const list=visibleSongs();$('statTracks').textContent=state.songs.length;$('statArtists').textContent=new Set(state.songs.map(t=>t.artist)).size;$('statOffline').textContent=state.songs.filter(isOffline).length;
  $('songList').innerHTML=list.map(t=>`<div class="song-row ${state.currentId===t.id?'playing':''}"><button class="song-body" data-play="${esc(t.id)}">${coverHtml(t)}<span class="song-copy"><strong>${esc(t.title)}</strong><small>${esc(t.artist)} · ${isOffline(t)?'Offline':'Cloud'}${state.favorites.includes(t.id)?' · ♥':''}</small></span></button><button class="song-menu" data-actions="${esc(t.id)}" aria-label="Možnosti ${esc(t.title)}">⋯</button></div>`).join('');$('emptyMessage').hidden=list.length!==0;
  $('emptyMessage').textContent=state.songs.length===0?'Zatím žádná hudba. Otevři záložku Přidat a vyber skladby z aplikace Soubory.':'V této kategorii zatím nic není.';
  document.querySelectorAll('[data-filter]').forEach(c=>c.classList.toggle('selected',c.dataset.filter===state.filter));}
function renderPlaylists(){const pl=state.playlists;$('playlistList').innerHTML=pl.map(p=>`<div class="playlist-card"><div class="playlist-icon">♫</div><button class="playlist-open" data-pl="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${p.ids.length} skladeb</small></button><button class="song-menu" data-pl-actions="${esc(p.id)}" aria-label="Další možnosti">⋯</button></div>`).join('')||'<p class="empty-message">Zatím žádné playlisty. Vytvoř první a přidej do něj skladby.</p>';
  const detail=$('playlistDetails');const selected=pl.find(p=>p.id===state.playlistId);detail.hidden=!selected;if(!selected)return;
  const songs=selected.ids.map(byId).filter(Boolean);detail.innerHTML=`<div class="playlist-details-title"><h2>${esc(selected.name)}</h2><button class="text-btn" id="playPlaylist">Přehrát vše</button></div><div class="song-list">${songs.map(t=>`<div class="song-row"><button class="song-body" data-playlist-play="${esc(t.id)}">${coverHtml(t)}<span class="song-copy"><strong>${esc(t.title)}</strong><small>${esc(t.artist)}</small></span></button><button class="song-menu" data-remove-from-pl="${esc(t.id)}" aria-label="Odebrat z playlistu">×</button></div>`).join('')||'<p class="empty-message">Tento playlist je prázdný.</p>'}</div>`;
}
function renderMini(){const track=byId(state.currentId);$('miniPlayer').hidden=!track;if(!track)return;$('miniTitle').textContent=track.title;$('miniArtist').textContent=track.artist;setCover($('miniCover'),art(track));$('miniPlay').textContent=audio.paused?'▶':'Ⅱ';$('playBtn').textContent=audio.paused?'▶':'Ⅱ';$('bigTitle').textContent=track.title;$('bigArtist').textContent=track.artist;setCover($('bigCover'),art(track));$('bigFav').textContent=state.favorites.includes(track.id)?'♥':'♡';$('bigFav').classList.toggle('active',state.favorites.includes(track.id));$('shuffleBtn').classList.toggle('active',state.shuffle);$('repeatBtn').classList.toggle('active',state.repeat!=='off');$('repeatBtn').textContent=state.repeat==='one'?'↻¹':'↻';$('sourceLabel').textContent=track.origin==='local'?'V telefonu':isOffline(track)?'Staženo offline':'Cloud – online';$('downloadCurrent').textContent=track.origin==='local'?'Uloženo v telefonu':isOffline(track)?'Smazat offline':'Uložit offline';$('downloadCurrent').disabled=track.origin==='local';}
function progress(){const d=audio.duration,t=audio.currentTime;const f=d&&Number.isFinite(d)?Math.min(1,t/d):0;$('seek').value=Math.round(f*1000);$('currentTime').textContent=fmt(t);$('duration').textContent=fmt(d);$('miniProgress').style.width=(f*100)+'%';}
function nav(page){state.page=page;document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen-'+page));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));scrollTo({top:0,behavior:'instant'});if(page==='playlists')renderPlaylists();}
async function persistSong(track){await dbTracks.put(track);const i=state.songs.findIndex(t=>t.id===track.id);if(i<0)state.songs.push(track);else state.songs[i]=track;renderLibrary();}
async function savePrefs(){await settings.put('favorites',state.favorites);await settings.put('playlists',state.playlists);}
function toggleFavorite(id){const i=state.favorites.indexOf(id);if(i<0)state.favorites.push(id);else state.favorites.splice(i,1);savePrefs().catch(console.error);renderLibrary();renderMini();}
function createQueue(ids,startId){state.queue=ids.filter(id=>byId(id));state.queueIndex=state.queue.indexOf(startId);if(state.queueIndex<0){state.queue.push(startId);state.queueIndex=state.queue.length-1}}
async function playSong(id,ids=null){const track=byId(id);if(!track)return;if(ids)createQueue(ids,id);else if(!state.queue.includes(id))createQueue(visibleSongs().map(t=>t.id),id);else state.queueIndex=state.queue.indexOf(id);
  if(state.objectURL){URL.revokeObjectURL(state.objectURL);state.objectURL=null}
  try{
    let url;
    if(isOffline(track)) {const stored=await audioFiles.get(track.id);if(stored?.blob){url=URL.createObjectURL(stored.blob);state.objectURL=url}else if(track.origin==='local')throw new Error('Soubor v úložišti chybí. Naimportuj ho znovu.');}
    if(!url&&track.origin==='cloud')url=track.src;
    if(!url)throw new Error('Skladbu nelze otevřít.');
    state.currentId=track.id;audio.src=url;audio.load();renderMini();renderLibrary();
    if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:track.album||'',artwork:track.cover?[{src:track.cover}]:[]});navigator.mediaSession.playbackState='playing'}
    await audio.play();renderMini();
  }catch(e){console.error(e);toast(`Nelze přehrát: ${e.message||'neznámá chyba'}`)}
}
function pauseToggle(){if(!state.currentId)return;if(audio.paused)audio.play().catch(()=>toast('Přehrávání se nepodařilo spustit.'));else audio.pause();}
function changeSong(direction){if(!state.queue.length)return;let index=state.queueIndex;if(direction>0&&state.repeat==='one'){audio.currentTime=0;audio.play().catch(console.error);return}
  if(state.shuffle&&state.queue.length>1){let r=index;while(r===index)r=Math.floor(Math.random()*state.queue.length);index=r}
  else{index+=direction;if(index<0||index>=state.queue.length){if(state.repeat==='all')index=(index+state.queue.length)%state.queue.length;else{if(direction>0){audio.pause();audio.currentTime=0;renderMini();return}index=0}}}
  state.queueIndex=index;playSong(state.queue[index]);}
function setMediaControls(){if(!('mediaSession' in navigator))return;const commands={play:()=>audio.play(),pause:()=>audio.pause(),previoustrack:()=>changeSong(-1),nexttrack:()=>changeSong(1),seekbackward:details=>{audio.currentTime=Math.max(0,audio.currentTime-(details.seekOffset||10))},seekforward:details=>{audio.currentTime=Math.min(audio.duration||0,audio.currentTime+(details.seekOffset||10))},seekto:details=>{if(details.seekTime!=null)audio.currentTime=details.seekTime}};for(const [key,fn]of Object.entries(commands)){try{navigator.mediaSession.setActionHandler(key,fn)}catch{}}}
async function importFiles(files){if(!files.length)return;const status=$('importProgress');status.hidden=false;let success=0,errors=0;
  for(let i=0;i<files.length;i++){
    const f=files[i];status.textContent=`Importuji ${i+1}/${files.length}: ${f.name}`;
    try{if(!f.type.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(f.name))throw Error('Nepodporovaný soubor');
      const meta=await extractMetadata(f),id='local-'+crypto.randomUUID();
      // Save the audio first. If there is insufficient storage, no broken track is added.
      await audioFiles.put(id,f);await persistSong({id,...meta,origin:'local',size:f.size,offline:true,addedAt:Date.now()});success++;
    }catch(e){console.error('Import',f.name,e);errors++;}
    await new Promise(r=>setTimeout(r,0));
  }
  status.textContent=`Hotovo: ${success} skladeb přidáno${errors?`, ${errors} se nepodařilo importovat`:''}.`;toast(`${success} skladeb přidáno`);}
function normalizedBase(url){const u=new URL(url);if(!['https:','http:'].includes(u.protocol))throw Error('Použij odkaz https://');if(u.protocol==='http:'&&u.hostname!=='localhost')throw Error('Cloud musí používat HTTPS.');u.pathname=u.pathname.replace(/\/?$/,'/');u.search='';u.hash='';return u.href}
async function connectCloud(){const status=$('cloudStatus');const raw=$('cloudUrl').value.trim();if(!raw){status.textContent='Zadej adresu veřejného R2 úložiště.';return}status.textContent='Načítám cloud…';
  try{const base=normalizedBase(raw);const url=new URL('library.json',base);const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.tracks))throw Error('library.json musí obsahovat pole tracks');let added=0;
    for(const item of data.tracks){if(!item.src||!item.title)continue;const src=new URL(item.src,base);if(src.protocol!=='https:')continue;const id='cloud-'+String(item.id||item.src);const old=byId(id);
      const cover=item.cover?new URL(item.cover,base).href:null;
      await persistSong({id,title:String(item.title),artist:String(item.artist||'Neznámý interpret'),album:String(item.album||'Neznámé album'),cover,src:src.href,origin:'cloud',offline:!!old?.offline,addedAt:old?.addedAt||Date.now()});added++;
    }
    state.cloudBase=base;await settings.put('cloudBase',base);status.textContent=`Připojeno: ${added} skladeb nalezeno.`;toast(`Cloud: ${added} skladeb`);
  }catch(e){console.error(e);status.textContent='Cloud se nepodařilo načíst: '+e.message+'. Zkontroluj adresu, library.json a CORS.';toast('Připojení cloudu selhalo');}}
async function saveCloudOffline(track){if(track?.origin!=='cloud')return;const status=$('importProgress');status.hidden=false;status.textContent=`Stahuji offline: ${track.title}`;
  try{const r=await fetch(track.src);if(!r.ok)throw Error('HTTP '+r.status);const blob=await r.blob();const estimate=await navigator.storage?.estimate?.();if(estimate?.quota&&estimate?.usage+blob.size>estimate.quota)throw Error('Nedostatek volného úložiště');await audioFiles.put(track.id,blob);track.offline=true;await persistSong(track);status.textContent=`Uloženo offline: ${track.title}`;toast('Skladba je dostupná offline');renderMini();}
  catch(e){console.error(e);status.textContent='Stažení se nezdařilo: '+e.message;toast('Offline stažení selhalo. Zkontroluj CORS a místo.');}}
async function removeCloudOffline(track){if(track.origin!=='cloud'||!track.offline)return;await audioFiles.remove(track.id);track.offline=false;await persistSong(track);renderMini();toast('Offline kopie byla smazána')}
async function removeLocal(track){if(!confirm(`Opravdu smazat „${track.title}“ z aplikace?`))return;if(state.currentId===track.id){audio.pause();audio.removeAttribute('src');state.currentId=null;if(state.objectURL)URL.revokeObjectURL(state.objectURL);state.objectURL=null}
  await audioFiles.remove(track.id);await dbTracks.remove(track.id);state.songs=state.songs.filter(t=>t.id!==track.id);state.playlists.forEach(p=>p.ids=p.ids.filter(id=>id!==track.id));state.favorites=state.favorites.filter(id=>id!==track.id);await savePrefs();renderLibrary();renderPlaylists();renderMini();toast('Skladba odstraněna')}
function openActions(id){const track=byId(id);if(!track)return;state.actionsId=id;$('actionTitle').textContent=track.title;
  const buttons=[['fav',state.favorites.includes(id)?'Odebrat z oblíbených':'Přidat do oblíbených'],['playlist','Přidat do playlistu']];
  if(track.origin==='cloud')buttons.push(['offline',track.offline?'Smazat offline kopii':'Stáhnout pro offline poslech']);
  if(track.origin==='local')buttons.push(['remove','Smazat skladbu z aplikace']);
  $('actionsContainer').innerHTML=buttons.map(([a,l])=>`<button class="action-button" data-act="${a}">${esc(l)}</button>`).join('');$('actionSheet').hidden=false;}
function choosePlaylistFor(id){if(!state.playlists.length){toast('Nejdřív vytvoř playlist v záložce Playlisty.');return}const html=state.playlists.map(p=>`<button class="action-button" data-add-to="${esc(p.id)}">${esc(p.name)} ${p.ids.includes(id)?'✓':''}</button>`).join('');$('actionTitle').textContent='Přidat do playlistu';$('actionsContainer').innerHTML=html;}
async function storageStats(){const e=await navigator.storage?.estimate?.();const toGB=n=>(n/1024**3).toFixed(2)+' GB';$('storageStats').textContent=e?`${toGB(e.usage||0)} využito / ${toGB(e.quota||0)} povoleno`:'Úložiště nelze zjistit';}
function applyTheme(theme){state.theme=theme;document.documentElement.dataset.theme=theme==='system'&&matchMedia('(prefers-color-scheme:light)').matches?'light':theme;$('themeSelect').value=theme;}
function dumpBackup(){const payload={version:1,favorites:state.favorites,playlists:state.playlists,date:new Date().toISOString()};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='moje-hudba-playlisty.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function restoreBackup(file){try{const data=JSON.parse(await file.text());if(!Array.isArray(data.favorites)||!Array.isArray(data.playlists))throw Error('Neplatný soubor');state.favorites=data.favorites.filter(v=>typeof v==='string');state.playlists=data.playlists.filter(v=>typeof v.name==='string'&&Array.isArray(v.ids)).map(v=>({id:String(v.id||crypto.randomUUID()),name:v.name.slice(0,100),ids:v.ids.filter(id=>typeof id==='string')}));await savePrefs();renderLibrary();renderPlaylists();toast('Playlisty a oblíbené obnoveny. Audio soubory je nutné mít v knihovně.')}
  catch(e){toast('Nelze obnovit zálohu: '+e.message)}}
function setHandlers(){
  document.querySelectorAll('.nav-item').forEach(x=>x.addEventListener('click',()=>nav(x.dataset.page)));
  $('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderLibrary()});
  $('filterChips').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){state.filter=b.dataset.filter;renderLibrary()}});
  $('songList').addEventListener('click',e=>{const p=e.target.closest('[data-play]'),a=e.target.closest('[data-actions]');if(p)playSong(p.dataset.play,visibleSongs().map(t=>t.id));if(a)openActions(a.dataset.actions)});
  $('shuffleAll').addEventListener('click',()=>{const list=visibleSongs();if(list.length){state.shuffle=true;playSong(list[Math.floor(Math.random()*list.length)].id,list.map(t=>t.id))}});
  $('addMusicTop').addEventListener('click',()=>nav('import'));
  $('pickFiles').addEventListener('click',()=>$('fileInput').click());
  $('fileInput').addEventListener('change',e=>{importFiles([...e.target.files]);e.target.value=''});
  $('connectCloud').addEventListener('click',connectCloud);
  $('createPlaylist').addEventListener('click',async()=>{const name=prompt('Název nového playlistu:');if(!name?.trim())return;state.playlists.push({id:crypto.randomUUID(),name:name.trim().slice(0,100),ids:[]});await savePrefs();renderPlaylists();toast('Playlist vytvořen')});
  $('playlistList').addEventListener('click',async e=>{const open=e.target.closest('[data-pl]'),menu=e.target.closest('[data-pl-actions]');if(open){state.playlistId=open.dataset.pl;renderPlaylists();$('playlistDetails').scrollIntoView({block:'nearest',behavior:'smooth'})}if(menu){const pl=state.playlists.find(p=>p.id===menu.dataset.plActions);if(!pl)return;const name=prompt('Přejmenovat playlist (prázdné = odstranit):',pl.name);if(name===null)return;if(!name.trim()){if(!confirm('Opravdu smazat playlist?'))return;state.playlists=state.playlists.filter(p=>p.id!==pl.id);if(state.playlistId===pl.id)state.playlistId=null}else pl.name=name.trim().slice(0,100);await savePrefs();renderPlaylists()}});
  $('playlistDetails').addEventListener('click',async e=>{const pl=state.playlists.find(p=>p.id===state.playlistId);if(!pl)return;const play=e.target.closest('[data-playlist-play]'),remove=e.target.closest('[data-remove-from-pl]');if(play)playSong(play.dataset.playlistPlay,pl.ids.filter(byId));if(remove){pl.ids=pl.ids.filter(id=>id!==remove.dataset.removeFromPl);await savePrefs();renderPlaylists()}if(e.target.closest('#playPlaylist')&&pl.ids.length)playSong(pl.ids.find(byId),pl.ids.filter(byId))});
  $('closeActions').addEventListener('click',()=>$('actionSheet').hidden=true);
  $('actionsContainer').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const id=state.actionsId,track=byId(id);if(!track)return;
    const act=b.dataset.act;if(act==='playlist'){choosePlaylistFor(id);return}
    if(b.dataset.addTo){const pl=state.playlists.find(p=>p.id===b.dataset.addTo);if(pl&&!pl.ids.includes(id)){pl.ids.push(id);await savePrefs();toast('Přidáno do playlistu')}else toast('Skladba už je v playlistu');renderPlaylists()}
    if(act==='fav')toggleFavorite(id);if(act==='offline')track.offline?await removeCloudOffline(track):await saveCloudOffline(track);if(act==='remove')await removeLocal(track);$('actionSheet').hidden=true;
  });
  $('miniPlay').addEventListener('click',pauseToggle);$('miniPrev').addEventListener('click',()=>changeSong(-1));$('miniNext').addEventListener('click',()=>changeSong(1));$('openNowPlaying').addEventListener('click',()=>{if(state.currentId)$('playerModal').hidden=false});$('closePlayer').addEventListener('click',()=>$('playerModal').hidden=true);
  $('prevBtn').addEventListener('click',()=>{if(audio.currentTime>3)audio.currentTime=0;else changeSong(-1)});$('nextBtn').addEventListener('click',()=>changeSong(1));$('playBtn').addEventListener('click',pauseToggle);
  $('seek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/1000});
  $('shuffleBtn').addEventListener('click',()=>{state.shuffle=!state.shuffle;renderMini()});$('repeatBtn').addEventListener('click',()=>{state.repeat=state.repeat==='off'?'all':state.repeat==='all'?'one':'off';renderMini()});
  $('bigFav').addEventListener('click',()=>{if(state.currentId)toggleFavorite(state.currentId)});$('playerMore').addEventListener('click',()=>{if(state.currentId)openActions(state.currentId)});
  $('downloadCurrent').addEventListener('click',async()=>{const track=byId(state.currentId);if(track?.origin!=='cloud')return;if(track.offline)await removeCloudOffline(track);else await saveCloudOffline(track)});
  audio.addEventListener('play',()=>{renderMini();if(navigator.mediaSession)navigator.mediaSession.playbackState='playing'});audio.addEventListener('pause',()=>{renderMini();if(navigator.mediaSession)navigator.mediaSession.playbackState='paused'});audio.addEventListener('timeupdate',progress);audio.addEventListener('loadedmetadata',progress);audio.addEventListener('ended',()=>changeSong(1));audio.addEventListener('error',()=>{if(state.currentId)toast('Audio soubor nelze přehrát. Zkus jiný formát nebo zkontroluj cloud.')});
  $('settingsBtn').addEventListener('click',()=>{$('settingsModal').hidden=false;storageStats()});$('closeSettings').addEventListener('click',()=>$('settingsModal').hidden=true);
  $('themeSelect').addEventListener('change',async e=>{applyTheme(e.target.value);await settings.put('theme',e.target.value)});$('refreshStorage').addEventListener('click',storageStats);
  $('exportBackup').addEventListener('click',dumpBackup);$('importBackup').addEventListener('click',()=>$('backupInput').click());$('backupInput').addEventListener('change',e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value=''});
  $('clearOffline').addEventListener('click',async()=>{if(!confirm('Smazat VEŠKERÉ skladby uložené lokálně a offline kopie cloudových skladeb? V cloudu zůstanou.'))return;audio.pause();audio.removeAttribute('src');state.currentId=null;if(state.objectURL)URL.revokeObjectURL(state.objectURL);state.objectURL=null;await audioFiles.clear();for(const t of state.songs.filter(t=>t.origin==='cloud'&&t.offline)){t.offline=false;await dbTracks.put(t)}for(const t of state.songs.filter(t=>t.origin==='local'))await dbTracks.remove(t.id);state.songs=state.songs.filter(t=>t.origin!=='local');renderLibrary();renderPlaylists();renderMini();storageStats();toast('Lokální audio bylo smazáno')});
  document.querySelectorAll('.overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.hidden=true}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.overlay').forEach(x=>x.hidden=true)});
}
async function init(){setHandlers();setMediaControls();try{
  await openDB();state.songs=await dbTracks.all();state.favorites=await settings.get('favorites',[]);state.playlists=await settings.get('playlists',[]);state.cloudBase=await settings.get('cloudBase','');$('cloudUrl').value=state.cloudBase;applyTheme(await settings.get('theme','dark'));renderLibrary();renderPlaylists();
  if(state.cloudBase){$('cloudStatus').textContent='Poslední připojený cloud: '+state.cloudBase}
  if(navigator.storage?.persist){navigator.storage.persist().catch(()=>{})}
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
}catch(e){console.error(e);toast('Lokální úložiště nelze otevřít. Zkontroluj režim soukromého prohlížení.')}}
init();
