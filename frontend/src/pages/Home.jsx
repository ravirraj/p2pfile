import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto px-4 pt-20 pb-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-2">PeerFlow</h1>
      <p className="text-gray-400 mb-10">Peer-to-peer file sharing. No accounts. No cloud. Just direct transfer.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate("/send")}
          className="py-8 px-4 bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 19V5m0 0l-7 7m7-7l7 7"
            />
          </svg>
          <span className="text-lg font-medium">Send Files</span>
        </button>
        <button
          onClick={() => navigate("/receive")}
          className="py-8 px-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 5v14m0 0l7-7m-7 7l-7-7"
            />
          </svg>
          <span className="text-lg font-medium">Receive Files</span>
        </button>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>✓ End-to-end encrypted</p>
        <p>✓ Files never stored on servers</p>
        <p>✓ Works on desktop and mobile</p>
      </div>
    </div>
  );
}
