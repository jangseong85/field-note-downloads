import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Dock from "./Dock";
import "./style.css";

type Tab = "memo" | "sals" | "mci" | "settings";
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    updateDock?: (state: { activeTab: Tab; isDark: boolean }) => void;
  }
}
const tabs: { key: Tab; label: string; path: string }[] = [
  { key: "memo", label: "메모", path: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6" },
  { key: "sals", label: "SALS", path: "M9 2h6 M12 5v3 M19 6l1 1 M12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M12 11v4l2 1" },
  { key: "mci", label: "다수사상자", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { key: "settings", label: "설정", path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 3 3 1 3 3v6l-3 1-1 3-3 3H9l-1-3-3-1-3-3V9l3-1 1-3z" },
];
function App() {
  const [state, setState] = useState({ activeTab: "memo" as Tab, isDark: true });
  useEffect(() => {
    window.updateDock = setState;
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ready" }));
    return () => { delete window.updateDock; };
  }, []);
  return <Dock theme={state.isDark ? "dark" : "light"} baseItemSize={56} magnification={56} panelHeight={80} gap={14} showLabels={false} items={tabs.map((tab) => ({
    label: tab.label,
    active: state.activeTab === tab.key,
    icon: <span className="dock-navigation-item"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={tab.path}/></svg><span className="dock-navigation-label">{tab.label}</span></span>,
    onClick: () => {
      setState((previous) => ({ ...previous, activeTab: tab.key }));
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "select", tab: tab.key }));
    },
  }))} />;
}
createRoot(document.getElementById("root")!).render(<App />);
