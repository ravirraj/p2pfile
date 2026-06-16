import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function QRDisplay({ value, size = 200 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#ffffff", light: "#111827" },
    });
  }, [value, size]);

  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-xl" />
    </div>
  );
}
