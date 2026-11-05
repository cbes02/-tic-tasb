import {FilesetResolver, PoseLandmarker} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';

const $=s=>document.querySelector(s);
const video=$('#video'),canvas=$('#view'),ctx=canvas.getContext('2d',{alpha:false});
const flavour='green';
let facing='environment',stream,detector,readyPromise,session=0,active=false,busy=false,raf=0,lastFrame=-1,lastSent=0,pose=null,lastSeen=0,photoUrl,photoBlob;
const images={};
['green'].forEach(key=>{const img=new Image();img.decoding='async';img.src=`${key}.png`;images[key]=img;});
const assetsReady=Promise.resolve();
function status(text){if($('#status').textContent!==text)$('#status').textContent=text;}
function initDetector(){
 if(readyPromise)return readyPromise;
 readyPromise=(async()=>{
  try{
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
   detector=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'./pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.6});
  }catch(error){readyPromise=null;detector=null;throw new Error('Il riconoscimento non si è avviato. Verifica la connessione e apri il link direttamente in Safari o Chrome.');}
 })();
 return readyPromise;
}
function stop(){active=false;session++;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;pose=null;lastSeen=0;$('#shoot').disabled=true;}
async function openCamera(){
 if(!navigator.mediaDevices?.getUserMedia)throw new Error('La fotocamera richiede un sito HTTPS aperto in Safari o Chrome.');
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:720},height:{ideal:1280}}});
 video.srcObject=stream;await video.play();
 canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 active=true;lastFrame=-1;lastSent=0;pose=null;lastSeen=0;session++;draw(performance.now());
}
$('#start').onclick=async()=>{
 const attempt=++session;const button=$('#start');button.disabled=true;button.textContent='Prepariamo il costume…';
 try{await assetsReady;$('#welcome').hidden=true;$('#camera').hidden=false;status('Carichiamo il filtro, solo la prima volta può servire un momento…');
 // Initialize before opening the camera so no camera stream survives a model loading failure.
 await initDetector();if(attempt!==session)return;await openCamera();status('Fai un passo indietro: devono vedersi anche i piedi.');
 }catch(e){stop();$('#welcome').hidden=false;$('#camera').hidden=true;alert(cameraError(e));}
 finally{button.disabled=false;button.textContent='Vai alla fotocamera ↗';}
};
function cameraError(e){return ({NotAllowedError:'Accesso alla fotocamera negato. Consenti la fotocamera nelle impostazioni del sito e riprova.',NotFoundError:'Non trovo una fotocamera su questo dispositivo.',NotReadableError:'La fotocamera è occupata. Chiudi le altre app che la stanno usando e riprova.'})[e.name]||e.message;}
$('#back').onclick=()=>{stop();$('#camera').hidden=true;$('#welcome').hidden=false;};
$('#flip').onclick=async()=>{const button=$('#flip');button.disabled=true;facing=facing==='environment'?'user':'environment';stop();try{await openCamera();}catch(e){stop();$('#camera').hidden=true;$('#welcome').hidden=false;alert(cameraError(e));}finally{button.disabled=false;}};
function updatePose(l){
 const required=[0,11,12,23,24,25,26,27,28];
 const valid=l&&required.every(i=>(l[i].visibility??0)>.5&&l[i].x>.015&&l[i].x<.985&&l[i].y>.01&&l[i].y<.99);
 if(!valid)return;
 const p=i=>({x:l[i].x*canvas.width,y:l[i].y*canvas.height});
 const a=p(11),b=p(12),h1=p(23),h2=p(24),k1=p(25),k2=p(26);
 const shoulder={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
 const hip={x:(h1.x+h2.x)/2,y:(h1.y+h2.y)/2};
 const knee={x:(k1.x+k2.x)/2,y:(k1.y+k2.y)/2};
 const torso=Math.hypot(hip.x-shoulder.x,hip.y-shoulder.y);
 const height=torso+Math.hypot(knee.x-hip.x,knee.y-hip.y)*.67;
 const width=Math.max(Math.hypot(b.x-a.x,b.y-a.y)*1.52,height*.53);
 const angle=Math.atan2(hip.y-shoulder.y,hip.x-shoulder.x)-Math.PI/2;
 const target={x:shoulder.x,y:shoulder.y-torso*.08,width,height:height+torso*.08,angle};
 if(!pose||performance.now()-lastSeen>350)pose=target;
 else for(const key of Object.keys(target))pose[key]+=(target[key]-pose[key])*.4;
 lastSeen=performance.now();
}
function draw(time){
 if(!active)return;
 ctx.save();if(facing==='user'){ctx.translate(canvas.width,0);ctx.scale(-1,1);}ctx.drawImage(video,0,0,canvas.width,canvas.height);ctx.restore();
 const visible=pose&&time-lastSeen<300;
 $('#guide').hidden=!!visible;$('#shoot').disabled=!visible;
 if(visible){
  ctx.save();ctx.translate(facing==='user'?canvas.width-pose.x:pose.x,pose.y);ctx.rotate(facing==='user'?-pose.angle:pose.angle);
  ctx.drawImage(images[flavour],-pose.width/2,0,pose.width,pose.height);ctx.restore();status('Sei una Tasb! Mettiti in posa e scatta.');
 }else status('Inquadra una persona intera, dalla testa ai piedi.');
 if(detector&&!busy&&video.currentTime!==lastFrame&&time-lastSent>142){
  busy=true;lastFrame=video.currentTime;lastSent=time;
  try{const result=detector.detectForVideo(video,time);updatePose(result.landmarks[0]||null);}catch(error){console.warn('Pose frame non disponibile',error);}finally{busy=false;}
 }
 raf=requestAnimationFrame(draw);
}
$('#shoot').onclick=()=>{
 if(!pose||performance.now()-lastSeen>=300)return;
 const photo=document.createElement('canvas');photo.width=canvas.width;photo.height=canvas.height;const pctx=photo.getContext('2d');pctx.drawImage(canvas,0,0);
 const band=Math.round(photo.height*.065);pctx.fillStyle='#17623b';pctx.fillRect(0,photo.height-band,photo.width,band);pctx.fillStyle='white';pctx.font=`bold ${Math.round(band*.4)}px Arial`;pctx.textAlign='center';pctx.fillText('tic tasb · Bormiadi',photo.width/2,photo.height-band*.35);
 photo.toBlob(blob=>{if(!blob)return;if(photoUrl)URL.revokeObjectURL(photoUrl);photoBlob=blob;photoUrl=URL.createObjectURL(blob);$('#photo').src=photoUrl;$('#download').href=photoUrl;const file=new File([blob],'tic-tasb.jpg',{type:'image/jpeg'});$('#share').hidden=!navigator.canShare?.({files:[file]});$('#result').showModal();},'image/jpeg',.93);
};
$('#closeResult').onclick=()=>$('#result').close();
$('#share').onclick=async()=>{try{await navigator.share({files:[new File([photoBlob],'tic-tasb.jpg',{type:'image/jpeg'})],title:'Ora sono una Tic Tasb!'});}catch(e){if(e.name!=='AbortError')alert('Puoi usare Salva foto e condividerla dalla galleria.');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active){stop();$('#camera').hidden=true;$('#welcome').hidden=false;}});
window.addEventListener('pagehide',()=>{stop();if(photoUrl)URL.revokeObjectURL(photoUrl);});
window.addEventListener('load',()=>setTimeout(()=>initDetector().catch(()=>{}),350),{once:true});
