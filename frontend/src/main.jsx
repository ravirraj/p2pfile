import { BrowserRouter, Routes, Route } from "react-router-dom";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SocketProvider } from "./hooks/useSocket.jsx";
import Layout from "./Layout.jsx";
import Home from "./pages/Home.jsx";
import Send from "./pages/Send.jsx";
import Receive from "./pages/Receive.jsx";
import History from "./pages/History.jsx";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SocketProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="send" element={<Send />} />
          <Route path="receive" element={<Receive />} />
          <Route path="receive/:roomId" element={<Receive />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </SocketProvider>
  </BrowserRouter>
);
