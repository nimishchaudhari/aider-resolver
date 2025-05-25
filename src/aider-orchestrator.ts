import { spawn, ChildProcess } from 'child_process';
import { AiderContext, AiderResult, ModelConfig, TaskComplexity, ProgressCallback, ProgressUpdate } from './types';

export class AiderOrchestrator {
  private currentProcess: ChildProcess | null = null;
  private progressCallback: ProgressCallback | null = null;

  constructor(private modelConfigs: Record<string, ModelConfig>) {}

  /**
   * Executes Aider with the given instruction and context
   */
  async execute(instruction: string, context: AiderContext): Promise<AiderResult> {
    const startTime = Date.now();
    const modelConfig = this.selectOptimalModel(this.analyzeTaskComplexity(instruction));
    
    try {
      this.reportProgress({
        step: 'Initializing',
        status: 'in_progress',
        message: `Selected ${modelConfig.name} for this task`
      });

      const aiderCommand = this.buildAiderCommand(instruction, context, modelConfig);
      const result = await this.executeAiderCommand(aiderCommand, context.workingDirectory);
      
      const executionTime = (Date.now() - startTime) / 1000;
      
      return {
        success: result.exitCode === 0,
        filesChanged: this.extractChangedFiles(result.output),
        commitSha: this.extractCommitSha(result.output),
        errorMessage: result.exitCode !== 0 ? result.stderr : undefined,
        output: result.output,
        costUsed: this.estimateCost(result.output, modelConfig),
        modelUsed: modelConfig.name,
        executionTime
      };
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      
      return {
        success: false,
        filesChanged: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        output: '',
        costUsed: 0,
        modelUsed: modelConfig.name,
        executionTime
      };
    }
  }

  /**
   * Sets up progress streaming callback
   */
  streamProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Selects optimal model based on task complexity
   */
  selectOptimalModel(complexity: TaskComplexity): ModelConfig {
    const modelPreferences = {
      simple: ['deepseek', 'claude-haiku', 'gpt-3.5-turbo'],
      medium: ['claude-sonnet', 'gpt-4', 'deepseek'],
      complex: ['claude-sonnet', 'gpt-4', 'o1-preview']
    };

    for (const modelName of modelPreferences[complexity]) {
      if (this.modelConfigs[modelName]) {
        return this.modelConfigs[modelName];
      }
    }

    // Fallback to first available model
    const availableModels = Object.values(this.modelConfigs);
    if (availableModels.length === 0) {
      throw new Error('No AI models configured');
    }

    return availableModels[0];
  }

  /**
   * Analyzes task complexity based on instruction content
   */
  private analyzeTaskComplexity(instruction: string): TaskComplexity {
    const complexKeywords = [
      'architecture', 'refactor', 'redesign', 'framework', 'database',
      'security', 'performance', 'algorithm', 'complex', 'integration'
    ];
    
    const simpleKeywords = [
      'fix typo', 'format', 'lint', 'comment', 'rename', 'simple',
      'update', 'change text', 'add line', 'remove line'
    ];

    const lowerInstruction = instruction.toLowerCase();
    
    if (complexKeywords.some(keyword => lowerInstruction.includes(keyword))) {
      return 'complex';
    }
    
    if (simpleKeywords.some(keyword => lowerInstruction.includes(keyword))) {
      return 'simple';
    }
    
    // Check instruction length as a heuristic
    if (instruction.length > 500) {
      return 'complex';
    } else if (instruction.length < 100) {
      return 'simple';
    }
    
    return 'medium';
  }

  /**
   * Builds the Aider command with all necessary parameters
   */
  private buildAiderCommand(instruction: string, context: AiderContext, modelConfig: ModelConfig): string[] {
    const command = ['aider'];
    
    // Non-interactive mode
    command.push('--yes');
    
    // Verbose output for progress tracking
    command.push('--verbose');
    command.push('--stream');
    
    // Model configuration
    command.push('--model', modelConfig.name);
    
    // API key configuration
    switch (modelConfig.provider) {
      case 'openai':
        command.push('--openai-api-key', modelConfig.apiKey);
        break;
      case 'anthropic':
        command.push('--anthropic-api-key', modelConfig.apiKey);
        break;
      case 'deepseek':
        command.push('--api-key', `deepseek=${modelConfig.apiKey}`);
        break;
    }
    
    // Add instruction
    command.push('--message', instruction);
    
    // Add file patterns
    if (context.files.length > 0) {
      command.push(...context.files);
    }
    
    return command;
  }

  /**
   * Executes the Aider command and streams output
   */
  private async executeAiderCommand(command: string[], workingDirectory: string): Promise<{
    exitCode: number;
    output: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      this.reportProgress({
        step: 'Executing Aider',
        status: 'in_progress',
        message: 'Starting AI code generation...'
      });

      const process = spawn(command[0], command.slice(1), {
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentProcess = process;
      let output = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this.parseProgressFromOutput(chunk);
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        this.currentProcess = null;
        resolve({
          exitCode: code || 0,
          output,
          stderr
        });
      });

      process.on('error', (error) => {
        this.currentProcess = null;
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        if (this.currentProcess) {
          this.currentProcess.kill('SIGTERM');
          reject(new Error('Aider execution timed out'));
        }
      }, 30 * 60 * 1000); // 30 minutes timeout
    });
  }

  /**
   * Parses progress information from Aider's verbose output
   */
  private parseProgressFromOutput(output: string): void {
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('Analyzing repository')) {
        this.reportProgress({
          step: 'Repository Analysis',
          status: 'in_progress',
          message: 'Understanding codebase structure...'
        });
      } else if (trimmedLine.includes('Generating changes')) {
        this.reportProgress({
          step: 'Code Generation',
          status: 'in_progress',
          message: 'AI is writing code changes...'
        });
      } else if (trimmedLine.includes('Applying changes')) {
        this.reportProgress({
          step: 'Applying Changes',
          status: 'in_progress',
          message: 'Writing changes to files...'
        });
      } else if (trimmedLine.includes('Committing changes')) {
        this.reportProgress({
          step: 'Git Commit',
          status: 'in_progress',
          message: 'Creating git commit...'
        });
      } else if (trimmedLine.includes('ERROR') || trimmedLine.includes('Error')) {
        this.reportProgress({
          step: 'Error',
          status: 'failed',
          message: trimmedLine
        });
      }
    }
  }

  /**
   * Reports progress to the callback if available
   */
  private reportProgress(update: ProgressUpdate): void {
    if (this.progressCallback) {
      this.progressCallback(update);
    }
  }

  /**
   * Extracts changed files from Aider output
   */
  private extractChangedFiles(output: string): string[] {
    const files: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for patterns like "Modified: file.ts" or "Created: file.js"
      const match = line.match(/(?:Modified|Created|Updated):\s+(.+)/);
      if (match) {
        files.push(match[1].trim());
      }
    }
    
    return files;
  }

  /**
   * Extracts commit SHA from Aider output
   */
  private extractCommitSha(output: string): string | undefined {
    const match = output.match(/Commit\s+([a-f0-9]{7,40})/i);
    return match ? match[1] : undefined;
  }

  /**
   * Estimates cost based on tokens used (simplified)
   */
  private estimateCost(output: string, modelConfig: ModelConfig): number {
    // This is a simplified estimation
    // In production, you'd parse actual token usage from the model response
    const estimatedTokens = output.length / 4; // Rough approximation
    return estimatedTokens * modelConfig.costPerToken;
  }

  /**
   * Cancels current operation
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }
}
