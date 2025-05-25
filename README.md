# 🤖 Aider GitHub Resolver

A production-ready GitHub Action that integrates [Aider's](https://aider.chat/) AI coding capabilities with GitHub workflows. Respond to `@agent` mentions in issues and PRs to execute AI-powered code changes with real-time progress updates.

## ✨ Features

- **Multi-LLM Support**: DeepSeek (cost-effective), Claude Sonnet (complex tasks), GPT-4 (specialized knowledge)
- **Real-time Progress**: Live updates in GitHub comments with progress checkboxes
- **Automatic PRs**: Creates pull requests with AI-generated changes
- **Cost Optimization**: Intelligent model routing based on task complexity
- **Security**: Input validation, user permissions, and audit trails
- **Error Recovery**: Graceful handling of failures with detailed error reporting

## 🚀 Quick Start

### 1. Setup Repository Secrets

Add the following secrets to your repository:
- `GITHUB_TOKEN` (automatically available)
- At least one AI provider API key:
  - `OPENAI_API_KEY` for GPT models
  - `ANTHROPIC_API_KEY` for Claude models  
  - `DEEPSEEK_API_KEY` for cost-effective operations

### 2. Add Workflow File

Create `.github/workflows/aider-assistant.yml`:

```yaml
name: 'Aider AI Assistant'

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: your-org/aider-resolver@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          deepseek_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

### 3. Usage

Simply mention `@agent` in any issue or PR comment:

```
@agent Fix the TypeScript compilation errors in src/auth.ts
```

```
@agent Add unit tests for the UserService class
files: src/services/user.ts, test/services/user.test.ts
```

```
@agent model: claude-sonnet
Refactor the database layer to use connection pooling
```

## 📖 Configuration

### Repository Configuration

Create `.github/agents.md` to customize behavior:

```markdown
# Agents Configuration

## Allowed Users
- @repository-owner
- @senior-developer

## Models
### deepseek
- Provider: deepseek
- Cost per token: $0.0001
- Complexity: simple

### claude-sonnet  
- Provider: anthropic
- Cost per token: $0.003
- Complexity: complex

## Cost Limits
- Max cost per operation: $1.00
- Daily budget: $10.00
```

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github_token` | GitHub token for API access | Required |
| `openai_api_key` | OpenAI API key | Optional |
| `anthropic_api_key` | Anthropic API key | Optional |
| `deepseek_api_key` | DeepSeek API key | Optional |
| `default_model` | Default AI model to use | `deepseek` |
| `cost_budget_daily` | Daily cost budget in USD | `10` |
| `enable_auto_pr` | Auto-create pull requests | `true` |
| `allowed_users` | Comma-separated list of allowed users | All collaborators |

## 🎯 Usage Examples

### Basic Code Fix
```
@agent Fix the memory leak in the WebSocket connection handler
```

### Feature Implementation  
```
@agent Add pagination support to the user API
files: src/api/users.ts, src/types/api.ts
model: claude-sonnet
```

### Testing
```
@agent Add comprehensive unit tests for the validation utilities
files: src/utils/validation.ts, test/utils/validation.test.ts
```

### Documentation
```
@agent Update the README with Docker setup instructions
files: README.md, docker-compose.yml
```

### Complex Refactoring
```
@agent priority: high
model: claude-sonnet
Refactor the payment processing to use the strategy pattern for better maintainability
files: src/payment/**/*.ts
```

## 🔄 How It Works

1. **Trigger Detection**: Monitors for `@agent` mentions in issues/PRs
2. **Permission Check**: Validates user authorization
3. **Context Analysis**: Extracts instruction, files, and model preferences
4. **Model Selection**: Chooses optimal AI model based on task complexity
5. **Aider Execution**: Runs Aider with streaming progress updates
6. **Git Operations**: Creates commits with descriptive messages
7. **PR Creation**: Automatically creates pull request with changes
8. **Progress Reporting**: Updates GitHub comments with real-time status

## 🛡️ Security

- **Input Sanitization**: All user inputs are validated and sanitized
- **Permission Control**: User-based access control with configurable allow lists
- **API Key Security**: Secure handling of multiple LLM provider keys
- **Audit Trail**: Complete logging of all operations and costs
- **Sandboxing**: Isolated execution environment for code changes

## 💰 Cost Optimization

The resolver automatically selects the most cost-effective model for each task:

- **DeepSeek** ($0.0001/token): Simple fixes, formatting, basic refactoring
- **Claude Sonnet** ($0.003/token): Complex logic, architecture changes
- **GPT-4** ($0.01/token): Specialized knowledge, complex problem-solving

Daily and per-operation cost limits prevent budget overruns.

## 🔧 Development

### Local Development

```bash
git clone https://github.com/your-org/aider-resolver
cd aider-resolver
npm install
npm run build
```

### Testing

```bash
npm test
npm run lint
```

### Docker Build

```bash
docker build -t aider-resolver .
```

## 📚 Examples

See the [`examples/`](./examples/) directory for:
- Complete workflow configurations
- Repository setup examples  
- Advanced usage patterns
- Integration with existing CI/CD

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🆘 Support

- [Documentation](./docs/)
- [GitHub Issues](https://github.com/your-org/aider-resolver/issues)
- [Aider Documentation](https://aider.chat/docs/)

---

**Built with ❤️ using [Aider](https://aider.chat/) and TypeScript**
