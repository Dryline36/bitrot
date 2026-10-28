/* BIT ROT shared wallet picker. Used by script.js (WL machine) and rot.js (ROT METER).
   Desktop: every EIP-6963 wallet the browser announces (own name + icon), window.ethereum fallback, plus WalletConnect QR.
   Mobile with no injected wallet: open the site inside a wallet app (dapp-browser links) or connect over WalletConnect.
   Everything runs in the visitor's browser. */
(function(){
const CFG=window.BITROT_CONFIG||{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UA=navigator.userAgent;
const isAndroid=()=>/Android/i.test(UA),isIOS=()=>/iPhone|iPad|iPod/i.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isMobile=()=>isAndroid()||isIOS()||/Mobi/i.test(UA);
const userRejected=e=>e?.code===4001||e?.code===5000||/reject|denied|cancel/i.test(e?.message||'');
const LAST='bitrot.wallet.last.v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- injected wallets ---------- */
const ann=[];let onAnn=null;
addEventListener('eip6963:announceProvider',e=>{const d=e?.detail;if(!d?.provider||ann.some(a=>a.provider===d.provider||(d.info?.uuid&&a.info?.uuid===d.info.uuid)))return;ann.push(d);onAnn&&onAnn()});
const ask=()=>{try{dispatchEvent(new Event('eip6963:requestProvider'))}catch(e){}};ask();
function legacyName(p){return p.isRabby?'Rabby':p.isBraveWallet?'Brave Wallet':p.isCoinbaseWallet?'Coinbase Wallet':p.isPhantom?'Phantom':p.isOkxWallet||p.isOKExWallet?'OKX Wallet':
  p.isZerion?'Zerion':p.isRainbow?'Rainbow':p.isTrust||p.isTrustWallet?'Trust Wallet':p.isMetaMask?'MetaMask':'Browser Wallet'}
/** [{id,name,icon,provider}] : EIP-6963 first; window.ethereum only if nothing announced. */
function injected(){
  if(ann.length)return ann.map(a=>({id:a.info?.rdns||a.info?.uuid||a.info?.name,name:String(a.info?.name||'Wallet').slice(0,40),
    icon:/^data:image\//.test(a.info?.icon||'')?a.info.icon:'',provider:a.provider}));
  const w=window.ethereum;if(!w)return [];
  const ps=Array.isArray(w.providers)&&w.providers.length?w.providers:[w];
  return ps.map((p,i)=>({id:'legacy:'+legacyName(p)+':'+i,name:legacyName(p),icon:'',provider:p}));
}
async function injectedSoon(ms=400){ask();let l=injected();if(l.length)return l;const t0=Date.now();while(Date.now()-t0<ms){await sleep(100);l=injected();if(l.length)break}return l}
const remember=id=>{try{localStorage.setItem(LAST,id)}catch(e){}};
const lastId=()=>{try{return localStorage.getItem(LAST)}catch(e){return null}};
/** The injected provider the visitor used last (or the only one), waiting briefly for late injection. */
async function remembered(ms=800){const l=await injectedSoon(ms);const id=lastId();return (l.find(x=>x.id===id)||(l.length===1?l[0]:null))?.provider||null}

async function acctNow(p){try{const a=await p.request({method:'eth_accounts'});return a?.[0]&&/^0x[0-9a-fA-F]{40}$/.test(a[0])?a[0]:null}catch(e){return null}}
/** eth_requestAccounts, robust to wallets that approve but never resolve, or say "already pending" (-32002). */
async function requestAccount(p,status=()=>{}){
  const have=await acctNow(p);if(have)return have;
  for(let attempt=0;attempt<2;attempt++){
    let err=null,res=null;p.request({method:'eth_requestAccounts'}).then(a=>{res=a?.[0]||null;if(!res)err=new Error('No account shared')},e=>{err=e});
    const t0=Date.now();
    while(Date.now()-t0<45000){await sleep(500);if(res)return res;if(err){if(userRejected(err))throw err;if(err.code!==-32002)break}
      const a=await acctNow(p);if(a)return a;if(Date.now()-t0>8000)status('STILL WAITING FOR THE WALLET...')}
    status('THE WALLET DID NOT ANSWER. ASKING AGAIN...');
  }
  const a=await acctNow(p);if(a)return a;throw new Error('The wallet did not respond.');
}

/* ---------- mobile wallet apps ----------
   open: dapp-browser link (opens this page inside the wallet, which then injects its provider). Formats from each wallet's docs.
   wc:   WalletConnect deep link (Reown registry: native scheme / universal link + "/wc?uri=").  */
const here=hash=>location.origin+location.pathname+(hash||'');
const enc=encodeURIComponent;
const APPS=[
  {id:'metamask',name:'MetaMask',open:u=>'https://metamask.app.link/dapp/'+u.replace(/^https?:\/\//,'')},
  {id:'coinbase',name:'Coinbase Wallet',open:u=>'https://go.cb-w.com/dapp?cb_url='+enc(u)},
  {id:'rainbow',name:'Rainbow',wc:uri=>(isAndroid()?'rainbow://wc?uri=':'https://rnbwapp.com/wc?uri=')+enc(uri)},
  {id:'trust',name:'Trust Wallet',open:u=>'https://link.trustwallet.com/open_url?coin_id=60&url='+enc(u)},
  {id:'phantom',name:'Phantom',open:u=>'https://phantom.app/ul/browse/'+enc(u)+'?ref='+enc(location.origin)},
  {id:'zerion',name:'Zerion',wc:uri=>'zerion://wc?uri='+enc(uri)},
  {id:'okx',name:'OKX Wallet',open:u=>'https://web3.okx.com/download?deeplink='+enc('okx://wallet/dapp/url?dappUrl='+enc(u))},
];
const RETURN={metamask:{a:'metamask://',i:'https://metamask.app.link'},rainbow:{a:'rainbow://',i:'https://rnbwapp.com'},zerion:{a:'zerion://',i:'zerion://'}};

/* ---------- WalletConnect (lazy-loaded on first use, one shared session) ---------- */
let wcMod=null,wcProv=null,wcApp=null;
const loadWC=()=>wcMod||(wcMod=Promise.all([import('https://esm.sh/@walletconnect/ethereum-provider@2.26.0?bundle'),import('https://esm.sh/uqr@0.1.2')])
  .then(([w,q])=>({EP:w.EthereumProvider||w.default?.EthereumProvider,svg:q.renderSVG})).catch(e=>{wcMod=null;throw new Error('Could not load WalletConnect.')}));
async function wcProvider(){if(!wcProv){const m=await loadWC();wcProv=await m.EP.init({projectId:CFG.WALLETCONNECT_PROJECT_ID,showQrModal:false,chains:[1],optionalChains:[1,8453],
  methods:['personal_sign','eth_accounts'],optionalMethods:[],events:['accountsChanged','chainChanged'],optionalEvents:['disconnect'],
  metadata:{name:'BIT ROT',description:'BIT ROT. Signing is free (no gas).',url:location.origin,icons:[new URL('assets/hero.gif',location.href).href]}})}return wcProv}
async function wcAccount(p,ms=6000){const t0=Date.now();while(true){const a=p.accounts?.[0];if(a)return a;
  for(const ns of Object.values(p.session?.namespaces||{}))for(const acc of ns?.accounts||[]){const x=String(acc).split(':').pop();if(/^0x[0-9a-fA-F]{40}$/.test(x))return x}
  if(Date.now()-t0>ms)return null;await sleep(400)}}
function openLink(h){if(!h)return;if(/^https?:/i.test(h)){const a=document.createElement('a');a.href=h;a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}else location.href=h}
/** Where to bounce the visitor so they can sign in their wallet app (mobile WalletConnect only). */
function walletReturn(p){const r=p?.session?.peer?.metadata?.redirect,nm=p?.session?.peer?.metadata?.name||'';
  const k=RETURN[wcApp]||Object.entries(RETURN).find(([id])=>new RegExp(id,'i').test(nm))?.[1];
  if(isAndroid())return r?.native||k?.a||'';if(isIOS())return r?.universal||r?.native||k?.i||'';return ''}
function wcDisconnect(){try{wcProv?.session&&wcProv.disconnect()}catch(e){}}

/* ---------- picker modal ---------- */
let M=null,resolveChoice=null;
function modal(){if(M)return M;
  M=document.createElement('div');M.className='wpm';M.hidden=true;M.setAttribute('role','dialog');M.setAttribute('aria-modal','true');M.setAttribute('aria-label','Connect a wallet');
  M.innerHTML='<div class="wpbox"><div class="wphead"><p class="wptitle">CONNECT WALLET</p><button type="button" class="wpx" aria-label="Close">X</button></div><div class="wpbody"></div></div>';
  document.body.appendChild(M);
  M.querySelector('.wpx').onclick=()=>close(null);
  M.addEventListener('click',e=>{if(e.target===M)close(null)});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!M.hidden)close(null)});
  return M}
const body=()=>modal().querySelector('.wpbody');
function close(choice){if(!M)return;M.hidden=true;onAnn=null;const r=resolveChoice;resolveChoice=null;r&&r(choice);if(wcCancel){const c=wcCancel;wcCancel=null;c()}}
function renderList(opts){
  const l=injected(),mob=isMobile(),wc=!!CFG.WALLETCONNECT_PROJECT_ID;let h='';
  if(l.length){h+='<p class="wpsec">'+(mob?'IN THIS APP':'DETECTED')+'</p><div class="wplist">'+l.map((w,i)=>
    '<button type="button" class="wpw" data-i="'+i+'">'+(w.icon?'<img alt="" src="'+esc(w.icon)+'">':'<i class="wpdot"></i>')+'<span>'+esc(w.name)+'</span></button>').join('')+'</div>'}
  if(mob&&!l.length){h+='<p class="wpsec">OPEN IN YOUR WALLET APP</p><div class="wplist">'+APPS.map(a=>a.open
      ?'<a class="wpw" data-app="'+a.id+'" href="'+esc(a.open(here(opts.hash)))+'" rel="noopener"><i class="wpdot"></i><span>'+a.name+'</span></a>'
      :(wc?'<button type="button" class="wpw" data-wc="'+a.id+'"><i class="wpdot"></i><span>'+a.name+'</span></button>':'')).join('')+'</div>'}
  if(!l.length&&!mob)h+='<p class="wpnote">NO BROWSER WALLET FOUND. UNLOCK YOUR EXTENSION AND RELOAD, OR SCAN WITH YOUR PHONE.</p>';
  if(wc)h+='<p class="wpsec">'+(mob?'ANY OTHER WALLET':'PHONE WALLET')+'</p><div class="wplist"><button type="button" class="wpw wpqr" data-wc="qr"><i class="wpdot"></i><span>SCAN QR (WALLETCONNECT)</span></button></div>';
  if(!l.length&&!mob)h+='<a class="wpget" href="https://ethereum.org/en/wallets/find-wallet/" target="_blank" rel="noopener">NEED A WALLET?</a>';
  const b=body();b.innerHTML=h;
  b.querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>close({type:'injected',w:l[+el.dataset.i]}));
  b.querySelectorAll('[data-wc]').forEach(el=>el.onclick=()=>{pickWC(APPS.find(a=>a.id===el.dataset.wc)||null)});
  b.querySelectorAll('[data-app]').forEach(el=>el.addEventListener('click',()=>{remember('app:'+el.dataset.app)}));
}
function pickWC(app){const r=resolveChoice;resolveChoice=null;onAnn=null;r&&r({type:'wc',app})}
let wcCancel=null;
function showQR(svg,uri,app){modal().hidden=false;const b=body();const link=app?.wc?.(uri);
  b.innerHTML=(app?'<p class="wpsec">OPENING '+esc(app.name.toUpperCase())+'...</p><a class="wpw wpgo" href="'+esc(link)+'" rel="noopener"><i class="wpdot"></i><span>OPEN '+esc(app.name.toUpperCase())+'</span></a><p class="wpsec">OR SCAN</p>':'<p class="wpsec">SCAN WITH YOUR WALLET</p>')+
    '<div class="wcqr">'+svg+'</div><button type="button" class="wpcopy">COPY LINK</button><button type="button" class="wpback">BACK</button>';
  b.querySelector('.wpcopy').onclick=async e=>{try{await navigator.clipboard.writeText(uri);e.target.textContent='COPIED'}catch(x){e.target.textContent='COPY FAILED'}};
  b.querySelector('.wpback').onclick=()=>{const c=wcCancel;wcCancel=null;c&&c('back')};
}

/** Show the picker. Resolves {p,a,kind,name} once connected, or null if the visitor closed it / left for a wallet app. */
async function connect({status=()=>{},hash=''}={}){
  status('LOOKING FOR YOUR WALLET...');
  let l=await injectedSoon(isMobile()?1200:400);
  for(;;){
    let choice;
    if(isMobile()&&l.length===1)choice={type:'injected',w:l[0]};   // inside a wallet's in-app browser: connect directly
    else{
      const m=modal();renderList({hash});m.hidden=false;m.querySelector('.wpx').focus?.();onAnn=()=>renderList({hash});
      status('PICK A WALLET');
      choice=await new Promise(r=>{resolveChoice=r});
    }
    if(!choice){status('');return null}
    if(choice.type==='injected'){const w=choice.w;
      status('APPROVE THE CONNECTION IN '+esc(w.name.toUpperCase()));
      const a=await requestAccount(w.provider,status);remember(w.id);return {p:w.provider,a,kind:'injected',name:w.name}}
    // WalletConnect
    const app=choice.app;wcApp=app?.id||null;
    try{const r=await connectWC(app,status);if(r){remember('wc:'+(app?.id||'qr'));return r}}
    catch(e){if(e?.message==='back'){l=injected();continue}if(e?.message==='closed'){status('');return null}throw e}
  }
}
async function connectWC(app,status){
  body().innerHTML='<p class="wpsec">LOADING WALLETCONNECT...</p>';modal().hidden=false;status('LOADING WALLETCONNECT...');
  const p=await wcProvider(),m=await loadWC();
  if(p.session){const a=await wcAccount(p,1500);if(a){M.hidden=true;return {p,a,kind:'wc',name:p.session?.peer?.metadata?.name||'WalletConnect'}}try{await p.disconnect()}catch(e){}}
  const onUri=uri=>{showQR(m.svg(uri,{ecc:'M',border:2,pixelSize:5,whiteColor:'#f4e7ea',blackColor:'#0a0a0a'}),uri,app);status(app?'APPROVE IN '+app.name.toUpperCase():'SCAN THE QR WITH YOUR WALLET');if(app&&isMobile())openLink(app.wc(uri))};
  p.on?.('display_uri',onUri);
  let why=null;const cancelled=new Promise((_,rej)=>{wcCancel=w=>{why=w||'closed';try{p.disconnect()}catch(e){}rej(new Error(why))}});
  try{await Promise.race([p.connect(),cancelled])}catch(e){if(why)throw new Error(why==='back'?'back':'closed');if(!p.session)throw e}
  finally{p.removeListener?.('display_uri',onUri);wcCancel=null;if(!why&&M)M.hidden=true}
  const a=await wcAccount(p);if(!a)throw new Error('Approved, but no account came back. Tap again.');
  return {p,a,kind:'wc',name:p.session?.peer?.metadata?.name||'WalletConnect'}
}

window.BRWallets={connect,injected,remembered,requestAccount,acctNow,walletReturn,openLink,wcDisconnect,userRejected,isMobile,
  get wcSession(){return !!wcProv?.session},get wc(){return wcProv},APPS};
})();
