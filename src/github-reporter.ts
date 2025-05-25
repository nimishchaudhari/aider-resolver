import { Octokit } from '@octokit/rest';
import { AiderResult, GitChanges, ProgressUpdate, Repository, User } from './types';

export class GitHubReporter {
  private octokit: Octokit;
  private repository: Repository;
  private progressCommentId: number | null = null;
  private progressSteps: Map<string, ProgressUpdate> = new Map();

  constructor(githubToken: string, repository: Repository) {
    this.octokit = new Octokit({
      auth: githubToken
    });
    this.repository = repository;
  }

  /**
   * Creates initial progress comment and updates it with real-time progress
   */
  async updateProgress(issueNumber: number, progress: ProgressUpdate): Promise<void> {
    this.progressSteps.set(progress.step, progress);

    const progressMarkdown = this.generateProgressMarkdown();

    try {
      if (this.progressCommentId === null) {
        // Create initial progress comment
        const response = await this.octokit.rest.issues.createComment({
          owner: this.repository.owner.login,
          repo: this.repository.name,
          issue_number: issueNumber,
          body: progressMarkdown
        });
        this.progressCommentId = response.data.id;
      } else {
        // Update existing progress comment
        await this.octokit.rest.issues.updateComment({
          owner: this.repository.owner.login,
          repo: this.repository.name,
          comment_id: this.progressCommentId,
          body: progressMarkdown
        });
      }
    } catch (error) {
      console.error('Failed to update progress comment:', error);
    }
  }

  /**
   * Reports final results of the Aider operation
   */
  async reportResults(
    issueNumber: number,
    result: AiderResult,
    user: User,
    pullRequestUrl?: string
  ): Promise<void> {
    const resultMarkdown = this.generateResultMarkdown(result, user, pullRequestUrl);

    try {
      if (this.progressCommentId !== null) {
        // Update the progress comment with final results
        await this.octokit.rest.issues.updateComment({
          owner: this.repository.owner.login,
          repo: this.repository.name,
          comment_id: this.progressCommentId,
          body: resultMarkdown
        });
      } else {
        // Create new comment with results
        await this.octokit.rest.issues.createComment({
          owner: this.repository.owner.login,
          repo: this.repository.name,
          issue_number: issueNumber,
          body: resultMarkdown
        });
      }
    } catch (error) {
      console.error('Failed to report results:', error);
    }
  }

  /**
   * Creates a pull request with the changes
   */
  async createPullRequest(changes: GitChanges, user: User): Promise<string> {
    try {
      const response = await this.octokit.rest.pulls.create({
        owner: this.repository.owner.login,
        repo: this.repository.name,
        title: changes.pullRequestTitle,
        body: changes.pullRequestBody,
        head: changes.branch,
        base: this.repository.default_branch
      });

      // Add assignee
      await this.octokit.rest.issues.addAssignees({
        owner: this.repository.owner.login,
        repo: this.repository.name,
        issue_number: response.data.number,
        assignees: [user.login]
      });

      // Add labels
      await this.octokit.rest.issues.addLabels({
        owner: this.repository.owner.login,
        repo: this.repository.name,
        issue_number: response.data.number,
        labels: ['ai-generated', 'aider-resolver']
      });

      return response.data.html_url;
    } catch (error) {
      console.error('Failed to create pull request:', error);
      throw error;
    }
  }

  /**
   * Generates progress markdown with checkboxes
   */
  private generateProgressMarkdown(): string {
    const timestamp = new Date().toISOString();
    
    let markdown = `🤖 **Aider Assistant** is working on your request...\n\n`;
    markdown += `**Progress:**\n`;

    const defaultSteps = [
      'Analyzing request and repository context',
      'Selecting optimal AI model',
      'Executing code changes with Aider',
      'Running tests and validation',
      'Creating pull request with changes',
      'Reporting results and cost summary'
    ];

    for (const stepName of defaultSteps) {
      const step = this.progressSteps.get(stepName);
      const status = step?.status || 'pending';
      const message = step?.message;

      let checkbox = '[ ]';
      let icon = '';
      
      switch (status) {
        case 'completed':
          checkbox = '[x]';
          icon = '✅';
          break;
        case 'in_progress':
          checkbox = '[⏳]';
          icon = '⚡';
          break;
        case 'failed':
          checkbox = '[❌]';
          icon = '❌';
          break;
        default:
          checkbox = '[ ]';
          icon = '⏸️';
      }

      markdown += `- ${checkbox} ${icon} ${stepName}`;
      if (message) {
        markdown += ` - ${message}`;
      }
      markdown += `\n`;
    }

    // Add any custom steps that aren't in the default list
    for (const [stepName, step] of this.progressSteps) {
      if (!defaultSteps.includes(stepName)) {
        const status = step.status;
        let checkbox = '[ ]';
        let icon = '';
        
        switch (status) {
          case 'completed':
            checkbox = '[x]';
            icon = '✅';
            break;
          case 'in_progress':
            checkbox = '[⏳]';
            icon = '⚡';
            break;
          case 'failed':
            checkbox = '[❌]';
            icon = '❌';
            break;
          default:
            checkbox = '[ ]';
            icon = '⏸️';
        }

        markdown += `- ${checkbox} ${icon} ${stepName}`;
        if (step.message) {
          markdown += ` - ${step.message}`;
        }
        markdown += `\n`;
      }
    }

    markdown += `\n*Last updated: ${timestamp}*\n`;
    markdown += `\n> 💡 This comment will be updated with real-time progress and final results.`;

    return markdown;
  }

  /**
   * Generates final result markdown
   */
  private generateResultMarkdown(
    result: AiderResult,
    user: User,
    pullRequestUrl?: string
  ): string {
    const timestamp = new Date().toISOString();
    
    let markdown = `🤖 **Aider Assistant** has completed your request!\n\n`;

    if (result.success) {
      markdown += `✅ **Operation Successful**\n\n`;
      
      if (pullRequestUrl) {
        markdown += `📋 **Pull Request Created:** [View Changes](${pullRequestUrl})\n\n`;
      }

      markdown += `**Summary:**\n`;
      markdown += `- **Files Changed:** ${result.filesChanged.length}\n`;
      markdown += `- **Model Used:** ${result.modelUsed}\n`;
      markdown += `- **Execution Time:** ${result.executionTime.toFixed(1)}s\n`;
      markdown += `- **Estimated Cost:** $${result.costUsed.toFixed(4)}\n`;

      if (result.commitSha) {
        markdown += `- **Commit:** \`${result.commitSha}\`\n`;
      }

      if (result.filesChanged.length > 0) {
        markdown += `\n**Changed Files:**\n`;
        for (const file of result.filesChanged) {
          markdown += `- \`${file}\`\n`;
        }
      }

      markdown += `\n**Next Steps:**\n`;
      if (pullRequestUrl) {
        markdown += `1. Review the changes in the [pull request](${pullRequestUrl})\n`;
        markdown += `2. Test the implementation locally\n`;
        markdown += `3. Merge when satisfied or request additional changes\n`;
      } else {
        markdown += `1. Review the committed changes\n`;
        markdown += `2. Test the implementation\n`;
        markdown += `3. Create additional issues if needed\n`;
      }

    } else {
      markdown += `❌ **Operation Failed**\n\n`;
      markdown += `**Error:** ${result.errorMessage}\n\n`;
      markdown += `**Troubleshooting:**\n`;
      markdown += `- Check if the request is clear and specific\n`;
      markdown += `- Ensure the specified files exist and are accessible\n`;
      markdown += `- Try breaking down complex requests into smaller steps\n`;
      markdown += `- Contact the repository maintainers if the issue persists\n\n`;
      
      markdown += `**Debug Information:**\n`;
      markdown += `- **Model Used:** ${result.modelUsed}\n`;
      markdown += `- **Execution Time:** ${result.executionTime.toFixed(1)}s\n`;
      
      if (result.output) {
        markdown += `\n<details>\n<summary>Detailed Output</summary>\n\n`;
        markdown += `\`\`\`\n${result.output}\`\`\`\n\n`;
        markdown += `</details>\n`;
      }
    }

    markdown += `\n---\n`;
    markdown += `*Completed at ${timestamp} • Requested by @${user.login}*\n`;
    markdown += `*Powered by [Aider](https://aider.chat/) and AI*`;

    return markdown;
  }

  /**
   * Adds reaction to the triggering comment
   */
  async addReaction(commentId: number, reaction: '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes'): Promise<void> {
    try {
      await this.octokit.rest.reactions.createForIssueComment({
        owner: this.repository.owner.login,
        repo: this.repository.name,
        comment_id: commentId,
        content: reaction
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  }

  /**
   * Creates a summary comment with cost and usage statistics
   */
  async createSummaryComment(
    issueNumber: number,
    results: AiderResult[],
    totalCost: number,
    user: User
  ): Promise<void> {
    const markdown = this.generateSummaryMarkdown(results, totalCost, user);

    try {
      await this.octokit.rest.issues.createComment({
        owner: this.repository.owner.login,
        repo: this.repository.name,
        issue_number: issueNumber,
        body: markdown
      });
    } catch (error) {
      console.error('Failed to create summary comment:', error);
    }
  }

  private generateSummaryMarkdown(results: AiderResult[], totalCost: number, user: User): string {
    const successCount = results.filter(r => r.success).length;
    const totalFiles = results.reduce((sum, r) => sum + r.filesChanged.length, 0);
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);

    let markdown = `📊 **Session Summary**\n\n`;
    markdown += `**Statistics:**\n`;
    markdown += `- **Operations:** ${results.length} (${successCount} successful)\n`;
    markdown += `- **Files Modified:** ${totalFiles}\n`;
    markdown += `- **Total Time:** ${totalTime.toFixed(1)}s\n`;
    markdown += `- **Total Cost:** $${totalCost.toFixed(4)}\n`;
    markdown += `- **User:** @${user.login}\n`;

    return markdown;
  }
}
