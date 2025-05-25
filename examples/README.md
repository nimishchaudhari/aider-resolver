# Example Repository Setup

This directory contains complete examples of how to set up and use the Aider GitHub Resolver in different types of projects.

## 📁 Directory Structure

```
examples/
├── typescript-project/     # TypeScript/Node.js project setup
├── python-project/         # Python project setup  
├── react-app/             # React application setup
├── minimal-setup/         # Minimal configuration
└── enterprise-setup/      # Enterprise-grade configuration
```

## 🚀 Quick Start Examples

### Minimal Setup

For a basic setup with default configurations:

```yaml
# .github/workflows/aider-assistant.yml
name: AI Assistant
on:
  issue_comment:
    types: [created]

jobs:
  ai-assistant:
    if: contains(github.event.comment.body, '@agent')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/aider-resolver@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
```

### TypeScript Project

Complete setup for TypeScript projects with testing and linting:

```yaml
# .github/workflows/aider-assistant.yml
name: AI Code Assistant
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
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run AI Assistant
        uses: your-org/aider-resolver@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
          default_model: 'deepseek'
          cost_budget_daily: '20'
          enable_auto_pr: 'true'
```

### Python Project

Setup for Python projects with poetry/pip:

```yaml
# .github/workflows/aider-assistant.yml
name: Python AI Assistant
on:
  issue_comment:
    types: [created]

jobs:
  aider-resolver:
    if: contains(github.event.comment.body, '@agent')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Run AI Assistant
        uses: your-org/aider-resolver@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
          config_file: '.github/agents-python.md'
```

## ⚙️ Configuration Examples

### Basic Configuration (.github/agents.md)

```markdown
# Agents Configuration

## Allowed Users
- @repository-owner
- @maintainer

## File Patterns
- `src/**/*.ts`
- `src/**/*.js`
- `test/**/*.ts`
- `*.md`

## Models
### deepseek
- Provider: deepseek
- Cost per token: $0.0001
- Complexity: simple

## Cost Limits
- Max cost per operation: $1.00
- Daily budget: $10.00
```

### Advanced Configuration

```markdown
# Advanced Agents Configuration

## Allowed Users
- @senior-developer
- @tech-lead
- @architect

## File Patterns
- `src/**/*.{ts,js,tsx,jsx}`
- `test/**/*.{ts,js}`
- `docs/**/*.md`
- `package.json`
- `tsconfig.json`
- `webpack.config.js`

## Models

### deepseek
- Provider: deepseek
- Cost per token: $0.0001
- Max tokens: 8192
- Complexity: simple
- Best for: Bug fixes, formatting, simple refactoring

### claude-sonnet
- Provider: anthropic
- Cost per token: $0.003
- Max tokens: 4096
- Complexity: complex
- Best for: Architecture changes, complex logic

### gpt-4
- Provider: openai
- Cost per token: $0.01
- Max tokens: 4096
- Complexity: complex
- Best for: Complex problems, broad knowledge

## Cost Limits
- Max cost per operation: $2.00
- Daily budget: $50.00

## Settings
- Default model: deepseek
- Auto create PR: true
- Test command: npm test
- Lint command: npm run lint
```

## 🎯 Usage Patterns

### Bug Fixes
```
@agent Fix the memory leak in the WebSocket connection handler
files: src/websocket.ts
```

### Feature Implementation
```
@agent Add user authentication with JWT tokens
files: src/auth/, src/middleware/auth.ts, src/types/user.ts
model: claude-sonnet
```

### Testing
```
@agent Add comprehensive unit tests for the UserService
files: src/services/user.ts, test/services/user.test.ts
priority: high
```

### Refactoring
```
@agent model: claude-sonnet
Refactor the payment processing to use dependency injection
files: src/payment/
```

### Documentation
```
@agent Update API documentation with new endpoints
files: docs/api.md, src/routes/api.ts
```

## 🔒 Security Examples

### Repository-specific User Access
```markdown
## Allowed Users
- @john-doe
- @jane-smith
- @security-team
```

### Team-based Access
```markdown
## Allowed Users
- @org/backend-team
- @org/frontend-team
- @org/devops-team
```

### File Access Restrictions
```markdown
## File Patterns
# Allow only source files, exclude sensitive configs
- `src/**/*.{ts,js}`
- `test/**/*.{ts,js}`
- `docs/**/*.md`

# Explicitly exclude sensitive files
- `!src/config/secrets.ts`
- `!.env*`
- `!*.key`
```

## 📊 Cost Management Examples

### Development Environment (Low Budget)
```markdown
## Cost Limits
- Max cost per operation: $0.50
- Daily budget: $5.00

## Settings
- Default model: deepseek  # Most cost-effective
```

### Production Environment (Higher Budget)
```markdown
## Cost Limits
- Max cost per operation: $5.00
- Daily budget: $100.00

## Settings
- Default model: claude-sonnet  # Better quality
```

### Per-User Cost Tracking
```markdown
## Cost Limits
- Max cost per operation: $2.00
- Daily budget per user: $20.00
- Monthly budget per user: $500.00
```

## 🚀 CI/CD Integration

### With Existing Test Suite
```yaml
- name: Run Tests Before AI Changes
  run: npm test

- name: Run AI Assistant
  uses: your-org/aider-resolver@v1
  # ... configuration

- name: Run Tests After AI Changes
  run: npm test
```

### With Code Quality Checks
```yaml
- name: Run AI Assistant
  uses: your-org/aider-resolver@v1
  # ... configuration

- name: Quality Gate
  run: |
    npm run lint
    npm run type-check
    npm run test:coverage
```

### Multi-Environment Setup
```yaml
strategy:
  matrix:
    environment: [development, staging, production]

steps:
  - name: Run AI Assistant
    uses: your-org/aider-resolver@v1
    with:
      config_file: '.github/agents-${{ matrix.environment }}.md'
```

## 📱 Project-Specific Examples

See individual directories for complete project setups:
- `typescript-project/` - Complete TypeScript project with testing
- `python-project/` - Python project with pytest and black
- `react-app/` - React application with component testing
- `minimal-setup/` - Bare minimum configuration
- `enterprise-setup/` - Enterprise-grade with all features
