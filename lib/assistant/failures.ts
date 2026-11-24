/**
 * What the learner sees when the model cannot answer, by reason. Shared by
 * the doubt helper's route and the notes formatter's route.
 */

export type ModelFailure =
  'not_configured' | 'model_blocked' | 'out_of_credits' | 'busy' | 'upstream';

export const MODEL_FAILURES: Readonly<Record<ModelFailure, { status: number; message: string }>> = {
  not_configured: {
    status: 503,
    message: 'The assistant is not set up yet. The OpenRouter key is missing or was refused.',
  },
  // OpenRouter answers 403 when the key works but this one model is blocked
  // for the account, for example "Model ... is banned". Other models still work.
  model_blocked: {
    status: 503,
    message: 'This model is not available on the OpenRouter account right now. Pick another model.',
  },
  out_of_credits: {
    status: 402,
    message: 'The OpenRouter account is out of credit. Add credit, then ask again.',
  },
  busy: { status: 429, message: 'That model is busy right now. Try again, or pick another model.' },
  upstream: {
    status: 502,
    message: 'The model could not answer just now. Try again, or pick another model.',
  },
};
