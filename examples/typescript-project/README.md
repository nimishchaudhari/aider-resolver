# TypeScript Project Example

Complete setup for a TypeScript/Node.js project with comprehensive AI assistant integration.

## Project Structure

```
typescript-project/
├── .github/
│   ├── workflows/
│   │   └── aider-assistant.yml
│   └── agents.md
├── src/
│   ├── services/
│   │   └── user.ts
│   ├── utils/
│   │   └── validation.ts
│   └── index.ts
├── test/
│   └── services/
│       └── user.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Workflow Configuration

```yaml
# .github/workflows/aider-assistant.yml
name: 'TypeScript AI Assistant'

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened]

jobs:
  aider-resolver:
    if: contains(github.event.comment.body, '@agent') || contains(github.event.issue.body, '@agent')
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
      issues: write
      pull-requests: write
      actions: read
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run TypeScript Check
        run: npm run type-check
      
      - name: Run Aider AI Assistant
        id: aider
        uses: your-org/aider-resolver@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          
          # AI Provider API Keys
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
          
          # Configuration
          default_model: 'deepseek'
          max_execution_time: '25'
          enable_auto_pr: 'true'
          cost_budget_daily: '15'
          
          # TypeScript-specific config
          config_file: '.github/agents.md'
      
      - name: Run Tests After Changes
        if: steps.aider.outputs.result == 'success'
        run: |
          npm test
          npm run lint
      
      - name: Report Results
        if: always()
        run: |
          echo "AI Assistant Result: ${{ steps.aider.outputs.result }}"
          echo "Files Changed: ${{ steps.aider.outputs.files_changed }}"
          echo "Cost Used: ${{ steps.aider.outputs.cost_used }}"
          if [[ "${{ steps.aider.outputs.pull_request_url }}" != "" ]]; then
            echo "Pull Request: ${{ steps.aider.outputs.pull_request_url }}"
          fi
```

## Agents Configuration

```markdown
# TypeScript Project AI Configuration

## Allowed Users
- @project-owner
- @senior-developer
- @tech-lead

## File Patterns
- `src/**/*.ts`
- `src/**/*.tsx`
- `test/**/*.ts`
- `test/**/*.spec.ts`
- `**/*.md`
- `package.json`
- `tsconfig.json`
- `jest.config.js`

## Models

### deepseek
- Provider: deepseek
- Cost per token: $0.0001
- Max tokens: 8192
- Complexity: simple
- Best for: Type fixes, simple refactoring, formatting

### claude-sonnet
- Provider: anthropic
- Cost per token: $0.003
- Max tokens: 4096
- Complexity: complex
- Best for: Complex TypeScript patterns, architecture changes

### gpt-4
- Provider: openai
- Cost per token: $0.01
- Max tokens: 4096
- Complexity: complex
- Best for: Advanced TypeScript features, complex algorithms

## Cost Limits
- Max cost per operation: $1.50
- Daily budget: $15.00

## Settings
- Default model: deepseek
- Auto create PR: true
- Test command: npm test
- Lint command: npm run lint
- Type check command: npm run type-check
```

## Package.json

```json
{
  "name": "typescript-ai-example",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit",
    "format": "prettier --write src/**/*.ts"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Usage Examples

### Type Safety Improvements
```
@agent Fix all TypeScript strict mode errors in the user service
files: src/services/user.ts
```

### Add Generic Types
```
@agent Add proper generic types to the API response handlers
files: src/utils/api.ts, src/types/api.ts
model: claude-sonnet
```

### Testing
```
@agent Add comprehensive unit tests with proper TypeScript typing
files: src/services/user.ts, test/services/user.test.ts
```

### Refactoring
```
@agent model: gpt-4
Refactor the authentication service to use dependency injection with proper TypeScript decorators
files: src/services/auth.ts, src/types/auth.ts
```
