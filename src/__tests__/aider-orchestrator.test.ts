import { AiderOrchestrator } from '../aider-orchestrator';
import { ModelConfig, TaskComplexity } from '../types';

describe('AiderOrchestrator', () => {
  let orchestrator: AiderOrchestrator;
  let mockModelConfigs: Record<string, ModelConfig>;

  beforeEach(() => {
    mockModelConfigs = {
      'deepseek': {
        name: 'deepseek',
        provider: 'deepseek',
        apiKey: 'test-key',
        costPerToken: 0.0001,
        maxTokens: 8192,
        complexity: 'simple'
      },
      'claude-sonnet': {
        name: 'claude-sonnet',
        provider: 'anthropic',
        apiKey: 'test-key',
        costPerToken: 0.003,
        maxTokens: 4096,
        complexity: 'complex'
      }
    };

    orchestrator = new AiderOrchestrator(mockModelConfigs);
  });

  describe('selectOptimalModel', () => {
    it('should select deepseek for simple tasks', () => {
      const model = orchestrator.selectOptimalModel('simple');
      expect(model.name).toBe('deepseek');
    });

    it('should select claude-sonnet for complex tasks', () => {
      const model = orchestrator.selectOptimalModel('complex');
      expect(model.name).toBe('claude-sonnet');
    });

    it('should fallback to available model if preferred not found', () => {
      const limitedConfigs = {
        'deepseek': mockModelConfigs['deepseek']
      };
      
      const limitedOrchestrator = new AiderOrchestrator(limitedConfigs);
      const model = limitedOrchestrator.selectOptimalModel('complex');
      expect(model.name).toBe('deepseek');
    });

    it('should throw error if no models are configured', () => {
      const emptyOrchestrator = new AiderOrchestrator({});
      expect(() => emptyOrchestrator.selectOptimalModel('simple'))
        .toThrow('No AI models configured');
    });
  });

  describe('analyzeTaskComplexity', () => {
    it('should detect complex tasks', () => {
      const instruction = 'Refactor the entire architecture to use microservices';
      const complexity = (orchestrator as any).analyzeTaskComplexity(instruction);
      expect(complexity).toBe('complex');
    });

    it('should detect simple tasks', () => {
      const instruction = 'Fix typo in comment';
      const complexity = (orchestrator as any).analyzeTaskComplexity(instruction);
      expect(complexity).toBe('simple');
    });

    it('should default to medium for unclear tasks', () => {
      const instruction = 'Update the user service';
      const complexity = (orchestrator as any).analyzeTaskComplexity(instruction);
      expect(complexity).toBe('medium');
    });
  });
});
