import type {
  GuardrailBlocked,
  PersonalAssistantResult,
  PersonalOrchestratorOutput,
} from '@project-manager/shared';
import { personalAssistantOrchestrator } from '../assistant/personal-orchestrator.js';

export type PersonalAssistantResolveResult = PersonalAssistantResult | GuardrailBlocked;

/** 薄封装：委托五层 orchestrator（F0 契约） */
export async function resolvePersonalAssistantIntent(
  message: string,
  options?: { modifyTodoId?: number; sessionId?: number },
): Promise<PersonalAssistantResolveResult> {
  return personalAssistantOrchestrator.handle({
    message,
    modifyTodoId: options?.modifyTodoId,
    sessionId: options?.sessionId,
  }) as Promise<PersonalOrchestratorOutput>;
}

export function isGuardrailBlocked(
  result: PersonalAssistantResolveResult,
): result is GuardrailBlocked {
  return 'blocked' in result && result.blocked === true;
}
