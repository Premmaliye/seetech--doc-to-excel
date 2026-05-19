/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileUp, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  X,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  LayoutDashboard,
  Layers,
  History,
  Settings,
  ShieldCheck,
  ChevronRight,
  Terminal,
  Camera,
  Maximize
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn, fileToBase64 } from "./lib/utils";
import { DOCUMENT_FORMATS, FormatDefinition } from "./formats";
import { exportToExcel } from "./excel/excelExporter";
import { ExtractedRow, ExtractedSheet, ExtractionResult } from "./types/extraction";

// --- Types handled by src/types/extraction.ts ---

type AppStatus = "idle" | "uploading" | "extracting" | "success" | "error";

// --- API Base URL ---
// In production (Vercel): set VITE_API_URL to your Railway/Render backend URL
// In local dev: empty string → uses same origin (Express serves both)
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// --- Main Component ---

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [extractedResult, setExtractedResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [engine, setEngine] = useState("Standard OCR Engine"); // AI Vision Engine (via OpenRouter)
  const [confidence, setConfidence] = useState(85);
  const [autoClean, setAutoClean] = useState(true);
  const [selectedFormatId, setSelectedFormatId] = useState("mixed");
  const [totalPages, setTotalPages] = useState(0);

  const isMixedMode = selectedFormatId === "mixed";
  const activeFormat = DOCUMENT_FORMATS.find(f => f.id === selectedFormatId) || DOCUMENT_FORMATS[0];
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const mainFileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles: File[] = Array.from(e.target.files);
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      const ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const validFiles: File[] = [];
      const errors: string[] = [];

      selectedFiles.forEach((file: File) => {
        const isTypeAllowed = ALLOWED_TYPES.includes(file.type);
        const isSizeAllowed = file.size <= MAX_SIZE;

        if (!isTypeAllowed) {
          errors.push(`"${file.name}" has an unsupported format.`);
        } else if (!isSizeAllowed) {
          errors.push(`"${file.name}" exceeds the 50MB limit.`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        setStatus("error");
        setError(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more errors)` : ""));
        errors.forEach(err => addLog(`UPLOAD ERROR: ${err}`));
      } else {
        if (status === "error") {
          setStatus("idle");
          setError(null);
        }
      }

      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startExtraction = async () => {
    if (files.length === 0) return;

    setStatus("extracting");
    setError(null);
    setLogs([]);
    setExtractedResult({ sheets: [] });
    addLog(`Initializing ${engine} Engine...`);

    const updateMasterResult = (newSheets: ExtractedSheet[]) => {
      setExtractedResult(prev => {
        const existingSheets = prev?.sheets || [];
        return {
          sheets: [...existingSheets, ...newSheets]
        };
      });
    };

    try {
      if (engine === "Standard OCR Engine") {
        setTotalPages(files.length);
        addLog(`Direct Upload Mode: Processing ${files.length} documents...`);
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          addLog(`Uploading ${file.name} for deep OCR analysis...`);
          
          const formatInstruction = isMixedMode 
            ? `AUTOMATIC PAGE CLASSIFICATION: 
               Your first task is to classify this page into one of the following formats:
               ${DOCUMENT_FORMATS.map(f => `- ${f.id}: ${f.label}. LOOK FOR: ${f.classificationKeywords.join(", ")}`).join("\n")}
               Choose the most specific ID.`
            : `STRICT FORMAT MODE: Extract specifically for ${activeFormat.label}.`;

          // Pass empty prompt — server uses its own optimized extraction prompt
          const promptStr = "";
          
          await uploadFile(file, promptStr, updateMasterResult);
          setPagesProcessed(prev => prev + 1);
        }
      } else {
        // AI Intelligent Parser Path (Page-by-Page)
        const allPages: { base64: string; mimeType: string }[] = [];
        
        for (const file of files) {
          addLog(`Analyzing ${file.name}...`);
          if (file.type === "application/pdf") {
            const pdfData = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(pdfData);
            const pageCount = pdfDoc.getPageCount();
            
            for (let i = 0; i < pageCount; i++) {
              const subPdf = await PDFDocument.create();
              const [copiedPage] = await subPdf.copyPages(pdfDoc, [i]);
              subPdf.addPage(copiedPage);
              const b64 = await subPdf.saveAsBase64();
              allPages.push({ base64: b64, mimeType: "application/pdf" });
            }
          } else {
            const b64 = await fileToBase64(file);
            allPages.push({ base64: b64, mimeType: file.type });
          }
        }

        setTotalPages(allPages.length);
        addLog(`Total payload: ${allPages.length} pages. Using Adaptive Batching...`);
        
        const MAX_RETRIES = 2;
        const adaptiveConcurrency = allPages.length > 10 ? 1 : 2;
        
        for (let j = 0; j < allPages.length; j += adaptiveConcurrency) {
          const chunk = allPages.slice(j, j + adaptiveConcurrency);
          
          await Promise.all(chunk.map(async (page, index) => {
            let retries = 0;
            let success = false;
            
            while (retries <= MAX_RETRIES && !success) {
              try {
                if (retries > 0) addLog(`Retry attempt ${retries} for page ${j + index + 1}...`);
                await processPart(page.base64, page.mimeType, updateMasterResult);
                success = true;
                setPagesProcessed(prev => prev + 1);
              } catch (pErr) {
                retries++;
                if (retries > MAX_RETRIES) {
                  addLog(`Error: Page ${j + index + 1} failed after ${MAX_RETRIES} retries.`);
                } else {
                  await new Promise(r => setTimeout(r, 2000 * retries));
                }
              }
            }
          }));

          if (allPages.length > 5) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      setStatus("success");
      addLog(`Extraction Complete. Task finalized.`);
    } catch (err: any) {
      const errorMsg = err.message || "Extraction stalled.";
      setError(errorMsg);
      addLog(`FATAL: ${errorMsg}`);
      setStatus("error");
    }
  };

  const uploadFile = async (file: File, prompt: string, onProgress: (data: ExtractedSheet[]) => void) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prompt", prompt);

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData
      });

      const responseText = await response.text();
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        const isHtml = responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html");
        const errMsg = isHtml 
          ? `Server returned an HTML error (Status ${response.status}). If deployed on Vercel, please ensure VITE_API_URL is configured in your Vercel project settings to point to your Railway/Render backend.`
          : (responseText.substring(0, 150) || `Invalid JSON response from server (Status ${response.status})`);
        throw new Error(errMsg);
      }

      if (!response.ok) {
        throw new Error(parsedData?.error || `Upload failed: ${response.status}`);
      }

      if (parsedData.sheets) {
        onProgress(parsedData.sheets);
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      addLog(`Upload Fail: ${err.message}`);
      throw err;
    }
  };

  const processPart = async (base64: string, mimeType: string, onProgress: (data: ExtractedSheet[]) => void) => {
    try {
      const formatInstruction = isMixedMode 
        ? `AUTOMATIC PAGE CLASSIFICATION: 
           Your first task is to classify this page into one of the following formats:
           ${DOCUMENT_FORMATS.map(f => `- ${f.id}: ${f.label}. LOOK FOR: ${f.classificationKeywords.join(", ")}`).join("\n")}
           Choose the most specific ID.`
        : `STRICT FORMAT MODE: Extract specifically for ${activeFormat.label}.`;

      const response = await fetch(`${API_BASE}/api/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `
                INDUSTRIAL AUDIT DIGITIZER.
                
                STEP 1: CLASSIFICATION
                ${formatInstruction}

                STEP 2: EXTRACTION LOGIC
                - HEADER MAPPING: For the detected format, use these EXACT HEADERS:
                ${JSON.stringify(DOCUMENT_FORMATS.reduce((acc, curr) => ({...acc, [curr.id]: curr.headers}), {}))}

                STRICT RULES:
                1. UNIFIED GRID: Return ALL equipment data in a SINGLE sheet ("sheets[0]"). The first row of "sheets[0].grid" MUST be the column headers.
                2. EXACT HEADERS REQUIRED: Use the EXACT headers provided. Map local terms to these headers (e.g., "Motor Make" -> "Make").
                3. ADAPTIVE ROW STRUCTURE: 
                   - IF the document explicitly lists data for Phase R, Y, and B separately, you MUST use the 4-row structure (Phase R, Y, B, Average) for that equipment.
                   - OTHERWISE (if it's a flat mechanical table), use a SINGLE row per equipment. 
                   - DO NOT force 4 rows if the source only has one.
                4. DATA INTEGRITY: Place static specifications (Make, Model, Frame) only once per equipment. 
                5. NO HALLUCINATION: If a cell is blank or unreadable, use "--". Do not guess.
                6. UNIT STANDARDIZATION: Keep values numeric where possible; move units to headers.
                7. JSON ONLY: Return ONLY valid JSON.

                EXAMPLE OUTPUT STRUCTURE:
                {
                  "detectedFormatId": "format-a",
                  "sheets": [
                    {
                      "name": "Audit_Page_1",
                      "grid": [
                        ["Sr. No.", "Equipment Name", "Phase (R/Y/B/Avg)", "Measured Voltage"],
                        ["1", "Main Pump", "Phase R", "415"],
                        ["", "", "Phase Y", "412"],
                        ["", "", "Phase B", "418"],
                        ["", "", "Average", "415"]
                      ]
                    }
                  ]
                }
                
                GOAL: 98% accuracy in digitizing scanned industrial data for professional audit reports.
              `
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extract data using the most appropriate format headers. Mode: ${engine}.` },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`
                  }
                }
              ]
            }
          ]
        })
      });

      const responseText = await response.text();
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        const isHtml = responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html");
        const errMsg = isHtml 
          ? `Server returned an HTML error (Status ${response.status}). If deployed on Vercel, please ensure VITE_API_URL is configured in your Vercel settings to point to your Railway/Render backend.`
          : (responseText.substring(0, 150) || `Invalid JSON response from server (Status ${response.status})`);
        throw new Error(errMsg);
      }

      if (!response.ok) {
        throw new Error(parsedData?.error?.message || parsedData?.error || `API Error: ${response.status}`);
      }

      let rawText = parsedData.choices?.[0]?.message?.content || "";
      
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) rawText = jsonMatch[0];
      
      try {
        const rawResult = JSON.parse(rawText) as { detectedFormatId: string; sheets: { name: string; grid: string[][] }[] };

        if (rawResult.sheets?.length > 0) {
          const sheets: ExtractedSheet[] = rawResult.sheets.map(s => {
            const fid = rawResult.detectedFormatId || activeFormat.id;
            const headers = s.grid[0] || [];
            
            const rows = s.grid.slice(1).map(row => {
              const rowObj: ExtractedRow = {};
              headers.forEach((h, j) => { if(h) rowObj[h] = row[j] || ""; });
              return rowObj;
            });

            return { 
              name: s.name, 
              rows: rows.filter(r => Object.values(r).some(v => v !== "")), 
              formatId: fid 
            };
          });
          onProgress(sheets);
        }
      } catch (parseErr) {
        throw new Error("AI returned invalid data structure. Please try again.");
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      addLog(`Extraction Fail: ${err.message}`);
    }
  };

  const downloadExcel = async () => {
    if (!extractedResult || !extractedResult.sheets || extractedResult.sheets.length === 0) {
      addLog("Export Error: No data found to export.");
      return;
    }
    
    addLog(`Preparing Excel export for ${extractedResult.sheets.length} data segments...`);
    try {
      await exportToExcel(extractedResult.sheets);
      addLog("Excel file generated and download triggered.");
    } catch (err: any) {
      addLog(`Export failed: ${err.message || "Unknown error"}`);
      console.error("[EXCEL EXPORT ERROR]", err);
      alert("Excel Export Failed: " + (err.message || "Please check console."));
    }
  };


  const reset = () => {
    setFiles([]);
    setExtractedResult(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-border-base flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">X</div>
          <span className="font-bold text-xl text-primary flex items-center gap-1">
            DocuStruct <span className="text-accent">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-base bg-gray-50 text-[11px] font-bold text-text-muted hover:bg-gray-100 hover:text-primary transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Start New Task
          </button>
          <span className="text-xs font-medium text-text-muted hidden sm:inline-block">v2.4.0 (Enterprise)</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-sidebar-bg border-r border-border-base flex flex-col py-6 shrink-0 hidden md:flex">
          <div className="mb-8 pl-6">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-[0.1em] mb-4">Main Navigation</div>
            <nav className="space-y-1">
              <div 
                className="w-full flex items-center gap-3 px-6 py-2.5 text-sm nav-item-active"
              >
                <LayoutDashboard className="w-4 h-4" /> Extraction Hub
              </div>
            </nav>
          </div>

          <div className="pl-6 px-4 mb-8">
            <div className="p-4 bg-gray-900 rounded-xl shadow-inner-lg overflow-hidden">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-widest">
                <Terminal className="w-3 h-3" /> System Log
              </div>
              <div className="space-y-1.5 h-24 overflow-hidden font-mono text-left">
                {logs.length > 0 ? logs.map((log, i) => (
                  <div key={i} className="text-[9px] text-gray-300 leading-tight border-l border-blue-500/30 pl-2">
                    {log}
                  </div>
                )) : (
                  <div className="text-[9px] text-gray-500 italic">Engine idle. Awaiting input...</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto px-6">
            <div className="p-4 bg-app-bg rounded-xl border border-border-base/50">
              <div className="text-[10px] font-bold text-text-muted mb-3 flex justify-between uppercase">
                <span>Session Throughput</span>
                <span className="text-accent">Live</span>
              </div>
              <div className="h-1.5 bg-border-base rounded-full overflow-hidden mb-3">
                <div className="h-full bg-accent rounded-full transition-all duration-500 animate-pulse" style={{ width: `${Math.min(100, (pagesProcessed % 100) || 100)}%` }}></div>
              </div>
              <div className="text-[10px] text-text-muted font-medium italic font-serif">Enterprise Mode: {pagesProcessed} pages processed</div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-hidden bg-app-bg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-hidden">
            {/* Left Column: Upload & Queue */}
            <section className="bg-white rounded-xl border border-border-base flex flex-col overflow-hidden shadow-sm">
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className={cn(
                "relative flex-1 border-2 border-dashed border-border-base rounded-lg bg-gray-50/30 flex flex-col items-center justify-center text-center p-8 transition-all hover:border-accent group",
                status !== "idle" && status !== "error" && "opacity-50 pointer-events-none"
              )}>
                <input
                  ref={mainFileInputRef}
                  type="file"
                  onChange={onFileChange}
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                />
                <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-border-base flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileUp className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-base font-bold text-primary mb-1">Drop documents here to structured extraction</h3>
                <p className="text-xs text-text-muted max-w-xs mb-6">Supports PDF, Scanned Images (JPG/PNG), and Word files up to 50MB</p>
                <div className="flex gap-3 relative z-20">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      mainFileInputRef.current?.click();
                    }}
                    className="px-5 py-2 bg-accent text-white rounded-md text-sm font-semibold shadow-sm hover:bg-accent/90 transition-all"
                  >
                    Browse Files
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCameraOpen(true);
                    }}
                    className="px-5 py-2 bg-white border border-border-base text-primary rounded-md text-sm font-semibold shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4 text-accent" /> Scan from Camera
                  </button>
                </div>
              </div>

              {/* Queue List */}
              <div className="mt-8 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-[13px] font-bold text-primary flex items-center gap-2 italic font-serif">
                    Processing Queue <span className="bg-muted px-2 py-0.5 rounded-full not-italic font-sans text-[10px] bg-gray-100 text-text-muted">{files.length} Files</span>
                  </h4>
                  {files.length > 0 && (
                    <button onClick={() => setFiles([])} className="text-[11px] text-accent font-bold hover:underline">Clear Queue</button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {files.map((file, idx) => (
                      <motion.div 
                        key={`${file.name}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-4 p-3 bg-white border border-border-base rounded-lg group hover:border-accent/40"
                      >
                        <div className="w-10 h-10 rounded-md bg-gray-50 flex items-center justify-center shrink-0">
                          {file.type.includes("image") ? (
                            <ImageIcon className="w-5 h-5 text-indigo-500" />
                          ) : (
                            <FileText className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-text-main truncate">{file.name}</div>
                          <div className="text-[11px] text-text-muted flex items-center gap-2">
                            { (file.size / 1024 / 1024).toFixed(2) } MB • <span className="text-accent/70">Awaiting processing</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-text-muted uppercase tracking-tight">Pending</span>
                          <button onClick={() => removeFile(idx)} className="p-1 px-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                    {files.length === 0 && (
                      <div className="h-20 flex items-center justify-center border-2 border-dotted border-border-base rounded-lg text-xs text-text-muted">
                        Queue is empty.
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {files.length > 0 && status === "idle" && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      startExtraction();
                    }}
                    className="w-full mt-4 py-3 bg-accent text-white rounded-lg text-sm font-bold shadow-md shadow-accent/20 hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
                  >
                    Run AI Vision Extraction <ChevronRight className="w-4 h-4" />
                  </button>
                )}


                {status === "extracting" && (
                  <div className="w-full mt-4 flex flex-col gap-2">
                    <div className="py-3 bg-accent/10 text-accent rounded-lg text-sm font-bold flex items-center justify-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> 
                      {pagesProcessed > 0 ? `Processing Page ${pagesProcessed + 1}...` : "Initializing Deep Extraction..."}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all duration-500" 
                        style={{ width: `${Math.round((pagesProcessed / Math.max(1, totalPages)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right Column: Preview & Logic */}
          <section className="flex flex-col gap-6 overflow-hidden">
            {/* Action State Panel */}
            <div className="bg-white rounded-xl border border-border-base shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
              <div className="p-4 border-b border-border-base flex items-center justify-between shrink-0 bg-gray-50/50">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 italic font-serif uppercase tracking-widest">
                  Data Preview
                </h3>
                {status === "success" && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={reset}
                      className="text-[11px] font-bold px-3 py-1.5 border border-border-base text-text-muted rounded-md hover:bg-gray-100 transition-all flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> New Extraction
                    </button>
                    <button 
                      onClick={downloadExcel}
                      className="text-[11px] font-bold px-3 py-1.5 bg-accent text-white rounded-md shadow-sm hover:scale-105 transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Export .XLSX
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden p-4">
                {status === "success" && extractedResult && extractedResult.sheets && extractedResult.sheets.length > 0 ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3 bg-green-50/50 p-2 rounded-lg border border-green-100/50">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-xs font-bold text-green-900 italic font-serif">Verified Extract: {extractedResult.sheets[0].name}</span>
                    </div>
                    <div className="flex-1 border-2 border-primary rounded overflow-hidden flex flex-col bg-white">
                      {/* Grid Header */}
                      {/* Grid Header */}
                      <div className="flex border-b-2 border-primary h-8 bg-[#EBD8E3] shrink-0">
                        <div className="w-10 px-2 py-2 text-[10px] font-bold text-primary border-r-2 border-primary bg-[#EBD8E3] flex items-center justify-center uppercase shrink-0">ID</div>
                        {(() => {
                          const sheet = extractedResult.sheets[0];
                          // Always use actual row keys so OCR data is always visible
                          const rows = sheet?.rows || [];
                          const allKeys = Array.from(new Set<string>(rows.flatMap(r => Object.keys(r || {})))).slice(0, 8);
                          const headers = allKeys.length > 0 ? allKeys : Object.keys(rows[0] || {}).slice(0, 8);
                          
                          return headers.map((header) => (
                            <div key={header} className="flex-1 min-w-[140px] px-3 py-2 text-[10px] font-bold text-primary border-r-2 border-primary last:border-r-0 truncate flex items-center uppercase">{header}</div>
                          ));
                        })()}
                      </div>
                      {/* Grid Rows */}
                      <div className="flex-1 overflow-y-auto overflow-x-auto text-[10px]">
                        {extractedResult.sheets[0].rows && extractedResult.sheets[0].rows.length > 0 ? (
                          <>
                            {extractedResult.sheets[0].rows.map((row, rIdx) => {
                              const sheet = extractedResult.sheets[0];
                              const rows = sheet?.rows || [];
                              const allKeys = Array.from(new Set<string>(rows.flatMap(r => Object.keys(r || {})))).slice(0, 8);
                              const headers = allKeys.length > 0 ? allKeys : Object.keys(row || {}).slice(0, 8);
                              
                              return (
                                  <div key={rIdx} className="flex border-b border-primary h-7 bg-white min-w-max">
                                    <div className="w-10 px-2 py-1 flex items-center justify-center font-bold text-primary bg-white border-r-2 border-primary shrink-0">{rIdx + 1}</div>
                                    {headers.map((h, cIdx) => {
                                      const val = row[h] ?? "--";
                                      return (
                                        <div key={cIdx} className="flex-1 min-w-[140px] px-3 py-1 flex items-center border-r-2 border-primary last:border-r-0 truncate font-semibold text-primary">{String(val)}</div>
                                      );
                                    })}
                                  </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="p-8 text-center text-text-muted italic">No data rows extracted for this segment.</div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="h-full border-2 border-dotted border-border-base rounded-xl bg-gray-50/30 flex flex-col items-center justify-center p-8 text-center">
                    <FileSpreadsheet className="w-10 h-10 text-text-muted/30 mb-4" />
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2 italic font-serif">No Data Available</p>
                    <p className="text-[11px] text-text-muted max-w-[200px]">Extract documents to view structural data layout</p>
                  </div>
                )}
              </div>

              {/* Engine Config (From Design) */}
              <div className="p-4 border-t border-border-base bg-gray-50/30">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Target Document Format</label>
                    <select 
                      value={selectedFormatId}
                      onChange={(e) => setSelectedFormatId(e.target.value)}
                      className="w-full p-2 bg-white border border-border-base rounded text-[13px] font-bold text-accent outline-none focus:border-accent ring-1 ring-accent/10"
                    >
                      <option value="mixed">✨ Auto-Detect (Mixed PDF)</option>
                      {DOCUMENT_FORMATS.map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block">Extraction Engine</label>
                    <select 
                      value={engine}
                      onChange={(e) => setEngine(e.target.value)}
                      className="w-full p-2 bg-white border border-border-base rounded text-[13px] font-medium outline-none focus:border-accent"
                    >
                      <option value="AI Intelligent Parser">AI Vision Parser (Page-by-Page)</option>
                      <option value="Standard OCR Engine">AI Vision Engine (Recommended)</option>
                      <option value="Table Only Mode">Table Only Mode</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 block flex justify-between">
                      Confidence Threshold <span>{confidence}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="50"
                      max="100"
                      value={confidence}
                      onChange={(e) => setConfidence(parseInt(e.target.value))}
                      className="w-full accent-accent h-1.5 bg-border-base rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="autoClean" 
                      checked={autoClean}
                      onChange={(e) => setAutoClean(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border-base text-accent focus:ring-accent" 
                    />
                    <label htmlFor="autoClean" className="text-[11px] font-bold text-text-main cursor-pointer italic font-serif">Auto-structure & Clean</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Error States */}
            <AnimatePresence>
              {status === "error" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 shrink-0 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-red-900 mb-1 italic font-serif">System Notification</div>
                    <div className="text-[11px] text-red-700/90 leading-tight">{error}</div>
                    <button onClick={reset} className="mt-2 text-[11px] font-bold text-red-900 hover:underline flex items-center gap-1 italic font-serif">
                      <RotateCcw className="w-3 h-3" /> System Recovery
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
      </div>

      <CameraScanner 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(file) => {
          setFiles(prev => [...prev, file]);
          setIsCameraOpen(false);
          addLog(`Camera image captured: ${file.name}`);
        }}
      />
    </div>
  );
}

// --- Sub-components ---

function CameraScanner({ isOpen, onClose, onCapture }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkCameras();
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  const checkCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    } catch (err) {
      console.warn("Could not enumerate devices", err);
    }
  };

  const startCamera = async () => {
    setError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API not supported in this browser. Please use the 'Direct Upload' fallback below.");
      return;
    }

    try {
      // Try with preferred facing mode
      const constraints = { 
        video: { 
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      
      // Fallback: try any camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        setError("Unable to access camera. This usually happens if permissions are blocked or another app is using it.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCapture(e.target.files[0]);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Use video's natural dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw the frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera_scan_${new Date().getTime()}.jpg`, { type: "image/jpeg" });
            onCapture(file);
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-border-base flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2 italic font-serif">
               <Camera className="w-5 h-5 text-accent" /> AI Document Scanner
            </h3>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Mode: {facingMode === 'environment' ? 'Back' : 'Front'} Lens</p>
          </div>
          <div className="flex items-center gap-2">
            {hasMultipleCameras && (
              <button 
                onClick={toggleCamera} 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-text-muted"
                title="Switch Camera"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-white text-center p-8 bg-gray-900 w-full h-full flex flex-col items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="font-bold text-sm mb-4 max-w-xs">{error}</p>
              
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-bold shadow-md"
                >
                  Use System Camera App
                </button>
                <button onClick={startCamera} className="text-xs text-text-muted hover:text-white underline">
                  Retry Live Connection
                </button>
              </div>
              
              {/* Native Fallback Input */}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handleNativeCapture}
                className="hidden" 
              />
            </div>
          ) : (
            <>
              {!stream && (
                <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mb-2" />
                  <p className="text-white text-[10px] uppercase font-bold tracking-widest">Initializing Lens...</p>
                </div>
              )}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover" 
              />
              {/* Document Alignment Overlay */}
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-white/40 border-dashed rounded-lg relative">
                  <div className="absolute top-4 left-4 border-t-4 border-l-4 border-accent w-10 h-10 rounded-tl-sm opacity-80" />
                  <div className="absolute top-4 right-4 border-t-4 border-r-4 border-accent w-10 h-10 rounded-tr-sm opacity-80" />
                  <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-accent w-10 h-10 rounded-bl-sm opacity-80" />
                  <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-accent w-10 h-10 rounded-br-sm opacity-80" />
                  
                  {/* Center Target */}
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-4 h-4 border border-white/30 rounded-full" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-white flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4 w-full">
            <button 
              onClick={onClose}
              className="px-6 h-[44px] border border-border-base bg-white rounded-xl text-xs font-bold text-text-muted hover:bg-gray-50 transition-all uppercase tracking-wider"
            >
              Close
            </button>
            <button 
              onClick={capture}
              disabled={!!error || !stream}
              className="flex-1 max-w-[240px] h-[44px] bg-primary text-white rounded-xl text-xs font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <div className="w-3 h-3 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(242,125,38,0.8)]" /> 
              Capture Frame
            </button>
          </div>
          
          <p className="text-[9px] text-text-muted font-medium text-center max-w-sm">
            Position the document within the frame for best results. AI will automatically correct perspective and deskew the image.
          </p>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
}
