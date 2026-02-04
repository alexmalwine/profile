import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Express, Response } from 'express';
import archiver from 'archiver';
import { CustomTradingCardsService } from './custom-trading-cards.service';
import {
  ART_STYLE_OPTIONS,
  DEFAULT_ZIP_NAME,
  MAX_CARD_COMBINATIONS,
  MAX_REFERENCE_IMAGES,
} from './custom-trading-cards/constants';
import { parseDelimitedList } from './custom-trading-cards/helpers';
import type { ArtStyleOption } from './custom-trading-cards/types';

interface CustomTradingCardsRequestBody {
  card_titles?: string | string[];
  cardTitles?: string | string[];
  Card_titles?: string | string[];
  prefixes?: string | string[];
  Prefixes?: string | string[];
  art_style?: string;
  artStyle?: string;
  Art_style?: string;
  theme?: string;
  Theme?: string;
}

@Controller('api/games/custom-trading-cards')
export class CustomTradingCardsController {
  private readonly logger = new Logger(CustomTradingCardsController.name);

  constructor(
    private readonly customTradingCardsService: CustomTradingCardsService,
  ) {}

  @Post('generate')
  @UseInterceptors(
    FilesInterceptor('reference_images', MAX_REFERENCE_IMAGES, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async generateCards(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body() body?: CustomTradingCardsRequestBody,
    @Res() response?: Response,
  ): Promise<void> {
    if (!response) {
      throw new BadRequestException('Response object is not available.');
    }

    const titles = parseDelimitedList(
      body?.card_titles ?? body?.cardTitles ?? body?.Card_titles,
    );
    if (titles.length === 0) {
      throw new BadRequestException('Card titles are required.');
    }

    const prefixes = parseDelimitedList(body?.prefixes ?? body?.Prefixes);
    const normalizedPrefixes = prefixes.length > 0 ? prefixes : [''];
    const totalCombinations = titles.length * normalizedPrefixes.length;
    if (totalCombinations > MAX_CARD_COMBINATIONS) {
      throw new BadRequestException(
        `Only ${MAX_CARD_COMBINATIONS} card combinations are allowed per request.`,
      );
    }

    const theme = body?.theme ?? body?.Theme ?? '';
    const normalizedTheme = theme.trim();
    if (!normalizedTheme) {
      throw new BadRequestException('Theme is required.');
    }

    const artStyleValue =
      body?.art_style ?? body?.artStyle ?? body?.Art_style ?? '';
    const normalizedArtStyle = artStyleValue.trim();
    if (!ART_STYLE_OPTIONS.includes(normalizedArtStyle as ArtStyleOption)) {
      throw new BadRequestException(
        `Art style must be one of: ${ART_STYLE_OPTIONS.join(', ')}.`,
      );
    }

    const cards = await this.customTradingCardsService.generateCards({
      cardTitles: titles,
      prefixes: normalizedPrefixes,
      theme: normalizedTheme,
      artStyle: normalizedArtStyle as ArtStyleOption,
      referenceImages: files ?? [],
    });

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${DEFAULT_ZIP_NAME}"`,
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (error) => {
      this.logger.warn(
        `Trading card zip warning: ${error?.message ?? 'Unknown warning'}`,
      );
    });
    archive.on('error', (error) => {
      this.logger.error(
        `Trading card zip error: ${error?.message ?? 'Unknown error'}`,
      );
      if (!response.headersSent) {
        response.status(500).json({ message: 'Unable to generate card zip.' });
      } else {
        response.end();
      }
    });

    archive.pipe(response);
    cards.forEach((card) => {
      archive.append(card.buffer, { name: card.fileName });
    });
    await archive.finalize();
  }
}
