import { AssistantResponse } from './types';

export function runQualityGuard(response: AssistantResponse, history: { role: string; content: string }[]): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (response.message.length > 800) {
    reasons.push('Response is too long (> 800 chars)');
  }

  const roboticPatterns = [
    /berikut beberapa/i,
    /sebagai ai/i,
    /saya adalah model bahasa/i,
    /menurut informasi yang saya miliki/i
  ];
  for (const pattern of roboticPatterns) {
    if (pattern.test(response.message)) {
      reasons.push(`Contains robotic pattern: ${pattern}`);
    }
  }

  if (response.message.includes('?')) {
    const questions = response.message.match(/[^.?!]+\?/g) || [];
    const lastQuestion = questions.length > 0 ? questions[questions.length - 1].trim().toLowerCase() : '';
    
    if (lastQuestion) {
      const assistantMessages = history.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
      for (const oldMsg of assistantMessages) {
        if (oldMsg.includes(lastQuestion)) {
          reasons.push('Repeated a question that was already asked');
          break;
        }
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
