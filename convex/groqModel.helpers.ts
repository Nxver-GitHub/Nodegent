/**
 * Fallback Groq model when the GROQ_MODEL env var is unset.
 *
 * Groq retires models without notice (llama-4-scout and llama-3.3-70b were
 * both pulled), so keep this to one place. Must support tool calling (chat's
 * browse_web/MCP tools) and strict JSON output (office-hours extraction).
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
