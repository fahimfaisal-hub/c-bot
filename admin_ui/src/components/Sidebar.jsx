import { LayoutDashboard, Database, MessagesSquare, SlidersHorizontal, Clock, Code2, Power, PanelLeftClose } from "lucide-react";
import { useConnection } from "../context/ConnectionContext";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "knowledge-base", label: "Knowledge Base", icon: Database },
  { id: "logs", label: "Chat Logs", icon: MessagesSquare },
  { id: "settings", label: "Bot Settings", icon: SlidersHorizontal },
  { id: "automation", label: "Automation", icon: Clock },
  { id: "integration", label: "Integration", icon: Code2 },
];

export default function Sidebar({ active, onNavigate, onCollapse }) {
  const { botName, disconnect } = useConnection();

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      <div className="px-5 py-5 border-b border-border flex items-start justify-between">
        <div>
          <p className="font-display font-bold text-base text-ink leading-tight">C-Bot</p>
          <p className="text-xs text-ink-faint mt-0.5">Control Panel</p>
        </div>
        <button
          onClick={onCollapse}
          aria-label="Hide sidebar"
          title="Hide sidebar"
          className="text-ink-faint hover:text-ink hover:bg-bg rounded-md p-1 -mr-1 -mt-1 transition-colors"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-signal-soft text-signal"
                  : "text-ink-muted hover:text-ink hover:bg-bg"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-xs text-ink-faint mb-1">Bot</p>
        <p className="text-sm font-medium text-ink truncate mb-3">{botName}</p>
        <button
          onClick={disconnect}
          className="w-full flex items-center gap-2 text-xs text-ink-faint hover:text-bad transition-colors"
        >
          <Power size={13} />
          Disconnect
        </button>
      </div>
    </aside>
  );
}
