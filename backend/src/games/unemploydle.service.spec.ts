import { BadRequestException } from '@nestjs/common';
import { UnemploydleService } from './unemploydle.service';

describe('UnemploydleService', () => {
  let service: UnemploydleService;

  const stubSearchResult = {
    summary: 'ChatGPT searched job sites and ranked the best resume matches.',
    searchQueries: [
      'senior frontend engineer remote',
      'fullstack engineer react node',
      'platform engineer aws kubernetes',
    ],
    jobs: [
      {
        company: 'Atlas Systems',
        title: 'Senior Frontend Engineer',
        location: 'Remote - US',
        source: 'LinkedIn',
        rating: 4.6,
        keywords: ['react', 'typescript', 'frontend', 'performance', 'ui'],
        url: 'https://example.com/jobs/atlas-systems-senior-frontend',
      },
      {
        company: 'Northwind Dynamics',
        title: 'Staff Software Engineer, Platform',
        location: 'Seattle, WA',
        source: 'Glassdoor',
        rating: 4.4,
        keywords: ['backend', 'node', 'docker', 'observability', 'testing'],
        url: 'https://example.com/jobs/northwind-staff-platform',
      },
      {
        company: 'Venture Harbor',
        title: 'Fullstack Engineer',
        location: 'New York, NY',
        source: 'Fortune 500',
        rating: 4.1,
        keywords: ['fullstack', 'react', 'node', 'postgres', 'graphql'],
        url: 'https://example.com/jobs/venture-harbor-fullstack',
      },
      {
        company: 'Aurora Labs',
        title: 'Software Engineer, Developer Experience',
        location: 'Remote - Americas',
        source: 'Company Careers',
        rating: 4.8,
        keywords: ['typescript', 'testing', 'observability', 'frontend'],
        url: 'https://example.com/jobs/aurora-labs-dx',
      },
      {
        company: 'Silverline Capital',
        title: 'Backend Engineer',
        location: 'Chicago, IL',
        source: 'LinkedIn',
        rating: 4.0,
        keywords: ['backend', 'node', 'postgres', 'redis', 'rest'],
        url: 'https://example.com/jobs/silverline-backend',
      },
      {
        company: 'Evergreen Commerce',
        title: 'Frontend Engineer',
        location: 'Austin, TX',
        source: 'Glassdoor',
        rating: 4.2,
        keywords: ['react', 'javascript', 'ui', 'accessibility'],
        url: 'https://example.com/jobs/evergreen-frontend',
      },
      {
        company: 'Pioneer Freight',
        title: 'Software Engineer, Growth',
        location: 'Remote - Global',
        source: 'Fortune 500',
        rating: 4.3,
        keywords: ['frontend', 'performance', 'testing', 'react'],
        url: 'https://example.com/jobs/pioneer-growth',
      },
      {
        company: 'Nimbus Health',
        title: 'Fullstack Engineer, Integrations',
        location: 'Boston, MA',
        source: 'Company Careers',
        rating: 4.5,
        keywords: ['fullstack', 'node', 'rest', 'graphql', 'typescript'],
        url: 'https://example.com/jobs/nimbus-integrations',
      },
      {
        company: 'Helios Mobility',
        title: 'Platform Engineer',
        location: 'San Francisco, CA',
        source: 'LinkedIn',
        rating: 4.7,
        keywords: ['backend', 'kubernetes', 'docker', 'aws', 'observability'],
        url: 'https://example.com/jobs/helios-platform',
      },
      {
        company: 'Summit Analytics',
        title: 'Software Engineer, Data Platform',
        location: 'Denver, CO',
        source: 'Glassdoor',
        rating: 4.1,
        keywords: ['backend', 'aws', 'postgres', 'testing', 'python'],
        url: 'https://example.com/jobs/summit-data-platform',
      },
      {
        company: 'Blue Orchid',
        title: 'Senior Frontend Engineer, Design Systems',
        location: 'Remote - US',
        source: 'Company Careers',
        rating: 4.6,
        keywords: ['react', 'frontend', 'ui', 'accessibility', 'typescript'],
        url: 'https://example.com/jobs/blue-orchid-design-systems',
      },
      {
        company: 'Ironwood Partners',
        title: 'Software Engineer, Core Services',
        location: 'Atlanta, GA',
        source: 'Fortune 500',
        rating: 4.0,
        keywords: ['backend', 'node', 'rest', 'docker', 'testing'],
        url: 'https://example.com/jobs/ironwood-core-services',
      },
    ],
  };

  beforeEach(() => {
    service = new UnemploydleService({
      searchJobs: async () => stubSearchResult,
    });
  });

  const getGame = (gameId: string) => (service as any).games.get(gameId);

  it('starts a new game with masked company', async () => {
    const response = await service.startGame('React TypeScript Node');

    expect(response.gameId).toBeDefined();
    expect(response.guessesLeft).toBe(response.maxGuesses);
    expect(response.maskedCompany).toMatch(/_/);
    expect(response.selectionSummary).toContain('ChatGPT');

    const game = getGame(response.gameId);
    expect(response.maskedCompany.length).toBe(game.company.length);
  });

  it('rejects invalid guesses', async () => {
    const response = await service.startGame('React TypeScript Node');

    expect(() => service.guess(response.gameId, '12')).toThrow(
      BadRequestException,
    );
  });

  it('decrements guesses for incorrect letters', async () => {
    const response = await service.startGame('React TypeScript Node');

    const next = service.guess(response.gameId, 'Q');

    expect(next.guessesLeft).toBe(response.maxGuesses - 1);
    expect(next.incorrectGuesses).toContain('Q');
  });

  it('flags repeated guesses', async () => {
    const response = await service.startGame('React TypeScript Node');

    const first = service.guess(response.gameId, 'Q');
    const second = service.guess(response.gameId, 'Q');

    expect(first.guessesLeft).toBe(second.guessesLeft);
    expect(second.alreadyGuessed).toBe(true);
  });

  it('wins when all letters are guessed', async () => {
    const response = await service.startGame('React TypeScript Node');
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

  it('returns a top 10 job list', async () => {
    const response = await service.getTopJobs('React TypeScript Node');

    expect(response.jobs).toHaveLength(10);
    expect(response.selectionSummary).toContain('top 10');
    response.jobs.forEach((job) => {
      expect(job.company).toBeTruthy();
      expect(job.matchScore).toBeGreaterThanOrEqual(0);
      expect(job.matchScore).toBeLessThanOrEqual(100);
    });
  });

  it('loses after running out of guesses', async () => {
    const response = await service.startGame('React TypeScript Node');
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
