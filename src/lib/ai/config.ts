/**
 * AI Services Configuration
 */

import { AIServiceConfig, RateLimitConfig, AIServiceRegistry } from './types'

// Service configurations
export const AI_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
  } as AIServiceConfig,

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || '30000'),
  } as AIServiceConfig,

  azure: {
    apiKey: process.env.AZURE_OPENAI_KEY!,
    baseUrl: process.env.AZURE_OPENAI_ENDPOINT!,
    model: process.env.AZURE_OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.AZURE_OPENAI_MAX_TOKENS || '4000'),
    temperature: parseFloat(process.env.AZURE_OPENAI_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.AZURE_OPENAI_TIMEOUT || '30000'),
  } as AIServiceConfig,

  flowise: {
    apiKey: process.env.FLOWISE_API_KEY || '',
    baseUrl: process.env.FLOWISE_BASE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.FLOWISE_TIMEOUT || '30000'),
  } as AIServiceConfig,
}

// Rate limiting configurations
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: {
    requestsPerMinute: parseInt(process.env.CHAT_RATE_LIMIT_MINUTE || '30'),
    requestsPerHour: parseInt(process.env.CHAT_RATE_LIMIT_HOUR || '500'),
    requestsPerDay: parseInt(process.env.CHAT_RATE_LIMIT_DAY || '2000'),
    tokensPerMinute: parseInt(process.env.CHAT_TOKENS_LIMIT_MINUTE || '50000'),
    tokensPerHour: parseInt(process.env.CHAT_TOKENS_LIMIT_HOUR || '500000'),
    tokensPerDay: parseInt(process.env.CHAT_TOKENS_LIMIT_DAY || '2000000'),
  },
  embeddings: {
    requestsPerMinute: parseInt(process.env.EMBEDDINGS_RATE_LIMIT_MINUTE || '100'),
    requestsPerHour: parseInt(process.env.EMBEDDINGS_RATE_LIMIT_HOUR || '2000'),
    requestsPerDay: parseInt(process.env.EMBEDDINGS_RATE_LIMIT_DAY || '10000'),
    tokensPerMinute: parseInt(process.env.EMBEDDINGS_TOKENS_LIMIT_MINUTE || '100000'),
    tokensPerHour: parseInt(process.env.EMBEDDINGS_TOKENS_LIMIT_HOUR || '1000000'),
    tokensPerDay: parseInt(process.env.EMBEDDINGS_TOKENS_LIMIT_DAY || '5000000'),
  },
  normalization: {
    requestsPerMinute: parseInt(process.env.NORMALIZATION_RATE_LIMIT_MINUTE || '50'),
    requestsPerHour: parseInt(process.env.NORMALIZATION_RATE_LIMIT_HOUR || '1000'),
    requestsPerDay: parseInt(process.env.NORMALIZATION_RATE_LIMIT_DAY || '5000'),
  },
  insights: {
    requestsPerMinute: parseInt(process.env.INSIGHTS_RATE_LIMIT_MINUTE || '10'),
    requestsPerHour: parseInt(process.env.INSIGHTS_RATE_LIMIT_HOUR || '200'),
    requestsPerDay: parseInt(process.env.INSIGHTS_RATE_LIMIT_DAY || '1000'),
  },
}

// Service registry - defines which AI provider to use for each service
export const SERVICE_REGISTRY: AIServiceRegistry = {
  chat: (process.env.AI_CHAT_PROVIDER as any) || 'flowise',
  embeddings: (process.env.AI_EMBEDDINGS_PROVIDER as any) || 'openai',
  normalization: (process.env.AI_NORMALIZATION_PROVIDER as any) || 'openai',
  insights: (process.env.AI_INSIGHTS_PROVIDER as any) || 'anthropic',
}

// Model configurations for specific tasks
export const MODEL_CONFIG = {
  chat: {
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-sonnet-20240229',
    azure: 'gpt-4',
  },
  embeddings: {
    openai: 'text-embedding-3-large',
    azure: 'text-embedding-ada-002',
  },
  normalization: {
    openai: 'gpt-3.5-turbo',
    anthropic: 'claude-3-haiku-20240307',
    azure: 'gpt-35-turbo',
  },
  insights: {
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-sonnet-20240229',
    azure: 'gpt-4',
  },
}

// Prompt templates
export const PROMPT_TEMPLATES = {
  chat: {
    system: `You are an AI sales intelligence assistant for C1 Northstar. You help sales professionals analyze accounts, identify opportunities, and provide strategic insights.

Your capabilities include:
- Analyzing company data and technology stacks
- Identifying key decision makers and contacts
- Providing market intelligence and competitive analysis
- Suggesting personalized outreach strategies
- Generating insights about pain points and opportunities

Always provide actionable, specific recommendations with confidence scores when possible.`,
    
    contextual: (accountName: string) => `Context: You're analyzing ${accountName}. Use the available account data to provide specific, actionable insights about this company.`,
  },

  normalization: {
    system: `You are a data normalization expert. Your job is to clean, standardize, and structure incoming data according to predefined schemas and business rules.

Tasks:
- Clean and validate data fields
- Standardize formats (dates, phone numbers, addresses, etc.)
- Resolve duplicates and conflicts
- Map data to standard taxonomies
- Flag data quality issues

Always maintain data integrity and provide confidence scores for your normalization decisions.`,
  },

  insights: {
    system: `You are an AI business analyst specializing in B2B sales intelligence. Generate actionable insights from company data.

Focus on:
- Technology gaps and modernization opportunities
- Hiring patterns indicating growth or transformation
- Competitive positioning and differentiation
- Market timing and budget cycle insights
- Risk factors and business challenges

Provide insights with confidence scores, supporting evidence, and specific recommended actions.`,
    
    analysis: (focusArea: string) => `Focus your analysis on ${focusArea}. Provide 3-5 high-confidence insights with specific evidence and actionable recommendations.`,
  },

  embeddings: {
    prefix: 'Represent this for semantic search: ',
  },
}

// Caching configurations
export const CACHE_CONFIG = {
  embeddings: {
    ttl: parseInt(process.env.EMBEDDINGS_CACHE_TTL || '86400'), // 24 hours
    maxSize: parseInt(process.env.EMBEDDINGS_CACHE_SIZE || '10000'),
  },
  insights: {
    ttl: parseInt(process.env.INSIGHTS_CACHE_TTL || '3600'), // 1 hour
    maxSize: parseInt(process.env.INSIGHTS_CACHE_SIZE || '1000'),
  },
  normalization: {
    ttl: parseInt(process.env.NORMALIZATION_CACHE_TTL || '7200'), // 2 hours
    maxSize: parseInt(process.env.NORMALIZATION_CACHE_SIZE || '5000'),
  },
}

// Cost tracking configurations (USD per 1K tokens)
export const COST_CONFIG = {
  openai: {
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
  },
  anthropic: {
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  },
  azure: {
    'gpt-4': { input: 0.01, output: 0.03 },
    'gpt-35-turbo': { input: 0.0015, output: 0.002 },
  },
}