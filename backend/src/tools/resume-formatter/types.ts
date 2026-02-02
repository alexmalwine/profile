export type ResumeFormatId = 'modern' | 'classic' | 'compact';

export interface ResumeFormat {
  id: ResumeFormatId;
  label: string;
  description: string;
  fileExtension: string;
  mimeType: string;
}

export interface FormatResult {
  formatId: ResumeFormatId;
  formatLabel: string;
  content: string;
  fileName: string;
  mimeType: string;
}
