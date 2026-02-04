import { BadRequestException, Injectable } from '@nestjs/common';
import { FORMATS } from './resume-formatter/constants';
import {
  parseResumeContent,
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

    const { name, summary, bullets, skills } = parseResumeContent(resumeText);
    const displayName = name || 'Candidate';

    // TODO: Replace with a structured resume parser and LLM-enhanced formatting.
    let content = '';
    switch (format.id) {
      case 'modern':
        content = formatModern(displayName, summary, bullets, skills);
        break;
      case 'classic':
        content = formatClassic(displayName, summary, bullets, skills);
        break;
      case 'compact':
        content = formatCompact(displayName, summary, bullets, skills);
        break;
      default:
        content = formatModern(displayName, summary, bullets, skills);
    }

    const safeName = sanitizeFileName(displayName);

    return {
      formatId: format.id,
      formatLabel: format.label,
      content,
      fileName: `${safeName}-resume-${format.id}.${format.fileExtension}`,
      mimeType: format.mimeType,
    };
  }
}
