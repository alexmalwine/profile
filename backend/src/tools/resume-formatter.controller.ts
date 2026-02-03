import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ResumeFormatterService } from './resume-formatter.service';
import type { FormatResult } from './resume-formatter/types';

@Controller('api/tools/resume-formatter')
export class ResumeFormatterController {
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
  formatResume(
    @UploadedFile() file?: Express.Multer.File,
    @Body('formatId') formatId?: string,
  ): FormatResult {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = file.buffer.toString('utf-8');
    const selectedFormat = formatId?.trim() || 'modern';

    return this.resumeFormatterService.formatResume(resumeText, selectedFormat);
  }
}
