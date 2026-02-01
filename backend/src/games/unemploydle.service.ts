import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

type JobSource = 'LinkedIn' | 'Glassdoor' | 'Fortune 500' | 'Company Careers';

interface JobOpening {
  id: string;
  company: string;
  title: string;
  location: string;
  source: JobSource;
  rating: number;
  keywords: string[];
  url: string;
}

interface RankedJob extends JobOpening {
  matchScore: number;
  overallScore: number;
}

interface GameState {
  id: string;
  company: string;
  maskedCompany: string;
  guessesLeft: number;
  maxGuesses: number;
  guessedLetters: Set<string>;
  incorrectGuesses: Set<string>;
  job: RankedJob;
  createdAt: number;
  selectionSummary: string;
}

interface StartResponse {
  gameId: string;
  maskedCompany: string;
  guessesLeft: number;
  maxGuesses: number;
  status: 'in_progress' | 'won' | 'lost';
  selectionSummary: string;
  job: {
    title: string;
    location: string;
    source: JobSource;
    rating: number;
    matchScore: number;
    companyMasked: string;
  };
  guessedLetters: string[];
  incorrectGuesses: string[];
}

interface GuessResponse extends StartResponse {
  status: 'in_progress' | 'won' | 'lost';
  alreadyGuessed: boolean;
  revealedCompany?: string;
  jobUrl?: string;
}

interface TopJobsResponse {
  selectionSummary: string;
  jobs: Array<{
    id: string;
    company: string;
    title: string;
    location: string;
    source: JobSource;
    rating: number;
    matchScore: number;
    url: string;
  }>;
}

const MAX_GUESSES = 7;

const KNOWN_KEYWORDS = [
  'react',
  'typescript',
  'javascript',
  'node',
  'nest',
  'graphql',
  'rest',
  'aws',
  'gcp',
  'python',
  'docker',
  'kubernetes',
  'postgres',
  'redis',
  'testing',
  'observability',
  'frontend',
  'backend',
  'fullstack',
  'ui',
  'performance',
  'accessibility',
];

const JOB_CANDIDATES: JobOpening[] = [
  {
    id: 'job-1',
    company: 'Atlas Systems',
    title: 'Senior Frontend Engineer',
    location: 'Remote - US',
    source: 'LinkedIn',
    rating: 4.6,
    keywords: ['react', 'typescript', 'frontend', 'performance', 'ui'],
    url: 'https://example.com/jobs/atlas-systems-senior-frontend',
  },
  {
    id: 'job-2',
    company: 'Northwind Dynamics',
    title: 'Staff Software Engineer, Platform',
    location: 'Seattle, WA',
    source: 'Glassdoor',
    rating: 4.4,
    keywords: ['backend', 'node', 'docker', 'observability', 'testing'],
    url: 'https://example.com/jobs/northwind-staff-platform',
  },
  {
    id: 'job-3',
    company: 'Venture Harbor',
    title: 'Fullstack Engineer',
    location: 'New York, NY',
    source: 'Fortune 500',
    rating: 4.1,
    keywords: ['fullstack', 'react', 'node', 'postgres', 'graphql'],
    url: 'https://example.com/jobs/venture-harbor-fullstack',
  },
  {
    id: 'job-4',
    company: 'Aurora Labs',
    title: 'Software Engineer, Developer Experience',
    location: 'Remote - Americas',
    source: 'Company Careers',
    rating: 4.8,
    keywords: ['typescript', 'testing', 'observability', 'frontend'],
    url: 'https://example.com/jobs/aurora-labs-dx',
  },
  {
    id: 'job-5',
    company: 'Silverline Capital',
    title: 'Backend Engineer',
    location: 'Chicago, IL',
    source: 'LinkedIn',
    rating: 4.0,
    keywords: ['backend', 'node', 'postgres', 'redis', 'rest'],
    url: 'https://example.com/jobs/silverline-backend',
  },
  {
    id: 'job-6',
    company: 'Evergreen Commerce',
    title: 'Frontend Engineer',
    location: 'Austin, TX',
    source: 'Glassdoor',
    rating: 4.2,
    keywords: ['react', 'javascript', 'ui', 'accessibility'],
    url: 'https://example.com/jobs/evergreen-frontend',
  },
  {
    id: 'job-7',
    company: 'Pioneer Freight',
    title: 'Software Engineer, Growth',
    location: 'Remote - Global',
    source: 'Fortune 500',
    rating: 4.3,
    keywords: ['frontend', 'performance', 'testing', 'react'],
    url: 'https://example.com/jobs/pioneer-growth',
  },
  {
    id: 'job-8',
    company: 'Nimbus Health',
    title: 'Fullstack Engineer, Integrations',
    location: 'Boston, MA',
    source: 'Company Careers',
    rating: 4.5,
    keywords: ['fullstack', 'node', 'rest', 'graphql', 'typescript'],
    url: 'https://example.com/jobs/nimbus-integrations',
  },
  {
    id: 'job-9',
    company: 'Helios Mobility',
    title: 'Platform Engineer',
    location: 'San Francisco, CA',
    source: 'LinkedIn',
    rating: 4.7,
    keywords: ['backend', 'kubernetes', 'docker', 'aws', 'observability'],
    url: 'https://example.com/jobs/helios-platform',
  },
  {
    id: 'job-10',
    company: 'Summit Analytics',
    title: 'Software Engineer, Data Platform',
    location: 'Denver, CO',
    source: 'Glassdoor',
    rating: 4.1,
    keywords: ['backend', 'aws', 'postgres', 'testing', 'python'],
    url: 'https://example.com/jobs/summit-data-platform',
  },
  {
    id: 'job-11',
    company: 'Blue Orchid',
    title: 'Senior Frontend Engineer, Design Systems',
    location: 'Remote - US',
    source: 'Company Careers',
    rating: 4.6,
    keywords: ['react', 'frontend', 'ui', 'accessibility', 'typescript'],
    url: 'https://example.com/jobs/blue-orchid-design-systems',
  },
  {
    id: 'job-12',
    company: 'Ironwood Partners',
    title: 'Software Engineer, Core Services',
    location: 'Atlanta, GA',
    source: 'Fortune 500',
    rating: 4.0,
    keywords: ['backend', 'node', 'rest', 'docker', 'testing'],
    url: 'https://example.com/jobs/ironwood-core-services',
  },
];

const fetchJobCandidates = () => {
  // TODO: Replace with real job ingestion from LinkedIn, Glassdoor,
  // Fortune 500 career pages, and other sources.
  return JOB_CANDIDATES;
};

const sanitizeLetter = (letter: string) => letter.trim().toUpperCase();

const maskCompanyName = (company: string, guessed: Set<string>) =>
  company
    .split('')
    .map((char) => {
      if (/[a-z]/i.test(char)) {
        const upper = char.toUpperCase();
        return guessed.has(upper) ? char : '_';
      }
      return char;
    })
    .join('');

const extractResumeKeywords = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const matches = new Set<string>();

  KNOWN_KEYWORDS.forEach((keyword) => {
    if (lower.includes(keyword)) {
      matches.add(keyword);
    }
  });

  return matches;
};

const computeMatchScore = (job: JobOpening, resumeKeywords: Set<string>) => {
  if (job.keywords.length === 0) {
    return 0.4;
  }

  const matches = job.keywords.filter((keyword) =>
    resumeKeywords.has(keyword),
  ).length;
  return matches / job.keywords.length;
};

const rankJobs = (resumeText: string) => {
  const resumeKeywords = extractResumeKeywords(resumeText);

  // TODO: Replace with real job ingestion and LLM ranking.
  return fetchJobCandidates().map((job) => {
    const matchScore = computeMatchScore(job, resumeKeywords);
    const ratingScore = job.rating / 5;
    const overallScore = matchScore * 0.7 + ratingScore * 0.3;

    return {
      ...job,
      matchScore,
      overallScore,
    };
  })
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 10);
};

@Injectable()
export class UnemploydleService {
  private readonly games = new Map<string, GameState>();

  startGame(resumeText: string): StartResponse {
    const rankedJobs = rankJobs(resumeText);
    const selectedJob =
      rankedJobs[Math.floor(Math.random() * rankedJobs.length)];

    const guessedLetters = new Set<string>();
    const maskedCompany = maskCompanyName(selectedJob.company, guessedLetters);
    const selectionSummary =
      'Ranked openings with a resume match, company ratings, and ' +
      'LLM-style scoring. Selected a random company from the top 10.';

    const game: GameState = {
      id: randomUUID(),
      company: selectedJob.company,
      maskedCompany,
      guessesLeft: MAX_GUESSES,
      maxGuesses: MAX_GUESSES,
      guessedLetters,
      incorrectGuesses: new Set<string>(),
      job: selectedJob,
      createdAt: Date.now(),
      selectionSummary,
    };

    this.games.set(game.id, game);
    this.cleanupOldGames();

    return this.buildStartResponse(game);
  }

  getTopJobs(resumeText: string): TopJobsResponse {
    const rankedJobs = rankJobs(resumeText);
    return {
      selectionSummary:
        'Ranked openings with a resume match, company ratings, and ' +
        'LLM-style scoring. Showing the top 10 matches.',
      jobs: rankedJobs.map((job) => ({
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        source: job.source,
        rating: job.rating,
        matchScore: Math.round(job.matchScore * 100),
        url: job.url,
      })),
    };
  }

  guess(gameId: string, letter: string): GuessResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const currentStatus = this.resolveStatus(game);
    if (currentStatus !== 'in_progress') {
      return {
        ...this.buildStartResponse(game),
        status: currentStatus,
        alreadyGuessed: false,
        revealedCompany: game.company,
        jobUrl: game.job.url,
      };
    }

    const sanitized = sanitizeLetter(letter);
    if (!/^[A-Z]$/.test(sanitized)) {
      throw new BadRequestException('Guess must be a single letter.');
    }

    let alreadyGuessed = false;

    if (game.guessedLetters.has(sanitized)) {
      alreadyGuessed = true;
    } else {
      game.guessedLetters.add(sanitized);

      if (!game.company.toUpperCase().includes(sanitized)) {
        game.guessesLeft = Math.max(0, game.guessesLeft - 1);
        game.incorrectGuesses.add(sanitized);
      }

      game.maskedCompany = maskCompanyName(game.company, game.guessedLetters);
    }

    const status = this.resolveStatus(game);

    return {
      ...this.buildStartResponse(game),
      status,
      alreadyGuessed,
      ...(status !== 'in_progress'
        ? {
            revealedCompany: game.company,
            jobUrl: game.job.url,
          }
        : {}),
    };
  }

  private resolveStatus(game: GameState) {
    if (!game.maskedCompany.includes('_')) {
      return 'won' as const;
    }

    if (game.guessesLeft <= 0) {
      return 'lost' as const;
    }

    return 'in_progress' as const;
  }

  private buildStartResponse(game: GameState): StartResponse {
    return {
      gameId: game.id,
      maskedCompany: game.maskedCompany,
      guessesLeft: game.guessesLeft,
      maxGuesses: game.maxGuesses,
      status: 'in_progress',
      selectionSummary: game.selectionSummary,
      job: {
        title: game.job.title,
        location: game.job.location,
        source: game.job.source,
        rating: game.job.rating,
        matchScore: Math.round(game.job.matchScore * 100),
        companyMasked: game.maskedCompany,
      },
      guessedLetters: Array.from(game.guessedLetters).sort(),
      incorrectGuesses: Array.from(game.incorrectGuesses).sort(),
    };
  }

  private cleanupOldGames() {
    if (this.games.size <= 50) {
      return;
    }

    const oldestGame = Array.from(this.games.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    )[0];

    if (oldestGame) {
      this.games.delete(oldestGame.id);
    }
  }
}
