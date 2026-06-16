import { Outlet, NavLink } from "react-router-dom";

export default function Layout() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="border-b border-gray-700/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-lg font-bold tracking-tight text-white no-underline">
            ShareSharp
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink to="/send" className={linkClass}>Send</NavLink>
            <NavLink to="/receive" className={linkClass}>Receive</NavLink>
            <NavLink to="/history" className={linkClass}>History</NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
