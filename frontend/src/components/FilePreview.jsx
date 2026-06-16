import { useState, useEffect } from "react";

export default function FilePreview({ file }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (file.type?.startsWith("image/")) {
      setPreview({ type: "image", url: URL.createObjectURL(file) });
      return () => URL.revokeObjectURL(preview?.url);
    }
    if (file.type?.startsWith("text/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview({ type: "text", content: reader.result.slice(0, 2000) });
      reader.readAsText(file);
    }
  }, [file]);

  if (!preview) return null;

  return (
    <div className="mt-2">
      {preview.type === "image" && (
        <img src={preview.url} alt={file.name} className="max-h-32 rounded-lg object-contain bg-gray-900" />
      )}
      {preview.type === "text" && (
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-2 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono">
          {preview.content}
        </pre>
      )}
    </div>
  );
}
