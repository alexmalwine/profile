import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnemploydleController } from './games/unemploydle.controller';
import { UnemploydleService } from './games/unemploydle.service';
import { ResumeFormatterController } from './tools/resume-formatter.controller';
import { ResumeFormatterService } from './tools/resume-formatter.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    UnemploydleController,
    ResumeFormatterController,
  ],
  providers: [AppService, UnemploydleService, ResumeFormatterService],
})
export class AppModule {}
