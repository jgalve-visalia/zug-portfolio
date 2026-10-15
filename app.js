(function(){
var $=function(i){return document.getElementById(i)};
var MODS=['demanda','portfolio','faturacao2','liq2','fichacpe'];
var ub=function(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a};
var bu=function(a){var s='';a=new Uint8Array(a);for(var i=0;i<a.length;i+=8192)s+=String.fromCharCode.apply(null,a.subarray(i,i+8192));return btoa(s)};
async function sha(t){var h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(h)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}
function prog(p){var e=$('prog');e.hidden=false;e.firstChild.style.width=Math.round(p*100)+'%'}
async function fetchPayload(){
  var r=await fetch('payload.bin',{cache:'no-cache'});if(!r.ok)throw new Error('payload');
  var tot=+r.headers.get('content-length')||0,rd=r.body.getReader(),ch=[],n=0;
  for(;;){var x=await rd.read();if(x.done)break;ch.push(x.value);n+=x.value.length;if(tot)prog(Math.min(.9,n/tot*.9))}
  var out=new Uint8Array(n),o=0;ch.forEach(function(c){out.set(c,o);o+=c.length});return out;
}
async function unwrap(email,pw){
  var U=await (await fetch('users.json',{cache:'no-cache'})).json();
  var id=await sha('zug|'+email),u=U.users.find(function(x){return x.id===id});
  if(!u)return null;
  var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  var kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:ub(u.s),iterations:U.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  try{var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(u.i),additionalData:new TextEncoder().encode('zug-user')},kek,ub(u.w));}catch(e){return null}
  return JSON.parse(new TextDecoder().decode(pt));
}
function perms(C){
  var css='';
  MODS.filter(function(m){return C.mods.indexOf(m)<0}).forEach(function(m){css+='.tab[data-page="'+m+'"],[data-sb="'+m+'"],[data-sub="'+m+'"],#page-'+m+'{display:none!important}'});
  if(C.f2)['overview','devengo','trazabilidad'].filter(function(t){return C.f2.indexOf(t)<0}).forEach(function(t){css+='#page-faturacao2 .f2-tab[data-t="'+t+'"],[data-f2="'+t+'"]{display:none!important}'});
  css+='#zug-user{position:fixed;bottom:12px;right:14px;z-index:9999;display:flex;gap:8px;align-items:center;background:rgba(10,25,48,.92);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 12px;font:12px/1.2 system-ui,sans-serif;color:#cfe0f5}#zug-user button{background:none;border:0;color:#7cc4ff;cursor:pointer;font:inherit;padding:2px 4px}';
  var js='(function(){var C='+JSON.stringify(C).replace(/</g,'\\u003c')+';window.__ZUG_USER=C;'+
  'function ok(p){return C.mods.indexOf(p)>=0}'+
  'function guard(){var a=document.querySelector(".tab.active");var p=a&&a.dataset.page;if(p&&!ok(p)){var t=document.querySelector(\'.tab[data-page="\'+C.mods[0]+\'"]\');if(t)t.click();}'+
  'if(C.f2&&window.f2State&&window.f2Go){try{var s=window.f2State();if(s&&s.tab&&C.f2.indexOf(s.tab)<0)window.f2Go(C.f2[0]);}catch(e){}}}'+
  'setInterval(guard,400);window.addEventListener("load",function(){setTimeout(guard,50);});'+
  'document.addEventListener("DOMContentLoaded",function(){var u=document.createElement("div");u.id="zug-user";u.innerHTML="<span></span><span style=\\"opacity:.6\\"></span><button type=\\"button\\">Sair</button>";u.children[0].textContent=C.email;u.children[1].textContent="· dados de "+C.built;'+
  'u.querySelector("button").onclick=function(){try{sessionStorage.removeItem("zugK")}catch(e){}location.reload()};document.body.appendChild(u);});})();';
  return '<style id="zug-perms">'+css+'</style><script>'+js+'<\/script>';
}
async function open_(K,meta){
  var blob=await fetchPayload();prog(.93);
  var key=await crypto.subtle.importKey('raw',K,'AES-GCM',false,['decrypt']);
  var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:blob.subarray(0,12),additionalData:new TextEncoder().encode('zug-payload')},key,blob.subarray(12));
  var txt=await new Response(new Blob([pt]).stream().pipeThrough(new DecompressionStream('gzip'))).text();prog(.98);
  var P=JSON.parse(txt);meta.built=P.built;
  var html=P.html.replace(/<script src="assets\/([^"]+)"><\/script>/g,function(m,f){var s=P.assets[f];if(s==null)return m;return '<script src="'+URL.createObjectURL(new Blob([s],{type:'application/javascript'}))+'"><\/script>'});
  html=html.replace('<head>','<head>'+perms(meta));
  document.open();document.write(html);document.close();
}
async function tryStored(){
  try{var s=sessionStorage.getItem('zugK');if(!s)return false;var o=JSON.parse(s);await open_(ub(o.k),o.u);return true}catch(e){try{sessionStorage.removeItem('zugK')}catch(x){}return false}
}
$('f-login').addEventListener('submit',async function(e){
  e.preventDefault();var b=e.target.querySelector('button'),msg=$('m-login');b.disabled=true;msg.className='msg';msg.textContent='A verificar…';
  try{
    var r=await unwrap($('l-email').value.trim().toLowerCase(),$('l-pw').value);
    if(!r){msg.textContent='Email ou palavra-passe incorretos.';b.disabled=false;return}
    msg.className='msg ok';msg.textContent='A abrir o painel…';
    try{sessionStorage.setItem('zugK',JSON.stringify(r))}catch(x){}
    await open_(ub(r.k),r.u);
  }catch(err){msg.className='msg';msg.textContent='Não foi possível abrir o painel. Tente de novo.';b.disabled=false}
});
tryStored();
})();
