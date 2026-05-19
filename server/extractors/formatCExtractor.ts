/**
 * FORMAT C EXTRACTOR — Equipment Nameplate / Motor Audit
 * ──────────────────────────────────────────────────────────────────────────
 * Handles motor nameplate data collection tables with:
 *   - Motor specs from nameplate (Make, Frame, Rated Power, Efficiency, IE Class)
 *   - Drive connection type (Direct Mount / Pulley / Gear)
 *   - VFD installation details
 *   - 4-row phase structure per motor
 *   - NO pump-specific columns (no suction/discharge pressure, no m3/hr flow)
 */

export const FORMAT_C_HEADERS = [
  "Sr. No.",
  "Equipment Name",
  "Application",
  "Make",
  "Frame Size",
  "Mounting (Foot/Flange)",
  "Rated Power (KW)",
  "Rated Efficiency (%)",
  "IE Class",
  "Rated RPM",
  "Drive Connection (Direct/Pulley/Gear)",
  "Motor Pulley Dia (mm)",
  "Driven Pulley Dia (mm)",
  "VFD Installed (Y/N) & Operating Hz & Make",
  "Daily Running Hours",
  "Annual Operating Days",
  "Observations",
  "Phase (R/Y/B/Avg)",
  "Measured Voltage (V)",
  "Measured Current (A)",
  "Measured Power (kW)",
  "Measured PF"
];

export const FORMAT_C_PROMPT = `You are extracting data from an EQUIPMENT NAMEPLATE / MOTOR AUDIT document (Format C).

THIS FORMAT CONTAINS: Motor nameplate data — equipment specs collected from motor nameplates with electrical measurements.

CRITICAL IDENTIFIERS FOR THIS FORMAT:
- Has "Equipment Name" column (NOT "AHU Fan", NOT "Pump Name")
- Has "Direct Mount / Pulley / Gear" or "Drive Connection" column
- Has "Motor Pulley Dia" and "Driven Pulley Dia" columns (if belt-driven)
- Has VFD details column
- Does NOT have: CFM, MMWG, Suction Pressure, Discharge Pressure, Throttling, m3/hr flow
- Does NOT have: Annual Energy Cost, kWh/Year columns

EXTRACTION RULES FOR FORMAT C:
1. Use EXACTLY these column headers (in this order):
   ${FORMAT_C_HEADERS.join(" | ")}

2. ROW STRUCTURE — 4 rows per motor:
   - Row 1: Phase R  (fill Sr.No, Equipment Name, all nameplate specs, then Phase=R, electrical readings)
   - Row 2: Phase Y  (Sr.No="", Equipment Name="", specs="", Phase=Y, electrical readings)
   - Row 3: Phase B  (Sr.No="", Equipment Name="", specs="", Phase=B, electrical readings)
   - Row 4: Average  (Sr.No="", Equipment Name="", specs="", Phase=Avg, averaged readings)

3. STATIC SPECS (Make, Frame, Rated Power, etc.) go ONLY in the Phase R row.

4. Map document headers to output headers:
   - "Direct Mount/ Pulley/ Gear" → "Drive Connection (Direct/Pulley/Gear)"
   - "VFD installed, (Y/N), Oper Hz & Make" → "VFD Installed (Y/N) & Operating Hz & Make"
   - "Daily Running Hours Hrs/Day" → "Daily Running Hours"
   - "Annual Operating Days, Days/Year" → "Annual Operating Days"

5. If a cell is empty or unreadable → use "--"
6. Do NOT skip any equipment row

Return ONLY this JSON (no markdown, no explanation):
{
  "detectedFormatId": "format-c",
  "sheets": [{
    "name": "Equipment_Nameplate_Audit",
    "grid": [
      ["Sr. No.", "Equipment Name", "Application", "Make", "Frame Size", "Mounting (Foot/Flange)", "Rated Power (KW)", "Rated Efficiency (%)", "IE Class", "Rated RPM", "Drive Connection (Direct/Pulley/Gear)", "Motor Pulley Dia (mm)", "Driven Pulley Dia (mm)", "VFD Installed (Y/N) & Operating Hz & Make", "Daily Running Hours", "Annual Operating Days", "Observations", "Phase (R/Y/B/Avg)", "Measured Voltage (V)", "Measured Current (A)", "Measured Power (kW)", "Measured PF"],
      ["1", "Cooling Tower Fan", "CT-01", "Siemens", "160L", "Foot", "15", "90.2", "IE3", "960", "Direct", "--", "--", "N", "24", "300", "--", "R", "415", "24", "14.5", "0.88"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Y", "413", "23.5", "14.2", "0.87"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "B", "417", "24.2", "14.8", "0.89"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Avg", "415", "23.9", "14.5", "0.88"]
    ]
  }]
}`;
