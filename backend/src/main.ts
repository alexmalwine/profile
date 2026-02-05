import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { CursorOrchestratorLogger } from './logging/cursor-orchestrator.logger';

config();

async function bootstrap() {
  const logger = new CursorOrchestratorLogger();
  const app = await NestFactory.create(AppModule, { logger });
  app.useLogger(logger);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
