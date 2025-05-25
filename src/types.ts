// Core type definitions for the Aider GitHub resolver

export interface GitHubWebhookPayload {
  action: string;
  issue?: Issue;
  pull_request?: PullRequest;
  comment?: Comment;
  repository: Repository;
  sender: User;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  user: User;
  assignees: User[];
  labels: Label[];
  state: 'open' | 'closed';
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  user: User;
  head: Branch;
  base: Branch;
  state: 'open' | 'closed' | 'merged';
}

export interface Comment {
  id: number;
  body: string;
  user: User;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: User;
  default_branch: string;
  private: boolean;
}

export interface User {
  id: number;
  login: string;
  type: 'User' | 'Bot';
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Branch {
  ref: string;
  sha: string;
  repo: Repository;
}

export interface AgentInstruction {
  trigger: string;
  instruction: string;
  files?: string[];
  model?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface AiderContext {
  instruction: string;
  repository: Repository;
  issueNumber?: number;
  pullRequestNumber?: number;
  files: string[];
  baseBranch: string;
  workingDirectory: string;
  user: User;
}

export interface AiderResult {
  success: boolean;
  filesChanged: string[];
  commitSha?: string;
  errorMessage?: string;
  output: string;
  costUsed: number;
  modelUsed: string;
  executionTime: number;
}

export interface ModelConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'deepseek';
  apiKey: string;
  costPerToken: number;
  maxTokens: number;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface ProgressUpdate {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  progress?: number;
}

export interface AgentsConfig {
  defaultModel: string;
  modelConfigs: Record<string, ModelConfig>;
  allowedUsers: string[];
  filePatterns: string[];
  testCommand?: string;
  lintCommand?: string;
  maxCostPerOperation: number;
  autoCreatePR: boolean;
}

export interface GitChanges {
  files: string[];
  commitMessage: string;
  branch: string;
  pullRequestTitle: string;
  pullRequestBody: string;
}

export interface SecretValidation {
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  hasDeepSeek: boolean;
  hasGitHub: boolean;
  isValid: boolean;
}

export type TaskComplexity = 'simple' | 'medium' | 'complex';

export type ProgressCallback = (update: ProgressUpdate) => void;

export interface CostTracker {
  dailyBudget: number;
  usedToday: number;
  operationCost: number;
  canProceed: boolean;
}
