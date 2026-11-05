import {FilesetResolver, PoseLandmarker} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
let detector;
self.onmessage=async ({data})=>{
 try {
  if(data.type==='init'){
   const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
   detector=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.6});
   self.postMessage({type:'ready'});
  } else if(data.type==='frame'){
   try{const result=detector.detectForVideo(data.bitmap,data.time);self.postMessage({type:'pose',landmarks:result.landmarks[0]||null,session:data.session});}finally{data.bitmap.close();}
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
