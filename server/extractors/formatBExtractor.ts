/**
 * FORMAT B EXTRACTOR — AHU Fan Audit
 * ──────────────────────────────────────────────────────────────────────────
 * Handles Air Handling Unit (AHU) fan audit tables with:
 *   - Design Flow in CFM (cubic feet per minute)
 *   - Static Pressure in MMWG (millimetres water gauge)
 *   - Belt vs Direct drive identification
 *   - 4-row phase structure per AHU
 */

export const FORMAT_B_HEADERS = [
  "Sr. No.",
  "AHU Fan Name",
  "Application / Location",
  "Design Flow (CFM)",
  "Design Static Pressure (MMWG)",
  "Measured Static Pressure (MMWG)",
  "Make",
  "Frame Size",
  "Mounting (Foot/Flange)",
  "Rated Power (KW)",
  "Rated Efficiency (%)",
  "IE Class",
  "Rated RPM",
  "VFD Installed (Y/N) & Operating Hz & Make",
  "Daily Running Hours",
  "Annual Operating Days",
  "Drive Type (Belt/Direct)",
  "Phase (R/Y/B/Avg)",
  "Measured Voltage (V)",
  "Measured Current (A)",
  "Measured Power (kW)",
  "Measured PF"
];

export const FORMAT_B_PROMPT = `You are extracting data from an AHU FAN AUDIT document (Format B).

THIS FORMAT CONTAINS: Air Handling Unit (AHU) fan data with CFM flow rates and MMWG static pressure.

CRITICAL IDENTIFIERS FOR THIS FORMAT:
- Equipment column is labeled "AHU Fan" or "AHU No." or similar
- Flow is in CFM (cubic feet per minute) — NOT m3/hr
- Pressure is in MMWG (millimetres water gauge) — NOT kg/cm2
- Has a "belt / direct driven" or drive type column

EXTRACTION RULES FOR FORMAT B:
1. Use EXACTLY these column headers (in this order):
   ${FORMAT_B_HEADERS.join(" | ")}

2. ROW STRUCTURE — 4 rows per AHU:
   - Row 1: Phase R  (fill Sr.No, AHU name, all specs, then Phase=R, electrical readings)
   - Row 2: Phase Y  (Sr.No="", AHU name="", specs="", Phase=Y, electrical readings)
   - Row 3: Phase B  (Sr.No="", AHU name="", specs="", Phase=B, electrical readings)
   - Row 4: Average  (Sr.No="", AHU name="", specs="", Phase=Avg, averaged readings)

3. STATIC SPECS go ONLY in the Phase R row. Leave blank for Y, B, Avg rows.

4. Map document headers to output headers:
   - "AHU Fan" / "AHU No." → "AHU Fan Name"
   - "Design Flow, CFM" / "Design Flow (CFM)" → "Design Flow (CFM)"
   - "Static Pressure, MMWG" → "Design Static Pressure (MMWG)"
   - "Measured Static Pressure" → "Measured Static Pressure (MMWG)"
   - "belt / direct driven" → "Drive Type (Belt/Direct)"

5. If a cell is empty or unreadable → use "--"
6. Do NOT skip any AHU row

Return ONLY this JSON (no markdown, no explanation):
{
  "detectedFormatId": "format-b",
  "sheets": [{
    "name": "AHU_Fan_Audit",
    "grid": [
      ["Sr. No.", "AHU Fan Name", "Application / Location", "Design Flow (CFM)", "Design Static Pressure (MMWG)", "Measured Static Pressure (MMWG)", "Make", "Frame Size", "Mounting (Foot/Flange)", "Rated Power (KW)", "Rated Efficiency (%)", "IE Class", "Rated RPM", "VFD Installed (Y/N) & Operating Hz & Make", "Daily Running Hours", "Annual Operating Days", "Drive Type (Belt/Direct)", "Phase (R/Y/B/Avg)", "Measured Voltage (V)", "Measured Current (A)", "Measured Power (kW)", "Measured PF"],
      ["1", "AHU-01", "Level 2", "5000", "25", "23", "Kirloskar", "132M", "Foot", "11", "89.5", "IE2", "1450", "N", "18", "300", "Belt", "R", "415", "18", "11", "0.87"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Y", "412", "17.5", "10.8", "0.86"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "B", "418", "18.2", "11.2", "0.88"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Avg", "415", "17.9", "11", "0.87"]
    ]
  }]
}`;
