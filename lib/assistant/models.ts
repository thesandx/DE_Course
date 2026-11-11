/**
 * The models the AI doubt assistant offers in its dropdown.
 *
 * An allowlist, not a free-text field: the server refuses any other id, so a
 * crafted request cannot pick a model that costs fifty times more. The ids are
 * OpenRouter's, checked against https://openrouter.ai/api/v1/models on
 * 2026-11-10. To offer another model, add a row here; nothing else changes.
 *
 * Pure and free of server imports, so the dropdown in the browser reads it too.
 */

export interface AssistantModel {
  /** The OpenRouter model id, such as `anthropic/claude-haiku-5.5`. */
  id: string;
  /** The name in the dropdown. */
  label: string;
  /** A two- or three-word note on when to pick it. */
  note: string;
}

export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', note: 'fast, cheap' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', note: 'best explanations' },
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', note: 'deepest, slower' },
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna', note: 'fast, cheap' },
  { id: 'openai/gpt-6.1-terra', label: 'GPT-6.1 Terra', note: 'balanced' },
  { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: 'fast' },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', note: 'cheapest' },
  { id: 'qwen/qwen3.8-flash', label: 'Qwen 3.8 Flash', note: 'cheap' },
  { id: 'x-ai/grok-4.7', label: 'Grok 4.7', note: 'balanced' },
];

/** The first choice for a new learner: cheap enough to ask freely, good enough to teach. */
export const DEFAULT_MODEL_ID = 'anthropic/claude-haiku-5.5';

export function isAssistantModel(id: string): boolean {
  return ASSISTANT_MODELS.some((model) => model.id === id);
}

/** Where the browser remembers the learner's model. The doubt helper and the notes formatter share it. */
export const MODEL_STORAGE_KEY = 'loop-ready-assistant-model';
