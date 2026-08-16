import { useMemo, useState } from "react";
import { Share2, Download, Loader2, ShieldCheck, FileText, Presentation, FileJson, Image as ImageIcon, FileCode } from "lucide-react";
import { useDraggable } from "@/hooks/use-draggable";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PedigreeSummaryPanel } from "@/components/shared/PedigreeSummaryPanel";

interface ShareGroupProps {
  setShowShareModal: (v: boolean) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean) => void;
  exportingFormat: string | null;
  handleExportReport: () => void;
  handleExportPDF: () => void;
  handleExportPPTX: () => void;
  handleExportPNG: (options?: { transparent?: boolean }) => void;
  handleExportSVG: (options?: { transparent?: boolean }) => void;
  handleExportPPRO: () => void;
  handleExportJSON: () => void;
  handleExportPED: () => void;
  pedigreeTitle: string;
  canvasNodes: any[];
  canvasEdges: any[];
  labelHidden?: boolean;
}

export function ShareGroup({
  setShowShareModal, showExportMenu, setShowExportMenu, exportingFormat,
  handleExportReport, handleExportPDF, handleExportPPTX,
  handleExportPNG, handleExportSVG, handleExportPPRO, handleExportJSON, handleExportPED,
  pedigreeTitle, canvasNodes, canvasEdges, labelHidden = false,
}: ShareGroupProps) {

  const { position, onPointerDown } = useDraggable();

  const [pngTransparent, setPngTransparent] = useState(false);
  const [svgTransparent, setSvgTransparent] = useState(false);

  const formattedDate = useMemo(() => new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), []);

  const exportCategories = [
    {
      title: "Clinical Documentation",
      description: "Counseling-ready summaries and reports",
      items: [
        {
          id: "report",
          name: "Clinical Report PDF",
          description: "Comprehensive 2-page report with pedigree chart, statistics, and validation analysis.",
          icon: <ShieldCheck className="w-5 h-5 text-teal-500" />,
          action: handleExportReport
        },
        {
          id: "pptx",
          name: "PowerPoint Presentation",
          description: "Editable vector shapes slide deck formatted in a widescreen landscape template.",
          icon: <Presentation className="w-5 h-5 text-orange-500" />,
          action: handleExportPPTX
        }
      ]
    },
    {
      title: "Pedigree Graphics",
      description: "High-resolution visuals and prints",
      items: [
        {
          id: "pdf",
          name: "Landscape PDF Diagram",
          description: "High-DPI printable PDF of the canvas diagram with an auto-updating legend.",
          icon: <FileText className="w-5 h-5 text-rose-500" />,
          action: handleExportPDF
        },
        {
          id: "png",
          name: "High-Res PNG Image",
          description: "High-fidelity raster bitmap image suitable for electronic medical records (EMR).",
          icon: <ImageIcon className="w-5 h-5 text-sky-500" />,
          action: () => handleExportPNG({ transparent: pngTransparent })
        },
        {
          id: "svg",
          name: "Vector SVG Graphic",
          description: "Scalable vector graphics XML format for web rendering and high-quality editing.",
          icon: <FileCode className="w-5 h-5 text-violet-500" />,
          action: () => handleExportSVG({ transparent: svgTransparent })
        }
      ]
    },
    {
      title: "Raw Data Exchange",
      description: "Interoperable backup and clinical exchange",
      items: [
        {
          id: "ppro",
          name: "PRO Backup (.ppro)",
          description: "Complete encrypted profile backup containing pedigree nodes, edges, history, and notes.",
          icon: <FileJson className="w-5 h-5 text-teal-600" />,
          action: handleExportPPRO
        },
        {
          id: "json",
          name: "Standard JSON",
          description: "Plain text machine-readable JSON structure for database exchange and API integrations.",
          icon: <FileCode className="w-5 h-5 text-slate-500" />,
          action: handleExportJSON
        },
        {
          id: "ped",
          name: "Linkage PED (.ped)",
          description: "Standard PLINK/GATK lineage format for genetics research and linkage analysis.",
          icon: <FileText className="w-5 h-5 text-indigo-500" />,
          action: handleExportPED
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-2">
        <button type="button" data-testid="button-share" onClick={() => setShowShareModal(true)} title="Share this pedigree" aria-label="Share this pedigree"
          className="flex flex-col items-center gap-1.5 min-w-[46px] min-h-[46px] py-1 rounded text-[11px] leading-tight font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Share2 className="w-5 h-5" />
          <span>Share</span>
        </button>
        <button
          type="button"
          data-testid="button-export"
          onClick={() => setShowExportMenu(true)}
          title="Export pedigree options"
          aria-label="Export pedigree options"
          className="flex flex-col items-center gap-1.5 min-w-[46px] min-h-[46px] py-1 rounded text-[11px] leading-tight font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Download className="w-5 h-5" />
          <span>Export</span>
        </button>
 
        <Dialog open={showExportMenu} onOpenChange={setShowExportMenu}>
          <DialogContent 
            className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[580px] max-h-[90vh]"
            style={{ 
              left: `calc(50% + ${position.x}px)`, 
              top: `calc(50% + ${position.y}px)` 
            }}
          >
            
            <PedigreeSummaryPanel
              title={pedigreeTitle}
              subtitle={`Exported on ${formattedDate}`}
              nodes={canvasNodes}
              edges={canvasEdges}
              footerText="All calculations, layouts, and image generations are performed locally within your secure sandbox environment. No data leaves this device."
              onDragStart={onPointerDown}
            />

            {/* Right Side: Options Grid */}
            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">Export Pedigree</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Download this pedigree canvas in clinical document, high-resolution graphic, or raw data formats.
                  </DialogDescription>
                </div>

                <div className="space-y-6">
                  {exportCategories.map((category) => (
                    <div key={category.title} className="space-y-2.5">
                      <div>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{category.title}</h4>
                        <p className="text-[9px] text-muted-foreground/80">{category.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {category.items.map((item) => {
                          const isExporting = exportingFormat === item.id;
                          return (
                            <div
                              key={item.id}
                              className="group flex flex-col justify-between p-3 rounded-lg border border-border/60 bg-card hover:bg-accent/40 hover:border-border transition-all"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  item.action();
                                  // Close modal on click unless it is already exporting
                                  if (!exportingFormat) {
                                    // Wait a tiny bit for action to start before closing
                                    setTimeout(() => setShowExportMenu(false), 250);
                                  }
                                }}
                                disabled={!!exportingFormat}
                                className="flex items-start text-left w-full disabled:opacity-50 focus:outline-none"
                              >
                                <div className="p-1.5 rounded bg-accent group-hover:bg-background transition-colors mr-3 mt-0.5 flex-shrink-0">
                                  {isExporting ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  ) : (
                                    item.icon
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                    {item.name}
                                  </h5>
                                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5 pr-2">
                                    {item.description}
                                  </p>
                                </div>
                              </button>

                              {(item.id === "png" || item.id === "svg") && (
                                <label
                                  className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/40 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-foreground cursor-pointer select-none w-full"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.id === "png" ? pngTransparent : svgTransparent}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (item.id === "png") {
                                        setPngTransparent(e.target.checked);
                                      } else {
                                        setSvgTransparent(e.target.checked);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                                  />
                                  <span>Transparent Background</span>
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(false)}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            
          </DialogContent>
        </Dialog>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Share</div>}
    </div>
  );
}
