export type JobSource =
  | 'LinkedIn'
  | 'Glassdoor'
  | 'Fortune 500'
  | 'Company Careers'
  | 'Indeed'
  | 'Other';

export interface JobOpening {
  id: string;
  company: string;
  title: string;
  location: string;
  source: JobSource;
  rating: number;
  keywords: string[];
  url: string;
  matchScoreHint?: number;
}

export interface RankedJob extends JobOpening {
  matchScore: number;
  overallScore: number;
}

export interface GameState {
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

export interface StartResponse {
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

export interface GuessResponse extends StartResponse {
  status: 'in_progress' | 'won' | 'lost';
  alreadyGuessed: boolean;
  revealedCompany?: string;
  jobUrl?: string;
}

export interface TopJobsResponse {
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

export interface JobSearchJob {
  company?: string;
  title?: string;
  location?: string;
  source?: string;
  rating?: number;
  keywords?: string[] | string;
  url?: string;
  matchScore?: number;
  rationale?: string;
}

export interface JobSearchResult {
  summary?: string;
  searchQueries?: string[];
  jobs: JobSearchJob[];
}

export interface JobSearchClient {
  searchJobs(resumeText: string): Promise<JobSearchResult>;
}

export interface CachedJobSearch {
  result: JobSearchResult;
  createdAt: number;
}
