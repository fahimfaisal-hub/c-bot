import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { createApiClient } from "../api/client";

const ConnectionContext = createContext(null);

const STORAGE_KEY = "company_bot_admin_connection";

export function ConnectionProvider({ children }) {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  const [botName, setBotName] = useState("Company Assistant");

  // restore last-used connection on load
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { baseUrl: savedUrl, apiKey: savedKey } = JSON.parse(saved);
        if (savedUrl) setBaseUrl(savedUrl);
        if (savedKey) setApiKey(savedKey);
      } catch {
        // ignore corrupt saved state
      }
    }
  }, []);

  const api = useMemo(() => createApiClient(baseUrl, apiKey), [baseUrl, apiKey]);

  const connect = useCallback(
    async (url, key) => {
      setStatus("connecting");
      const client = createApiClient(url, key);
      try {
        const config = await client.getConfig();
        // getConfig is public (no auth) — verify the key with an admin call
        await client.getSources();
        setBaseUrl(url);
        setApiKey(key);
        setBotName(config.bot_name || "Company Assistant");
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl: url, apiKey: key }));
        return { ok: true };
      } catch (err) {
        setStatus("error");
        return { ok: false, message: err.message || "Could not connect." };
      }
    },
    []
  );

  const disconnect = useCallback(() => {
    setStatus("disconnected");
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // auto-reconnect using restored credentials
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && status === "disconnected") {
      try {
        const { baseUrl: savedUrl, apiKey: savedKey } = JSON.parse(saved);
        if (savedUrl && savedKey) connect(savedUrl, savedKey);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConnectionContext.Provider
      value={{ baseUrl, apiKey, status, botName, api, connect, disconnect }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}
