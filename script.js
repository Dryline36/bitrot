/* BIT ROT site script.
   SPIN THE ROT is enforced SERVER-SIDE by the Supabase Edge Function `bitrot-spin` (see BITROT_API below):
   wallet signature check, 3 spins per wallet per UTC day, one WL win per wallet ever, odds rolled on the server.
   The browser only animates the reels the server returns. hasWalletWon(address) / recordWin(data) call it. */
const P=[["300.gif", 300, "rot king", "hexborn", "HEXBORN"], ["2048.gif", 2048, "soot tusked stoker", "hexborn", "HEXBORN"], ["2870.gif", 2870, "prom king bones", "hexborn", "HEXBORN"], ["3911.gif", 3911, "fanged count", "hexborn", "HEXBORN"], ["429.gif", 429, "see through skull sy", "the-hollowed", "THE HOLLOWED"], ["1932.gif", 1932, "bone antler hermit", "the-hollowed", "THE HOLLOWED"], ["2471.gif", 2471, "synthwave skull", "the-hollowed", "THE HOLLOWED"], ["3961.gif", 3961, "ghost story kid", "the-hollowed", "THE HOLLOWED"], ["323.gif", 323, "club bouncer", "static-choir", "STATIC CHOIR"], ["1761.gif", 1761, "street musician", "static-choir", "STATIC CHOIR"], ["3146.gif", 3146, "mime silent", "static-choir", "STATIC CHOIR"], ["3983.gif", 3983, "music box dancer", "static-choir", "STATIC CHOIR"], ["16.gif", 16, "anglerfish man", "glitch-brood", "GLITCH BROOD"], ["1222.gif", 1222, "dragon scale drina", "glitch-brood", "GLITCH BROOD"], ["2389.gif", 2389, "gamer wraith", "glitch-brood", "GLITCH BROOD"], ["3411.gif", 3411, "crypto grandma", "glitch-brood", "GLITCH BROOD"], ["105.gif", 105, "storm cloud stu", "stormblight", "STORMBLIGHT"], ["1192.gif", 1192, "twisted desert jos", "stormblight", "STORMBLIGHT"], ["2128.gif", 2128, "ice delivery man", "stormblight", "STORMBLIGHT"], ["4113.gif", 4113, "under the weather", "stormblight", "STORMBLIGHT"], ["374.gif", 374, "hotdog vendor", "gutter-folk", "GUTTER FOLK"], ["1868.gif", 1868, "horse milk seller", "gutter-folk", "GUTTER FOLK"], ["2915.gif", 2915, "the family doctor", "gutter-folk", "GUTTER FOLK"], ["3512.gif", 3512, "nebula painter", "gutter-folk", "GUTTER FOLK"], ["47.gif", 47, "cracked carla", "drip-saints", "DRIP SAINTS"], ["1161.gif", 1161, "inky dripping inka", "drip-saints", "DRIP SAINTS"], ["3609.gif", 3609, "cracked well digger", "drip-saints", "DRIP SAINTS"], ["4154.gif", 4154, "cracked smile cyrus", "drip-saints", "DRIP SAINTS"]];
const C=[["hexborn", "HEXBORN", "Demons, cultists and rotten royalty. Horns, halos, crowns.", 659, "300.gif"], ["the-hollowed", "THE HOLLOWED", "The dead that won't stay down. Skulls and void eyes.", 601, "429.gif"], ["static-choir", "STATIC CHOIR", "Noise freaks, punks and performers. Signal arcs and broken speakers.", 522, "323.gif"], ["glitch-brood", "GLITCH BROOD", "Machines, aliens, degens and mutant creatures.", 527, "16.gif"], ["stormblight", "STORMBLIGHT", "Weathered by frost, smoke, mud and sparks.", 637, "105.gif"], ["gutter-folk", "GUTTER FOLK", "The working stiffs of the rot. Every job, every shift.", 637, "374.gif"], ["drip-saints", "DRIP SAINTS", "Cracked, sweating, melting misfits. Holy and leaking.", 637, "47.gif"]];

const cv=document.getElementById('noise'),cx=cv.getContext('2d');
function rs(){cv.width=innerWidth/2;cv.height=innerHeight/2}rs();addEventListener('resize',rs);
setInterval(()=>{const w=cv.width,h=cv.height,im=cx.createImageData(w,h),a=im.data;
for(let i=0;i<a.length;i+=4){const r=Math.random();if(r<.12){const v=r*600;a[i]=v;a[i+1]=v*.4;a[i+2]=v*.6;a[i+3]=r<.004?255:90}}
cx.putImageData(im,0,0)},70);


/* ---------- lightbox ---------- */
const lb=document.getElementById('lb');
function openLB(f,n,name,cl){lb.querySelector('img').src='assets/'+f;lb.querySelector('p').textContent=`#${n} ${name} // ${cl}`;lb.classList.add('open')}
lb.onclick=()=>lb.classList.remove('open');

/* ---------- clan cards (no counts: supply TBD) ---------- */
const cw=document.getElementById('clangrid');
C.forEach(([s,n,id,c,f])=>{const d=document.createElement('div');d.className='clan';
d.innerHTML=`<img loading="lazy" src="assets/${f}" width="240" height="240" alt="${n}"><h3>${n}</h3><p>${id}</p>`;
d.onclick=()=>{setFilter(s);document.getElementById('gallery').scrollIntoView()};cw.appendChild(d)});

/* ---------- carousel ---------- */
const rows=[...document.querySelectorAll('#car .row')];
const car=document.getElementById('car');
let filter='all',paused=false,dragging=null;
const st=rows.map(r=>({el:r,tr:r.querySelector('.track'),dir:+r.dataset.dir,x:0,w:0,v:0}));
function cardEl([f,n,name,e,cl]){const d=document.createElement('div');d.className='card';
d.innerHTML=`<img src="assets/${f}" width="240" height="240" alt="#${n} ${name}" draggable="false"><p>#${n} ${name}<span class="ctag">${cl}</span></p>`;
d.addEventListener('click',ev=>{if(car.dataset.moved==='1'){ev.preventDefault();return}openLB(f,n,name,cl)});return d}
function build(){
  let items=P.filter(p=>filter==='all'||p[3]===filter);
  st.forEach((s,i)=>{
    let list=filter==='all'?items.filter((_,j)=>j%2===i):(i===0?items:[...items].reverse());
    s.tr.innerHTML='';
    const one=document.createDocumentFragment();list.forEach(p=>one.appendChild(cardEl(p)));s.tr.appendChild(one);
    // repeat until wide enough to loop seamlessly
    const base=[...s.tr.children];let reps=0;
    while((reps<1||s.tr.scrollWidth<innerWidth*2+800)&&reps<12){base.forEach(c=>{const k=c.cloneNode(true);const p=list[base.indexOf(c)];k.addEventListener('click',ev=>{if(car.dataset.moved==='1'){ev.preventDefault();return}openLB(p[0],p[1],p[2],p[4])});s.tr.appendChild(k)});reps++}
    s.w=s.tr.scrollWidth/(reps+1); s.x=s.dir>0?0:-s.w; s.tr.classList.remove('flick');void s.tr.offsetWidth;s.tr.classList.add('flick');
  });
}
function setFilter(f){filter=f;document.querySelectorAll('.filters button').forEach(b=>b.classList.toggle('on',b.dataset.e===f));build()}
document.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>setFilter(b.dataset.e));
const SPEED=40; // px per second
let last=performance.now();
function tick(t){const dt=Math.min(.05,(t-last)/1000);last=t;
  st.forEach(s=>{if(!s.w)return;
    if(!paused&&!dragging) s.x-=s.dir*SPEED*dt;
    s.x+=s.v; s.v*=.88; if(Math.abs(s.v)<.05)s.v=0;
    while(s.x<=-s.w)s.x+=s.w; while(s.x>0)s.x-=s.w;
    s.tr.style.transform=`translate3d(${s.x}px,0,0)`});
  requestAnimationFrame(tick)}
requestAnimationFrame(tick);
car.addEventListener('mouseenter',()=>paused=true);car.addEventListener('mouseleave',()=>paused=false);
let resumeT;
rows.forEach((r,i)=>{
  r.addEventListener('pointerdown',e=>{dragging={i,x0:e.clientX,lx:e.clientX,moved:false};car.dataset.moved='0';paused=true;clearTimeout(resumeT)});
});
addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragging.lx;dragging.lx=e.clientX;
  if(Math.abs(e.clientX-dragging.x0)>6){dragging.moved=true;car.dataset.moved='1'}
  st[dragging.i].x+=dx;st[dragging.i].v=dx*.5});
addEventListener('pointerup',()=>{if(!dragging)return;dragging=null;resumeT=setTimeout(()=>{if(!car.matches(':hover'))paused=false},2500);setTimeout(()=>car.dataset.moved='0',30)});
car.querySelector('.prev').onclick=e=>{e.stopPropagation();st.forEach(s=>s.v+=18)};
car.querySelector('.next').onclick=e=>{e.stopPropagation();st.forEach(s=>s.v-=18)};
addEventListener('resize',()=>{clearTimeout(window._rb);window._rb=setTimeout(build,250)});
build();

/* ---------- SPIN THE ROT (server-rolled, wallet-gated) ---------- */
const CFG=window.BITROT_CONFIG||{};
const SYM=C.map(c=>c[4]), MAX_SPINS=3, SESS='bitrot.wallet.session.v1', SESSION_TTL=12*3600e3;
const $=id=>document.getElementById(id);
const reels=[...document.querySelectorAll('.reel img')];
const spinBtn=$('spin'),msg=$('slotmsg'),left=$('spinsleft'),winBox=$('win'),cab=document.querySelector('.cab');
const short=a=>a.slice(0,4)+'..'+a.slice(-2);
const rnd=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
const hex=b=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const isAndroid=()=>/Android/i.test(navigator.userAgent), isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isMobile=()=>isAndroid()||isIOS()||/Mobi/i.test(navigator.userAgent);
let session=null,state={already_won:false,spins_left:0,claim_code:null},spinning=false,provider=null;

/* --- server API: the only place that talks to the backend --- */
async function api(action,extra={}){
  if(!session)throw new Error('not_connected');
  const r=await fetch(CFG.API,{method:'POST',headers:{'content-type':'application/json',apikey:CFG.ANON,authorization:'Bearer '+CFG.ANON},
    body:JSON.stringify({action,message:session.message,signature:session.signature,...extra})});
  let b={};try{b=await r.json()}catch(e){}
  if(r.status===401){clearSession();throw new Error(b.error||'signin')}
  return b;
}
/** Has this wallet already won WL? (server: bitrot_wl_winners) */
async function hasWalletWon(address){const s=await api('status');state=s;return !!s.already_won}
/** The win itself is recorded server-side during the spin. This only attaches the optional X handle. */
async function recordWin(data){if(!data.x)return {ok:true};const r=await api('handle',{x_handle:data.x});return {ok:!!r.ok,error:r.error}}

/* --- wallets: shared picker in wallets.js (EIP-6963 list, mobile wallet apps, WalletConnect) --- */
const W=window.BRWallets;
const userRejected=W.userRejected;
function buildMessage(address){const n=Date.now();
  return `BIT ROT WL spin\nWallet: ${address}\nNonce: ${hex(crypto.getRandomValues(new Uint8Array(12)))}\nIssued At: ${new Date(n).toISOString()}\nExpires: ${new Date(n+SESSION_TTL).toISOString()}\n\nFree signature. No transaction, no gas.`}
async function signIn(p,address,onWait){
  const message=buildMessage(address);const hm='0x'+hex(new TextEncoder().encode(message));
  onWait&&onWait();
  const signature=await p.request({method:'personal_sign',params:[hm,address]});
  session={address:address.toLowerCase(),message,signature,exp:Date.now()+SESSION_TTL};
  try{localStorage.setItem(SESS,JSON.stringify(session))}catch(e){}
}
function loadSession(){try{const s=JSON.parse(localStorage.getItem(SESS)||'null');return s&&s.exp>Date.now()+60e3?s:null}catch(e){return null}}
function clearSession(){session=null;try{localStorage.removeItem(SESS)}catch(e){}}

/* --- connect flow --- */
function status(t,cls=''){$('walmsg').innerHTML=t;$('walmsg').className='walmsg'+(cls?' '+cls:'')}
async function connect(){
  try{
    const r=await W.connect({status,hash:'#slots'});if(!r)return;
    const p=r.p,a=r.a,kind=r.kind;
    provider=p;
    await signIn(p,a,()=>{status('SIGN THE FREE MESSAGE IN YOUR WALLET (NO GAS)');if(kind==='wc'&&W.isMobile())W.openLink(W.walletReturn(p))});
    p.on?.('accountsChanged',acc=>{if(session&&acc?.[0]&&acc[0].toLowerCase()!==session.address)disconnect('ACCOUNT CHANGED. RECONNECT.')});
    await afterSignIn();
  }catch(e){status(userRejected(e)?'REQUEST CANCELLED IN WALLET.':'COULD NOT CONNECT: '+String(e?.message||e).slice(0,80).toUpperCase())}
}
async function afterSignIn(){
  $('connect').hidden=true;$('addr').hidden=false;$('addr').textContent=short(session.address);$('disc').hidden=false;
  status('CHECKING WALLET...');
  try{await hasWalletWon(session.address)}catch(e){status('SERVER UNREACHABLE. TRY AGAIN SOON.');return refresh()}
  if(state.already_won){status('THIS WALLET ALREADY HAS WL. FUN SPINS ONLY, NO PRIZE.','has');if(state.claim_code)showClaim(state.claim_code)}
  else status('CONNECTED. 3 WL SPINS PER WALLET PER DAY.');
  refresh();
}
function disconnect(t){clearSession();state={already_won:false,spins_left:0};
  W.wcDisconnect();
  $('connect').hidden=false;$('addr').hidden=true;$('disc').hidden=true;winBox.hidden=true;status(t||'');refresh()}
$('connect').onclick=()=>connect();$('disc').onclick=()=>disconnect('DISCONNECTED.');

function refresh(){
  if(!session){spinBtn.disabled=true;spinBtn.textContent='SPIN';left.textContent='CONNECT A WALLET TO SPIN';return}
  if(state.already_won){spinBtn.disabled=spinning;spinBtn.textContent='FUN SPIN';left.textContent='FUN MODE: NO PRIZE (WALLET ALREADY HAS WL)';return}
  spinBtn.textContent='SPIN';spinBtn.disabled=spinning||state.spins_left<=0;
  left.textContent=`${Math.max(0,state.spins_left)} / ${MAX_SPINS} WL SPINS LEFT TODAY (${short(session.address)})`}
function showClaim(code){winBox.hidden=false;$('winaddr').textContent=short(session.address);$('code').textContent=code;$('claim').hidden=false}

/* --- reels: animate whatever the server decided --- */
function animate(res,done){
  cab.classList.add('rolling');
  reels.forEach((img,i)=>{const box=img.parentElement;box.classList.add('spinning');let k=rnd(7);
    const iv=setInterval(()=>{k=(k+1)%7;img.src='assets/'+SYM[k];if(i===0)window.SFX?.tick()},90);
    const stop=()=>{if(!res.ready)return setTimeout(stop,150);clearInterval(iv);img.src='assets/'+SYM[res.reels[i]];box.classList.remove('spinning');box.classList.add('stop');window.SFX?.stop();setTimeout(()=>box.classList.remove('stop'),280);
      if(i===2){cab.classList.remove('rolling');done()}};
    setTimeout(stop,1100+i*550)});
}
function funRoll(){const hit=rnd(25)===0;if(hit){const k=rnd(7);return [k,k,k]}let r;do{r=[rnd(7),rnd(7),rnd(7)]}while(r[0]===r[1]&&r[1]===r[2]);return r}
reels.forEach((r,i)=>r.src='assets/'+SYM[(i*2)%7]);
spinBtn.onclick=async()=>{
  if(spinning||!session)return;spinning=true;window.SFX?.click();refresh();msg.textContent='ROTTING...';msg.className='slotmsg';
  const res={ready:false,reels:[0,1,2]};let out=null;const fun=state.already_won;
  animate(res,()=>{spinning=false;
    if(!out){msg.textContent='SPIN FAILED. TRY AGAIN.';return refresh()}
    const hit=res.reels[0]===res.reels[1]&&res.reels[1]===res.reels[2];
    if(hit)window.SFX?.win();else window.SFX?.lose();
    if(hit){cab.classList.add('jackpot');setTimeout(()=>cab.classList.remove('jackpot'),2100)}
    if(out.won){msg.textContent='>>> TRIPLE ROT <<<';msg.className='slotmsg won';state.already_won=true;state.claim_code=out.claim_code;
      $('wlform').hidden=false;$('claim').hidden=true;winBox.hidden=false;$('winaddr').textContent=short(session.address);$('code').textContent=out.claim_code;$('claim').hidden=false;winBox.scrollIntoView({block:'center'});
      status('THIS WALLET NOW HAS WL. FUN SPINS ONLY FROM HERE.','has')}
    else if(fun)msg.textContent=hit?'TRIPLE ROT! (FUN SPIN, NO PRIZE)':'NO MATCH (FUN SPIN)';
    else if(out.error==='already_won'){state.already_won=true;status('THIS WALLET ALREADY HAS WL. FUN SPINS ONLY, NO PRIZE.','has');msg.textContent='ALREADY WON';if(out.claim_code)showClaim(out.claim_code)}
    else if(out.error==='no_spins_left'){state.spins_left=0;msg.textContent='NO WL SPINS LEFT. COME BACK TOMORROW (UTC)'}
    else msg.textContent=state.spins_left<=0?'NO WL SPINS LEFT. COME BACK TOMORROW (UTC)':'NO MATCH. SPIN AGAIN';
    refresh()});
  try{
    if(fun){out={reels:funRoll(),won:false}}
    else{out=await api('spin');if(typeof out.spins_left==='number')state.spins_left=out.spins_left}
    if(Array.isArray(out.reels))res.reels=out.reels;else{const r=funRoll();res.reels=r[0]===r[1]&&r[1]===r[2]?[r[0],(r[0]+1)%7,r[2]]:r}
  }catch(e){out=null}
  res.ready=true;
};
$('wlform').onsubmit=async e=>{e.preventDefault();
  const x=String(new FormData(e.target).get('x')||'').trim().replace(/^@/,'');
  if(!x){return}
  if(!/^[A-Za-z0-9_]{1,15}$/.test(x)){alert('Invalid X handle');return}
  const r=await recordWin({wallet:session?.address,x:'@'+x,code:state.claim_code});
  if(r.ok){e.target.hidden=true;status('X HANDLE SAVED WITH YOUR WIN.','has')}else alert('Could not save handle: '+(r.error||'error'))};
(async()=>{const s=loadSession();if(s){session=s;await afterSignIn()}else refresh()})();
