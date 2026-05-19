
export interface FormatDefinition {
  id: string;
  label: string;
  headers: string[];
  instructionPrefix: string;
  dynamicColumns: string[];
  /** Keywords the AI should look for to identify this format */
  classificationKeywords: string[];
  /** Maps local format headers to Master Schema headers */
  mapping?: Record<string, string>;
}

/** 
 * MASTER SCHEMA: The unified output structure for the final Excel.
 * Includes all possible fields from the 4 formats.
 */
export const MASTER_HEADERS = [
  "Sr. No.", "Audit Type", "Equipment/Pump Name", "Application", "Make", "Frame Size", 
  "Mounting Type", "Rated Power (kW)", "Rated Efficiency (%)", "IE Class", "Rated RPM", 
  "Connection Type", "VFD Installed", "VFD Frequency/Details", "Daily Hours", 
  "Annual Days", "Design Flow", "Measured Flow", "Design Head (m)", 
  "Suction Pressure", "Discharge Pressure", "Static Pressure", "Observations/Drive Details",
  "Phase (R/Y/B/Avg)", "Measured Voltage (V)", "Measured Current (A)", 
  "Measured Power (kW)", "Measured PF"
];

export const DOCUMENT_FORMATS: FormatDefinition[] = [
  {
    id: "format-a",
    label: "Comprehensive Audit (Format A)",
    classificationKeywords: ["Comprehensive Audit", "Air comp", "Condenser", "Evaporator", "Annual Energy Cost"],
    headers: [
      "Sr. No.", "Equipment Name", "Application", "Make", "Frame Size", "Foot or Flange Mounted", 
      "Rated Power ,KW", "Rated Efficiency,%", "IE Class (IE1/IE2/IE3)", "Rated RPM", 
      "Direcct Mount/Pulley /Gear", "VFD installed Y/N", "Daily Running Hours", 
      "Annual operating Days", "Observation", "VFD Make and Model", 
      "VFD operating Frequency if VFD is Installed", "Q ,m3/hr", "Head,m", 
      "Measured Flow , m3/hr", "Suction press (Kg/cm2)", "Discharge Pressure (Kg/cm2)", 
      "Suction Tempreture Air comp", "Condenser IN(Kg/cm2)", "Condenser OUT(Kg/cm2)", 
      "Evaporator IN (Kg/cm2)", "Evaporator OUT (Kg/cm2)", "CT Sum Water Temperature", 
      "Air Compressor/ AWU,CFM", "Static pressure,mm wg", "Blower", 
      "Direct Mount/Pulley /Gear", "Motor Pulley Dia", "Driven Pulley Dia", 
      "Phase (R/Y/B/Avg)", "Meassured voltage", "Measured Current", "Measured kW", 
      "Measured PF", "Average Measured kW", "% Loading", "kWh/Day", "kWh/Year", 
      "Annual Energy Cost, Rs."
    ],
    instructionPrefix: "COMPREHENSIVE AUDIT MODE: This is for high-detail facility audits. Extract mechanical specs (Motor/Pump/Compressor) and map electrical readings across the 4-row (R, Y, B, Avg) structure.",
    dynamicColumns: ["Phase (R/Y/B/Avg)", "Meassured voltage", "Measured Current", "Measured kW", "Measured PF"],
    mapping: {
      "Equipment Name": "Equipment/Pump Name",
      "Foot or Flange Mounted": "Mounting Type",
      "Rated Power ,KW": "Rated Power (kW)",
      "Rated Efficiency,%": "Rated Efficiency (%)",
      "IE Class (IE1/IE2/IE3)": "IE Class",
      "Direcct Mount/Pulley /Gear": "Connection Type",
      "VFD installed Y/N": "VFD Installed",
      "VFD Make and Model": "VFD Frequency/Details",
      "Daily Running Hours": "Daily Hours",
      "Annual operating Days": "Annual Days",
      "Q ,m3/hr": "Design Flow",
      "Measured Flow , m3/hr": "Measured Flow",
      "Head,m": "Design Head (m)",
      "Suction press (Kg/cm2)": "Suction Pressure",
      "Discharge Pressure (Kg/cm2)": "Discharge Pressure",
      "Static pressure,mm wg": "Static Pressure",
      "Observation": "Observations/Drive Details",
      "Meassured voltage": "Measured Voltage (V)",
      "Measured Current": "Measured Current (A)",
      "Measured kW": "Measured Power (kW)",
      "Measured PF": "Measured PF"
    }
  },
  {
    id: "format-b",
    label: "AHU Fan Audit (Format B)",
    classificationKeywords: ["AHU Fan", "Design Flow, CFM", "Static Pressure, MMWG", "belt / direct driven"],
    headers: [
      "Sr.", "AHU Fan", "Application", "Design Flow, CFM", "Static Pressure, MMWG", 
      "Measured Static Pressure, MMWG", "Make", "Frame Size", "Foot or Flange Mounted", 
      "Rated Power, KW", "Rated Efficiency, %", "IE Class (IE1/IE2/IE3)", "Rated RPM", 
      "VFD installed, (Y/N), Oper Hz & Make", "Daily Running Hours Hrs/Day", 
      "Annual Operating Days, Days/Year", "belt / direct driven",
      "Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"
    ],
    instructionPrefix: "AHU FAN MODE: Focus on Air Handling Units. Mandatory extraction of CFM (Design Flow) and Static Pressure (MMWG). Identify drive type (Belt vs Direct).",
    dynamicColumns: ["Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"],
    mapping: {
      "Sr.": "Sr. No.",
      "AHU Fan": "Equipment/Pump Name",
      "Design Flow, CFM": "Design Flow",
      "Static Pressure, MMWG": "Static Pressure",
      "Measured Static Pressure, MMWG": "Measured Flow",
      "Foot or Flange Mounted": "Mounting Type",
      "Rated Power, KW": "Rated Power (kW)",
      "Rated Efficiency, %": "Rated Efficiency (%)",
      "IE Class (IE1/IE2/IE3)": "IE Class",
      "VFD installed, (Y/N), Oper Hz & Make": "VFD Frequency/Details",
      "Daily Running Hours Hrs/Day": "Daily Hours",
      "Annual Operating Days, Days/Year": "Annual Days",
      "belt / direct driven": "Connection Type",
      "Measured Voltage": "Measured Voltage (V)",
      "Measured Current": "Measured Current (A)",
      "Measured KW": "Measured Power (kW)",
      "Measured PF": "Measured PF"
    }
  },
  {
    id: "format-c",
    label: "Equipment Nameplate (Format C)",
    classificationKeywords: ["Equipment Nameplate", "Direct Mount/ Pulley/ Gear", "VFD details", "Motor Efficiency"],
    headers: [
      "Sr.", "Equipment Name", "Application", "Make", "Frame Size", "Foot or Flange Mounted", 
      "Rated Power, KW", "Rated Efficiency, %", "IE Class (IE1/IE2/IE3)", "Rated RPM", 
      "Direct Mount/ Pulley/ Gear", "VFD installed, (Y/N), Oper Hz & Make", 
      "Daily Running Hours Hrs/Day", "Annual Operating Days, Days/Year", "Observations",
      "Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"
    ],
    instructionPrefix: "EQUIPMENT NAMEPLATE MODE: Standardized motor nameplate extraction. Capture mechanical load connection (Direct/Pulley/Gear) and VFD configurations.",
    dynamicColumns: ["Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"],
    mapping: {
      "Sr.": "Sr. No.",
      "Equipment Name": "Equipment/Pump Name",
      "Foot or Flange Mounted": "Mounting Type",
      "Rated Power, KW": "Rated Power (kW)",
      "Rated Efficiency, %": "Rated Efficiency (%)",
      "IE Class (IE1/IE2/IE3)": "IE Class",
      "Direct Mount/ Pulley/ Gear": "Connection Type",
      "VFD installed, (Y/N), Oper Hz & Make": "VFD Frequency/Details",
      "Daily Running Hours Hrs/Day": "Daily Hours",
      "Annual Operating Days, Days/Year": "Annual Days",
      "Observations": "Observations/Drive Details",
      "Measured Voltage": "Measured Voltage (V)",
      "Measured Current": "Measured Current (A)",
      "Measured KW": "Measured Power (kW)",
      "Measured PF": "Measured PF"
    }
  },
  {
    id: "format-d",
    label: "Pump/ETP Audit (Format D)",
    classificationKeywords: ["Pump Name", "Design Flow (m3/hr)", "Suction Pressure (kg/cm2)", "Throttling Present"],
    headers: [
      "Sr.", "Pump Name", "Application", "Design Flow (m3/hr)", "Design Head (m)", 
      "Suction Pressure (kg/cm2)", "Discharge Pressure (kg/cm2)", "Measured Flow (m3/hr)", 
      "Make", "Frame Size", "Foot/Flange Mounted", "Rated Power KW", "Rated Efficiency %", 
      "IE Class", "Rated RPM", "VFD Details", "Daily Running Hours", 
      "Annual Operating Days", "Throttling Present (Yes/No)",
      "Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"
    ],
    instructionPrefix: "PUMP AUDIT MODE: Extract pump-specific parameters like Head, Suction Press, and Discharge Press. Note if Throttling is present.",
    dynamicColumns: ["Phase (R/Y/B/Avg)", "Measured Voltage", "Measured Current", "Measured KW", "Measured PF"],
    mapping: {
      "Sr.": "Sr. No.",
      "Pump Name": "Equipment/Pump Name",
      "Design Flow (m3/hr)": "Design Flow",
      "Design Head (m)": "Design Head (m)",
      "Suction Pressure (kg/cm2)": "Suction Pressure",
      "Discharge Pressure (kg/cm2)": "Discharge Pressure",
      "Measured Flow (m3/hr)": "Measured Flow",
      "Foot/Flange Mounted": "Mounting Type",
      "Rated Power KW": "Rated Power (kW)",
      "Rated Efficiency %": "Rated Efficiency (%)",
      "VFD Details": "VFD Frequency/Details",
      "Daily Running Hours": "Daily Hours",
      "Annual Operating Days": "Annual Days",
      "Throttling Present (Yes/No)": "Observations/Drive Details",
      "Measured Voltage": "Measured Voltage (V)",
      "Measured Current": "Measured Current (A)",
      "Measured KW": "Measured Power (kW)",
      "Measured PF": "Measured PF"
    }
  }
];
