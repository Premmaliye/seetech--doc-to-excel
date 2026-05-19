/**
 * FORMAT A EXTRACTOR — Comprehensive Motor/Equipment Audit
 * ──────────────────────────────────────────────────────────────────────────
 * Handles large mixed-equipment audit tables with:
 *   - Motors, Pumps, Air Compressors, Chillers, Cooling Towers, Blowers
 *   - 4-row phase structure (R, Y, B, Average) per equipment
 *   - Annual energy cost calculations
 */

export const FORMAT_A_HEADERS = [
  "Sr. No.",
  "Equipment Name",
  "Application",
  "Make",
  "Frame Size",
  "Foot or Flange Mounted",
  "Rated Power (KW)",
  "Rated Efficiency (%)",
  "IE Class",
  "Rated RPM",
  "Drive Type (Direct/Pulley/Gear)",
  "VFD Installed (Y/N)",
  "VFD Make & Model",
  "VFD Operating Frequency (Hz)",
  "Daily Running Hours",
  "Annual Operating Days",
  "Design Flow (m3/hr)",
  "Design Head (m)",
  "Measured Flow (m3/hr)",
  "Suction Pressure (kg/cm2)",
  "Discharge Pressure (kg/cm2)",
  "Static Pressure (mm wg)",
  "Observations",
  "Phase (R/Y/B/Avg)",
  "Measured Voltage (V)",
  "Measured Current (A)",
  "Measured Power (kW)",
  "Measured PF",
  "% Loading",
  "kWh/Day",
  "kWh/Year",
  "Annual Energy Cost (Rs.)"
];

export const FORMAT_A_PROMPT = `You are extracting data from a COMPREHENSIVE MOTOR/EQUIPMENT AUDIT document (Format A).

THIS FORMAT CONTAINS: Motors, Pumps, Air Compressors, Chillers, Cooling Towers, Blowers in one large table.

EXTRACTION RULES FOR FORMAT A:
1. Use EXACTLY these column headers (in this order):
   ${FORMAT_A_HEADERS.join(" | ")}

2. ROW STRUCTURE — 4 rows per equipment:
   - Row 1: Phase R  (fill Sr.No, Equipment Name, all specs, then Phase=R, Voltage R, Current R, kW R, PF R)
   - Row 2: Phase Y  (Sr.No="", Equipment Name="", specs="", Phase=Y, Voltage Y, Current Y, kW Y, PF Y)
   - Row 3: Phase B  (Sr.No="", Equipment Name="", specs="", Phase=B, Voltage B, Current B, kW B, PF B)
   - Row 4: Average  (Sr.No="", Equipment Name="", specs="", Phase=Avg, Voltage avg, Current avg, kW avg, PF avg)

3. STATIC SPECS (Make, Frame, Rated Power, etc.) go ONLY in the Phase R row. Leave blank for Y, B, Avg rows.

4. If a cell is empty or unreadable → use "--"
5. Do NOT skip any equipment row
6. Preserve all numbers exactly as written

Return ONLY this JSON (no markdown, no explanation):
{
  "detectedFormatId": "format-a",
  "sheets": [{
    "name": "Comprehensive_Audit",
    "grid": [
      ["Sr. No.", "Equipment Name", "Application", "Make", "Frame Size", "Foot or Flange Mounted", "Rated Power (KW)", "Rated Efficiency (%)", "IE Class", "Rated RPM", "Drive Type (Direct/Pulley/Gear)", "VFD Installed (Y/N)", "VFD Make & Model", "VFD Operating Frequency (Hz)", "Daily Running Hours", "Annual Operating Days", "Design Flow (m3/hr)", "Design Head (m)", "Measured Flow (m3/hr)", "Suction Pressure (kg/cm2)", "Discharge Pressure (kg/cm2)", "Static Pressure (mm wg)", "Observations", "Phase (R/Y/B/Avg)", "Measured Voltage (V)", "Measured Current (A)", "Measured Power (kW)", "Measured PF", "% Loading", "kWh/Day", "kWh/Year", "Annual Energy Cost (Rs.)"],
      ["1", "Main Pump", "Cooling", "ABB", "160M", "Foot", "22", "91.5", "IE3", "1450", "Direct", "N", "--", "--", "20", "300", "150", "30", "--", "1.2", "3.5", "--", "--", "R", "415", "42", "22", "0.85", "75", "440", "132000", "132000"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Y", "412", "41", "21.5", "0.84", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "B", "418", "43", "22.5", "0.86", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Avg", "415", "42", "22", "0.85", "", "", "", ""]
    ]
  }]
}`;
