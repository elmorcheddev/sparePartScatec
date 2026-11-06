// Camera QR scanner. Uses BarcodeDetector when available (Chrome/Android),
// otherwise falls back to jsQR (iOS Safari, Firefox), loaded only when needed.
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>ko(new Error("Cannot load "+src));document.head.appendChild(s)})}

async function startScanner(onCode){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert("Camera scanning is not available here. Scan the QR label with your phone camera app – it opens the item directly.");return}
  const ov=document.createElement("div");ov.className="scn";
  ov.innerHTML='<video playsinline muted></video><button class="cl">Close</button>';
  document.body.appendChild(ov);
  const v=ov.querySelector("video");let stream,stop=false;
  const close=()=>{stop=true;if(stream)stream.getTracks().forEach(t=>t.stop());ov.remove()};
  ov.querySelector("button").onclick=close;
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    v.srcObject=stream;await v.play();
    let detect;
    if("BarcodeDetector" in window){
      const bd=new BarcodeDetector({formats:["qr_code","code_128","ean_13","code_39"]});
      detect=async()=>{const r=await bd.detect(v);return r.length?r[0].rawValue:null};
    }else{
      if(!window.jsQR)await loadScript("js/jsQR.js");
      const cv=document.createElement("canvas"),cx=cv.getContext("2d",{willReadFrequently:true});
      detect=async()=>{
        if(!v.videoWidth)return null;
        cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);
        const r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);
        return r?r.data:null};
    }
    const tick=async()=>{
      if(stop)return;
      try{const raw=await detect();if(raw&&onCode(raw)){close();return}}catch(e){}
      setTimeout(tick,250)};
    tick();
  }catch(e){close();alert("Camera not available: "+e.message)}
}
