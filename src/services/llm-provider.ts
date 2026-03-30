import { z } from 'zod';
import type { FeatureSnapshot, SignalOutput } from '@/types/domain';

const llmJudgmentSchema = z.object({
  confidence_adjustment: z.number().min(-0.25).max(0.25),
  reasons: z.array(z.string()).max(3),
  veto: z.boolean(),
});

export interface LlmProvider {
  evaluateCandidate(input: { features: FeatureSnapshot; candidate: SignalOutput }): Promise<z.infer<typeof llmJudgmentSchema>>;
}

export class DisabledLlmProvider implements LlmProvider {
  async evaluateCandidate() {
    return { confidence_adjustment: 0, reasons: ['llm disabled'], veto: false };
  }
}

export class StubOpenAiLlmProvider implements LlmProvider {
  async evaluateCandidate() {
    return { confidence_adjustment: 0, reasons: ['stubbed llm evaluation'], veto: false };
  }
}

export { llmJudgmentSchema };
