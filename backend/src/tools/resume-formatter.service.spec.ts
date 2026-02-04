import { BadRequestException } from '@nestjs/common';
import { ResumeFormatterService } from './resume-formatter.service';

describe('ResumeFormatterService', () => {
  let service: ResumeFormatterService;

  beforeEach(() => {
    service = new ResumeFormatterService();
  });

  it('returns available formats', () => {
    const formats = service.getFormats();

    expect(formats).toHaveLength(3);
    expect(formats.map((format) => format.id)).toEqual(
      expect.arrayContaining(['modern', 'classic', 'compact']),
    );
  });

  it('throws for unknown formats', () => {
    expect(() =>
      service.formatResume('Jane Doe', 'unknown-format'),
    ).toThrow(BadRequestException);
  });

  it('formats a resume in modern style', () => {
    const result = service.formatResume(
      'Jane Doe\nSenior Engineer\nBuilt scalable systems\nReact TypeScript',
      'modern',
    );

    expect(result.formatId).toBe('modern');
    expect(result.content).toContain('# Jane Doe');
    expect(result.content).toContain('## Summary');
    expect(result.content).toContain('Senior Engineer');
    expect(result.fileName).toBe('jane-doe-resume-modern.md');
  });

  it('formats a resume in classic style', () => {
    const result = service.formatResume(
      'Sam Lee\nEngineering Lead\nLed teams to deliver\nNode.js AWS',
      'classic',
    );

    expect(result.formatId).toBe('classic');
    expect(result.content).toContain('SAM LEE');
    expect(result.content).toContain('SUMMARY');
    expect(result.content).toContain('Engineering Lead');
    expect(result.fileName).toBe('sam-lee-resume-classic.md');
  });

  it('formats a resume in compact style', () => {
    const result = service.formatResume(
      'Alex Kim\nFullstack Engineer\nShipped features\nDocker PostgreSQL',
      'compact',
    );

    expect(result.formatId).toBe('compact');
    expect(result.content).toContain('Alex Kim | Resume');
    expect(result.content).toContain('Fullstack Engineer');
    expect(result.fileName).toBe('alex-kim-resume-compact.txt');
  });
});
