import { useEffect, useRef, useState } from "react";

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let stream = null;
    let interval = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;

        const BarcodeDetector = window.BarcodeDetector;
        if (!BarcodeDetector) {
          setError("QR scanning not supported on this browser. Enter the code manually.");
          return;
        }

        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        interval = setInterval(async () => {
          if (!videoRef.current || !scanning) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            for (const b of barcodes) {
              if (b.rawValue) {
                setScanning(false);
                clearInterval(interval);
                stream?.getTracks().forEach((t) => t.stop());
                onScan(b.rawValue);
                return;
              }
            }
          } catch {
            // detection frame error
          }
        }, 500);
      } catch (err) {
        setError("Camera access denied or not available");
      }
    }

    start();

    return () => {
      clearInterval(interval);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-4 w-full max-w-sm border border-gray-700/50">
        <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: "1/1", maxHeight: "60vh" }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-2 border-blue-400 rounded-lg m-8 opacity-60" />
        </div>
        {error ? (
          <p className="text-sm text-red-400 text-center">{error}</p>
        ) : (
          <p className="text-sm text-gray-400 text-center">Point camera at QR code</p>
        )}
        <div className="flex justify-center mt-3">
          <button
            onClick={() => { onClose?.(); }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
