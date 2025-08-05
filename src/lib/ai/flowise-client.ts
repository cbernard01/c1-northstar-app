/**
 * Flowise API Client for Chat Functionality
 */

import { createParser } from "eventsource-parser";

import { logger } from "../logger";
import { AI_CONFIG, PROMPT_TEMPLATES } from "./config";
import { AIResponse, ChatContext, StreamingOptions } from "./types";

export class FlowiseClient {
  private config = AI_CONFIG.flowise;
  private chatFlowId: string;

  constructor(chatFlowId?: string) {
    this.chatFlowId = chatFlowId || process.env.FLOWISE_CHATFLOW_ID || "default-flow";
  }

  /**
   * Send a message to Flowise chat API
   */
  async sendMessage(
    message: string,
    context: ChatContext,
    options?: {
      streaming?: boolean;
      sessionId?: string;
      overrideConfig?: Record<string, any>;
    },
  ): Promise<AIResponse> {
    try {
      const payload = this.buildChatPayload(message, context, options);

      logger.info("Sending message to Flowise", {
        chatFlowId: this.chatFlowId,
        sessionId: options?.sessionId,
        messageLength: message.length,
      });

      const response = await fetch(`${this.config.baseUrl}/api/v1/prediction/${this.chatFlowId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`Flowise API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: data.text || data.response || data.answer || "",
        usage: data.usage,
        model: "flowise",
        finishReason: data.finishReason,
        metadata: {
          sessionId: data.sessionId,
          chatId: data.chatId,
          followUpPrompts: data.followUpPrompts,
          sources: data.sources,
          ...data.metadata,
        },
      };
    } catch (error) {
      logger.error("Flowise API error", {
        error: error instanceof Error ? error.message : "Unknown error",
        chatFlowId: this.chatFlowId,
      });
      throw error;
    }
  }

  /**
   * Stream a message response from Flowise
   */
  async streamMessage(
    message: string,
    context: ChatContext,
    streamingOptions: StreamingOptions,
    options?: {
      sessionId?: string;
      overrideConfig?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      const payload = this.buildChatPayload(message, context, { ...options, streaming: true });

      logger.info("Starting Flowise streaming", {
        chatFlowId: this.chatFlowId,
        sessionId: options?.sessionId,
      });

      const response = await fetch(`${this.config.baseUrl}/api/v1/prediction/${this.chatFlowId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });

      if (!response.ok) {
        throw new Error(`Flowise streaming error: ${response.status} ${response.statusText}`);
      }

      await this.handleStreamingResponse(response, streamingOptions);
    } catch (error) {
      logger.error("Flowise streaming error", {
        error: error instanceof Error ? error.message : "Unknown error",
        chatFlowId: this.chatFlowId,
      });

      streamingOptions.onError?.(
        error instanceof Error ? error : new Error("Unknown streaming error"),
      );
    }
  }

  /**
   * Handle streaming response from Flowise
   */
  private async handleStreamingResponse(
    response: Response,
    options: StreamingOptions,
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body for streaming");
    }

    const decoder = new TextDecoder();
    let fullResponse = "";

    const parser = createParser((event) => {
      if (event.type === "event") {
        if (event.data === "[DONE]") {
          options.onComplete?.(fullResponse);
          return;
        }

        try {
          const data = JSON.parse(event.data);

          if (data.event === "token") {
            const token = data.data;
            fullResponse += token;
            options.onToken?.(token);
          } else if (data.event === "end") {
            options.onComplete?.(fullResponse);
          } else if (data.event === "error") {
            options.onError?.(new Error(data.data));
          }
        } catch (error) {
          // Ignore JSON parsing errors for non-JSON chunks
        }
      }
    });

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (fullResponse) {
            options.onComplete?.(fullResponse);
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Build chat payload for Flowise API
   */
  private buildChatPayload(
    message: string,
    context: ChatContext,
    options?: {
      streaming?: boolean;
      sessionId?: string;
      overrideConfig?: Record<string, any>;
    },
  ) {
    const systemPrompt = context.accountName
      ? `${PROMPT_TEMPLATES.chat.system}\n\n${PROMPT_TEMPLATES.chat.contextual(context.accountName)}`
      : PROMPT_TEMPLATES.chat.system;

    const chatHistory =
      context.previousMessages?.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) || [];

    return {
      question: message,
      history: chatHistory,
      streaming: options?.streaming || false,
      sessionId: options?.sessionId,
      overrideConfig: {
        systemMessage: systemPrompt,
        temperature: 0.7,
        maxTokens: 4000,
        ...(options?.overrideConfig || {}),
      },
      chatId: context.sessionId,
      uploads: [], // For future file upload support
      ...this.buildContextualData(context),
    };
  }

  /**
   * Build contextual data for enhanced responses
   */
  private buildContextualData(context: ChatContext) {
    const contextualData: Record<string, any> = {
      userId: context.userId,
    };

    if (context.accountId) {
      contextualData.accountId = context.accountId;
    }

    if (context.accountName) {
      contextualData.accountName = context.accountName;
    }

    return { context: contextualData };
  }

  /**
   * Get chat session from Flowise
   */
  async getChatSession(sessionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/chatmessage/${this.chatFlowId}?sessionId=${sessionId}`,
        {
          headers: {
            ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get chat session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Failed to get chat session", {
        error: error instanceof Error ? error.message : "Unknown error",
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Clear chat session
   */
  async clearChatSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/chatmessage/${this.chatFlowId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          sessionId,
          chatType: "EXTERNAL",
          memoryType: "buffer",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to clear chat session: ${response.status}`);
      }

      logger.info("Chat session cleared", { sessionId });
    } catch (error) {
      logger.error("Failed to clear chat session", {
        error: error instanceof Error ? error.message : "Unknown error",
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Health check for Flowise service
   */
  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; details?: any }> {
    try {
      const startTime = Date.now();

      const response = await fetch(`${this.config.baseUrl}/api/v1/chatflows`, {
        headers: {
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          status: "healthy",
          details: {
            latency,
            chatFlowId: this.chatFlowId,
            timestamp: new Date().toISOString(),
          },
        };
      } else {
        return {
          status: "unhealthy",
          details: {
            status: response.status,
            statusText: response.statusText,
            latency,
          },
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}
