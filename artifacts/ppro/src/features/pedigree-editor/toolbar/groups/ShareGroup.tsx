import { useState, useEffect, useRef, useCallback } from "react";
import { Share2, Download, ChevronDown, ChevronRight, Loader2, ShieldCheck, FileText, Presentation, FileJson, Image, Wifi } from "lucide-react";

interface ShareGroupProps {
  setShowShareModal: (v: boolean) => void;
  setShowLanShare: React.Dispatch<React.SetStateAction<boolean>>;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean) => void;
  exportingFormat: string | null;
  handleExportReport: () => void;
  handleExportPDF: () => void;
  handleExportPPTX: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportJSON: () => void;
  handleExportPPRO: () => void;
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = 150;
    let top = r.bottom + 4;
    if (top + panelHeight > window.innerHeight) {
      top = Math.max(8, r.top - panelHeight);
    }
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 210)) });
  }, [ref]);
  return { pos, measure };
}

export function ShareGroup({
  setShowShareModal, setShowLanShare, showExportMenu, setShowExportMenu, exportingFormat,
  handleExportReport, handleExportPDF, handleExportPPTX,
  handleExportPNG, handleExportSVG, handleExportJSON, handleExportPPRO, labelHidden = false,
}: ShareGroupProps) {
  const exportRef = useRef<HTMLButtonElement>(null);
  const { pos: exportPos, measure: measureExport } = useDropdownPosition(exportRef);

  const [expandClinical, setExpandClinical] = useState(false);
  const [expandData, setExpandData] = useState(false);

  useEffect(() => {
    if (!showExportMenu) { setExpandClinical(false); setExpandData(false); }
  }, [showExportMenu]);
  const clinicalRowRef = useRef<HTMLButtonElement>(null);
  const dataRowRef = useRef<HTMLButtonElement>(null);
  const [clinicalFlyoutPos, setClinicalFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [dataFlyoutPos, setDataFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const OPEN_DELAY = 75;
  const CLOSE_DELAY = 200;
  const hoverClinicalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverDataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimers = useCallback(() => {
    if (hoverClinicalTimerRef.current !== null) { clearTimeout(hoverClinicalTimerRef.current); hoverClinicalTimerRef.current = null; }
    if (hoverDataTimerRef.current !== null) { clearTimeout(hoverDataTimerRef.current); hoverDataTimerRef.current = null; }
  }, []);

  const handleClinicalEnter = useCallback(() => {
    clearHoverTimers();
    setExpandData(false);
    hoverClinicalTimerRef.current = setTimeout(() => {
      setExpandClinical(true);
      if (clinicalRowRef.current) {
        const rect = clinicalRowRef.current.getBoundingClientRect();
        const flyoutWidth = 200;
        const goesOffRight = rect.right + 4 + flyoutWidth > window.innerWidth;
        const flyoutHeight = 88;
        let top = rect.top;
        if (top + flyoutHeight > window.innerHeight) {
          top = Math.max(8, window.innerHeight - flyoutHeight - 8);
        }
        setClinicalFlyoutPos({ top, left: goesOffRight ? Math.max(8, rect.left - flyoutWidth - 4) : rect.right + 4 });
      }
    }, OPEN_DELAY);
  }, [clearHoverTimers]);

  const handleClinicalLeave = useCallback(() => {
    if (hoverClinicalTimerRef.current !== null) { clearTimeout(hoverClinicalTimerRef.current); hoverClinicalTimerRef.current = null; }
    hoverClinicalTimerRef.current = setTimeout(() => { setExpandClinical(false); }, CLOSE_DELAY);
  }, []);

  const handleDataEnter = useCallback(() => {
    clearHoverTimers();
    setExpandClinical(false);
    hoverDataTimerRef.current = setTimeout(() => {
      setExpandData(true);
      if (dataRowRef.current) {
        const rect = dataRowRef.current.getBoundingClientRect();
        const flyoutWidth = 200;
        const goesOffRight = rect.right + 4 + flyoutWidth > window.innerWidth;
        const flyoutHeight = 200;
        let top = rect.top;
        if (top + flyoutHeight > window.innerHeight) {
          top = Math.max(8, window.innerHeight - flyoutHeight - 8);
        }
        setDataFlyoutPos({ top, left: goesOffRight ? Math.max(8, rect.left - flyoutWidth - 4) : rect.right + 4 });
      }
    }, OPEN_DELAY);
  }, [clearHoverTimers]);

  const handleDataLeave = useCallback(() => {
    if (hoverDataTimerRef.current !== null) { clearTimeout(hoverDataTimerRef.current); hoverDataTimerRef.current = null; }
    hoverDataTimerRef.current = setTimeout(() => { setExpandData(false); }, CLOSE_DELAY);
  }, []);

  useEffect(() => {
    if (!showExportMenu) return;
    measureExport();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowExportMenu(false); clearHoverTimers(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showExportMenu, measureExport, setShowExportMenu, clearHoverTimers]);

  const clinicalExports = [
    { id: "report" as const, label: "Clinical Report", sub: "PDF with risk & validation", icon: <ShieldCheck className="w-4 h-4 text-primary" />, fn: handleExportReport },
    { id: "pdf" as const, label: "Diagram", sub: "PDF landscape", icon: <FileText className="w-4 h-4 text-red-400" />, fn: handleExportPDF },
  ];
  const dataExports = [
    { id: "pptx" as const, label: "PowerPoint", sub: ".pptx editable", icon: <Presentation className="w-4 h-4 text-orange-400" />, fn: handleExportPPTX },
    { id: "svg" as const, label: "SVG", sub: "Vector graphic", icon: <FileText className="w-4 h-4 text-purple-400" />, fn: handleExportSVG },
    { id: "png" as const, label: "PNG", sub: "High-res bitmap", icon: <Image className="w-4 h-4 text-cyan-400" />, fn: handleExportPNG },
    { id: "json" as const, label: "JSON", sub: "Raw data", icon: <FileJson className="w-4 h-4 text-blue-400" />, fn: handleExportJSON },
    { id: "ppro" as const, label: "PRO File", sub: "Full history", icon: <FileJson className="w-4 h-4 text-primary" />, fn: handleExportPPRO },
  ];

  const btnCls = "w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent transition-colors text-left";
  const flyoutItemCls = "w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left";

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button type="button" data-testid="button-share" onClick={() => setShowShareModal(true)} title="Share this pedigree" aria-label="Share this pedigree"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Share2 className="w-5 h-5" />
          <span>Share</span>
        </button>
        <button type="button"
          data-testid="button-lan-share"
          onClick={() => setShowLanShare(true)}
          title="LAN share (direct P2P)"
          aria-label="LAN share"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Wifi className="w-5 h-5" />
          <span>LAN</span>
        </button>
        <button
          type="button"
          ref={exportRef}
          data-testid="button-export"
          onClick={() => setShowExportMenu(!showExportMenu)}
          title="Export pedigree"
          aria-label="Export pedigree"
          aria-expanded={showExportMenu}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showExportMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <div className="flex items-center gap-0.5"><Download className="w-5 h-5" /><ChevronDown className="w-2.5 h-2.5" /></div>
          <span>{exportingFormat ? "…" : "Export"}</span>
        </button>
        {showExportMenu && exportPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setShowExportMenu(false); clearHoverTimers(); }} />
            <div className="fixed z-50 w-[200px] border border-border rounded-lg shadow-xl overflow-hidden bg-popover" style={{ top: exportPos.top, left: exportPos.left }}>
              {/* Clinical category row */}
              <button ref={clinicalRowRef} type="button"
                onMouseEnter={handleClinicalEnter}
                onMouseLeave={handleClinicalLeave}
                onClick={() => { setExpandClinical(true); setExpandData(false); }}
                className={`${btnCls} ${expandClinical ? "bg-accent" : ""}`}
              >
                <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="flex-1 text-xs font-medium">Clinical</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              </button>

              <div className="border-t border-border" />

              {/* Data & Images category row */}
              <button ref={dataRowRef} type="button"
                onMouseEnter={handleDataEnter}
                onMouseLeave={handleDataLeave}
                onClick={() => { setExpandData(true); setExpandClinical(false); }}
                className={`${btnCls} ${expandData ? "bg-accent" : ""}`}
              >
                <Presentation className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="flex-1 text-xs font-medium">Data & Images</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              </button>
            </div>

            {/* Clinical flyout */}
            {expandClinical && clinicalFlyoutPos && (
              <div className="fixed z-50 min-w-[200px] border border-border rounded-md shadow-xl bg-popover"
                style={{ left: clinicalFlyoutPos.left, top: clinicalFlyoutPos.top }}
                onMouseEnter={() => { if (hoverClinicalTimerRef.current !== null) { clearTimeout(hoverClinicalTimerRef.current); hoverClinicalTimerRef.current = null; } }}
                onMouseLeave={handleClinicalLeave}
              >
                {clinicalExports.map((item) => (
                  <button type="button" key={item.id} data-testid={`button-export-${item.id}`}
                    onClick={item.fn} disabled={!!exportingFormat}
                    className={`${flyoutItemCls} disabled:opacity-40`}>
                    {exportingFormat === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
                    ) : <span className="flex-shrink-0">{item.icon}</span>}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{exportingFormat === item.id ? "..." : item.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Data & Images flyout */}
            {expandData && dataFlyoutPos && (
              <div className="fixed z-50 min-w-[200px] border border-border rounded-md shadow-xl bg-popover"
                style={{ left: dataFlyoutPos.left, top: dataFlyoutPos.top }}
                onMouseEnter={() => { if (hoverDataTimerRef.current !== null) { clearTimeout(hoverDataTimerRef.current); hoverDataTimerRef.current = null; } }}
                onMouseLeave={handleDataLeave}
              >
                {dataExports.map((item) => (
                  <button type="button" key={item.id} data-testid={`button-export-${item.id}`}
                    onClick={item.fn} disabled={!!exportingFormat}
                    className={`${flyoutItemCls} disabled:opacity-40 border-t border-border first:border-t-0`}>
                    {exportingFormat === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
                    ) : <span className="flex-shrink-0">{item.icon}</span>}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{exportingFormat === item.id ? "..." : item.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Share</div>}
    </div>
  );
}
