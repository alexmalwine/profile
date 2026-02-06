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
  prefixes?: string | string[];
  art_style?: string;
  theme?: string;
}

type CustomTradingCardsBodyInput =
  | (CustomTradingCardsRequestBody & Record<string, unknown>)
  | undefined;

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
    @Body() body?: CustomTradingCardsBodyInput,
    @Res() response?: Response,
  ): Promise<void> {
    if (!response) {
      throw new BadRequestException('Response object is not available.');
    }
    const request = this.buildRequestPayload(body, files);
    const cards = await this.customTradingCardsService.generateCards(request);

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

  @Post('preview')
  @UseInterceptors(
    FilesInterceptor('reference_images', MAX_REFERENCE_IMAGES, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async previewCard(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body() body?: CustomTradingCardsBodyInput,
    @Res() response?: Response,
  ): Promise<void> {
    if (!response) {
      throw new BadRequestException('Response object is not available.');
    }

    const request = this.buildRequestPayload(body, files);
    const preview = await this.customTradingCardsService.generatePreviewCard(
      request,
    );

    response.setHeader('Content-Type', 'image/png');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${preview.fileName}"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.end(preview.buffer);
  }

  private buildRequestPayload(
    body: CustomTradingCardsBodyInput,
    files: Express.Multer.File[],
  ) {
    const titles = parseDelimitedList(
      this.getBodyValue(body, ['card_titles', 'cardTitles', 'Card_titles']),
    );
    if (titles.length === 0) {
      throw new BadRequestException('Card titles are required.');
    }

    const prefixes = parseDelimitedList(
      this.getBodyValue(body, ['prefixes', 'Prefixes']),
    );
    const normalizedPrefixes = prefixes.length > 0 ? prefixes : [''];
    const totalCombinations = titles.length * normalizedPrefixes.length;
    if (totalCombinations > MAX_CARD_COMBINATIONS) {
      throw new BadRequestException(
        `Only ${MAX_CARD_COMBINATIONS} card combinations are allowed per request.`,
      );
    }

    const theme =
      this.getBodyValue(body, ['theme', 'Theme']) ??
      '';
    const normalizedTheme = theme.trim();
    if (!normalizedTheme) {
      throw new BadRequestException('Theme is required.');
    }

    const artStyleValue =
      this.getBodyValue(body, ['art_style', 'artStyle', 'Art_style']) ?? '';
    const normalizedArtStyle = artStyleValue.trim();
    if (!ART_STYLE_OPTIONS.includes(normalizedArtStyle as ArtStyleOption)) {
      throw new BadRequestException(
        `Art style must be one of: ${ART_STYLE_OPTIONS.join(', ')}.`,
      );
    }

    return {
      cardTitles: titles,
      prefixes: normalizedPrefixes,
      theme: normalizedTheme,
      artStyle: normalizedArtStyle as ArtStyleOption,
      referenceImages: files ?? [],
    };
  }

  private getBodyValue(
    body: CustomTradingCardsBodyInput,
    keys: string[],
  ): string | string[] | undefined {
    if (!body) {
      return undefined;
    }
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' || Array.isArray(value)) {
        return value;
      }
    }
    return undefined;
  }
}
