import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnemployedleController } from './games/unemployedle.controller';
import { UnemployedleService } from './games/unemployedle.service';
import { ResumeFormatterController } from './tools/resume-formatter.controller';
import { ResumeFormatterService } from './tools/resume-formatter.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    UnemployedleController,
    ResumeFormatterController,
  ],
  providers: [AppService, UnemployedleService, ResumeFormatterService],
})
export class AppModule {}
