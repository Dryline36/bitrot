/* BIT ROT: ROT YOURSELF (client-side glitch tool) + ROT METER (shared decay meter, server: Supabase fn bitrot-rot).
   Everything here runs in the visitor's browser. The glitch tool never uploads anything. */
(function(){
const CFG=window.BITROT_CONFIG||{};
const $=id=>document.getElementById(id);
const S=()=>window.SFX||{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
const PK=[255,31,143],MG=[194,24,91];

/* ================= glitch engine (shared) ================= */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}
/** src: ImageData (w x h). p: {drift,split,tear,melt,static} 0..100. f: frame index. returns new ImageData */
function glitch(src,p,f,seed,ctx){
  const w=src.width,h=src.height,R=rng(seed+f*7919+1),sc=w/512;
  let a=new Uint32Array(src.data.buffer.slice(0)),b=new Uint32Array(a.length);
  const wob=Math.sin(f/8*Math.PI*2);
  // DRIFT: chunky row bands slide sideways
  if(p.drift>0){b.set(a);const n=2+Math.round(p.drift/9),blk=Math.max(2,Math.round(4*sc));
    for(let k=0;k<n;k++){const y0=Math.floor(R()*h),bh=Math.max(blk,Math.floor((4+R()*(6+p.drift*.7))*sc));
      let dx=Math.round(((R()-.5)*p.drift*2.6+wob*p.drift*.25)*sc/blk)*blk;dx=((dx%w)+w)%w;
      for(let y=y0;y<Math.min(h,y0+bh);y++){const o=y*w;for(let x=0;x<w;x++)b[o+x]=a[o+(x+dx)%w]}}
    [a,b]=[b,a]}
  // MELT: columns drip downward
  if(p.melt>0){const cw=Math.max(2,Math.round(4*sc)),prob=p.melt/100*.75,grow=.55+.45*Math.sin(f/8*Math.PI*2-1.2);
    for(let x0=0;x0<w;x0+=cw){if(R()>prob)continue;const y0=Math.floor(R()*h*.75),len=Math.floor((20+R()*p.melt*3.4)*sc*grow);
      for(let x=x0;x<Math.min(w,x0+cw);x++){const c=a[y0*w+x];for(let y=y0+1;y<Math.min(h,y0+len);y++){
        const t=(y-y0)/len;if(R()<t*.04)break;a[y*w+x]=t>.85?((c&0xff000000)|((c>>>1)&0x7f7f7f)):c}}}}
  // TEAR: hard horizontal scanline rips with pink bleed
  if(p.tear>0){b.set(a);const n=Math.round(p.tear/11)+(f%3===0?1:0);
    for(let k=0;k<n;k++){const y0=Math.floor(R()*h),th=Math.max(1,Math.floor((1+R()*(2+p.tear/6))*sc));
      const dx=((Math.round((R()-.5)*p.tear*6*sc))%w+w)%w,tint=R()<.5,inv=R()<.15;
      for(let y=y0;y<Math.min(h,y0+th);y++){const o=y*w;for(let x=0;x<w;x++){let c=a[o+(x+dx)%w];
        if(inv)c=(c&0xff000000)|(~c&0xffffff);
        else if(tint){const r=c&255,g=c>>8&255,bb=c>>16&255;c=(c&0xff000000)|(((bb*.5+PK[2]*.5)|0)<<16)|(((g*.5+PK[1]*.5)|0)<<8)|((r*.5+PK[0]*.5)|0)}
        b[o+x]=c}}}
    [a,b]=[b,a]}
  // SPLIT: RGB channel offset
  if(p.split>0){const dx=Math.round((p.split/100*26*(.75+.25*wob))*sc),dy=Math.round(p.split/100*3*sc*(f%2?1:-1));
    for(let y=0;y<h;y++){const yr=Math.min(h-1,Math.max(0,y-dy)),o=y*w,orr=yr*w;for(let x=0;x<w;x++){
      const cr=a[orr+Math.max(0,x-dx)],cb=a[o+Math.min(w-1,x+dx)],c=a[o+x];
      b[o+x]=(c&0xff00ff00)|(cr&255)|(cb&0xff0000)}}
    [a,b]=[b,a]}
  // STATIC: chunky pink / white / black noise
  if(p.static>0){const blk=Math.max(2,Math.round(2*sc)),prob=p.static/100*.22;
    for(let y=0;y<h;y+=blk)for(let x=0;x<w;x+=blk){if(R()>prob)continue;const q=R();
      const c=q<.5?(255<<24|PK[2]<<16|PK[1]<<8|PK[0]):q<.75?0xffffffff:q<.9?0xff0a0a0a:(255<<24|MG[2]<<16|MG[1]<<8|MG[0]);
      for(let yy=y;yy<Math.min(h,y+blk);yy++)for(let xx=x;xx<Math.min(w,x+blk);xx++)a[yy*w+xx]=c}}
  return new ImageData(new Uint8ClampedArray(a.buffer),w,h);
}

/* ================= ROT YOURSELF ================= */
(function(){
  const cv=$('gtc');if(!cv)return;const cx=cv.getContext('2d',{willReadFrequently:true});const N=512,FRAMES=8,DELAY=110;
  const src=document.createElement('canvas');src.width=src.height=N;const sx=src.getContext('2d',{willReadFrequently:true});
  let base=null,cache=[],seed=(Math.random()*1e9)|0,fi=0,hasUser=false;
  const P={};document.querySelectorAll('.gt-sl input').forEach(i=>{P[i.dataset.k]=+i.value;paintSl(i);
    i.addEventListener('input',()=>{P[i.dataset.k]=+i.value;paintSl(i);cache=[];S().knob?.()})});
  function paintSl(i){i.style.setProperty('--v',i.value+'%')}
  function setImg(img){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,s=Math.max(N/iw,N/ih);
    sx.fillStyle='#0a0a0a';sx.fillRect(0,0,N,N);sx.imageSmoothingEnabled=true;sx.drawImage(img,(N-iw*s)/2,(N-ih*s)/2,iw*s,ih*s);
    base=sx.getImageData(0,0,N,N);cache=[]}
  const msg=t=>{$('gtmsg').textContent=t};
  const ph=new Image();ph.onload=()=>{if(!hasUser)setImg(ph)};ph.src='assets/2389.gif';
  async function load(file){if(!file)return;if(!/^image\//.test(file.type)&&!/\.(png|jpe?g|gif|webp|heic|avif)$/i.test(file.name)){msg('THAT IS NOT AN IMAGE.');return}
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{hasUser=true;setImg(img);URL.revokeObjectURL(url);$('gtdrop').classList.add('done');msg('ROTTING YOUR PFP. SAVE IT, THEN ATTACH IT TO YOUR POST.');S().rot?.()};
    img.onerror=()=>{URL.revokeObjectURL(url);msg('COULD NOT READ THAT IMAGE. TRY A PNG OR JPG.')};img.src=url}
  $('gtfile').addEventListener('change',e=>{load(e.target.files[0]);e.target.value=''});
  const drop=$('gtdrop').parentElement;
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>load(e.dataTransfer?.files?.[0]));
  const frame=i=>cache[i]||(cache[i]=glitch(base,P,i,seed));
  let lastT=0,vis=true;
  new IntersectionObserver(es=>{vis=es[0].isIntersecting}).observe(cv);
  (function loop(t){requestAnimationFrame(loop);if(!base||!vis||t-lastT<DELAY)return;lastT=t;fi=(fi+1)%FRAMES;cx.putImageData(frame(fi),0,0)})(0);
  $('gtrot').onclick=()=>{const r=()=>Math.round(Math.random()**.8*100);
    document.querySelectorAll('.gt-sl input').forEach(i=>{i.value=r();P[i.dataset.k]=+i.value;paintSl(i)});seed=(Math.random()*1e9)|0;cache=[];
    cv.parentElement.classList.remove('hit');void cv.offsetWidth;cv.parentElement.classList.add('hit');S().rot?.()};
  function stamp(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')}
  async function deliver(blob,name){const file=new File([blob],name,{type:blob.type});
    const mobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(mobile&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return 'shared'}catch(e){if(e?.name==='AbortError')return 'cancel'}}
    const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return 'saved'}
  $('gtpng').onclick=async()=>{if(!base)return;S().save?.();const c=document.createElement('canvas');c.width=c.height=N;c.getContext('2d').putImageData(frame(fi),0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));const r=await deliver(b,`bitrot-rotted-${stamp()}.png`);if(r!=='cancel')msg('PNG SAVED. NOW POST IT ON X.')};
  let busy=false;
  $('gtgif').onclick=async()=>{if(!base||busy)return;busy=true;const btn=$('gtgif');btn.disabled=true;btn.textContent='ENCODING...';S().save?.();
    try{const g=await import('./vendor/gifenc.esm.js');const enc=g.GIFEncoder();
      for(let i=0;i<FRAMES;i++){const d=frame(i).data;const pal=g.quantize(d,256,{format:'rgb565'});const idx=g.applyPalette(d,pal,'rgb565');enc.writeFrame(idx,N,N,{palette:pal,delay:DELAY});await sleep(0)}
      enc.finish();const r=await deliver(new Blob([enc.bytes()],{type:'image/gif'}),`bitrot-rotted-${stamp()}.gif`);if(r!=='cancel')msg('GIF SAVED. NOW POST IT ON X.')}
    catch(e){console.error(e);msg('GIF FAILED. TRY SAVE PNG.')}
    finally{busy=false;btn.disabled=false;btn.textContent='SAVE GIF'}};
  $('gtx').onclick=()=>{const site=location.origin+location.pathname.replace(/index\.html$/,'');
    const text=`I just got rotted. #BITROT @Theprixxxxx\n${site}`;
    window.open('https://x.com/intent/post?text='+encodeURIComponent(text),'_blank','noopener');msg('ATTACH THE GIF OR PNG YOU SAVED TO THE POST.')};
})();

/* ================= ROT METER ================= */
(function(){
  const rm=$('rm');if(!rm||!CFG.ROT_API)return;
  const API=CFG.ROT_API,KEY='bitrot.rot.wallet.v1',GOAL_DEF=7;
  let st=null,off=0,wallet=null,prov=null,feeding=false,wasDead=null;
  try{const w=localStorage.getItem(KEY);if(/^0x[0-9a-f]{40}$/.test(w||''))wallet=w}catch(e){}
  const short=a=>a.slice(0,4)+'..'+a.slice(-2);
  const status=(t,cls='')=>{$('rmmsg').innerHTML=t;$('rmmsg').className='walmsg'+(cls?' '+cls:'')};
  const level=()=>{if(!st)return null;const dt=(Date.now()+off-Date.parse(st.server_time))/3600e3;return Math.max(0,Math.min(100,st.level-st.decay_per_hour*dt))};
  async function load(){try{const r=await fetch(API+(wallet?'?wallet='+wallet:''),{cache:'no-store'});const b=await r.json();if(b&&typeof b.level==='number'){st=b;off=Date.parse(b.server_time)-Date.now();paint()}}
    catch(e){$('rminfo').textContent='THE METER IS UNREACHABLE. TRY AGAIN SOON.'}}
  const ago=t=>{if(!t)return 'NEVER';const m=Math.max(0,(Date.now()+off-Date.parse(t))/60e3);return m<1?'JUST NOW':m<60?Math.floor(m)+'M AGO':m<1440?Math.floor(m/60)+'H AGO':Math.floor(m/1440)+'D AGO'};
  function paint(){if(!st)return;const L=level(),goal=st.streak_goal||GOAL_DEF;
    $('rmfill').style.width=L.toFixed(2)+'%';$('rmpct').textContent=(L<10?L.toFixed(1):Math.floor(L))+'%';
    const dead=L<=0;rm.classList.toggle('dead',dead);rm.classList.toggle('low',L>0&&L<25);
    if(wasDead===false&&dead)S().flat?.();wasDead=dead;
    $('rminfo').textContent=dead?'FLATLINED. FEED IT TO BRING IT BACK.':`DRAINS ${+st.decay_per_hour}% AN HOUR // EACH FEED +${+st.feed_amount}% // FED ${st.total_feeds} TIMES // LAST FED ${ago(st.last_fed_at)}`;
    const w=st.wallet&&wallet&&st.wallet.wallet===wallet?st.wallet:null,n=w?Math.min(goal,w.streak):0;
    $('rmstreak').textContent=`YOUR STREAK: ${w?w.streak:0}/${goal}`;
    const pips=$('rmpips');if(pips.children.length!==goal){pips.innerHTML='';for(let i=0;i<goal;i++)pips.appendChild(document.createElement('i'))}
    [...pips.children].forEach((p,i)=>p.classList.toggle('on',i<n));
    $('rmwl').hidden=!(w&&w.wl_eligible);
    const fb=$('rmfeed');
    if(!wallet){fb.disabled=true;fb.textContent='FEED THE ROT';$('rmnext').textContent='CONNECT A WALLET TO FEED IT';return}
    if(w&&w.fed_today){fb.disabled=true;fb.textContent='FED TODAY';const ms=Date.parse(st.today+'T00:00:00Z')+86400e3-(Date.now()+off);
      const hh=Math.max(0,Math.floor(ms/3600e3)),mm=Math.max(0,Math.floor(ms/60e3)%60),ss=Math.max(0,Math.floor(ms/1e3)%60);
      $('rmnext').textContent=`NEXT FEED IN ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
      if(ms<=0&&!feeding){st.wallet.fed_today=false;load()}}
    else{fb.disabled=feeding;fb.textContent=feeding?'FEEDING...':'FEED THE ROT';$('rmnext').textContent=w&&w.streak>0?'FEED BEFORE 00:00 UTC TO KEEP YOUR STREAK':'START YOUR STREAK TODAY'}}
  setInterval(paint,1000);setInterval(load,60e3);
  /* background art, corrupted by how far the meter has dropped */
  const cv=$('rmc'),cx=cv.getContext('2d',{willReadFrequently:true}),art=new Image();let base=null,fi=0,seed=(Math.random()*1e9)|0,vis=true;
  art.onload=()=>{const c=document.createElement('canvas');c.width=c.height=384;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=false;x.drawImage(art,0,0,384,384);base=x.getImageData(0,0,384,384)};art.src='assets/300.gif';
  new IntersectionObserver(es=>{vis=es[0].isIntersecting}).observe(cv);
  let lt=0;(function loop(t){requestAnimationFrame(loop);if(!base||!vis||t-lt<120)return;lt=t;fi++;
    const L=level()??100,r=Math.pow(1-L/100,.8),dead=L<=0;if(fi%24===0)seed=(Math.random()*1e9)|0;
    const k=dead?1.6:r;const p={drift:Math.min(100,k*70),split:Math.min(100,6+k*55),tear:Math.min(100,k*65),melt:Math.min(100,k*80),static:Math.min(100,3+k*(dead?75:40))};
    cx.putImageData(glitch(base,p,fi%8,seed+(dead?fi:0)),0,0)})(0);

  /* wallets: shared picker in wallets.js */
  const W=window.BRWallets,isMobile=W.isMobile,userRejected=W.userRejected;
  function setWallet(a){wallet=a?a.toLowerCase():null;try{wallet?localStorage.setItem(KEY,wallet):localStorage.removeItem(KEY)}catch(e){}
    $('rmconnect').hidden=!!wallet;$('rmaddr').hidden=!wallet;$('rmdisc').hidden=!wallet;if(wallet)$('rmaddr').textContent=short(wallet);paint()}
  async function connect(){try{const r=await W.connect({status,hash:'#meter'});if(!r)return null;const p=r.p;
      prov={p,kind:r.kind};p.on?.('accountsChanged',acc=>{if(wallet&&acc?.[0]&&acc[0].toLowerCase()!==wallet){prov=null;setWallet(acc[0]);load()}});
      setWallet(r.a);status('CONNECTED. FEED IT ONCE A DAY.');await load();return prov}
    catch(e){status(userRejected(e)?'REQUEST CANCELLED IN WALLET.':'COULD NOT CONNECT: '+String(e?.message||e).slice(0,80).toUpperCase());return null}}
  $('rmconnect').onclick=()=>connect();
  $('rmdisc').onclick=()=>{try{prov?.kind==='wc'&&W.wcDisconnect()}catch(e){}prov=null;setWallet(null);status('DISCONNECTED.')};
  const ERR={already_fed:'ALREADY FED TODAY. COME BACK AFTER 00:00 UTC.',message_expired:'THAT SIGNATURE EXPIRED. TRY AGAIN.',bad_signature:'SIGNATURE DID NOT MATCH THIS WALLET.',bad_origin:'FEEDING IS NOT ALLOWED FROM THIS ADDRESS.',server_error:'THE ROT CHOKED. TRY AGAIN.'};
  $('rmfeed').onclick=async()=>{if(feeding||!wallet)return;feeding=true;paint();
    try{if(!prov){const p=W.wcSession?null:await W.remembered(800),a=p&&await W.acctNow(p);if(a&&a.toLowerCase()===wallet)prov={p,kind:'injected'};
        else if(W.wcSession&&W.wc.accounts?.[0]?.toLowerCase()===wallet)prov={p:W.wc,kind:'wc'};else if(!await connect())return}
      const day=new Date(Date.now()+off).toISOString().slice(0,10);
      const message=`BIT ROT: FEED THE ROT\nWallet: ${wallet}\nDay: ${day}\nNonce: ${hex(crypto.getRandomValues(new Uint8Array(12)))}\nIssued At: ${new Date(Date.now()+off).toISOString()}\n\nFree signature. No transaction, no gas.`;
      status('SIGN THE FREE MESSAGE IN YOUR WALLET (NO GAS)');if(prov.kind==='wc'&&isMobile())W.openLink(W.walletReturn(prov.p));
      const signature=await prov.p.request({method:'personal_sign',params:['0x'+hex(new TextEncoder().encode(message)),wallet]});
      status('FEEDING...');const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,signature})});const b=await r.json().catch(()=>({}));
      if(typeof b.level==='number'){st=b;off=Date.parse(b.server_time)-Date.now()}
      if(b.ok){S().feed?.();rm.classList.remove('fed');void rm.offsetWidth;rm.classList.add('fed');const s=b.wallet||{};
        status(s.wl_eligible&&s.streak===(b.streak_goal||GOAL_DEF)?'7 DAYS STRAIGHT. YOUR WALLET IS ON THE WL.':`FED. +${+b.feed_amount}%. STREAK ${s.streak}/${b.streak_goal||GOAL_DEF}.`,'has')}
      else{S().deny?.();status(ERR[b.error]||'COULD NOT FEED: '+String(b.error||r.status).toUpperCase())}}
    catch(e){status(userRejected(e)?'SIGNATURE CANCELLED.':'COULD NOT FEED: '+String(e?.message||e).slice(0,80).toUpperCase())}
    finally{feeding=false;paint()}};
  setWallet(wallet);load();
})();
})();
