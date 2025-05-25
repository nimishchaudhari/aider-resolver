import { GitHubContextParser } from '../github-parser';
import { GitHubWebhookPayload, AgentInstruction } from '../types';

describe('GitHubContextParser', () => {
  let parser: GitHubContextParser;

  beforeEach(() => {
    parser = new GitHubContextParser();
  });

  describe('extractTrigger', () => {
    it('should extract basic agent instruction', () => {
      const commentBody = '@agent Fix the TypeScript compilation errors';
      const result = parser.extractTrigger(commentBody);

      expect(result).toEqual({
        trigger: '@agent',
        instruction: 'Fix the TypeScript compilation errors',
        files: undefined,
        model: undefined,
        priority: 'medium'
      });
    });

    it('should extract instruction with files specified', () => {
      const commentBody = `@agent Fix the authentication logic
files: src/auth.ts, src/types.ts`;
      const result = parser.extractTrigger(commentBody);

      expect(result?.files).toEqual(['src/auth.ts', 'src/types.ts']);
    });

    it('should extract instruction with model specified', () => {
      const commentBody = '@agent model: claude-sonnet Refactor the database layer';
      const result = parser.extractTrigger(commentBody);

      expect(result?.model).toBe('claude-sonnet');
    });

    it('should detect high priority requests', () => {
      const commentBody = '@agent URGENT: Fix the critical security vulnerability';
      const result = parser.extractTrigger(commentBody);

      expect(result?.priority).toBe('high');
    });

    it('should detect low priority requests', () => {
      const commentBody = '@agent Simple formatting fix needed';
      const result = parser.extractTrigger(commentBody);

      expect(result?.priority).toBe('low');
    });

    it('should return null for non-agent comments', () => {
      const commentBody = 'This is just a regular comment';
      const result = parser.extractTrigger(commentBody);

      expect(result).toBeNull();
    });
  });

  describe('shouldProcessEvent', () => {
    it('should process issue comments with agent mentions', () => {
      const payload: Partial<GitHubWebhookPayload> = {
        action: 'created',
        comment: {
          id: 1,
          body: '@agent Fix this issue',
          user: { id: 1, login: 'user', type: 'User' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      };

      const result = parser.shouldProcessEvent(payload as GitHubWebhookPayload);
      expect(result).toBe(true);
    });

    it('should not process comments without agent mentions', () => {
      const payload: Partial<GitHubWebhookPayload> = {
        action: 'created',
        comment: {
          id: 1,
          body: 'Regular comment without trigger',
          user: { id: 1, login: 'user', type: 'User' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      };

      const result = parser.shouldProcessEvent(payload as GitHubWebhookPayload);
      expect(result).toBe(false);
    });
  });

  describe('validatePermissions', () => {
    it('should allow all users when no restrictions are set', () => {
      const result = parser.validatePermissions('anyuser', []);
      expect(result).toBe(true);
    });

    it('should allow users in the allowed list', () => {
      const allowedUsers = ['user1', 'user2'];
      const result = parser.validatePermissions('user1', allowedUsers);
      expect(result).toBe(true);
    });

    it('should deny users not in the allowed list', () => {
      const allowedUsers = ['user1', 'user2'];
      const result = parser.validatePermissions('user3', allowedUsers);
      expect(result).toBe(false);
    });
  });
});
