import { BadRequestException } from '@nestjs/common';
import { UnemploydleService } from './unemploydle.service';

describe('UnemploydleService', () => {
  let service: UnemploydleService;

  beforeEach(() => {
    service = new UnemploydleService();
  });

  const getGame = (gameId: string) => (service as any).games.get(gameId);

  it('starts a new game with masked company', () => {
    const response = service.startGame('React TypeScript Node');

    expect(response.gameId).toBeDefined();
    expect(response.guessesLeft).toBe(response.maxGuesses);
    expect(response.maskedCompany).toMatch(/_/);
    expect(response.selectionSummary).toContain('Ranked openings');

    const game = getGame(response.gameId);
    expect(response.maskedCompany.length).toBe(game.company.length);
  });

  it('rejects invalid guesses', () => {
    const response = service.startGame('React TypeScript Node');

    expect(() => service.guess(response.gameId, '12')).toThrow(
      BadRequestException,
    );
  });

  it('decrements guesses for incorrect letters', () => {
    const response = service.startGame('React TypeScript Node');

    const next = service.guess(response.gameId, 'Q');

    expect(next.guessesLeft).toBe(response.maxGuesses - 1);
    expect(next.incorrectGuesses).toContain('Q');
  });

  it('flags repeated guesses', () => {
    const response = service.startGame('React TypeScript Node');

    const first = service.guess(response.gameId, 'Q');
    const second = service.guess(response.gameId, 'Q');

    expect(first.guessesLeft).toBe(second.guessesLeft);
    expect(second.alreadyGuessed).toBe(true);
  });

  it('wins when all letters are guessed', () => {
    const response = service.startGame('React TypeScript Node');
    const game = getGame(response.gameId);

    const letters = Array.from(
      new Set(game.company.toUpperCase().replace(/[^A-Z]/g, '').split('')),
    );

    let last = response;
    letters.forEach((letter: string) => {
      last = service.guess(response.gameId, letter);
    });

    expect(last.status).toBe('won');
    expect(last.revealedCompany).toBe(game.company);
    expect(last.jobUrl).toBe(game.job.url);
  });

  it('loses after running out of guesses', () => {
    const response = service.startGame('React TypeScript Node');
    const game = getGame(response.gameId);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const wrongLetters = alphabet.filter(
      (letter) => !game.company.toUpperCase().includes(letter),
    );

    expect(wrongLetters.length).toBeGreaterThanOrEqual(response.maxGuesses);

    let last = response;
    wrongLetters.slice(0, response.maxGuesses).forEach((letter) => {
      last = service.guess(response.gameId, letter);
    });

    expect(last.status).toBe('lost');
    expect(last.guessesLeft).toBe(0);
    expect(last.revealedCompany).toBe(game.company);
    expect(last.jobUrl).toBe(game.job.url);
  });
});
