import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Express } from 'express';
import { UnemployedleController } from './unemployedle.controller';
import { UnemployedleService } from './unemployedle.service';

const buildFile = (text: string): Express.Multer.File =>
  ({
    originalname: 'resume.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from(text),
  }) as Express.Multer.File;

describe('UnemployedleController', () => {
  let controller: UnemployedleController;
  let service: {
    startGame: jest.Mock;
    getTopJobs: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      startGame: jest.fn(),
      getTopJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnemployedleController],
      providers: [
        {
          provide: UnemployedleService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get(UnemployedleController);
  });

  it('rejects non-resume uploads on start', async () => {
    const file = buildFile('Hello world. This is not a resume.');

    await expect(controller.startGame(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.startGame).not.toHaveBeenCalled();
  });

  it('rejects non-resume uploads on top jobs', async () => {
    const file = buildFile('Just a short note without resume details.');

    await expect(controller.getTopJobs(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(service.getTopJobs).not.toHaveBeenCalled();
  });

  it('accepts resume-like uploads and forwards options', async () => {
    const file = buildFile(
      [
        'Alex Doe',
        'alex@example.com',
        'Experience',
        'Senior Software Engineer - Acme Corp',
        '2019 - 2024',
        '- Built distributed systems in TypeScript and Node.js',
        'Education',
        'B.S. Computer Science',
        'Skills',
        'TypeScript, React, AWS',
      ].join('\n'),
    );

    const stubResponse = {
      gameId: 'game-1',
      maskedCompany: '___',
      guessesLeft: 7,
      maxGuesses: 7,
      status: 'in_progress',
      selectionSummary: 'summary',
      job: {
        title: 'Software Engineer',
        location: 'Remote',
        source: 'LinkedIn',
        matchScore: 78,
        companyMasked: '___',
      },
      guessedLetters: [],
      incorrectGuesses: [],
    };

    service.startGame.mockResolvedValue(stubResponse);

    const response = await controller.startGame(file, {
      includeRemote: 'true',
      includeLocal: 'false',
      includeSpecific: 'true',
      specificLocation: 'Chicago, IL',
    });

    expect(response).toEqual(stubResponse);
    expect(service.startGame).toHaveBeenCalledWith(
      expect.stringContaining('Experience'),
      {
        includeRemote: true,
        includeLocal: false,
        specificLocation: 'Chicago, IL',
        localLocation: null,
        desiredJobTitle: null,
      },
    );
  });
});
