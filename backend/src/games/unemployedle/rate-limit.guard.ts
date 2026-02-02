import {
  CanActivate,
  ExecutionContext,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  UNEMPLOYEDLE_RATE_LIMIT_MAX_REQUESTS,
  UNEMPLOYEDLE_RATE_LIMIT_WINDOW_MS,
} from './constants';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class UnemployedleRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.getClientKey(request);
    const now = Date.now();

    const entry = this.requests.get(key);
    if (!entry || entry.resetAt <= now) {
      this.requests.set(key, {
        count: 1,
        resetAt: now + UNEMPLOYEDLE_RATE_LIMIT_WINDOW_MS,
      });
      this.pruneExpired(now);
      return true;
    }

    if (entry.count >= UNEMPLOYEDLE_RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000),
      );
      throw new TooManyRequestsException(
        `Too many resume searches. Try again in ${retryAfterSeconds}s.`,
      );
    }

    entry.count += 1;
    return true;
  }

  private pruneExpired(now: number) {
    if (this.requests.size <= 1000) {
      return;
    }

    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetAt <= now) {
        this.requests.delete(key);
      }
    }
  }

  private getClientKey(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0]?.trim() ?? 'unknown';
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
