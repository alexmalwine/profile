import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Express } from 'express';
import {
  ART_STYLE_OPTIONS,
  IMAGE_GENERATION_CONCURRENCY,
  MAX_CARD_COMBINATIONS,
} from './custom-trading-cards/constants';
import {
  normalizeTitleKey,
  sanitizeFileName,
} from './custom-trading-cards/helpers';
import { ClipdropImageClient } from './custom-trading-cards/image-generation.client';
import { parse as parsePath } from 'path';
import type {
  ArtStyleOption,
  CardCombination,
  CustomTradingCardsRequest,
  GeneratedCard,
} from './custom-trading-cards/types';

const ART_STYLE_PROMPTS: Record<ArtStyleOption, string> = {
  anime: 'vibrant anime illustration with crisp linework and dramatic lighting',
  'pixel-art': 'retro pixel art with chunky shading and limited palette',
  watercolor: 'soft watercolor painting with gentle gradients and texture',
  'oil-painting': 'rich oil painting with textured brush strokes and depth',
  'retro-comic': 'retro comic panel with bold inks and halftone shading',
  '3d-render': 'cinematic 3D render with realistic lighting and detail',
  'minimalist-vector': 'minimalist vector art with clean shapes and flat color',
};

@Injectable()
export class CustomTradingCardsService {
  private readonly logger = new Logger(CustomTradingCardsService.name);

  constructor(private readonly imageClient: ClipdropImageClient) {}

  async generateCards(
    request: CustomTradingCardsRequest,
  ): Promise<GeneratedCard[]> {
    const combinations = this.buildCombinations(
      request.cardTitles,
      request.prefixes,
    );
    this.assertCombinationCount(combinations.length);

    const referenceMap = this.buildReferenceImageMap(request.referenceImages);
    this.logger.log(`Generating ${combinations.length} trading card images.`);

    return this.runWithConcurrency(
      combinations,
      IMAGE_GENERATION_CONCURRENCY,
      (combo) => this.generateCard(combo, request, referenceMap),
    );
  }

  async generatePreviewCard(
    request: CustomTradingCardsRequest,
  ): Promise<GeneratedCard> {
    const combinations = this.buildCombinations(
      request.cardTitles,
      request.prefixes,
    );
    this.assertCombinationCount(combinations.length);

    const [preview] = combinations;
    const referenceMap = this.buildReferenceImageMap(request.referenceImages);
    this.logger.log(`Generating preview card for ${preview.displayTitle}.`);

    return this.generateCard(preview, request, referenceMap);
  }

  private buildCombinations(cardTitles: string[], prefixes: string[]) {
    const normalizedPrefixes =
      prefixes.length > 0 ? prefixes : [''];

    return normalizedPrefixes.flatMap((prefix) => {
      const trimmedPrefix = prefix.trim();
      return cardTitles
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => {
          const displayTitle = trimmedPrefix
            ? `${trimmedPrefix} ${title}`
            : title;
          return {
            title,
            prefix: trimmedPrefix || null,
            displayTitle,
          } satisfies CardCombination;
        });
    });
  }

  private buildReferenceImageMap(files: Express.Multer.File[]) {
    const map = new Map<string, Express.Multer.File>();

    files.forEach((file) => {
      if (!file) {
        return;
      }
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException(
          'Reference images must be valid image files.',
        );
      }
      const baseName = file.originalname
        ? parsePath(file.originalname).name
        : '';
      const key = normalizeTitleKey(baseName);
      if (!key || map.has(key)) {
        return;
      }
      map.set(key, file);
    });

    return map;
  }

  private async generateCard(
    combo: CardCombination,
    request: CustomTradingCardsRequest,
    referenceMap: Map<string, Express.Multer.File>,
  ): Promise<GeneratedCard> {
    const referenceImage = referenceMap.get(normalizeTitleKey(combo.title));
    const prompt = this.buildPrompt(
      combo,
      request.theme,
      request.artStyle,
      Boolean(referenceImage),
    );
    const buffer = await this.imageClient.generateImage(prompt, {
      referenceImage,
    });
    const safeName = sanitizeFileName(combo.displayTitle);

    return {
      title: combo.title,
      prefix: combo.prefix,
      fileName: `${safeName}.png`,
      buffer,
    };
  }

  private assertCombinationCount(count: number) {
    if (count === 0) {
      throw new BadRequestException('At least one card title is required.');
    }

    if (count > MAX_CARD_COMBINATIONS) {
      throw new BadRequestException(
        `Only ${MAX_CARD_COMBINATIONS} card combinations are allowed per request.`,
      );
    }
  }

  private buildPrompt(
    combo: CardCombination,
    theme: string,
    artStyle: ArtStyleOption,
    hasReference: boolean,
  ) {
    const title = combo.displayTitle;
    const stylePrompt = ART_STYLE_PROMPTS[artStyle];
    const referenceNote = hasReference
      ? 'Use the supplied reference image to keep the subject accurate.'
      : '';

    return [
      `Create a detailed trading card illustration of ${title}.`,
      `Theme: ${theme}.`,
      `Style: ${stylePrompt}.`,
      'Include a clean title banner area with the name.',
      'Avoid watermarks or extra text.',
      referenceNote,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    let index = 0;
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (index < items.length) {
          const current = index;
          index += 1;
          results[current] = await worker(items[current], current);
        }
      },
    );

    await Promise.all(workers);
    return results;
  }

  getArtStyleOptions() {
    return ART_STYLE_OPTIONS;
  }
}
