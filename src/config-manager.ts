import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { AgentsConfig, ModelConfig, SecretValidation, CostTracker } from './types';

export class ConfigManager {
  private static readonly DEFAULT_CONFIG: AgentsConfig = {
    defaultModel: 'deepseek',
    modelConfigs: {},
    allowedUsers: [],
    filePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.md'],
    maxCostPerOperation: 1.0,
    autoCreatePR: true
  };

  constructor(private workingDirectory: string) {}

  /**
   * Loads agents configuration from repository
   */
  async loadAgentsConfig(configPath: string = '.github/agents.md'): Promise<AgentsConfig> {
    const fullPath = path.join(this.workingDirectory, configPath);
    
    try {
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        return this.parseAgentsConfig(content);
      }
    } catch (error) {
      console.log(`Could not load config from ${configPath}, using defaults:`, error);
    }
    
    // Return default config with environment-based model setup
    return this.buildConfigFromEnvironment();
  }

  /**
   * Gets model configuration for a specific task type
   */
  getModelConfig(taskType: string, config: AgentsConfig): ModelConfig {
    const modelName = config.defaultModel;
    const modelConfig = config.modelConfigs[modelName];
    
    if (!modelConfig) {
      throw new Error(`Model configuration not found for: ${modelName}`);
    }
    
    return modelConfig;
  }

  /**
   * Validates that required secrets are available
   */
  validateSecrets(): SecretValidation {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    const hasGitHub = !!process.env.GITHUB_TOKEN;
    
    const isValid = hasGitHub && (hasOpenAI || hasAnthropic || hasDeepSeek);
    
    return {
      hasOpenAI,
      hasAnthropic,
      hasDeepSeek,
      hasGitHub,
      isValid
    };
  }

  /**
   * Creates and tracks cost for operations
   */
  createCostTracker(dailyBudget: number): CostTracker {
    // In production, this would connect to a persistent store
    const usedToday = this.getTodaysCost();
    
    return {
      dailyBudget,
      usedToday,
      operationCost: 0,
      canProceed: usedToday < dailyBudget
    };
  }

  /**
   * Updates cost tracking after operation
   */
  updateCostTracking(tracker: CostTracker, operationCost: number): void {
    tracker.operationCost = operationCost;
    tracker.usedToday += operationCost;
    tracker.canProceed = tracker.usedToday < tracker.dailyBudget;
    
    // In production, persist this to storage
    this.persistCostData(tracker);
  }

  /**
   * Saves current configuration to file
   */
  async saveAgentsConfig(config: AgentsConfig, configPath: string = '.github/agents.md'): Promise<void> {
    const fullPath = path.join(this.workingDirectory, configPath);
    const content = this.generateConfigMarkdown(config);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Parses agents.md configuration file
   */
  private parseAgentsConfig(content: string): AgentsConfig {
    const config = { ...ConfigManager.DEFAULT_CONFIG };
    
    // Parse YAML frontmatter if present
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      try {
        const yamlConfig = yaml.parse(yamlMatch[1]);
        Object.assign(config, yamlConfig);
      } catch (error) {
        console.warn('Failed to parse YAML frontmatter:', error);
      }
    }
    
    // Parse configuration sections from markdown
    this.parseMarkdownConfig(content, config);
    
    return config;
  }

  /**
   * Parses configuration from markdown sections
   */
  private parseMarkdownConfig(content: string, config: AgentsConfig): void {
    // Parse allowed users
    const usersMatch = content.match(/## Allowed Users\s*\n([\s\S]*?)(?=\n##|\n$)/);
    if (usersMatch) {
      const users = usersMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-*]\s*@?/, '').trim())
        .filter(user => user.length > 0);
      config.allowedUsers = users;
    }

    // Parse file patterns
    const filesMatch = content.match(/## File Patterns\s*\n([\s\S]*?)(?=\n##|\n$)/);
    if (filesMatch) {
      const patterns = filesMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-*]\s*`?([^`]+)`?/, '$1').trim())
        .filter(pattern => pattern.length > 0);
      config.filePatterns = patterns;
    }

    // Parse model configurations
    const modelsMatch = content.match(/## Models\s*\n([\s\S]*?)(?=\n##|\n$)/);
    if (modelsMatch) {
      this.parseModelConfigs(modelsMatch[1], config);
    }

    // Parse cost limits
    const costMatch = content.match(/## Cost Limits\s*\n([\s\S]*?)(?=\n##|\n$)/);
    if (costMatch) {
      const costContent = costMatch[1];
      const maxCostMatch = costContent.match(/max[_\s]*cost[_\s]*per[_\s]*operation[:\s]*\$?([0-9.]+)/i);
      if (maxCostMatch) {
        config.maxCostPerOperation = parseFloat(maxCostMatch[1]);
      }
    }
  }

  /**
   * Parses model configurations from markdown
   */
  private parseModelConfigs(content: string, config: AgentsConfig): void {
    const modelSections = content.split(/###\s+([^\n]+)/);
    
    for (let i = 1; i < modelSections.length; i += 2) {
      const modelName = modelSections[i].trim().toLowerCase();
      const modelContent = modelSections[i + 1];
      
      const modelConfig = this.parseModelSection(modelContent);
      if (modelConfig) {
        config.modelConfigs[modelName] = {
          name: modelName,
          ...modelConfig
        };
      }
    }
  }

  /**
   * Parses individual model section
   */
  private parseModelSection(content: string): Partial<ModelConfig> | null {
    const providerMatch = content.match(/provider[:\s]+(\w+)/i);
    const costMatch = content.match(/cost[_\s]*per[_\s]*token[:\s]+\$?([0-9.]+)/i);
    const maxTokensMatch = content.match(/max[_\s]*tokens[:\s]+([0-9]+)/i);
    const complexityMatch = content.match(/complexity[:\s]+(\w+)/i);
    
    if (!providerMatch) {
      return null;
    }
    
    return {
      provider: providerMatch[1] as 'openai' | 'anthropic' | 'deepseek',
      apiKey: this.getApiKeyForProvider(providerMatch[1]),
      costPerToken: costMatch ? parseFloat(costMatch[1]) : 0.001,
      maxTokens: maxTokensMatch ? parseInt(maxTokensMatch[1]) : 4096,
      complexity: complexityMatch?.[1] as 'simple' | 'medium' | 'complex' || 'medium'
    };
  }

  /**
   * Builds configuration from environment variables
   */
  private buildConfigFromEnvironment(): AgentsConfig {
    const config = { ...ConfigManager.DEFAULT_CONFIG };
    
    // Add available models based on environment
    if (process.env.DEEPSEEK_API_KEY) {
      config.modelConfigs['deepseek'] = {
        name: 'deepseek',
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        costPerToken: 0.0001,
        maxTokens: 8192,
        complexity: 'simple'
      };
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      config.modelConfigs['claude-sonnet'] = {
        name: 'claude-sonnet',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        costPerToken: 0.003,
        maxTokens: 4096,
        complexity: 'complex'
      };
    }
    
    if (process.env.OPENAI_API_KEY) {
      config.modelConfigs['gpt-4'] = {
        name: 'gpt-4',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        costPerToken: 0.01,
        maxTokens: 4096,
        complexity: 'complex'
      };
    }
    
    // Set default model to first available
    const availableModels = Object.keys(config.modelConfigs);
    if (availableModels.length > 0) {
      config.defaultModel = availableModels[0];
    }
    
    // Parse environment variables
    if (process.env.INPUT_DEFAULT_MODEL) {
      config.defaultModel = process.env.INPUT_DEFAULT_MODEL;
    }
    
    if (process.env.INPUT_COST_BUDGET_DAILY) {
      config.maxCostPerOperation = parseFloat(process.env.INPUT_COST_BUDGET_DAILY);
    }
    
    if (process.env.INPUT_ALLOWED_USERS) {
      config.allowedUsers = process.env.INPUT_ALLOWED_USERS.split(',').map(u => u.trim());
    }
    
    if (process.env.INPUT_ENABLE_AUTO_PR) {
      config.autoCreatePR = process.env.INPUT_ENABLE_AUTO_PR.toLowerCase() === 'true';
    }
    
    return config;
  }

  /**
   * Gets API key for a provider
   */
  private getApiKeyForProvider(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai':
        return process.env.OPENAI_API_KEY || process.env.INPUT_OPENAI_API_KEY || '';
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || process.env.INPUT_ANTHROPIC_API_KEY || '';
      case 'deepseek':
        return process.env.DEEPSEEK_API_KEY || process.env.INPUT_DEEPSEEK_API_KEY || '';
      default:
        return '';
    }
  }

  /**
   * Gets today's cost from storage (simplified implementation)
   */
  private getTodaysCost(): number {
    // In production, this would read from persistent storage
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Persists cost data (simplified implementation)
   */
  private persistCostData(tracker: CostTracker): void {
    // In production, this would write to persistent storage
    console.log('Cost tracking:', {
      dailyBudget: tracker.dailyBudget,
      usedToday: tracker.usedToday,
      operationCost: tracker.operationCost
    });
  }

  /**
   * Generates agents.md configuration file content
   */
  private generateConfigMarkdown(config: AgentsConfig): string {
    let content = `# Agents Configuration\n\n`;
    content += `This file configures the Aider GitHub resolver for this repository.\n\n`;
    
    content += `## Allowed Users\n\n`;
    if (config.allowedUsers.length > 0) {
      for (const user of config.allowedUsers) {
        content += `- @${user}\n`;
      }
    } else {
      content += `- *All repository collaborators*\n`;
    }
    
    content += `\n## File Patterns\n\n`;
    for (const pattern of config.filePatterns) {
      content += `- \`${pattern}\`\n`;
    }
    
    content += `\n## Models\n\n`;
    for (const [name, modelConfig] of Object.entries(config.modelConfigs)) {
      content += `### ${name}\n\n`;
      content += `- Provider: ${modelConfig.provider}\n`;
      content += `- Cost per token: $${modelConfig.costPerToken}\n`;
      content += `- Max tokens: ${modelConfig.maxTokens}\n`;
      content += `- Complexity: ${modelConfig.complexity}\n\n`;
    }
    
    content += `## Cost Limits\n\n`;
    content += `- Max cost per operation: $${config.maxCostPerOperation}\n`;
    
    content += `\n## Settings\n\n`;
    content += `- Default model: ${config.defaultModel}\n`;
    content += `- Auto create PR: ${config.autoCreatePR}\n`;
    
    return content;
  }
}
