import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MARKET_DATA_PROVIDER: z.enum(['mock', 'alpha_vantage']).default('mock'),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  ENABLE_LLM: z.enum(['true', 'false']).default('false').optional(),
  LLM_PROVIDER: z.enum(['none', 'openai']).default('none').optional(),
  LLM_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
