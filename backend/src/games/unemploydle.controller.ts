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
import { UnemploydleService } from './unemploydle.service';
import type { StartResponse, TopJobsResponse, GuessResponse } from './unemploydle.service';

interface GuessRequest {
  gameId: string;
  letter: string;
}

@Controller('api/games/unemploydle')
export class UnemploydleController {
  constructor(private readonly unemploydleService: UnemploydleService) {}

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
    return this.unemploydleService.startGame(resumeText);
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
    return this.unemploydleService.getTopJobs(resumeText);
  }

  @Post('guess')
  guess(@Body() body: GuessRequest): GuessResponse {
    if (!body?.gameId || !body?.letter) {
      throw new BadRequestException('gameId and letter are required.');
    }

    return this.unemploydleService.guess(body.gameId, body.letter);
  }
}
