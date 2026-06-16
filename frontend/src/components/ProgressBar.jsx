export default function ProgressBar({ progress, status, speed, eta, fileName, fileSize, type, onCancel, preview }) {
  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === 0) return "";
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
    if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatEta = (seconds) => {
    if (!seconds) return "";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const statusIcon = {
    idle: "",
    sending: "↑",
    receiving: "↓",
    completed: "✓",
    error: "✗",
    aborted: "—",
    resuming: "↻",
  };

  const statusColor = {
    idle: "text-gray-400",
    sending: "text-blue-400",
    receiving: "text-green-400",
    completed: "text-green-400",
    error: "text-red-400",
    aborted: "text-yellow-400",
    resuming: "text-yellow-400",
  };

  const barColor = status === "completed"
    ? "bg-green-500"
    : status === "error" || status === "aborted"
      ? "bg-red-500"
      : "bg-blue-500";

  const isActive = status === "sending" || status === "receiving" || status === "resuming";
  const showImagePreview = preview?.type === "image" && (status === "completed" || status === "receiving");

  return (
    <div className="bg-gray-800/60 rounded-lg border border-gray-700/50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-medium ${statusColor[status]}`}>
              {statusIcon[status]}
            </span>
            <span className="text-gray-200 text-sm font-medium truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {isActive && onCancel && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(fileName); }}
                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-red-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {speed && <span>{formatSpeed(speed)}</span>}
              {eta && <span>{formatEta(eta)}</span>}
              <span>{formatSize(fileSize)}</span>
            </div>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span className="capitalize">{status}</span>
          <span>{progress}%</span>
        </div>
      </div>

      {showImagePreview && preview?.url && (
        <div className="px-4 pb-4">
          <img
            src={preview.url}
            alt={fileName}
            className="max-h-48 rounded-lg object-contain bg-gray-900"
          />
        </div>
      )}

      {preview?.type === "text" && preview?.content && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono">
            {preview.content}
          </pre>
        </div>
      )}
    </div>
  );
}
