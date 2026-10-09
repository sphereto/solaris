import { useEffect, useRef, useState } from 'react';
import { SolarScene } from '../scene/SolarScene';

export function SolarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: SolarScene | null = null;
    try {
      scene = new SolarScene(canvas);
    } catch (err) {
      console.error('[solaris] could not start WebGL', err);
      setFailed(true);
    }
    return () => scene?.dispose();
  }, []);

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Overhead view of the Sun and eight planets on their orbits. Tap to tilt the view, double tap to return overhead."
      />
      {failed && (
        <p className="fallback">
          Solaris needs WebGL, and this browser could not start it. Try a recent Chrome, Safari or Firefox.
        </p>
      )}
    </div>
  );
}
