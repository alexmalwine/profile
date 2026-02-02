import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
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

@Controller('api/games/unemployedle')
export class UnemployedleController {
  constructor(private readonly unemployedleService: UnemployedleService) {}

  @Post('start')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async startGame(@UploadedFile() file?: Multer.File): Promise<StartResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = file.buffer.toString('utf-8');
    return this.unemployedleService.startGame(resumeText);
  }

  @Post('jobs')
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async getTopJobs(
    @UploadedFile() file?: Multer.File,
  ): Promise<TopJobsResponse> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    const resumeText = file.buffer.toString('utf-8');
    return this.unemployedleService.getTopJobs(resumeText);
  }

  @Post('guess')
  guess(@Body() body: GuessRequest): GuessResponse {
    if (!body?.gameId || !body?.letter) {
      throw new BadRequestException('gameId and letter are required.');
    }

    return this.unemployedleService.guess(body.gameId, body.letter);
  }
}
