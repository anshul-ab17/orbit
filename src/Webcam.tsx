import { useEffect, useRef } from "react";

// Borderless, always-on-top circular webcam bubble (the floating "you" preview
// Orbit/Cap overlay on the recording).
export default function Webcam() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 320 }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => console.error("webcam error", e));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-[210px] w-[210px] rounded-full object-cover shadow-2xl ring-4 ring-white/80"
      />
    </div>
  );
}
