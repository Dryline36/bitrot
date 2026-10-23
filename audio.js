/* BIT ROT audio: 100% original, synthesized live with WebAudio. Starts muted; toggle or first click enables. */
(function(){
const KEY='bitrot_sound';let ctx=null,master=null,musicBus=null,sfxBus=null,on=false,musicTimer=null,step=0,nextT=0;
const pref=()=>{try{return localStorage.getItem(KEY)}catch(e){return null}};
const save=v=>{try{localStorage.setItem(KEY,v)}catch(e){}};
function init(){if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();
  master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const comp=ctx.createDynamicsCompressor();comp.connect(master);
  musicBus=ctx.createGain();musicBus.gain.value=.16;musicBus.connect(comp);
  sfxBus=ctx.createGain();sfxBus.gain.value=.3;sfxBus.connect(comp)}
function tone(f,t,d,type='square',v=.3,bus=sfxBus,slide=0){if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(bus);o.start(t);o.stop(t+d+.02)}
let nb=null;function noise(t,d,v=.2,bus=sfxBus,hp=1000){if(!ctx)return;if(!nb){nb=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const a=nb.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=nb;f.type='highpass';f.frequency.value=hp;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f);f.connect(g);g.connect(bus);s.start(t);s.stop(t+d+.02)}
/* music: dark minor arp + bass + crunchy hats, 112 bpm, 16th grid, 4-bar loop */
const N=n=>440*Math.pow(2,(n-69)/12);
const prog=[[45,48,52,57],[41,45,48,53],[43,47,50,55],[40,44,47,52]]; // Am F G E
const arpPat=[0,2,1,3,2,1,3,2,0,3,1,2,3,1,2,0];
function schedule(){const s16=60/112/4;while(nextT<ctx.currentTime+.2){const bar=Math.floor(step/16)%4,i=step%16,ch=prog[bar];
  tone(N(ch[arpPat[i]]+24),nextT,s16*.9,'square',.07,musicBus);
  if(i%4===0)tone(N(ch[0]-12),nextT,s16*3.6,'sawtooth',.18,musicBus);
  if(i%8===0){tone(110,nextT,.18,'sine',.5,musicBus,.3)}
  if(i%8===4)noise(nextT,.12,.18,musicBus,1800);
  if(i%2===1)noise(nextT,.03,.05,musicBus,7000);
  if(i===14&&bar===3)tone(N(ch[3]+36),nextT,s16*2,'square',.05,musicBus,.5);
  nextT+=s16;step++}}
function startMusic(){if(musicTimer||!ctx)return;nextT=ctx.currentTime+.05;musicTimer=setInterval(schedule,50)}
function stopMusic(){clearInterval(musicTimer);musicTimer=null}
function set(v){on=v;save(v?'on':'off');if(v){init();if(!ctx)return;ctx.resume();master.gain.setTargetAtTime(.7,ctx.currentTime,.05);startMusic()}
  else if(ctx){master.gain.setTargetAtTime(0,ctx.currentTime,.05);setTimeout(()=>{if(!on)stopMusic()},300)}btn&&paint()}
const T=()=>ctx?ctx.currentTime:0,ok=()=>on&&ctx;
window.SFX={
  get on(){return on},set,
  tick(){if(ok())tone(1400+Math.random()*400,T(),.03,'square',.08)},
  stop(){if(!ok())return;const t=T();tone(160,t,.12,'square',.3,sfxBus,.4);noise(t,.06,.25,sfxBus,300)},
  lose(){if(!ok())return;const t=T();tone(140,t,.35,'sawtooth',.25,sfxBus,.6);tone(147,t,.35,'square',.15,sfxBus,.6)},
  win(){if(!ok())return;const t=T();[69,72,76,81,76,81,84,88].forEach((n,i)=>tone(N(n),t+i*.09,.14,'square',.2));tone(N(93),t+.75,.6,'square',.22);tone(N(57),t+.75,.6,'sawtooth',.2);noise(t+.75,.4,.12,sfxBus,5000)},
  blip(){if(ok())tone(2200+Math.random()*1500,T(),.025,'square',.04,sfxBus,.5)},
  click(){if(!ok())return;const t=T();tone(900,t,.05,'square',.12,sfxBus,.3);noise(t,.03,.08,sfxBus,4000)}
};
/* toggle button */
let btn=null;function paint(){btn.textContent=on?'SOUND: ON':'SOUND: OFF';btn.setAttribute('aria-pressed',on);btn.classList.toggle('on',on)}
addEventListener('DOMContentLoaded',()=>{
  btn=document.createElement('button');btn.id='sound';btn.className='soundbtn';btn.type='button';paint();document.body.appendChild(btn);
  btn.onclick=e=>{e.stopPropagation();set(!on);if(on)SFX.click()};
  // first click anywhere turns sound on, unless the user explicitly muted before
  const first=e=>{if(e.target===btn)return;removeEventListener('pointerdown',first,true);if(pref()!=='off'&&!on)set(true)};
  addEventListener('pointerdown',first,true);
  document.addEventListener('pointerover',e=>{if(e.target.closest?.('button,.btn,a,.card')&&!e.target.closest('#sound'))SFX.blip()});
  document.addEventListener('click',e=>{if(e.target.closest?.('button,.btn')&&e.target.id!=='sound'&&e.target.id!=='spin')SFX.click()});
});
})();
