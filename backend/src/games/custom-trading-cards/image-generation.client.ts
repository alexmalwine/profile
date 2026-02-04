import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IMAGE_GENERATION_TIMEOUT_MS,
} from './constants';
import type { ImageGenerationClient, ImageGenerationOptions } from './types';

@Injectable()
export class ClipdropImageClient implements ImageGenerationClient {
  private readonly apiKey = process.env.CLIPDROP_API_KEY;
  private readonly textEndpoint = 'https://clipdrop-api.co/text-to-image/v1';
  private readonly imageEndpoint = 'https://clipdrop-api.co/image-to-image/v1';
  private readonly logger = new Logger(ClipdropImageClient.name);
  private readonly fetcher: typeof fetch = fetch;

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions,
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'CLIPDROP_API_KEY is not configured for image generation.',
      );
    }

    const hasReference = Boolean(options?.referenceImage);
    const endpoint = hasReference ? this.imageEndpoint : this.textEndpoint;
    const formData = new FormData();
    formData.append('prompt', prompt);

    if (options?.referenceImage) {
      const { buffer, mimetype, originalname } = options.referenceImage;
      const blob = new Blob([buffer], { type: mimetype || 'image/png' });
      formData.append('image_file', blob, originalname || 'reference.png');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      IMAGE_GENERATION_TIMEOUT_MS,
    );

    try {
      const response = await this.fetcher(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Clipdrop API error ${response.status}: ${errorText.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException('Image generation failed.');
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('Image generation timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
