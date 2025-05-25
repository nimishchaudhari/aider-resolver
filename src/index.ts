import * as core from '@actions/core';
import { AiderResolver } from './aider-resolver';

/**
 * Main entry point for the Aider GitHub Action
 */
async function run(): Promise<void> {
  try {
    core.info('🤖 Starting Aider GitHub Resolver...');

    // Get required inputs
    const githubToken = core.getInput('github_token', { required: true });
    
    // Validate at least one AI provider API key is present
    const openaiKey = core.getInput('openai_api_key');
    const anthropicKey = core.getInput('anthropic_api_key');
    const deepseekKey = core.getInput('deepseek_api_key');
    
    if (!openaiKey && !anthropicKey && !deepseekKey) {
      throw new Error('At least one AI provider API key must be provided (openai_api_key, anthropic_api_key, or deepseek_api_key)');
    }

    // Set environment variables for the resolver
    if (openaiKey) process.env.OPENAI_API_KEY = openaiKey;
    if (anthropicKey) process.env.ANTHROPIC_API_KEY = anthropicKey;
    if (deepseekKey) process.env.DEEPSEEK_API_KEY = deepseekKey;
    
    // Set other input environment variables
    process.env.INPUT_DEFAULT_MODEL = core.getInput('default_model');
    process.env.INPUT_MAX_EXECUTION_TIME = core.getInput('max_execution_time');
    process.env.INPUT_ENABLE_AUTO_PR = core.getInput('enable_auto_pr');
    process.env.INPUT_COST_BUDGET_DAILY = core.getInput('cost_budget_daily');
    process.env.INPUT_ALLOWED_USERS = core.getInput('allowed_users');
    process.env.INPUT_CONFIG_FILE = core.getInput('config_file');

    // Initialize and run the resolver
    const resolver = new AiderResolver(githubToken);
    await resolver.processEvent();

    core.info('✅ Aider GitHub Resolver completed successfully');
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    core.setFailed(`❌ Action failed: ${message}`);
    
    // Log full error for debugging
    console.error('Full error details:', error);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  core.setFailed(`Unhandled promise rejection: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  core.setFailed(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the action
if (require.main === module) {
  run();
}

export { run };
