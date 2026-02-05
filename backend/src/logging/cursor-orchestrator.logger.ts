import { Logger } from '@nestjs/common';
import { hostname } from 'os';
import {
  MAX_FIELD_LENGTH,
  extractDetails,
  looksLikeStack,
  parseBooleanFlag,
  resolveEnvironment,
  resolveRepoRef,
  resolveRepoUrl,
  resolveServiceName,
  safeStringify,
  truncate,
} from './cursor-orchestrator.utils';

type CursorOrchestratorError = {
  message: string;
  type?: string;
  stack_trace?: string;
};

type CursorOrchestratorLinks = {
  logs?: string;
  dashboard?: string;
  runbook?: string;
};

type CursorOrchestratorPayload = {
  source: string;
  trigger: string;
  repository: string;
  ref: string;
  service: string;
  environment: string;
  timestamp: string;
  error: CursorOrchestratorError;
  links: CursorOrchestratorLinks;
  expected_behavior: string;
  definition_of_done: string;
  metadata: Record<string, unknown>;
  prompt?: string;
};

type NormalizedError = {
  message: string;
  type?: string;
  stackTrace?: string;
  details?: Record<string, unknown>;
};

type ErrorContext = {
  loggerContext?: string;
  timestamp: string;
};

export class CursorOrchestratorLogger extends Logger {
  private readonly enabled = parseBooleanFlag(
    process.env.CURSOR_ORCHESTRATOR_ENABLED,
  );
  private readonly webhookUrl = process.env.CURSOR_ORCHESTRATOR_WEBHOOK_URL;
  private readonly token = process.env.CURSOR_ORCHESTRATOR_TOKEN;
  private readonly repoUrl = resolveRepoUrl();
  private readonly repoRef = resolveRepoRef();
  private readonly service = resolveServiceName();
  private readonly environment = resolveEnvironment();
  private readonly logsUrl = process.env.CURSOR_ORCHESTRATOR_LOGS_URL ?? '';
  private readonly dashboardUrl =
    process.env.CURSOR_ORCHESTRATOR_DASHBOARD_URL ?? '';
  private readonly runbookUrl = process.env.CURSOR_ORCHESTRATOR_RUNBOOK_URL ?? '';
  private readonly expectedBehavior =
    process.env.CURSOR_ORCHESTRATOR_EXPECTED_BEHAVIOR ??
    'Investigate backend errors and identify the root cause.';
  private readonly definitionOfDone =
    process.env.CURSOR_ORCHESTRATOR_DEFINITION_OF_DONE ??
    'Root cause documented with a fix or mitigation plan.';
  private readonly host = hostname();

  override error(message: unknown, ...optionalParams: unknown[]) {
    super.error(message as string, ...(optionalParams as any[]));

    if (!this.shouldNotify()) {
      return;
    }

    const { stack, context } = this.extractOptionalParams(optionalParams);
    const errorPayload = this.normalizeError(message, stack);
    const errorContext = this.resolveErrorContext(context);
    void this.notifyOrchestrator(errorPayload, errorContext);
  }

  private shouldNotify() {
    return this.enabled && Boolean(this.webhookUrl);
  }

  private extractOptionalParams(optionalParams: unknown[]) {
    let stack: string | undefined;
    let context: string | undefined;

    if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
      const value = optionalParams[0];
      if (looksLikeStack(value)) {
        stack = value;
      } else {
        context = value;
      }
    } else {
      if (typeof optionalParams[0] === 'string') {
        stack = optionalParams[0];
      }
      if (typeof optionalParams[1] === 'string') {
        context = optionalParams[1];
      }
    }

    return { stack, context };
  }

  private resolveErrorContext(context?: string): ErrorContext {
    return {
      loggerContext: context ?? this.context,
      timestamp: new Date().toISOString(),
    };
  }

  private normalizeError(message: unknown, stack?: string): NormalizedError {
    if (message instanceof Error) {
      return {
        message: message.message || 'Error logged without message.',
        type: message.name,
        stackTrace: truncate(stack ?? message.stack),
        details: message.cause ? { cause: message.cause } : undefined,
      };
    }

    if (typeof message === 'string') {
      return {
        message,
        stackTrace: truncate(stack),
      };
    }

    if (message && typeof message === 'object') {
      const record = message as Record<string, unknown>;
      const details = extractDetails(record);
      const recordMessage =
        typeof record.message === 'string' ? record.message : undefined;
      const recordStack =
        typeof record.stack === 'string' ? record.stack : undefined;
      const recordType =
        typeof record.name === 'string'
          ? record.name
          : typeof record.type === 'string'
            ? record.type
            : undefined;
      return {
        message: recordMessage ?? 'Non-string error logged.',
        type: recordType,
        stackTrace: truncate(stack ?? recordStack),
        details,
      };
    }

    return {
      message: typeof message === 'undefined' ? 'Undefined error.' : String(message),
      stackTrace: truncate(stack),
    };
  }

  private buildPrompt(
    payload: CursorOrchestratorPayload,
    error: NormalizedError,
    context: ErrorContext,
  ) {
    const detailsJson = error.details
      ? truncate(safeStringify(error.details), MAX_FIELD_LENGTH)
      : 'not provided';
    const stackTrace = error.stackTrace ?? 'not provided';
    const repoUrl = this.repoUrl || 'not provided';
    const repoRef = this.repoRef || 'not provided';
    const loggerContext = context.loggerContext || 'not provided';

    const lines = [
      '# Incident Event Context',
      '',
      '## Repo context',
      `- Repo: ${repoUrl}`,
      `- Ref/branch: ${repoRef}`,
      `- Service: ${payload.service}`,
      `- Environment: ${payload.environment}`,
      `- Timestamp: ${context.timestamp}`,
      `- Host: ${this.host}`,
      `- PID: ${process.pid}`,
      `- Logger context: ${loggerContext}`,
      '',
      '## Error',
      `- Message: ${error.message}`,
      `- Type: ${error.type ?? 'not provided'}`,
      '',
      '```',
      stackTrace,
      '```',
      '',
      '## Details',
      '```json',
      detailsJson,
      '```',
      '',
      '## Raw payload',
      '```json',
      safeStringify(payload),
      '```',
      '',
    ];

    return lines.join('\n');
  }

  private buildPayload(
    error: NormalizedError,
    context: ErrorContext,
  ): CursorOrchestratorPayload {
    const timestamp = context.timestamp;

    return {
      source: 'nest-api',
      trigger: 'error_log',
      repository: this.repoUrl,
      ref: this.repoRef,
      service: this.service,
      environment: this.environment,
      timestamp,
      error: {
        message: error.message,
        type: error.type,
        stack_trace: error.stackTrace,
      },
      links: {
        logs: this.logsUrl || undefined,
        dashboard: this.dashboardUrl || undefined,
        runbook: this.runbookUrl || undefined,
      },
      expected_behavior: this.expectedBehavior,
      definition_of_done: this.definitionOfDone,
      metadata: {
        logger_context: context.loggerContext,
        host: this.host,
        pid: process.pid,
        node_version: process.version,
        repo_path: process.cwd(),
      },
    };
  }

  private async notifyOrchestrator(
    error: NormalizedError,
    context: ErrorContext,
  ) {
    if (!this.webhookUrl) {
      return;
    }

    const basePayload = this.buildPayload(error, context);
    const payload: CursorOrchestratorPayload = {
      ...basePayload,
      prompt: this.buildPrompt(basePayload, error, context),
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        super.warn(
          `Cursor orchestrator responded with ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      super.warn(`Failed to notify Cursor orchestrator: ${message}`);
    }
  }
}
