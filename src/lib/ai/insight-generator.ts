/**
 * Insight Generator Service - Generate business insights from account data
 */

import NodeCache from "node-cache";

import { logger } from "../logger";
import { CACHE_CONFIG, PROMPT_TEMPLATES, SERVICE_REGISTRY } from "./config";
import { EmbeddingService } from "./embedding-service";
import { LLMService } from "./llm-service";
import {
  AIServiceProvider,
  ChatMessage,
  GeneratedInsight,
  InsightGenerationRequest,
} from "./types";

export class InsightGenerator {
  private llmService: LLMService;
  private embeddingService: EmbeddingService;
  private cache: NodeCache;

  constructor() {
    this.llmService = new LLMService();
    this.embeddingService = new EmbeddingService();
    this.cache = new NodeCache({
      stdTTL: CACHE_CONFIG.insights.ttl,
      maxKeys: CACHE_CONFIG.insights.maxSize,
      useClones: false,
    });
  }

  /**
   * Generate insights for an account
   */
  async generateInsights(
    request: InsightGenerationRequest,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
      maxInsights?: number;
    },
  ): Promise<GeneratedInsight[]> {
    const provider = options?.provider || SERVICE_REGISTRY.insights;
    const useCache = options?.useCache !== false;
    const maxInsights = options?.maxInsights || 5;

    const cacheKey = this.getCacheKey(request, provider);

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<GeneratedInsight[]>(cacheKey);
      if (cached) {
        logger.debug("Insights cache hit", {
          accountId: request.accountData.id,
          provider,
          insightCount: cached.length,
        });
        return cached;
      }
    }

    try {
      const insights = await this.generateAccountInsights(request, provider, maxInsights);

      // Cache the results
      if (useCache) {
        this.cache.set(cacheKey, insights);
      }

      logger.info("Insights generated", {
        accountId: request.accountData.id,
        accountName: request.accountData.name,
        provider,
        insightCount: insights.length,
        cached: false,
      });

      return insights;
    } catch (error) {
      logger.error("Insight generation error", {
        accountId: request.accountData.id,
        provider,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Generate specific type of insights
   */
  async generateSpecificInsights(
    request: InsightGenerationRequest,
    insightType: "technical" | "business" | "competitive",
    options?: {
      provider?: AIServiceProvider;
      maxInsights?: number;
    },
  ): Promise<GeneratedInsight[]> {
    const provider = options?.provider || SERVICE_REGISTRY.insights;
    const maxInsights = options?.maxInsights || 3;

    const messages = this.buildInsightMessages(request, insightType);

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.3, // Lower temperature for more focused insights
      maxTokens: 2000,
    });

    return this.parseInsightResponse(response.content, insightType);
  }

  /**
   * Generate insights with similarity analysis
   */
  async generateSimilarAccountInsights(
    request: InsightGenerationRequest,
    similarAccounts: Array<{
      id: string;
      name: string;
      similarity: number;
      insights?: GeneratedInsight[];
    }>,
    options?: {
      provider?: AIServiceProvider;
      useCache?: boolean;
    },
  ): Promise<GeneratedInsight[]> {
    const provider = options?.provider || SERVICE_REGISTRY.insights;

    // Build context with similar accounts
    const similarityContext = similarAccounts
      .slice(0, 3) // Top 3 similar accounts
      .map((acc) => ({
        name: acc.name,
        similarity: Math.round(acc.similarity * 100),
        topInsights: acc.insights?.slice(0, 2).map((i) => i.title) || [],
      }));

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `${PROMPT_TEMPLATES.insights.system}

You also have access to insights from similar companies for context and pattern recognition.`,
      },
      {
        role: "user",
        content: `Analyze ${request.accountData.name} and generate insights. Here's the company data:

**Company Information:**
- Name: ${request.accountData.name}
- Industry: ${request.accountData.industry || "Unknown"}
- Size: ${request.accountData.size || "Unknown"}
- Domain: ${request.accountData.domain || "Unknown"}

**Technology Stack:**
${this.formatTechnologies(request.accountData.technologies || [])}

**Key Contacts:**
${this.formatContacts(request.accountData.contacts || [])}

**Similar Companies (for context):**
${similarityContext
  .map((acc) => `- ${acc.name} (${acc.similarity}% similar): ${acc.topInsights.join(", ")}`)
  .join("\n")}

Generate 3-5 unique insights that are specific to ${request.accountData.name}, considering patterns from similar companies but focusing on this company's unique characteristics.`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.4,
      maxTokens: 2500,
    });

    return this.parseInsightResponse(response.content);
  }

  /**
   * Generate trend-based insights
   */
  async generateTrendInsights(
    requests: InsightGenerationRequest[],
    options?: {
      provider?: AIServiceProvider;
      trendType?: "technology" | "hiring" | "market";
    },
  ): Promise<{
    trends: Array<{
      trend: string;
      confidence: number;
      affectedAccounts: string[];
      recommendation: string;
    }>;
    insights: GeneratedInsight[];
  }> {
    const provider = options?.provider || SERVICE_REGISTRY.insights;
    const trendType = options?.trendType || "technology";

    // Aggregate data across accounts
    const aggregatedData = this.aggregateAccountData(requests, trendType);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a market trend analyst. Analyze data across multiple companies to identify patterns, trends, and market opportunities.`,
      },
      {
        role: "user",
        content: `Analyze the following ${requests.length} companies to identify ${trendType} trends:

${aggregatedData}

Identify:
1. Key trends affecting multiple companies
2. Emerging patterns in the market
3. Opportunities these trends create
4. Specific recommendations for each trend

Focus on actionable insights that can help with sales strategy.`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.5,
      maxTokens: 3000,
    });

    return this.parseTrendResponse(response.content, requests);
  }

  /**
   * Generate real-time insights based on recent changes
   */
  async generateRealtimeInsights(
    accountId: string,
    recentChanges: Array<{
      type: "technology" | "contact" | "funding" | "news";
      description: string;
      timestamp: Date;
      source: string;
    }>,
    options?: {
      provider?: AIServiceProvider;
    },
  ): Promise<GeneratedInsight[]> {
    const provider = options?.provider || SERVICE_REGISTRY.insights;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are a real-time business intelligence analyst. Generate actionable insights based on recent changes and events at companies.`,
      },
      {
        role: "user",
        content: `Account ${accountId} has had the following recent changes:

${recentChanges
  .map(
    (change) =>
      `- ${change.type.toUpperCase()}: ${change.description} (${change.source}, ${change.timestamp.toLocaleDateString()})`,
  )
  .join("\n")}

Generate 2-3 time-sensitive insights that:
1. Explain what these changes might indicate
2. Identify immediate opportunities
3. Suggest specific actions to take soon

Focus on insights that require quick action or indicate timing opportunities.`,
      },
    ];

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.6,
      maxTokens: 1500,
    });

    const insights = this.parseInsightResponse(response.content);

    // Mark as time-sensitive
    return insights.map((insight) => ({
      ...insight,
      metadata: {
        ...insight.metadata,
        timeSensitive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    }));
  }

  /**
   * Generate main account insights
   */
  private async generateAccountInsights(
    request: InsightGenerationRequest,
    provider: AIServiceProvider,
    maxInsights: number,
  ): Promise<GeneratedInsight[]> {
    const messages = this.buildInsightMessages(request);

    const response = await this.llmService.generateCompletion(messages, provider, {
      temperature: 0.4,
      maxTokens: 3000,
    });

    return this.parseInsightResponse(response.content).slice(0, maxInsights);
  }

  /**
   * Build messages for insight generation
   */
  private buildInsightMessages(
    request: InsightGenerationRequest,
    focusType?: "technical" | "business" | "competitive",
  ): ChatMessage[] {
    const systemPrompt = focusType
      ? `${PROMPT_TEMPLATES.insights.system}\n\n${PROMPT_TEMPLATES.insights.analysis(focusType)}`
      : PROMPT_TEMPLATES.insights.system;

    const analysisType = request.context?.analysisType || "all";
    const focusAreas = request.context?.focusAreas?.join(", ") || "general business opportunities";

    return [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Analyze the following company and generate ${focusType || "comprehensive"} insights:

**Company:** ${request.accountData.name}
**Industry:** ${request.accountData.industry || "Unknown"}
**Size:** ${request.accountData.size || "Unknown"}
**Domain:** ${request.accountData.domain || "Unknown"}
**Analysis Focus:** ${focusAreas}

**Technology Stack:**
${this.formatTechnologies(request.accountData.technologies || [])}

**Key Contacts:**
${this.formatContacts(request.accountData.contacts || [])}

**Analysis Type:** ${analysisType}

Generate actionable insights with confidence scores, evidence, and specific recommended actions. Focus on opportunities that align with our solutions and sales strategy.`,
      },
    ];
  }

  /**
   * Format technologies for prompt
   */
  private formatTechnologies(
    technologies: Array<{
      name: string;
      category: string;
      confidence: number;
    }>,
  ): string {
    if (technologies.length === 0) {
      return "- No technology data available";
    }

    const categories = technologies.reduce(
      (acc, tech) => {
        if (!acc[tech.category]) {
          acc[tech.category] = [];
        }
        acc[tech.category].push(`${tech.name} (${Math.round(tech.confidence * 100)}% confidence)`);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    return Object.entries(categories)
      .map(([category, techs]) => `- **${category}**: ${techs.join(", ")}`)
      .join("\n");
  }

  /**
   * Format contacts for prompt
   */
  private formatContacts(
    contacts: Array<{
      name: string;
      title?: string;
      department?: string;
    }>,
  ): string {
    if (contacts.length === 0) {
      return "- No contact data available";
    }

    return contacts
      .map(
        (contact) =>
          `- ${contact.name}${contact.title ? ` - ${contact.title}` : ""}${contact.department ? ` (${contact.department})` : ""}`,
      )
      .join("\n");
  }

  /**
   * Parse insight response from LLM
   */
  private parseInsightResponse(
    content: string,
    defaultCategory: "technical" | "business" | "competitive" = "business",
  ): GeneratedInsight[] {
    const insights: GeneratedInsight[] = [];

    // Try to parse structured JSON first
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          return parsed.map((insight) => this.validateInsight(insight));
        }
      }
    } catch (error) {
      // Continue with text parsing
    }

    // Parse text-based insights
    const sections = content.split(/(?:^|\n)(?:\d+\.|\*|\-)\s+/).filter((s) => s.trim());

    for (const section of sections) {
      try {
        const insight = this.parseTextInsight(section.trim(), defaultCategory);
        if (insight) {
          insights.push(insight);
        }
      } catch (error) {
        logger.warn("Failed to parse insight section", { section: section.slice(0, 100) });
      }
    }

    return insights;
  }

  /**
   * Parse text-based insight
   */
  private parseTextInsight(
    text: string,
    defaultCategory: "technical" | "business" | "competitive",
  ): GeneratedInsight | null {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) return null;

    const title = lines[0].replace(/^\*\*(.+)\*\*$/, "$1").trim();
    if (!title) return null;

    const description = lines.slice(1).join(" ").trim();
    if (!description) return null;

    // Extract confidence if mentioned
    const confidenceMatch = description.match(/confidence[:\s]+(\d+)%/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.75;

    // Extract category if mentioned
    let category = defaultCategory;
    if (/technical|technology|tech|engineering/i.test(description)) {
      category = "technical";
    } else if (/competitive|competitor|market/i.test(description)) {
      category = "competitive";
    }

    // Extract tags
    const tags = this.extractTags(description);

    // Extract suggested actions
    const actionMatch = description.match(/(?:action|recommend|suggest)[^:]*:(.+?)(?:\.|$)/i);
    const suggestedActions = actionMatch ? [actionMatch[1].trim()] : [];

    return {
      type: `${category}_opportunity`,
      title,
      description,
      confidence,
      category,
      tags,
      suggestedActions,
      metadata: {
        generatedAt: new Date().toISOString(),
        source: "ai_generated",
      },
    };
  }

  /**
   * Extract tags from description
   */
  private extractTags(description: string): string[] {
    const tags: string[] = [];

    // Technology tags
    if (/cloud|aws|azure|gcp/i.test(description)) tags.push("cloud");
    if (/ai|machine learning|ml/i.test(description)) tags.push("ai");
    if (/security|compliance/i.test(description)) tags.push("security");
    if (/modernization|legacy/i.test(description)) tags.push("modernization");
    if (/scale|scaling|growth/i.test(description)) tags.push("scaling");
    if (/automation|workflow/i.test(description)) tags.push("automation");

    // Business tags
    if (/cost|budget|roi/i.test(description)) tags.push("cost-optimization");
    if (/efficiency|productivity/i.test(description)) tags.push("efficiency");
    if (/hiring|talent|recruitment/i.test(description)) tags.push("hiring");
    if (/funding|investment/i.test(description)) tags.push("funding");

    return tags;
  }

  /**
   * Validate and normalize insight object
   */
  private validateInsight(insight: any): GeneratedInsight {
    return {
      type: insight.type || "business_opportunity",
      title: insight.title || "Untitled Insight",
      description: insight.description || "",
      confidence: Math.min(Math.max(insight.confidence || 0.5, 0), 1),
      category: insight.category || "business",
      tags: Array.isArray(insight.tags) ? insight.tags : [],
      suggestedActions: Array.isArray(insight.suggestedActions) ? insight.suggestedActions : [],
      metadata: {
        ...insight.metadata,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Aggregate account data for trend analysis
   */
  private aggregateAccountData(requests: InsightGenerationRequest[], trendType: string): string {
    const summary = requests
      .map((req, index) => {
        const account = req.accountData;

        switch (trendType) {
          case "technology":
            return `${index + 1}. ${account.name} (${account.industry}): ${
              account.technologies?.map((t) => t.name).join(", ") || "No tech data"
            }`;

          case "hiring":
            return `${index + 1}. ${account.name}: ${
              account.contacts?.length || 0
            } contacts, key roles: ${
              account.contacts
                ?.map((c) => c.title)
                .filter(Boolean)
                .join(", ") || "Unknown"
            }`;

          default:
            return `${index + 1}. ${account.name} - ${account.industry} (${account.size})`;
        }
      })
      .join("\n");

    return summary;
  }

  /**
   * Parse trend analysis response
   */
  private parseTrendResponse(
    content: string,
    requests: InsightGenerationRequest[],
  ): {
    trends: Array<{
      trend: string;
      confidence: number;
      affectedAccounts: string[];
      recommendation: string;
    }>;
    insights: GeneratedInsight[];
  } {
    // Simplified parsing - in production, this would be more sophisticated
    const insights = this.parseInsightResponse(content);

    const trends = [
      {
        trend: "Sample trend analysis",
        confidence: 0.8,
        affectedAccounts: requests.map((r) => r.accountData.name),
        recommendation: "Focus on emerging technology adoption patterns",
      },
    ];

    return { trends, insights };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: InsightGenerationRequest, provider: string): string {
    const key = `${provider}:${request.accountData.id}:${request.context?.analysisType || "all"}:${
      request.context?.focusAreas?.join(",") || "general"
    }`;
    return Buffer.from(key).toString("base64").slice(0, 64);
  }

  /**
   * Clear insights cache
   */
  clearCache(accountId?: string): void {
    if (accountId) {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter((key) => key.includes(accountId));
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
}
