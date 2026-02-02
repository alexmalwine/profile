import { BadRequestException, Injectable } from '@nestjs/common';
import { FORMATS } from './resume-formatter/constants';
import {
  extractSkills,
  normalizeResumeLines,
  sanitizeFileName,
} from './resume-formatter/helpers';
import {
  formatClassic,
  formatCompact,
  formatModern,
} from './resume-formatter/templates';
import type { FormatResult } from './resume-formatter/types';

@Injectable()
export class ResumeFormatterService {
  getFormats() {
    return FORMATS.map(({ id, label, description }) => ({
      id,
      label,
      description,
    }));
  }

  formatResume(resumeText: string, formatId: string): FormatResult {
    const format = FORMATS.find((entry) => entry.id === formatId);
    if (!format) {
      throw new BadRequestException('Unknown resume format.');
    }

    const lines = normalizeResumeLines(resumeText);
    const name = lines[0] ?? 'Candidate Name';
    const summaryLines = lines.slice(1, 4);
    const detailLines = lines.slice(4);
    const summary = summaryLines.join(' ');
    const bullets = detailLines.length > 0 ? detailLines : summaryLines;
    const skills = extractSkills(resumeText);

    // TODO: Replace with a structured resume parser and LLM-enhanced formatting.
    let content = '';
    switch (format.id) {
      case 'modern':
        content = formatModern(name, summary, bullets, skills);
        break;
      case 'classic':
        content = formatClassic(name, summary, bullets, skills);
        break;
      case 'compact':
        content = formatCompact(name, summary, bullets, skills);
        break;
      default:
        content = formatModern(name, summary, bullets, skills);
    }

    const safeName = sanitizeFileName(name);

    return {
      formatId: format.id,
      formatLabel: format.label,
      content,
      fileName: `${safeName}-resume-${format.id}.${format.fileExtension}`,
      mimeType: format.mimeType,
    };
  }
}
