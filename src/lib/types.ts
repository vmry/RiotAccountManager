export type QueueRank = {
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
} | null;

export type AccountProfile = {
  id: string;
  displayName: string;
  loginUsername: string;
  gameName: string;
  tagLine: string;
  platform: string;
  level: number | null;
  solo: QueueRank;
  flex: QueueRank;
  lastUpdated: string | null;
  lastError: string | null;
};

export type AppSettings = {
  autoRefreshMinutes: number;
};

export type AppState = {
  accounts: AccountProfile[];
  settings: AppSettings;
  hasApiKey: boolean;
};

export type AccountDraft = {
  id?: string;
  displayName: string;
  loginUsername: string;
  password: string;
  gameName: string;
  tagLine: string;
  platform: string;
};
