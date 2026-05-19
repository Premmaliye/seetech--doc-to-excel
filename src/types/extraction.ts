export interface ExtractedRow {
  [key: string]: string | number | boolean | null;
}

export interface ExtractedSheet {
  name: string;
  rows: ExtractedRow[];
  formatId: string;
}

export interface ExtractionResult {
  sheets: ExtractedSheet[];
  detectedFormatId?: string;
}

export interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}
