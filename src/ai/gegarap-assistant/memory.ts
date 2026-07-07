import { ConversationMemory } from './types';

export function buildConversationMemory(history: { role: string; content: string }[]): ConversationMemory {
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content);
  const assistantMessages = history.filter(m => m.role === 'assistant').map(m => m.content);

  const questionHistory = assistantMessages
    .filter(msg => msg.includes('?'))
    .map(msg => {
      const questions = msg.match(/[^.?!]+\?/g) || [];
      return questions.length > 0 ? questions[questions.length - 1].trim() : '';
    })
    .filter(q => q.length > 0);

  return {
    issueSummary: userMessages.length > 0 ? userMessages[0] : '',
    answeredQuestions: userMessages.slice(1),
    category: null,
    risk: 'unknown',
    causes: [],
    questionHistory
  };
}

export function formatMemoryForPrompt(memory: ConversationMemory): string {
  const sections: string[] = [];

  if (memory.issueSummary) {
    sections.push(`RINGKASAN MASALAH AWAL:\n${memory.issueSummary}`);
  }

  if (memory.answeredQuestions.length > 0) {
    sections.push(`JAWABAN PENGGUNA YANG SUDAH ADA:\n${memory.answeredQuestions.map(answer => `- ${answer}`).join('\n')}`);
  }

  if (memory.questionHistory.length > 0) {
    sections.push(`PERTANYAAN YANG SUDAH ANDA TANYAKAN (JANGAN DIULANG):
${memory.questionHistory.map(q => `- ${q}`).join('\n')}
`);
  }

  return sections.join('\n\n');
}
