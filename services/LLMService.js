import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { logger } from '../config/winstonLogger.js';

const DEFAULT_LLM_URL = 'https://llm-provider.example.com/v1/chat/completions';

class LLMService {
    static async generateReply({ prompt, conversationId, email }) {
        const llmEndpoint = process.env.LLM_API_URL || DEFAULT_LLM_URL;
        const llmToken = process.env.LLM_API_TOKEN || 'mock-token';

        const requestPayload = {
            model: 'mock-gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant responding on behalf of the simulation layer.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            metadata: {
                conversationId,
                email
            }
        };

        const requestHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmToken}`
        };

        logger.info(`Simulating LLM call to ${llmEndpoint} for conversation ${conversationId}`);
        logger.debug?.('LLM request payload', requestPayload);

        const delayMs = randomInt(10, 21) * 1000;
        await delay(delayMs);

        const simulatedContent = [
            `Here is a thoughtful response based on your prompt: "${prompt}".`,
            'If this were a real LLM call, the content would be generated dynamically.',
            'Use this response to demonstrate how the frontend handles delayed, streaming-like output from a large language model.'
        ].join(' ');

        const simulatedResponse = {
            provider: 'simulated-llm',
            delayMs,
            message: simulatedContent
        };

        logger.info(`LLM simulation complete for conversation ${conversationId} (delay ${delayMs} ms)`);
        return simulatedResponse;
    }
}

export default LLMService;

