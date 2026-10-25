import { useEffect, useRef, useState } from "react";
import NeonReveal from "@/components/react-bits/neon-reveal";

declare global {
  interface Window { ReactNativeWebView?: { postMessage: (message: string) => void }; }
}
export default function App() {
  const frame = useRef<HTMLDivElement>(null);
  const [tubeInset, setTubeInset] = useState(0);
  const [tubeLength, setTubeLength] = useState(0.506);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const update = () => {
      setTubeInset(node.clientHeight * 0.4127);
      setTubeLength(0.506 - 3 / Math.max(node.clientWidth, 1));
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <main className="splash-stage">
      <div className="art-frame" ref={frame}>
        {tubeInset > 0 && <NeonReveal
          colors={["#ff003a", "#e9002e"]}
          backgroundColor="transparent"
          direction="down" expandFrom="center" easing="out" trigger="mount"
          revealDuration={1150} revealDelay={100} thickness={2}
          glow={0.62} spill={0.14} reach={0.58} intensity={0.884}
          feather={0.32} inset={tubeInset} length={tubeLength}
          hum={0.78} flicker={0.9} interactive={false} intro
          onComplete={() => window.ReactNativeWebView?.postMessage("complete")}
        >
          <section className="splash-content" aria-label="Field Note">
            <img className="scene" src={`${import.meta.env.BASE_URL}field24-scene-v3.png`} alt="붉은 경광등과 백색 전조등이 켜진 119 구급차" />
            <div className="wordmark"><h1 className="brand-type">FIELD NOTE</h1></div>
          </section>
        </NeonReveal>}
        <div className="ignition-roof-wash" aria-hidden="true" />
      </div>
    </main>
  );
}
