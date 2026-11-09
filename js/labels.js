// 5S label printing: item labels + location/rack labels. QR codes open the catalogue page.
const $=id=>document.getElementById(id);
const esc=s=>(s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=s=>/^\d$/.test(s)?"0"+s:s;
const SIZES={xl:[135,90],lg:[120,80],l:[95,60],m:[70,40],s:[50,30]};
const ZCOL=["#c0392b","#2563c9","#2e8b57","#d68910","#7d3c98","#138d9c","#d35400","#566573"];   // one colour per zone (visual management)
let D=[],LOC={},mode="i";

function parseCSV(t){t=t.replace(/^﻿/,"");const d=(t.split(/\r?\n/)[0]||"").includes(";")?";":",";const rows=[];let r=[],f="",q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
    else if(c=='"')q=true;else if(c==d){r.push(f);f=""}
    else if(c=="\n"||c=="\r"){if(c=="\r"&&t[i+1]=="\n")i++;r.push(f);f="";if(r.some(x=>x.trim()))rows.push(r);r=[]}
    else f+=c}
  r.push(f);if(r.some(x=>x.trim()))rows.push(r);return rows}
async function loadLoc(){try{const res=await fetch("data/locations.csv",{cache:"no-cache"});if(!res.ok)return;
  const rows=parseCSV(await res.text());if(rows.length<2)return;
  const hd=rows[0].map(s=>s.trim().toLowerCase().replace(/[^a-z]/g,"")),ix=n=>hd.indexOf(n),a=ix("qrid"),z=ix("zone"),r2=ix("rack"),p=ix("position");if(a<0)return;
  rows.slice(1).forEach(c=>{const k=(c[a]||"").trim();if(k)LOC[k]={z:(c[z]||"").trim(),r:(c[r2]||"").trim(),p:(c[p]||"").trim()}})}catch(e){}}

const lcode=x=>{const l=LOC[x.qr];return l&&l.z&&l.r&&l.p?[l.z,pad(l.r),pad(l.p)].join("-"):""};
const zones=()=>[...new Set(Object.values(LOC).map(l=>l.z).filter(Boolean))].sort();
const zcol=z=>{const i=zones().indexOf(z);return i<0?"#4d209f":ZCOL[i%ZCOL.length]};
function base(){let b=$("base").value.trim();if(!b)b=location.origin+"/";if(!/^https?:\/\//i.test(b))b="https://"+b;return b.replace(/#.*$/,"").replace(/\/?$/,"/")}
const qrsvg=u=>{const q=qrcode(0,"M");q.addData(u);q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true})};

function itemLabel(x,sz){
  const lc=lcode(x),z=(LOC[x.qr]||{}).z,mf=[x.manufacturer,x.supplier].filter(Boolean).join(" · ");
  const big=["xl","lg","l"].includes(sz)&&$("ph").checked,
    ph=big?(x.photos.length?'<div class="ph"><img src="images/products/'+encodeURIComponent(x.photos[0])+'" alt=""></div>':'<div class="ph none">No photo</div>'):"";
  return '<div class="lb sz-'+sz+(big?" hasph":"")+'" style="--zc:'+zcol(z)+'"><div class="top"><span class="loc">'+(lc?esc(lc):"LOC ____")+'</span><span class="id">'+esc(x.qr)+'</span></div>'
   +'<div class="mid">'+ph+'<div class="q">'+qrsvg(base()+"#"+x.qr)+'</div><div class="tx"><div class="cd">'+esc(x.code)+'</div><div class="nm">'+esc(x.title)+'</div>'
   +(x.spec?'<div class="sp">'+esc(x.spec)+'</div>':'')+(mf?'<div class="mf">'+esc(mf)+'</div>':'')+'</div></div>'
   +'<div class="ft"><span>Scatec spare parts</span><span>Scan QR for details</span></div></div>'}

function locLabel(code,sz,isZone){
  const p=code.split("-"),z=p[0];
  const sub=isZone?"Zone sign · scan to list all items":(p.length>1?"Rack "+esc(p[1])+(p[2]?" · Position "+esc(p[2]):""):"");
  return '<div class="lb loc'+(isZone?" zone":"")+' sz-'+sz+'" style="--zc:'+zcol(z)+'"><div class="top"><span class="loc">ZONE '+esc(z)+'</span><span class="id">Scatec</span></div>'
   +'<div class="mid"><div class="q">'+qrsvg(base()+"#loc="+encodeURIComponent(code))+'</div><div class="tx"><div class="big">'+esc(isZone?z:code)+'</div><div class="sub">'+sub+'</div></div></div>'
   +'<div class="ft"><span>Scan to see what belongs here</span><span>5S</span></div></div>'}

function items(){
  const s=$("fs").value,z=$("fz").value,tk=$("fq").value.toLowerCase().split(/\s+/).filter(Boolean);
  return D.filter(x=>(!s||x.supplier===s)&&(!z||(z==="-"?!lcode(x):(LOC[x.qr]||{}).z===z))&&tk.every(t=>[x.code,x.oem,x.title,x.manufacturer,x.supplier,x.qr,lcode(x)].join(" ").toLowerCase().includes(t)))}
function locCodes(){
  let codes=[];
  if($("lsrc").value==="csv"){codes=[...new Set(D.map(lcode).filter(Boolean))].sort()}
  else{const zs=$("gz").value.split(",").map(s=>s.trim().toUpperCase()).filter(Boolean),R=Math.min(99,+$("gr").value||0),P=Math.min(99,+$("gp").value||0);
    zs.forEach(z=>{for(let r=1;r<=R;r++)for(let p=1;p<=P;p++)codes.push(z+"-"+pad(String(r))+"-"+pad(String(p)))})}
  return codes}

function draw(){
  const sz=$("size").value,paper=$("paper").value,roll=paper==="roll",[w,h]=SIZES[sz];let h2="",n=0;
  if(mode==="i"){const cp=Math.max(1,Math.min(20,+$("cp").value||1));items().forEach(x=>{for(let i=0;i<cp;i++){h2+=itemLabel(x,sz);n++}})}
  else{const codes=locCodes();if($("zs").checked)[...new Set(codes.map(c=>c.split("-")[0]))].forEach(z=>{h2+=locLabel(z,sz,true);n++});codes.forEach(c=>{h2+=locLabel(c,sz,false);n++})}
  $("sheet").className="sheet sz-"+sz;$("sheet").innerHTML=h2||'<p class="noprint" style="padding:20px">Nothing to print yet.'+(mode==="l"&&$("lsrc").value==="csv"?" Fill zone / rack / position in data/locations.csv, or choose “Generate a range”.":"")+'</p>';
  $("cnt").textContent=n+" label"+(n==1?"":"s")+" · "+w+" × "+h+" mm";
  $("pg").textContent=roll?"@page{size:"+w+"mm "+h+"mm;margin:0}@media print{.sheet{display:block}.lb{page-break-after:always;break-after:page;border:0;border-radius:0}.lb:last-child{page-break-after:auto}}":"@page{size:A4"+(paper==="land"?" landscape":"")+";margin:8mm}";
  const b=base();$("warn").hidden=!/\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|\[::1\])/i.test(b);
  try{localStorage.setItem("scatecBase",$("base").value)}catch(e){}}

function setMode(m){mode=m;$("tab-i").classList.toggle("on",m==="i");$("tab-l").classList.toggle("on",m==="l");$("opt-i").hidden=m!=="i";$("opt-l").hidden=m!=="l";draw()}

async function init(){
  const local=/^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/.test(location.hostname);
  let saved="";try{saved=localStorage.getItem("scatecBase")||""}catch(e){}
  // deployed site: use its own address; opened locally: reuse the last public address typed (if any)
  $("base").value=local?saved:location.origin+location.pathname.replace(/[^\/]*$/,"");
  try{D=(await (await fetch("data/products.json",{cache:"no-cache"})).json()).items}catch(e){$("sheet").innerHTML='<p style="padding:20px">Could not load data/products.json</p>';return}
  await loadLoc();
  $("fs").innerHTML+=[...new Set(D.map(x=>x.supplier).filter(Boolean))].sort().map(s=>"<option>"+esc(s)+"</option>").join("");
  $("fz").innerHTML+='<option value="-">Unassigned</option>'+zones().map(z=>'<option value="'+esc(z)+'">Zone '+esc(z)+"</option>").join("");
  if(!zones().length){$("lsrc").value="gen";$("gen").hidden=false}
  ["base","size","paper","fs","fz","fq","cp","gz","gr","gp","zs","ph"].forEach(i=>{$(i).oninput=draw;$(i).onchange=draw});
  $("lsrc").onchange=()=>{$("gen").hidden=$("lsrc").value!=="gen";draw()};
  $("tab-i").onclick=()=>setMode("i");$("tab-l").onclick=()=>setMode("l");
  $("pr").onclick=async()=>{await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})));window.print()};
  if(location.hash==="#locations")setMode("l");else draw()}
init();
