/**
 * FORMAT D EXTRACTOR — Pump / ETP Audit
 * ──────────────────────────────────────────────────────────────────────────
 * Handles pump and Effluent Treatment Plant (ETP) audit tables with:
 *   - Pump hydraulic parameters (flow m3/hr, head m, suction/discharge pressure)
 *   - Throttling valve status
 *   - 4-row phase structure per pump
 */

export const FORMAT_D_HEADERS = [
  "Sr. No.",
  "Pump Name",
  "Application",
  "Design Flow (m3/hr)",
  "Design Head (m)",
  "Suction Pressure (kg/cm2)",
  "Discharge Pressure (kg/cm2)",
  "Measured Flow (m3/hr)",
  "Make",
  "Frame Size",
  "Mounting (Foot/Flange)",
  "Rated Power (KW)",
  "Rated Efficiency (%)",
  "IE Class",
  "Rated RPM",
  "VFD Details",
  "Daily Running Hours",
  "Annual Operating Days",
  "Throttling Present (Yes/No)",
  "Phase (R/Y/B/Avg)",
  "Measured Voltage (V)",
  "Measured Current (A)",
  "Measured Power (kW)",
  "Measured PF"
];

export const FORMAT_D_PROMPT = `You are extracting data from a PUMP / ETP AUDIT document (Format D).

THIS FORMAT CONTAINS: Pump audit data with hydraulic parameters and electrical measurements.

CRITICAL IDENTIFIERS FOR THIS FORMAT:
- Equipment column is labeled "Pump Name" or "Pump No." or similar
- Has "Suction Pressure (kg/cm2)" column
- Has "Discharge Pressure (kg/cm2)" column
- Has "Design Flow (m3/hr)" — flow in cubic metres per hour (NOT CFM)
- Has "Throttling Present (Yes/No)" column
- Does NOT have: CFM, MMWG, Annual Energy Cost

EXTRACTION RULES FOR FORMAT D:
1. Use EXACTLY these column headers (in this order):
   ${FORMAT_D_HEADERS.join(" | ")}

2. ROW STRUCTURE — 4 rows per pump:
   - Row 1: Phase R  (fill Sr.No, Pump Name, all hydraulic specs, motor specs, then Phase=R, electrical readings)
   - Row 2: Phase Y  (Sr.No="", Pump Name="", specs="", Phase=Y, electrical readings)
   - Row 3: Phase B  (Sr.No="", Pump Name="", specs="", Phase=B, electrical readings)
   - Row 4: Average  (Sr.No="", Pump Name="", specs="", Phase=Avg, averaged readings)

3. STATIC SPECS (Make, Frame, Rated Power, Suction/Discharge Pressure, etc.) go ONLY in the Phase R row.

4. Map document headers to output headers:
   - "Pump Name" / "Pump No." → "Pump Name"
   - "Design Flow (m3/hr)" / "Q (m3/hr)" → "Design Flow (m3/hr)"
   - "Head (m)" / "Design Head" → "Design Head (m)"
   - "Suction press (Kg/cm2)" → "Suction Pressure (kg/cm2)"
   - "Discharge Pressure (Kg/cm2)" → "Discharge Pressure (kg/cm2)"
   - "Measured Flow , m3/hr" → "Measured Flow (m3/hr)"
   - "Throttling Present" → "Throttling Present (Yes/No)"
   - "VFD installed Y/N" / "VFD Details" → "VFD Details"

5. If a cell is empty or unreadable → use "--"
6. Do NOT skip any pump row

Return ONLY this JSON (no markdown, no explanation):
{
  "detectedFormatId": "format-d",
  "sheets": [{
    "name": "Pump_ETP_Audit",
    "grid": [
      ["Sr. No.", "Pump Name", "Application", "Design Flow (m3/hr)", "Design Head (m)", "Suction Pressure (kg/cm2)", "Discharge Pressure (kg/cm2)", "Measured Flow (m3/hr)", "Make", "Frame Size", "Mounting (Foot/Flange)", "Rated Power (KW)", "Rated Efficiency (%)", "IE Class", "Rated RPM", "VFD Details", "Daily Running Hours", "Annual Operating Days", "Throttling Present (Yes/No)", "Phase (R/Y/B/Avg)", "Measured Voltage (V)", "Measured Current (A)", "Measured Power (kW)", "Measured PF"],
      ["1", "CW Pump-1", "Cooling Water", "500", "35", "0.5", "3.8", "480", "KSB", "200L", "Foot", "55", "92.1", "IE3", "1450", "N", "22", "300", "No", "R", "415", "88", "54", "0.88"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Y", "412", "87", "53.5", "0.87"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "B", "418", "89", "54.5", "0.89"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Avg", "415", "88", "54", "0.88"]
    ]
  }]
}`;
