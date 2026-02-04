import type { Express } from 'express';
import { ART_STYLE_OPTIONS } from './constants';

export type ArtStyleOption = (typeof ART_STYLE_OPTIONS)[number];

export interface CustomTradingCardsRequest {
  cardTitles: string[];
  prefixes: string[];
  theme: string;
  artStyle: ArtStyleOption;
  referenceImages: Express.Multer.File[];
}

export interface CardCombination {
  title: string;
  prefix: string | null;
  displayTitle: string;
}

export interface GeneratedCard {
  title: string;
  prefix: string | null;
  fileName: string;
  buffer: Buffer;
}

export interface ImageGenerationOptions {
  referenceImage?: Express.Multer.File | null;
}

export interface ImageGenerationClient {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<Buffer>;
}
