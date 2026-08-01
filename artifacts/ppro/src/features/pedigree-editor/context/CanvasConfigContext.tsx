import { createContext, useContext, useEffect, useState, createElement, useRef, useMemo } from "react";
import { NODE_SIZE as DEFAULT_NODE_SIZE, NODE_GAP as DEFAULT_NODE_GAP, GEN_GRID as DEFAULT_GEN_GRID } from "@/features/pedigree-editor/canvas/types";

export interface CanvasConfig {
  nodeSize: number;
  nodeGap: number;
  genGrid: number;
  edgeWidthNormal: number;
  edgeWidthSelected: number;
  edgeDropOffset: number;
  carrierDotRadius: number;
  annFontSize: number;
  annDefaultPos: "above" | "below" | "left" | "right";
  edgeColor: string;
  nodeStrokeColor: string;
  annFontFamily: string;
  annBold: boolean;
  annUppercase: boolean;
  gridOpacity: number;
  genotypeMutantColor: string;
  genotypeWildtypeColor: string;
  genotypeSeparatorColor: string;
  showGenotypes: boolean;
  genotypeFontSize: number;
  genotypeOffset: number;
  toolbarHeight?: number;
  gridStyle?: "lines" | "dots" | "crosses";
  autoLabelFontSize?: number;
  autoLabelColor?: string;
  devMode?: boolean;
  autoFitLayout?: boolean;
  showAge?: boolean;
  ageFontSize?: number;
  showRelationshipLabels?: boolean;
  sibshipDropHeight?: number;
  twinGapMono?: number;
  twinGapDizygotic?: number;
  coupleSpacing?: number;
  hSpacing?: number;
  crossingMinimizationSweeps?: number;
  edgeArcRadius?: number;
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  nodeSize: DEFAULT_NODE_SIZE,
  nodeGap: DEFAULT_NODE_GAP,
  genGrid: DEFAULT_GEN_GRID,
  edgeWidthNormal: 1.5,
  edgeWidthSelected: 2.5,
  edgeDropOffset: 40,
  carrierDotRadius: 5,
  annFontSize: 12,
  annDefaultPos: "below",
  edgeColor: "#000000",
  nodeStrokeColor: "",
  annFontFamily: "Inter, sans-serif",
  annBold: true,
  annUppercase: false,
  gridOpacity: 0.10,
  genotypeMutantColor: "#EF4444",
  genotypeWildtypeColor: "#4B5563",
  genotypeSeparatorColor: "#9CA3AF",
  showGenotypes: true,
  genotypeFontSize: 12,
  genotypeOffset: 3,
  toolbarHeight: 96,
  gridStyle: "lines",
  autoLabelFontSize: 12,
  autoLabelColor: "",
  devMode: false,
  autoFitLayout: true,
  showAge: true,
  ageFontSize: 10,
  showRelationshipLabels: true,
  sibshipDropHeight: 30,
  twinGapMono: DEFAULT_NODE_SIZE * 0.55,
  twinGapDizygotic: DEFAULT_NODE_SIZE * 0.8,
  coupleSpacing: DEFAULT_NODE_GAP,
  hSpacing: Math.round(DEFAULT_NODE_GAP * 110 / 96.8),
  crossingMinimizationSweeps: 15,
  edgeArcRadius: 6,
};

const STORAGE_KEY = "ppro_canvas_config";

export function getStoredConfig(): Partial<CanvasConfig> {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object") {
        for (const key of Object.keys(parsed)) {
          const val = parsed[key];
          const defaultVal = DEFAULT_CANVAS_CONFIG[key as keyof CanvasConfig];
          if (typeof defaultVal === "number") {
            const num = Number(val);
            if (!isFinite(num) || val === null || val === undefined) {
              delete parsed[key];
            } else {
              parsed[key] = num;
            }
          }
        }
        return parsed;
      }
    }
  } catch {}
  return {};
}

export function saveConfig(cfg: CanvasConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

let _moduleConfig: CanvasConfig = { ...DEFAULT_CANVAS_CONFIG, ...getStoredConfig() };

export function getModuleCanvasConfig(): CanvasConfig {
  return _moduleConfig;
}

export interface CanvasConfigContextValue {
  config: CanvasConfig;
  updateConfig: (patch: Partial<CanvasConfig>) => void;
}

export const CanvasConfigContext = createContext<CanvasConfigContextValue>({
  config: DEFAULT_CANVAS_CONFIG,
  updateConfig: () => {},
});

export function CanvasConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CanvasConfig>(() => {
    const stored = getStoredConfig();
    return { ...DEFAULT_CANVAS_CONFIG, ...stored };
  });

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    _moduleConfig = config;
  }, [config]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const next = { ...DEFAULT_CANVAS_CONFIG, ...detail };
        setConfig(next);
      }
    };
    window.addEventListener("canvas-config-change", handler);
    return () => window.removeEventListener("canvas-config-change", handler);
  }, []);

  const updateConfig = (patch: Partial<CanvasConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
    _moduleConfig = next;
  };

  return createElement(
    CanvasConfigContext.Provider,
    { value: { config, updateConfig } },
    children,
  );
}

export function useCanvasConfig() {
  return useContext(CanvasConfigContext);
}

export function CanvasConfigOverrideProvider({
  localConfig,
  onUpdateConfig,
  children,
}: {
  localConfig: Partial<CanvasConfig>;
  onUpdateConfig: (patch: Partial<CanvasConfig>) => void;
  children: React.ReactNode;
}) {
  const parentCtx = useContext(CanvasConfigContext);

  const mergedConfig = useMemo(() => {
    const merged = { ...parentCtx.config };
    for (const key of Object.keys(localConfig)) {
      const val = localConfig[key as keyof CanvasConfig];
      if (val !== undefined && val !== null && (typeof val !== "number" || isFinite(val))) {
        (merged as any)[key] = val;
      }
    }
    return merged;
  }, [parentCtx.config, localConfig]);

  useEffect(() => {
    _moduleConfig = mergedConfig;
    return () => {
      _moduleConfig = parentCtx.config;
    };
  }, [mergedConfig, parentCtx.config]);

  const value = useMemo(() => ({
    config: mergedConfig,
    updateConfig: onUpdateConfig,
  }), [mergedConfig, onUpdateConfig]);

  return createElement(
    CanvasConfigContext.Provider,
    { value },
    children,
  );
}
