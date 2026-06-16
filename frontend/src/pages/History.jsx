import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTransferHistory, clearTransferHistory } from "../utils/history.js";
import { formatSize } from "../utils/format.js";

export default function History() {
  const [history, setHistory] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getTransferHistory().then(setHistory);
  }, []);

  async function handleClear() {
    await clearTransferHistory();
    setHistory([]);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Transfer History</h2>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No transfer history yet</p>
          <button
            onClick={() => navigate("/send")}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Send Your First File
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry, i) => (
            <div
              key={i}
              className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  entry.type === "sent"
                    ? "bg-blue-900/50 text-blue-300"
                    : "bg-green-900/50 text-green-300"
                }`}>
                  {entry.type === "sent" ? "Sent" : "Received"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              {entry.files?.slice(0, 3).map((f, j) => (
                <p key={j} className="text-xs text-gray-400 truncate">
                  {f.name} — {formatSize(f.size)}
                </p>
              ))}
              {(entry.files?.length || 0) > 3 && (
                <p className="text-xs text-gray-600 mt-1">
                  ...and {entry.files.length - 3} more
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">ID: {entry.roomId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
