# Agents Configuration

This file configures the Aider GitHub resolver for this repository. The resolver responds to `@agent` mentions in issues and pull requests, executing AI-powered code changes using Aider.

## Quick Start

To use the AI assistant, simply mention `@agent` in an issue or PR comment followed by your instruction:

```
@agent Fix the TypeScript compilation errors in the authentication module
```

```
@agent Add unit tests for the UserService class, focusing on edge cases
```

```
@agent Refactor the database connection logic to use connection pooling
```

## Allowed Users

Configure which GitHub users can trigger the AI assistant:

- @repository-owner
- @senior-developer
- @team-lead

> **Note:** If this section is empty, all repository collaborators can use the assistant.

## File Patterns

Specify which files the AI assistant can modify:

- `src/**/*.ts`
- `src/**/*.js`
- `src/**/*.tsx`
- `src/**/*.jsx`
- `test/**/*.ts`
- `test/**/*.js`
- `**/*.md`
- `package.json`
- `tsconfig.json`

## Models

Configure AI models for different types of tasks:

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
- Best for: Architecture changes, complex logic, code reviews

### gpt-4
- Provider: openai
- Cost per token: $0.01
- Max tokens: 4096
- Complexity: complex
- Best for: Complex problems requiring broad knowledge

## Cost Limits

- Max cost per operation: $1.00
- Daily budget: $10.00

## Settings

- Default model: deepseek
- Auto create PR: true
- Test command: `npm test`
- Lint command: `npm run lint`

## Advanced Usage

### Specify Files
```
@agent files: src/auth.ts,src/types.ts
Update the authentication types to support OAuth2
```

### Choose Model
```
@agent model: claude-sonnet
Redesign the database schema for better performance
```

### Set Priority
```
@agent priority: high
Critical security fix needed for user input validation
```

## Examples

### Bug Fix
```
@agent Fix the memory leak in the WebSocket connection handler
```

### Feature Addition
```
@agent Add pagination support to the user list API endpoint
files: src/api/users.ts, src/types/api.ts
```

### Refactoring
```
@agent model: claude-sonnet
Refactor the payment processing module to use the strategy pattern
files: src/payment/**/*.ts
```

### Testing
```
@agent Add comprehensive unit tests for the validation utils
files: src/utils/validation.ts, test/utils/validation.test.ts
```

### Documentation
```
@agent Update the README with setup instructions for the new Docker configuration
files: README.md, docker-compose.yml
```

## Best Practices

1. **Be Specific**: Provide clear, detailed instructions about what you want changed
2. **Specify Files**: When possible, indicate which files should be modified
3. **Test Instructions**: Include testing requirements in your request
4. **Review Changes**: Always review the generated pull request before merging
5. **Start Small**: Begin with simple changes to understand the AI's capabilities

## Troubleshooting

### Common Issues

**"No valid agent instruction found"**
- Ensure you start with `@agent` (not `@agents`)
- Check that your instruction is clear and specific

**"User not authorized"**
- Verify your username is in the allowed users list
- Contact repository maintainers to request access

**"Operation would exceed cost limits"**
- The requested change exceeds the configured cost limits
- Try breaking down complex requests into smaller parts
- Contact maintainers to adjust cost limits if needed

**"Aider execution failed"**
- Check if the specified files exist and are accessible
- Ensure the instruction is technically feasible
- Review the error message in the detailed output

### Getting Help

1. Check the [Aider documentation](https://aider.chat/docs/)
2. Review the action logs in the GitHub Actions tab
3. Create an issue with the `aider-resolver` label for assistance
4. Contact the repository maintainers

---

*This configuration is powered by [Aider](https://aider.chat/) and GitHub Actions.*
