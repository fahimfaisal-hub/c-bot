import { useEffect, useState } from "react";
import { Database, MessagesSquare, AlertTriangle, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useConnection } from "../context/ConnectionContext";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import StatusPulse from "../components/StatusPulse";
import Skeleton from "../components/Skeleton";

function groupLogsByDay(logs) {
  const counts = {};
  logs.forEach((log) => {
    const day = new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    counts[day] = (counts[day] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([day, count]) => ({ day, count }))
    .slice(-7);
}

export default function Dashboard() {
  const { api } = useConnection();
  const [sources, setSources] = useState(null);
  const [logStats, setLogStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [automation, setAutomation] = useState(null);

  useEffect(() => {
    api.getSources().then(setSources).catch(() => {});
    api.getLogs(100).then((res) => {
      setLogStats(res);
      setChartData(groupLogsByDay(res.logs));
    }).catch(() => {});
    api.getAutomation().then(setAutomation).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unansweredPct =
    logStats && logStats.total_questions > 0
      ? Math.round((logStats.unanswered_questions / logStats.total_questions) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted mt-1">An overview of your bot's knowledge base and activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Knowledge sources"
          value={sources ? sources.sources.length : <Skeleton className="h-9 w-12" />}
          sublabel={sources ? `${sources.total_chunks} chunks indexed` : ""}
          icon={Database}
          accent="signal"
        />
        <StatCard
          label="Questions asked"
          value={logStats ? logStats.total_questions : <Skeleton className="h-9 w-12" />}
          sublabel="last 100 logged"
          icon={MessagesSquare}
          accent="signal"
        />
        <StatCard
          label="Unanswered"
          value={logStats ? `${unansweredPct}%` : <Skeleton className="h-9 w-12" />}
          sublabel={logStats ? `${logStats.unanswered_questions} of ${logStats.total_questions}` : ""}
          icon={AlertTriangle}
          accent={unansweredPct > 20 ? "warn" : "good"}
        />
        <StatCard
          label="Auto-sync"
          value={automation ? (automation.auto_sync_enabled ? "On" : "Off") : <Skeleton className="h-9 w-12" />}
          sublabel={automation?.auto_sync_enabled ? `every ${automation.auto_sync_interval_hours}h` : "disabled"}
          icon={RefreshCw}
          accent={automation?.auto_sync_enabled ? "good" : "signal"}
        />
      </div>

      <Card title="Questions over time" description="Volume of chat questions from recent logs">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3454D1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3454D1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9AA1AE" }} axisLine={{ stroke: "#E3E6EB" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9AA1AE" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E3E6EB", fontFamily: "Inter" }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="count" stroke="#3454D1" strokeWidth={2} fill="url(#signalFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-ink-faint py-10 text-center">Not enough data yet — ask the bot a few questions.</p>
        )}
      </Card>

      <Card title="System status">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <StatusPulse variant="good" label="API connected" pulse />
          <StatusPulse
            variant={automation?.auto_sync_enabled ? "good" : "idle"}
            label={automation?.auto_sync_enabled ? `Auto-sync active · every ${automation.auto_sync_interval_hours}h` : "Auto-sync disabled"}
          />
          <StatusPulse
            variant={automation?.log_retention_days > 0 ? "good" : "idle"}
            label={automation?.log_retention_days > 0 ? `Log retention: ${automation.log_retention_days} days` : "Log retention: off"}
          />
        </div>
      </Card>
    </div>
  );
}
