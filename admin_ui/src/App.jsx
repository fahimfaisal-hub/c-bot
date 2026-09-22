import { useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { ConnectionProvider, useConnection } from "./context/ConnectionContext";
import { ToastProvider } from "./context/ToastContext";
import ConnectScreen from "./pages/ConnectScreen";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import KnowledgeBase from "./pages/KnowledgeBase";
import ChatLogs from "./pages/ChatLogs";
import BotSettings from "./pages/BotSettings";
import Automation from "./pages/Automation";
import Integration from "./pages/Integration";

const PAGES = {
  dashboard: Dashboard,
  "knowledge-base": KnowledgeBase,
  logs: ChatLogs,
  settings: BotSettings,
  automation: Automation,
  integration: Integration,
};

function AppShell() {
  const { status } = useConnection();
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarVisible, setSidebarVisible] = useState(true);

  if (status !== "connected") {
    return <ConnectScreen />;
  }

  const ActivePage = PAGES[activePage];

  return (
    <div className="flex min-h-screen bg-bg">
      {sidebarVisible && (
        <Sidebar active={activePage} onNavigate={setActivePage} onCollapse={() => setSidebarVisible(false)} />
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          aria-label="Show sidebar"
          title="Show sidebar"
          className="fixed top-5 left-5 z-40 flex items-center gap-2 bg-surface border border-border shadow-card rounded-lg px-3 py-2 text-ink-muted hover:text-ink hover:border-border-strong transition-colors"
        >
          <PanelLeftOpen size={16} />
          <span className="text-xs font-medium">C-Bot</span>
        </button>
      )}

      <main className="flex-1 px-8 py-8 max-w-6xl">
        <ActivePage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConnectionProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ConnectionProvider>
  );
}
