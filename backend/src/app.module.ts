import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UnemploydleController } from './games/unemploydle.controller';
import { UnemploydleService } from './games/unemploydle.service';

@Module({
  imports: [],
  controllers: [AppController, UnemploydleController],
  providers: [AppService, UnemploydleService],
})
export class AppModule {}
