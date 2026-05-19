import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ExtractedSheet, ExtractedRow } from "../types/extraction";
import { DOCUMENT_FORMATS, MASTER_HEADERS } from "../formats";

/**
 * Styles a header row with a professional enterprise look
 */
function styleHeaderRow(row: ExcelJS.Row, bgColor: string) {
  row.height = 32;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Strict match: exact normalized equality only.
 * Used for master header mapping to avoid false positives.
 */
function strictMatch(rowKeys: string[], target: string): string | undefined {
  const nt = normalize(target);
  // 1. Exact normalized match
  const exact = rowKeys.find(k => normalize(k) === nt);
  if (exact) return exact;
  // 2. One fully contains the other — only if both are long enough (>5 chars)
  if (nt.length > 5) {
    const contained = rowKeys.find(k => {
      const nk = normalize(k);
      return nk.length > 5 && (nk === nt || nt.startsWith(nk) || nk.startsWith(nt));
    });
    if (contained) return contained;
  }
  return undefined;
}

/**
 * Map a single row to the MASTER_HEADERS columns.
 * Covers both old format headers (from formats.ts) and new standardized
 * headers from the isolated extractors.
 */

// Master mapping: every possible header variant → master column name
const HEADER_TO_MASTER: Record<string, string> = {
  // Sr. No.
  "sr. no.": "Sr. No.", "sr.": "Sr. No.", "sr no": "Sr. No.", "s.no": "Sr. No.",

  // Equipment/Pump Name
  "equipment name": "Equipment/Pump Name",
  "ahu fan name": "Equipment/Pump Name", "ahu fan": "Equipment/Pump Name",
  "pump name": "Equipment/Pump Name",
  "equipment/pump name": "Equipment/Pump Name",

  // Application
  "application": "Application", "application / location": "Application",

  // Make
  "make": "Make",

  // Frame Size
  "frame size": "Frame Size",

  // Mounting Type
  "foot or flange mounted": "Mounting Type",
  "mounting (foot/flange)": "Mounting Type",
  "foot/flange mounted": "Mounting Type",

  // Rated Power
  "rated power (kw)": "Rated Power (kW)",
  "rated power ,kw": "Rated Power (kW)",
  "rated power, kw": "Rated Power (kW)",
  "rated power kw": "Rated Power (kW)",

  // Rated Efficiency
  "rated efficiency (%)": "Rated Efficiency (%)",
  "rated efficiency,%": "Rated Efficiency (%)",
  "rated efficiency, %": "Rated Efficiency (%)",
  "rated efficiency %": "Rated Efficiency (%)",

  // IE Class
  "ie class": "IE Class",
  "ie class (ie1/ie2/ie3)": "IE Class",

  // Rated RPM
  "rated rpm": "Rated RPM",

  // Connection Type
  "drive type (direct/pulley/gear)": "Connection Type",
  "drive connection (direct/pulley/gear)": "Connection Type",
  "direct mount/ pulley/ gear": "Connection Type",
  "direcct mount/pulley /gear": "Connection Type",
  "belt / direct driven": "Connection Type",
  "drive type (belt/direct)": "Connection Type",

  // VFD Installed
  "vfd installed (y/n)": "VFD Installed",
  "vfd installed y/n": "VFD Installed",

  // VFD Details
  "vfd installed (y/n) & operating hz & make": "VFD Frequency/Details",
  "vfd make & model": "VFD Frequency/Details",
  "vfd make and model": "VFD Frequency/Details",
  "vfd details": "VFD Frequency/Details",
  "vfd operating frequency (hz)": "VFD Frequency/Details",

  // Daily Hours
  "daily running hours": "Daily Hours",
  "daily running hours hrs/day": "Daily Hours",

  // Annual Days
  "annual operating days": "Annual Days",
  "annual operating days, days/year": "Annual Days",

  // Design Flow
  "design flow (m3/hr)": "Design Flow",
  "design flow (cfm)": "Design Flow",
  "design flow, cfm": "Design Flow",
  "q ,m3/hr": "Design Flow",
  "q (m3/hr)": "Design Flow",

  // Measured Flow
  "measured flow (m3/hr)": "Measured Flow",
  "measured flow , m3/hr": "Measured Flow",
  "measured static pressure (mmwg)": "Measured Flow",

  // Design Head
  "design head (m)": "Design Head (m)",
  "head,m": "Design Head (m)",
  "head (m)": "Design Head (m)",

  // Suction Pressure
  "suction pressure (kg/cm2)": "Suction Pressure",
  "suction press (kg/cm2)": "Suction Pressure",

  // Discharge Pressure
  "discharge pressure (kg/cm2)": "Discharge Pressure",

  // Static Pressure
  "design static pressure (mmwg)": "Static Pressure",
  "static pressure (mm wg)": "Static Pressure",
  "static pressure,mm wg": "Static Pressure",

  // Observations
  "observations": "Observations/Drive Details",
  "observation": "Observations/Drive Details",
  "throttling present (yes/no)": "Observations/Drive Details",

  // Phase
  "phase (r/y/b/avg)": "Phase (R/Y/B/Avg)",

  // Measured Voltage
  "measured voltage (v)": "Measured Voltage (V)",
  "measured voltage": "Measured Voltage (V)",
  "meassured voltage": "Measured Voltage (V)",

  // Measured Current
  "measured current (a)": "Measured Current (A)",
  "measured current": "Measured Current (A)",

  // Measured Power
  "measured power (kw)": "Measured Power (kW)",
  "measured kw": "Measured Power (kW)",

  // Measured PF
  "measured pf": "Measured PF",
};

function mapRowToMaster(row: ExtractedRow, _formatId: string): (string | number | boolean | null)[] {
  const rowKeys = Object.keys(row);

  return MASTER_HEADERS.map(masterHeader => {
    // Try each row key — normalize and look up in the mapping table
    for (const rowKey of rowKeys) {
      const nk = rowKey.toLowerCase().trim();
      const mapped = HEADER_TO_MASTER[nk];
      if (mapped === masterHeader) {
        const val = row[rowKey];
        if (val !== undefined && val !== null && val !== "") return val;
      }
    }

    // Fallback: direct normalized match against master header
    const nm = masterHeader.toLowerCase().trim();
    const directKey = rowKeys.find(k => k.toLowerCase().trim() === nm);
    if (directKey) return row[directKey];

    return "";
  });
}

/**
 * Main Excel Export Engine
 */
export async function exportToExcel(sheets: ExtractedSheet[]) {
  console.log("[EXCEL] Generating Enterprise Report...");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DocuStruct AI Enterprise";
  workbook.created = new Date();

  // ── 1. Raw Data Sheet (always populated — shows exactly what was extracted) ──
  // This sheet uses the actual keys from the data, not a fixed schema.
  // It guarantees data is always visible even if format detection is off.
  const allRows = sheets.flatMap(s => s.rows);
  if (allRows.length > 0) {
    const rawSheet = workbook.addWorksheet("Raw Extracted Data", {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Collect all unique keys across all rows
    const allKeys = Array.from(new Set(allRows.flatMap(r => Object.keys(r))));
    const rawHeaderRow = rawSheet.addRow(allKeys);
    styleHeaderRow(rawHeaderRow, 'FFE91E8C'); // Pink

    allRows.forEach(row => {
      const rowData = allKeys.map(k => {
        const val = row[k];
        return val !== undefined && val !== null ? String(val) : "";
      });
      const excelRow = rawSheet.addRow(rowData);
      excelRow.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          left: { style: 'thin' },
          right: { style: 'thin' },
          bottom: { style: 'thin' }
        };
      });
    });

    rawSheet.columns.forEach(col => { col.width = 20; });
    console.log(`[EXCEL] Raw Data sheet: ${allRows.length} rows, ${allKeys.length} columns`);
  }

  // ── 2. Master Audit Report (mapped to unified schema) ──
  const masterSheet = workbook.addWorksheet("Master Audit Report", {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }]
  });

  const masterHeaderRow = masterSheet.addRow(MASTER_HEADERS);
  styleHeaderRow(masterHeaderRow, 'FFE91E8C'); // Pink

  sheets.forEach(sheet => {
    sheet.rows.forEach(row => {
      const masterRowData = mapRowToMaster(row, sheet.formatId);
      const newRow = masterSheet.addRow(masterRowData);

      const phaseValue = String(row["Phase (R/Y/B/Avg)"] || "").toLowerCase();
      const isAverage = phaseValue.includes("avg") || phaseValue.includes("average");

      newRow.eachCell((cell, colIdx) => {
        const isFirstCol = colIdx === 1;
        const isLastCol = colIdx === MASTER_HEADERS.length;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          left: isFirstCol ? { style: 'medium' } : { style: 'thin' },
          right: isLastCol ? { style: 'medium' } : { style: 'thin' },
          bottom: isAverage ? { style: 'medium' } : { style: 'thin' }
        };
        if (isAverage) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          cell.font = { bold: true };
        }
      });
    });
  });

  masterSheet.columns.forEach(col => { col.width = 22; });

  // ── 3. Per-Format Sheets (one sheet per detected format) ──
  const formatGroups: Record<string, ExtractedRow[]> = {};
  const formatSheetNames: Record<string, string> = {
    "format-a": "Comprehensive Audit",
    "format-b": "AHU Fan Audit",
    "format-c": "Equipment Nameplate",
    "format-d": "Pump ETP Audit",
  };

  sheets.forEach(s => {
    const fid = s.formatId || "format-a";
    if (!formatGroups[fid]) formatGroups[fid] = [];
    formatGroups[fid].push(...s.rows);
  });

  Object.entries(formatGroups).forEach(([fid, rows]) => {
    if (rows.length === 0) return;

    const sheetName = (formatSheetNames[fid] || fid).slice(0, 31);
    const ws = workbook.addWorksheet(sheetName);

    // Use actual keys from the data as headers — these come from the isolated extractors
    // and are already standardized per format
    const allKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const hRow = ws.addRow(allKeys);
    styleHeaderRow(hRow, 'FFE91E8C'); // Pink

    rows.forEach(row => {
      const rowData = allKeys.map(k => String(row[k] ?? ""));
      const excelRow = ws.addRow(rowData);

      const phaseVal = String(row["Phase (R/Y/B/Avg)"] || "").toLowerCase();
      const isAvg = phaseVal.includes("avg") || phaseVal.includes("average");

      excelRow.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
        if (isAvg) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          cell.font = { bold: true };
        }
      });
    });

    ws.columns.forEach(col => { col.width = 20; });
  });

  // ── Finalize ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  saveAs(blob, `Industrial_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  console.log("[EXCEL] Export complete.");
}
