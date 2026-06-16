import { useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar.jsx";

export default function FileList({ transfers, onCancel, previews }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transfers.length]);

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Transfers
      </h3>
      <div className="space-y-2">
        {transfers.map((t) => (
          <ProgressBar
            key={t.id}
            progress={t.progress}
            status={t.status}
            speed={t.speed}
            eta={t.eta}
            fileName={t.fileName}
            fileSize={t.fileSize}
            type={t.type}
            onCancel={onCancel}
            preview={previews?.[t.fileName]}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
