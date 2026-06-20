import { extractSTEMAnswer } from '../../services/aiRouter.service';

describe('AI Router — STEM CoT Extractor', () => {
  test('strips <think> block and returns clean answer', () => {
    const raw = `<think>Let me calculate step by step: 2+2=4, then multiply by 3...</think>\n\nThe answer is **12**.`;
    const { reasoning, answer } = extractSTEMAnswer(raw);
    expect(reasoning).toContain('Let me calculate');
    expect(answer).toContain('The answer is **12**');
    expect(answer).not.toContain('<think>');
  });

  test('handles missing <think> block gracefully', () => {
    const raw = 'The integral of x^2 is x^3/3 + C.';
    const { reasoning, answer } = extractSTEMAnswer(raw);
    expect(reasoning).toBe('');
    expect(answer).toBe(raw);
  });

  test('handles multiple <think> blocks', () => {
    const raw = '<think>First thought</think>Middle text<think>Second thought</think>Final answer.';
    const { answer } = extractSTEMAnswer(raw);
    expect(answer).not.toContain('<think>');
    expect(answer).toContain('Final answer');
  });

  test('handles empty content', () => {
    const { reasoning, answer } = extractSTEMAnswer('');
    expect(reasoning).toBe('');
    expect(answer).toBe('');
  });
});
