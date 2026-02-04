import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { PDFParse } from 'pdf-parse';
import { ResumeFormatterService } from './resume-formatter.service';
import type { FormatResult } from './resume-formatter/types';

@Controller('api/tools/resume-formatter')
export class ResumeFormatterController {
  private readonly logger = new Logger(ResumeFormatterController.name);

  constructor(
    private readonly resumeFormatterService: ResumeFormatterService,
  ) {}

  @Get('formats')
  getFormats() {
    return this.resumeFormatterService.getFormats();
  }

  @Post('format')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async formatResume(
    @UploadedFile() file?: Express.Multer.File,
    @Body('formatId') formatId?: string,
  ): Promise<FormatResult> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = await this.extractResumeText(file);
    const selectedFormat = formatId?.trim() || 'modern';

    return this.resumeFormatterService.formatResume(resumeText, selectedFormat);
  }

  private async extractResumeText(file: Express.Multer.File): Promise<string> {
    if (this.isPdfResume(file)) {
      try {
        const parser = new PDFParse({ data: file.buffer });
        try {
          const parsed = await parser.getText();
          const normalized = this.normalizeResumeText(parsed.text ?? '');
          if (normalized) {
            return normalized;
          }
          this.logger.warn(
            'PDF resume parsed but contained no text. Falling back to raw text.',
          );
        } finally {
          await parser.destroy().catch(() => undefined);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `PDF resume parsing failed. Falling back to raw text. ${message}`,
        );
      }
    }

    return this.normalizeResumeText(file.buffer.toString('utf-8'));
  }

  private isPdfResume(file: Express.Multer.File): boolean {
    const mimeType = file.mimetype?.toLowerCase() ?? '';
    if (mimeType.includes('pdf')) {
      return true;
    }

    const name = file.originalname?.toLowerCase() ?? '';
    if (name.endsWith('.pdf')) {
      return true;
    }

    const header = file.buffer?.subarray(0, 5).toString('utf-8') ?? '';
    return header.startsWith('%PDF-');
  }

  private normalizeResumeText(text: string): string {
    const normalizedNewlines = text.replace(/\r\n/g, '\n');
    const withoutControls = Array.from(normalizedNewlines)
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code === 9 || code === 10 || code === 13 || code >= 32;
      })
      .join('');
    const collapsedWhitespace = withoutControls
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n');

    return collapsedWhitespace.trim();
  }
}
