import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import pdfParse from 'pdf-parse';
import { UnemployedleService } from './unemployedle.service';
import type {
  GuessResponse,
  StartResponse,
  TopJobsResponse,
} from './unemployedle/types';

interface GuessRequest {
  gameId: string;
  letter: string;
}

interface PdfParseResult {
  text: string;
}

@Controller('api/games/unemployedle')
export class UnemployedleController {
  private readonly logger = new Logger(UnemployedleController.name);

  constructor(private readonly unemployedleService: UnemployedleService) {}

  @Post('start')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async startGame(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<StartResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = await this.extractResumeText(file);
    return this.unemployedleService.startGame(resumeText);
  }

  @Post('jobs')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async getTopJobs(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<TopJobsResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = await this.extractResumeText(file);
    return this.unemployedleService.getTopJobs(resumeText);
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
        const parsed = (await pdfParse(file.buffer)) as PdfParseResult;
        const normalized = this.normalizeResumeText(parsed.text ?? '');
        if (normalized) {
          return normalized;
        }
        this.logger.warn(
          'PDF resume parsed but contained no text. Falling back to raw text.',
        );
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
}
