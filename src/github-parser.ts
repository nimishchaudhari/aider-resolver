import { AgentInstruction, GitHubWebhookPayload, AiderContext, User, Repository } from './types';

export class GitHubContextParser {
  private static readonly AGENT_TRIGGER_PATTERN = /@agents?\s+(.+)/i;
  private static readonly FILE_PATTERN = /(?:files?|in)\s*:\s*([^\n]+)/i;
  private static readonly MODEL_PATTERN = /(?:model|using)\s*:\s*(\w+)/i;

  /**
   * Extracts agent instruction from comment body
   */
  extractTrigger(commentBody: string): AgentInstruction | null {
    const match = commentBody.match(GitHubContextParser.AGENT_TRIGGER_PATTERN);
    if (!match) {
      return null;
    }

    const fullInstruction = match[1].trim();
    const files = this.extractFiles(commentBody);
    const model = this.extractModel(commentBody);
    const priority = this.extractPriority(commentBody);

    return {
      trigger: '@agent',
      instruction: fullInstruction,
      files,
      model,
      priority
    };
  }

  /**
   * Prepares context for Aider execution
   */
  prepareContext(eventData: GitHubWebhookPayload, instruction: AgentInstruction): AiderContext {
    const repository = eventData.repository;
    const user = eventData.sender;
    
    // Determine if this is an issue or PR context
    const issueNumber = eventData.issue?.number;
    const pullRequestNumber = eventData.pull_request?.number;
    
    // Default to all relevant files if none specified
    const files = instruction.files || this.getDefaultFiles(repository);
    
    return {
      instruction: instruction.instruction,
      repository,
      issueNumber,
      pullRequestNumber,
      files,
      baseBranch: repository.default_branch,
      workingDirectory: process.cwd(),
      user
    };
  }

  /**
   * Validates if user has permission to trigger the action
   */
  validatePermissions(user: string, allowedUsers: string[]): boolean {
    // If no specific users are configured, allow all
    if (!allowedUsers || allowedUsers.length === 0) {
      return true;
    }

    return allowedUsers.includes(user);
  }

  /**
   * Determines if the webhook event should trigger the action
   */
  shouldProcessEvent(eventData: GitHubWebhookPayload): boolean {
    // Process issue comments
    if (eventData.action === 'created' && eventData.comment) {
      return this.extractTrigger(eventData.comment.body) !== null;
    }

    // Process new issues with agent mentions
    if (eventData.action === 'opened' && eventData.issue) {
      return this.extractTrigger(eventData.issue.body || '') !== null;
    }

    // Process PR comments
    if (eventData.action === 'created' && eventData.comment && eventData.pull_request) {
      return this.extractTrigger(eventData.comment.body) !== null;
    }

    return false;
  }

  private extractFiles(text: string): string[] | undefined {
    const match = text.match(GitHubContextParser.FILE_PATTERN);
    if (!match) {
      return undefined;
    }

    return match[1]
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  private extractModel(text: string): string | undefined {
    const match = text.match(GitHubContextParser.MODEL_PATTERN);
    return match ? match[1].toLowerCase() : undefined;
  }

  private extractPriority(text: string): 'low' | 'medium' | 'high' | undefined {
    const lowPriorityWords = ['low', 'minor', 'simple'];
    const highPriorityWords = ['high', 'urgent', 'critical', 'important'];
    
    const lowerText = text.toLowerCase();
    
    if (highPriorityWords.some(word => lowerText.includes(word))) {
      return 'high';
    }
    
    if (lowPriorityWords.some(word => lowerText.includes(word))) {
      return 'low';
    }
    
    return 'medium';
  }

  private getDefaultFiles(repository: Repository): string[] {
    // Return common file patterns based on repository type
    return [
      '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
      '**/*.py', '**/*.java', '**/*.go', '**/*.rs',
      '**/*.md', 'package.json', 'requirements.txt'
    ];
  }

  /**
   * Extracts relevant context from issue or PR description
   */
  extractContextFromDescription(description: string): {
    relatedFiles: string[];
    requirements: string[];
    constraints: string[];
  } {
    const relatedFiles: string[] = [];
    const requirements: string[] = [];
    const constraints: string[] = [];

    // Extract file mentions
    const fileMatches = description.match(/`([^`]+\.[a-zA-Z]+)`/g);
    if (fileMatches) {
      relatedFiles.push(...fileMatches.map(match => match.slice(1, -1)));
    }

    // Extract requirements (lines starting with "- [ ]" or "- ")
    const requirementMatches = description.match(/^[\s]*[-*]\s*(?:\[[ x]\]\s*)?(.+)$/gm);
    if (requirementMatches) {
      requirements.push(...requirementMatches.map(match => match.replace(/^[\s]*[-*]\s*(?:\[[ x]\]\s*)?/, '')));
    }

    // Extract constraints (lines with "must", "should", "cannot")
    const constraintWords = ['must', 'should', 'cannot', 'should not', 'must not'];
    const lines = description.split('\n');
    for (const line of lines) {
      if (constraintWords.some(word => line.toLowerCase().includes(word))) {
        constraints.push(line.trim());
      }
    }

    return { relatedFiles, requirements, constraints };
  }
}
