/**
 * Data Normalization Service - Clean and standardize incoming data
 */

import NodeCache from "node-cache";

import { logger } from "../logger";
import { CACHE_CONFIG, PROMPT_TEMPLATES, SERVICE_REGISTRY } from "./config";
import { LLMService } from "./llm-service";
import { AIServiceProvider, ChatMessage, NormalizationRequest, NormalizedData } from "./types";

export class NormalizationService {
  private llmService: LLMService;
  private cache: NodeCache;

  constructor() {
    this.llmService = new LLMService();
    this.cache = new NodeCache({
      stdTTL: CACHE_CONFIG.normalization.ttl,
      maxKeys: CACHE_CONFIG.normalization.maxSize,
      useClones: false,
    });
  }

  /**
   * Normalize company data
   */
  async normalizeCompanyData(
    rawData: Record<string, unknown>,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      strictMode?: boolean;
    },
  ): Promise<NormalizedData> {
    const provider = options?.provider || SERVICE_REGISTRY.normalization;
    const useCache = options?.useCache !== false;
    const strictMode = options?.strictMode || false;

    const cacheKey = this.getCacheKey(rawData, provider);

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<NormalizedData>(cacheKey);
      if (cached) {
        logger.debug("Normalization cache hit", { provider });
        return cached;
      }
    }

    try {
      const normalized = await this.performCompanyNormalization(rawData, provider, strictMode);

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, normalized);
      }

      logger.info("Company data normalized", {
        provider,
        fieldsNormalized: Object.keys(normalized.normalized).length,
        confidence: normalized.confidence,
        issues: normalized.issues?.length || 0,
        cached: false,
      });

      return normalized;
    } catch (error) {
      logger.error("Company normalization error", {
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Normalize contact data
   */
  async normalizeContactData(
    contacts: Array<Record<string, unknown>>,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      deduplication?: boolean;
    },
  ): Promise<{
    normalized: Array<Record<string, unknown>>;
    duplicates: Array<{ indices: number[]; confidence: number }>;
    issues: Array<{
      index: number;
      field: string;
      issue: string;
      severity: "low" | "medium" | "high";
    }>;
  }> {
    const provider = options?.provider || SERVICE_REGISTRY.normalization;
    const deduplication = options?.deduplication !== false;

    const normalized: Array<Record<string, unknown>> = [];
    const allIssues: Array<{
      index: number;
      field: string;
      issue: string;
      severity: "low" | "medium" | "high";
    }> = [];

    // Normalize each contact
    for (let i = 0; i < contacts.length; i++) {
      try {
        const result = await this.normalizeContact(contacts[i], provider);
        normalized.push(result.normalized);

        if (result.issues) {
          allIssues.push(...result.issues.map((issue) => ({ ...issue, index: i })));
        }
      } catch (error) {
        logger.warn("Failed to normalize contact", {
          index: i,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        normalized.push(contacts[i]); // Keep original if normalization fails
      }
    }

    // Find duplicates if requested
    const duplicates = deduplication ? await this.findDuplicateContacts(normalized, provider) : [];

    return {
      normalized,
      duplicates,
      issues: allIssues,
    };
  }

  /**
   * Normalize technology data
   */
  async normalizeTechnologyData(
    technologies: Array<{ name: string; category?: string; confidence?: number }>,
    options?: {
      provider?: AIServiceProvider;
      standardizeNames?: boolean;
      categorize?: boolean;
    },
  ): Promise<{
    normalized: Array<{
      name: string;
      standardName: string;
      category: string;
      confidence: number;
      metadata?: Record<string, unknown>;
    }>;
    suggestions: Array<{
      original: string;
      suggested: string;
      reason: string;
    }>;
  }> {
    const provider = options?.provider || SERVICE_REGISTRY.normalization;
    const standardizeNames = options?.standardizeNames !== false;
    const categorize = options?.categorize !== false;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${PROMPT_TEMPLATES.normalization.system}

You are normalizing technology data. Your tasks:
1. Standardize technology names to official/canonical forms
2. Categorize technologies appropriately
3. Provide confidence scores
4. Identify potential issues or suggestions

Technology categories include: frontend, backend, database, cloud, analytics, security, devops, mobile, ai-ml, etc.`,
      },
      {
        role: "user",
        content: `Normalize the following technologies:

${technologies
  .map(
    (tech, i) =>
      `${i + 1}. ${tech.name}${tech.category ? ` (currently: ${tech.category})` : ""}${tech.confidence ? ` (confidence: ${tech.confidence})` : ""}`,
  )
  .join("\n")}

Requirements:
- Standardize names: ${standardizeNames}
- Categorize: ${categorize}

Return a JSON response with:
{
  "normalized": [
    {
      "name": "original_name",
      "standardName": "canonical_name", 
      "category": "category",
      "confidence": 0.95,
      "metadata": {}
    }
  ],
  "suggestions": [
    {
      "original": "original_name",
      "suggested": "better_name",
      "reason": "explanation"
    }
  ]
}`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.2, // Low temperature for consistent normalization
      maxTokens: 2000,
    });

    try {
      const parsed = this.extractJSON(response.content);
      return this.validateTechnologyNormalization(parsed, technologies);
    } catch (error) {
      logger.warn("Failed to parse technology normalization response", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Return fallback normalization
      return this.fallbackTechnologyNormalization(technologies);
    }
  }

  /**
   * Normalize custom data with schema
   */
  async normalizeWithSchema(
    request: NormalizationRequest,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
    },
  ): Promise<NormalizedData> {
    const provider = options?.provider || SERVICE_REGISTRY.normalization;
    const useCache = options?.useCache !== false;

    const cacheKey = this.getCacheKey(request.data, provider);

    if (useCache) {
      const cached = this.cache.get<NormalizedData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: PROMPT_TEMPLATES.normalization.system,
      },
      {
        role: "user",
        content: `Normalize the following data according to the schema and rules:

**Data to normalize:**
${JSON.stringify(request.data, null, 2)}

**Target schema:**
${JSON.stringify(request.schema, null, 2)}

**Normalization rules:**
${request.rules?.map((rule) => `- ${rule.field}: ${rule.rule}`).join("\n") || "No specific rules"}

Return normalized data with confidence scores and any issues identified.`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.1,
      maxTokens: 2000,
    });

    const result = this.parseNormalizationResponse(response.content, request.data);

    if (useCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Perform company data normalization
   */
  private async performCompanyNormalization(
    rawData: Record<string, unknown>,
    provider: AIServiceProvider,
    strictMode: boolean,
  ): Promise<NormalizedData> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${PROMPT_TEMPLATES.normalization.system}

You are normalizing company data. Focus on:
- Company names (official vs common names)
- Industry standardization
- Size categories (startup, small, medium, large, enterprise)
- Location formatting
- Website URLs
- Contact information
- Technology data

${strictMode ? "Use strict validation - flag any questionable data." : "Be flexible with minor inconsistencies."}`,
      },
      {
        role: "user",
        content: `Normalize this company data:

${JSON.stringify(rawData, null, 2)}

Expected output format:
{
  "normalized": {
    "name": "standardized_company_name",
    "domain": "company.com",
    "industry": "standardized_industry",
    "size": "small|medium|large|enterprise",
    "location": "City, State/Country",
    "website": "https://company.com",
    "description": "cleaned_description",
    "employees": number_or_range,
    "founded": year_or_null
  },
  "confidence": 0.95,
  "issues": [
    {
      "field": "field_name",
      "issue": "description",
      "severity": "low|medium|high",
      "suggestion": "how_to_fix"
    }
  ]
}`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.2,
      maxTokens: 1500,
    });

    return this.parseNormalizationResponse(response.content, rawData);
  }

  /**
   * Normalize individual contact
   */
  private async normalizeContact(
    contact: Record<string, unknown>,
    provider: AIServiceProvider,
  ): Promise<NormalizedData> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Normalize contact information. Clean and standardize:
- Names (proper case, handle nicknames)
- Email addresses (validate format)
- Job titles (standardize common variations)
- Phone numbers (format consistently)
- LinkedIn URLs (canonical format)`,
      },
      {
        role: "user",
        content: `Normalize this contact:

${JSON.stringify(contact, null, 2)}

Return JSON with normalized data, confidence score, and any issues.`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.1,
      maxTokens: 800,
    });

    return this.parseNormalizationResponse(response.content, contact);
  }

  /**
   * Find duplicate contacts
   */
  private async findDuplicateContacts(
    contacts: Array<Record<string, unknown>>,
    provider: AIServiceProvider,
  ): Promise<Array<{ indices: number[]; confidence: number }>> {
    if (contacts.length < 2) return [];

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "Identify duplicate contacts. Look for same person with variations in name, email, or other details.",
      },
      {
        role: "user",
        content: `Find duplicates in these contacts:

${contacts.map((contact, i) => `${i}: ${JSON.stringify(contact)}`).join("\n")}

Return JSON array of duplicate groups:
[
  {
    "indices": [0, 5, 12],
    "confidence": 0.95
  }
]`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.1,
      maxTokens: 1000,
    });

    try {
      return (
        (this.extractJSON(response.content) as unknown as Array<{
          indices: number[];
          confidence: number;
        }>) || []
      );
    } catch {
      return [];
    }
  }

  /**
   * Parse normalization response
   */
  private parseNormalizationResponse(
    content: string,
    originalData: Record<string, unknown>,
  ): NormalizedData {
    try {
      const parsed = this.extractJSON(content);

      return {
        normalized: parsed.normalized || originalData,
        confidence: Math.min(Math.max((parsed.confidence as number) || 0.5, 0), 1),
        issues:
          (parsed.issues as Array<{
            field: string;
            issue: string;
            severity: "high" | "low" | "medium";
            suggestion?: string;
          }>) || [],
        metadata: {
          originalFields: Object.keys(originalData).length,
          normalizedFields: Object.keys(parsed.normalized || {}).length,
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.warn("Failed to parse normalization response", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Return fallback result
      return {
        normalized: originalData,
        confidence: 0.3,
        issues: [
          {
            field: "parsing",
            issue: "Failed to parse AI response",
            severity: "high",
            suggestion: "Manual review required",
          },
        ],
      };
    }
  }

  /**
   * Validate technology normalization
   */
  private validateTechnologyNormalization(
    parsed: Record<string, unknown>,
    original: Array<{ name: string; category?: string; confidence?: number }>,
  ): {
    normalized: Array<{
      name: string;
      standardName: string;
      category: string;
      confidence: number;
      metadata?: Record<string, unknown>;
    }>;
    suggestions: Array<{
      original: string;
      suggested: string;
      reason: string;
    }>;
  } {
    const normalizedArray = Array.isArray(parsed.normalized) ? parsed.normalized : [];
    const normalized = normalizedArray.map(
      (tech: { name: string; category?: string; confidence?: number; standardName?: string; metadata?: Record<string, unknown> }, index: number) => ({
        name: original[index]?.name || tech.name || "Unknown",
        standardName: tech.standardName || tech.name || original[index]?.name || "Unknown",
        category: tech.category || "other",
        confidence: Math.min(Math.max(tech.confidence || 0.5, 0), 1),
        metadata: tech.metadata || {},
      }),
    );

    const suggestions =
      (parsed.suggestions as Array<{
        original: string;
        suggested: string;
        reason: string;
      }>) || [];

    return { normalized, suggestions };
  }

  /**
   * Fallback technology normalization
   */
  private fallbackTechnologyNormalization(
    technologies: Array<{ name: string; category?: string; confidence?: number }>,
  ): {
    normalized: Array<{
      name: string;
      standardName: string;
      category: string;
      confidence: number;
      metadata?: Record<string, unknown>;
    }>;
    suggestions: Array<{
      original: string;
      suggested: string;
      reason: string;
    }>;
  } {
    const normalized = technologies.map((tech) => ({
      name: tech.name,
      standardName: tech.name,
      category: tech.category || this.guessCategory(tech.name),
      confidence: tech.confidence || 0.5,
      metadata: { fallback: true },
    }));

    return { normalized, suggestions: [] };
  }

  /**
   * Simple category guessing for fallback
   */
  private guessCategory(techName: string): string {
    const name = techName.toLowerCase();

    if (/react|vue|angular|frontend|html|css|javascript/.test(name)) return "frontend";
    if (/node|express|django|rails|backend|api/.test(name)) return "backend";
    if (/mysql|postgres|mongodb|database|sql/.test(name)) return "database";
    if (/aws|azure|gcp|docker|kubernetes|cloud/.test(name)) return "cloud";
    if (/analytics|tableau|powerbi|data/.test(name)) return "analytics";
    if (/security|auth|firewall/.test(name)) return "security";
    if (/mobile|ios|android|swift|kotlin/.test(name)) return "mobile";
    if (/ai|ml|tensorflow|pytorch/.test(name)) return "ai-ml";

    return "other";
  }

  /**
   * Extract JSON from response
   */
  private extractJSON(content: string): Record<string, unknown> {
    // Try to find JSON in code blocks
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try to find JSON in the content
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const jsonStr = content.slice(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr);
    }

    throw new Error("No JSON found in response");
  }

  /**
   * Generate cache key
   */
  private getCacheKey(data: Record<string, unknown>, provider: string): string {
    const content = `${provider}:${JSON.stringify(data)}`;
    return Buffer.from(content).toString("base64").slice(0, 64);
  }

  /**
   * Clear normalization cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter((key) => key.includes(pattern));
      this.cache.del(matchingKeys);
    } else {
      this.cache.flushAll();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(provider: AIServiceProvider = "openai"): Promise<{
    status: "healthy" | "unhealthy";
    details: Record<string, unknown>;
  }> {
    try {
      const startTime = Date.now();

      const testData = { name: "Test Company", industry: "tech" };
      await this.normalizeCompanyData(testData, {
        provider,
        useCache: false,
      });

      const latency = Date.now() - startTime;
      const cacheStats = this.getCacheStats();

      return {
        status: "healthy",
        details: {
          provider,
          latency,
          cache: cacheStats,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          provider,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
