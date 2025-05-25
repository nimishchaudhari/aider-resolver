import * as core from '@actions/core';
import * as github from '@actions/github';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

import { GitHubContextParser } from './github-parser';
import { AiderOrchestrator } from './aider-orchestrator';
import { GitHubReporter } from './github-reporter';
import { ConfigManager } from './config-manager';
import { 
  GitHubWebhookPayload, 
  AgentInstruction, 
  AiderContext, 
  AiderResult,
  GitChanges,
  AgentsConfig,
  CostTracker
} from './types';

export class AiderResolver {
  private parser: GitHubContextParser;
  private orchestrator: AiderOrchestrator | null = null;
  private reporter: GitHubReporter;
  private configManager: ConfigManager;
  private config: AgentsConfig | null = null;
  private costTracker: CostTracker | null = null;

  constructor(
    private githubToken: string,
    private workingDirectory: string = process.cwd()
  ) {
    this.parser = new GitHubContextParser();
    this.configManager = new ConfigManager(this.workingDirectory);
    
    // GitHub reporter will be initialized when we have repository context
    this.reporter = null as any;
  }

  /**
   * Main entry point for processing GitHub webhook events
   */
  async processEvent(): Promise<void> {
    try {
      const eventPayload = github.context.payload as GitHubWebhookPayload;
      
      core.info('Processing GitHub event...');
      core.debug(`Event: ${JSON.stringify(eventPayload, null, 2)}`);

      // Validate the event should be processed
      if (!this.parser.shouldProcessEvent(eventPayload)) {
        core.info('Event does not contain agent trigger, skipping...');
        return;
      }

      // Initialize components with repository context
      await this.initialize(eventPayload);

      // Extract instruction from the event
      const instruction = this.extractInstruction(eventPayload);
      if (!instruction) {
        core.info('No valid agent instruction found');
        return;
      }

      // Validate permissions
      if (!this.validatePermissions(eventPayload.sender.login)) {
        core.warning(`User ${eventPayload.sender.login} is not authorized to use agents`);
        return;
      }

      // Check cost constraints
      if (!this.validateCostConstraints(instruction)) {
        core.warning('Operation would exceed cost limits');
        return;
      }

      // Prepare context for Aider
      const context = this.parser.prepareContext(eventPayload, instruction);
      
      // Setup git repository
      await this.setupGitRepository(context);

      // Add reaction to show we're processing
      if (eventPayload.comment) {
        await this.reporter.addReaction(eventPayload.comment.id, 'eyes');
      }

      // Execute the Aider operation
      const result = await this.executeAiderOperation(instruction, context, eventPayload);

      // Handle results
      await this.handleResults(result, context, eventPayload);

    } catch (error) {
      core.setFailed(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Full error:', error);
    }
  }

  /**
   * Initializes all components with repository context
   */
  private async initialize(eventPayload: GitHubWebhookPayload): Promise<void> {
    // Initialize GitHub reporter
    this.reporter = new GitHubReporter(this.githubToken, eventPayload.repository);

    // Load configuration
    const configFile = core.getInput('config_file') || '.github/agents.md';
    this.config = await this.configManager.loadAgentsConfig(configFile);

    // Validate secrets
    const secretValidation = this.configManager.validateSecrets();
    if (!secretValidation.isValid) {
      throw new Error('Required API keys are missing. Need GitHub token and at least one AI provider API key.');
    }

    // Initialize Aider orchestrator
    this.orchestrator = new AiderOrchestrator(this.config.modelConfigs);

    // Setup cost tracking
    const dailyBudget = parseFloat(core.getInput('cost_budget_daily') || '10');
    this.costTracker = this.configManager.createCostTracker(dailyBudget);

    core.info('Aider resolver initialized successfully');
  }

  /**
   * Extracts agent instruction from the event
   */
  private extractInstruction(eventPayload: GitHubWebhookPayload): AgentInstruction | null {
    let commentBody = '';

    if (eventPayload.comment) {
      commentBody = eventPayload.comment.body;
    } else if (eventPayload.issue) {
      commentBody = eventPayload.issue.body || '';
    }

    return this.parser.extractTrigger(commentBody);
  }

  /**
   * Validates user permissions
   */
  private validatePermissions(username: string): boolean {
    if (!this.config) return false;
    return this.parser.validatePermissions(username, this.config.allowedUsers);
  }

  /**
   * Validates cost constraints
   */
  private validateCostConstraints(instruction: AgentInstruction): boolean {
    if (!this.costTracker || !this.config) return false;

    // Estimate operation cost (simplified)
    const estimatedCost = this.estimateOperationCost(instruction);
    
    if (estimatedCost > this.config.maxCostPerOperation) {
      core.warning(`Estimated cost $${estimatedCost} exceeds max per operation $${this.config.maxCostPerOperation}`);
      return false;
    }

    if (this.costTracker.usedToday + estimatedCost > this.costTracker.dailyBudget) {
      core.warning(`Operation would exceed daily budget`);
      return false;
    }

    return true;
  }

  /**
   * Estimates operation cost based on instruction complexity
   */
  private estimateOperationCost(instruction: AgentInstruction): number {
    const baseComplexity = instruction.priority === 'high' ? 0.50 : 
                          instruction.priority === 'low' ? 0.10 : 0.25;
    
    const lengthMultiplier = Math.min(instruction.instruction.length / 1000, 2.0);
    const fileMultiplier = instruction.files ? Math.min(instruction.files.length / 10, 1.5) : 1.0;
    
    return baseComplexity * lengthMultiplier * fileMultiplier;
  }

  /**
   * Sets up the git repository for Aider operations
   */
  private async setupGitRepository(context: AiderContext): Promise<void> {
    core.info('Setting up git repository...');

    // Ensure we're in a git repository
    if (!await fs.pathExists(path.join(this.workingDirectory, '.git'))) {
      // Clone the repository if we're not already in it
      await this.cloneRepository(context);
    }

    // Configure git user for commits
    await this.configureGitUser();

    // Create a new branch for changes
    const branchName = `aider-${Date.now()}`;
    await this.executeCommand(['git', 'checkout', '-b', branchName]);
    
    core.info(`Created branch: ${branchName}`);
  }

  /**
   * Clones the repository if needed
   */
  private async cloneRepository(context: AiderContext): Promise<void> {
    const repoUrl = `https://x-access-token:${this.githubToken}@github.com/${context.repository.full_name}.git`;
    
    await this.executeCommand(['git', 'clone', repoUrl, '.']);
    core.info(`Cloned repository: ${context.repository.full_name}`);
  }

  /**
   * Configures git user for commits
   */
  private async configureGitUser(): Promise<void> {
    await this.executeCommand(['git', 'config', 'user.name', 'Aider Assistant']);
    await this.executeCommand(['git', 'config', 'user.email', 'aider-assistant@users.noreply.github.com']);
  }

  /**
   * Executes the Aider operation with progress tracking
   */
  private async executeAiderOperation(
    instruction: AgentInstruction,
    context: AiderContext,
    eventPayload: GitHubWebhookPayload
  ): Promise<AiderResult> {
    if (!this.orchestrator) {
      throw new Error('Aider orchestrator not initialized');
    }

    const issueNumber = context.issueNumber || context.pullRequestNumber;
    if (!issueNumber) {
      throw new Error('No issue or PR number found');
    }

    // Setup progress tracking
    this.orchestrator.streamProgress(async (progress) => {
      await this.reporter.updateProgress(issueNumber, progress);
    });

    // Execute Aider
    core.info('Executing Aider operation...');
    const result = await this.orchestrator.execute(instruction.instruction, context);

    // Update cost tracking
    if (this.costTracker) {
      this.configManager.updateCostTracking(this.costTracker, result.costUsed);
    }

    return result;
  }

  /**
   * Handles the results of the Aider operation
   */
  private async handleResults(
    result: AiderResult,
    context: AiderContext,
    eventPayload: GitHubWebhookPayload
  ): Promise<void> {
    const issueNumber = context.issueNumber || context.pullRequestNumber;
    if (!issueNumber) {
      throw new Error('No issue or PR number found');
    }

    let pullRequestUrl: string | undefined;

    if (result.success && result.filesChanged.length > 0) {
      // Add success reaction
      if (eventPayload.comment) {
        await this.reporter.addReaction(eventPayload.comment.id, 'hooray');
      }

      // Create pull request if enabled
      if (this.config?.autoCreatePR) {
        pullRequestUrl = await this.createPullRequest(result, context, eventPayload);
      }

      // Set action outputs
      core.setOutput('result', 'success');
      core.setOutput('files_changed', result.filesChanged.length.toString());
      core.setOutput('cost_used', result.costUsed.toString());
      
      if (pullRequestUrl) {
        core.setOutput('pull_request_url', pullRequestUrl);
      }
    } else {
      // Add failure reaction
      if (eventPayload.comment) {
        await this.reporter.addReaction(eventPayload.comment.id, 'confused');
      }

      core.setOutput('result', 'failed');
      core.setOutput('files_changed', '0');
      core.setOutput('cost_used', result.costUsed.toString());
    }

    // Report final results
    await this.reporter.reportResults(issueNumber, result, eventPayload.sender, pullRequestUrl);
  }

  /**
   * Creates a pull request with the changes
   */
  private async createPullRequest(
    result: AiderResult,
    context: AiderContext,
    eventPayload: GitHubWebhookPayload
  ): Promise<string> {
    // Get current branch name
    const branchResult = await this.executeCommand(['git', 'branch', '--show-current']);
    const branchName = branchResult.stdout.trim();

    // Push the branch
    await this.executeCommand(['git', 'push', 'origin', branchName]);

    // Prepare PR details
    const changes: GitChanges = {
      files: result.filesChanged,
      commitMessage: `AI-generated changes via Aider\n\n${context.instruction}`,
      branch: branchName,
      pullRequestTitle: `🤖 AI Code Changes: ${this.truncateString(context.instruction, 50)}`,
      pullRequestBody: this.generatePullRequestBody(result, context, eventPayload)
    };

    return await this.reporter.createPullRequest(changes, eventPayload.sender);
  }

  /**
   * Generates pull request body
   */
  private generatePullRequestBody(
    result: AiderResult,
    context: AiderContext,
    eventPayload: GitHubWebhookPayload
  ): string {
    let body = `## 🤖 AI-Generated Changes\n\n`;
    body += `**Original Request:** ${context.instruction}\n\n`;
    
    if (context.issueNumber) {
      body += `**Related Issue:** #${context.issueNumber}\n\n`;
    }

    body += `**Changes Made:**\n`;
    for (const file of result.filesChanged) {
      body += `- Modified \`${file}\`\n`;
    }

    body += `\n**AI Model Used:** ${result.modelUsed}\n`;
    body += `**Execution Time:** ${result.executionTime.toFixed(1)}s\n`;
    body += `**Cost:** $${result.costUsed.toFixed(4)}\n`;

    if (result.commitSha) {
      body += `**Commit:** ${result.commitSha}\n`;
    }

    body += `\n**Requested by:** @${eventPayload.sender.login}\n`;
    body += `\n---\n`;
    body += `*This pull request was automatically generated by [Aider](https://aider.chat/) AI assistant.*\n`;
    body += `*Please review the changes carefully before merging.*`;

    return body;
  }

  /**
   * Executes a shell command
   */
  private async executeCommand(command: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), {
        cwd: this.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Truncates string to specified length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }
}
