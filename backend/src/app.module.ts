import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      exclude: ['/api*'],
    }),
  ],
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
