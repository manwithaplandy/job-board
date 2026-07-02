// Shared output-language policy appended to every rolefit LLM agent's system
// prompt (résumé, cover letter, application prefill). Mirror of the Python
// source of truth ENGLISH_ONLY_INSTRUCTION in reviewer/schemas.py — keep in sync.
export const ENGLISH_ONLY_INSTRUCTION =
  "Write all of your output in English. Even when the input — a company name, " +
  "job posting, résumé, or saved answer — is in another language, express your " +
  "generated text in English, translating the relevant facts rather than copying " +
  "the non-English wording. The sole exception: values these instructions tell " +
  "you to reproduce verbatim (e.g., an employer's name or a multiple-choice " +
  "option) must be kept exactly as given.";
