"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface TemplateEditorTopBarConfig {
  mode: "template-editor";
  label: string;
  onLabelChange: (value: string) => void;
  onSave: () => void;
  saveDisabled: boolean;
}

type TopBarConfig = TemplateEditorTopBarConfig | null;

interface DashboardTopBarContextValue {
  config: TopBarConfig;
  setConfig: (config: TopBarConfig) => void;
}

const DashboardTopBarContext = createContext<DashboardTopBarContextValue | null>(null);

export function DashboardTopBarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TopBarConfig>(null);

  const value = useMemo(() => ({ config, setConfig }), [config]);

  return (
    <DashboardTopBarContext.Provider value={value}>
      {children}
    </DashboardTopBarContext.Provider>
  );
}

export function useDashboardTopBar() {
  const context = useContext(DashboardTopBarContext);
  if (!context) {
    throw new Error("useDashboardTopBar must be used inside DashboardTopBarProvider");
  }
  return context;
}
