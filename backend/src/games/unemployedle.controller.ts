import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { PDFParse } from 'pdf-parse';
import { UnemployedleService } from './unemployedle.service';
import { UnemployedleRateLimitGuard } from './unemployedle/rate-limit.guard';
import type {
  GuessResponse,
  JobSearchOptions,
  StartResponse,
  TopJobsResponse,
} from './unemployedle/types';

interface GuessRequest {
  gameId: string;
  letter: string;
}

interface JobSearchOptionsRequest {
  includeRemote?: string;
  includeLocal?: string;
  includeSpecific?: string;
  specificLocation?: string;
  localLocation?: string;
}

const RESUME_SECTION_MARKERS = [
  'experience',
  'work experience',
  'professional experience',
  'employment',
  'employment history',
  'work history',
  'education',
  'skills',
  'projects',
  'certifications',
  'summary',
  'profile',
  'objective',
  'volunteer',
  'awards',
  'publications',
];

const PROFILE_LINK_MARKERS = [
  'linkedin.com',
  'github.com',
  'portfolio',
  'behance.net',
  'dribbble.com',
];

const resumeLineSplit = (resumeText: string) =>
  resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const countSectionSignals = (text: string) => {
  const normalized = text.toLowerCase();
  return RESUME_SECTION_MARKERS.reduce(
    (total, marker) => total + (normalized.includes(marker) ? 1 : 0),
    0,
  );
};

const containsProfileLink = (text: string) => {
  const normalized = text.toLowerCase();
  return PROFILE_LINK_MARKERS.some((marker) => normalized.includes(marker));
};

const isLikelyResumeText = (resumeText: string) => {
  const trimmed = resumeText.trim();
  if (!trimmed) {
    return false;
  }

  const words = trimmed.match(/[A-Za-z0-9]+/g) ?? [];
  const wordCount = words.length;
  if (wordCount < 25) {
    return false;
  }

  const sectionSignals = countSectionSignals(trimmed);
  const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed);
  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(trimmed);
  const hasProfileLink = containsProfileLink(trimmed);
  const hasDate =
    /(?:19|20)\d{2}/.test(trimmed) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(trimmed);
  const bulletLines = resumeLineSplit(trimmed).filter((line) =>
    /^[-*]\s+/.test(line),
  ).length;

  const signalCount =
    sectionSignals +
    (hasEmail ? 1 : 0) +
    (hasPhone ? 1 : 0) +
    (hasProfileLink ? 1 : 0) +
    (hasDate ? 1 : 0) +
    (bulletLines > 0 ? 1 : 0);

  if (wordCount < 60 && signalCount < 2) {
    return false;
  }

  if (
    wordCount < 90 &&
    sectionSignals === 0 &&
    !hasEmail &&
    !hasPhone &&
    !hasProfileLink &&
    !hasDate
  ) {
    return false;
  }

  return true;
};

@Controller('api/games/unemployedle')
export class UnemployedleController {
  private readonly logger = new Logger(UnemployedleController.name);

  constructor(private readonly unemployedleService: UnemployedleService) {}

  @Post('start')
  @UseGuards(UnemployedleRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async startGame(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: JobSearchOptionsRequest,
  ): Promise<StartResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = await this.extractResumeText(file);
    this.assertResumeLooksValid(resumeText);
    return this.unemployedleService.startGame(
      resumeText,
      this.parseJobSearchOptions(body),
    );
  }

  @Post('jobs')
  @UseGuards(UnemployedleRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async getTopJobs(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: JobSearchOptionsRequest,
  ): Promise<TopJobsResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = await this.extractResumeText(file);
    this.assertResumeLooksValid(resumeText);
    return this.unemployedleService.getTopJobs(
      resumeText,
      this.parseJobSearchOptions(body),
    );
  }

  @Post('guess')
  guess(@Body() body: GuessRequest): GuessResponse {
    if (!body?.gameId || !body?.letter) {
      throw new BadRequestException('gameId and letter are required.');
    }

    return this.unemployedleService.guess(body.gameId, body.letter);
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
        const message =
          error instanceof Error ? error.message : 'Unknown error';
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

  private assertResumeLooksValid(resumeText: string) {
    if (isLikelyResumeText(resumeText)) {
      return;
    }

    throw new BadRequestException(
      'That upload does not look like a resume. Please upload a resume with sections like Experience, Education, or Skills.',
    );
  }

  private parseJobSearchOptions(
    body?: JobSearchOptionsRequest,
  ): JobSearchOptions {
    if (!body) {
      return {};
    }

    const includeRemote = this.parseBoolean(body.includeRemote);
    const includeLocal = this.parseBoolean(body.includeLocal);
    const includeSpecific = this.parseBoolean(body.includeSpecific);
    const specificLocation =
      includeSpecific || body.specificLocation?.trim()
        ? body.specificLocation?.trim()
        : null;
    const localLocation = body.localLocation?.trim();

    return {
      includeRemote,
      includeLocal,
      specificLocation,
      localLocation: localLocation || null,
    };
  }

  private parseBoolean(value?: string) {
    if (!value) {
      return false;
    }
    return value === 'true' || value === '1' || value === 'on';
  }
}
