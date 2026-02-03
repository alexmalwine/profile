import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnemployedleController } from './games/unemployedle.controller';
import { UnemployedleService } from './games/unemployedle.service';
import { JobBoardSearchClient } from './games/unemployedle/job-search.client';
import { ChatGptJobRanker } from './games/unemployedle/job-ranker.client';
import { UnemployedleRateLimitGuard } from './games/unemployedle/rate-limit.guard';
import { ResumeFormatterController } from './tools/resume-formatter.controller';
import { ResumeFormatterService } from './tools/resume-formatter.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    UnemployedleController,
    ResumeFormatterController,
  ],
  providers: [
    AppService,
    UnemployedleService,
    JobBoardSearchClient,
    ChatGptJobRanker,
    UnemployedleRateLimitGuard,
    ResumeFormatterService,
  ],
})
export class AppModule {}
