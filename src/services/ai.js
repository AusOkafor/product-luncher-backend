import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config();

class AIService {
    constructor() {
        this.openai = null;
        this.anthropic = null;
        this.togetherAI = null;
        this.currentProvider = 'openai'; // Default provider
    }

    async initialize() {
        try {
            // Initialize OpenAI
            if (process.env.OPENAI_API_KEY) {
                this.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                    organization: process.env.OPENAI_ORGANIZATION,
                });
                logger.info('OpenAI client initialized');
            }

            // Initialize Anthropic
            if (process.env.ANTHROPIC_API_KEY) {
                this.anthropic = new Anthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                });
                logger.info('Anthropic client initialized');
            }

            // Initialize TogetherAI
            if (process.env.TOGETHER_API_KEY) {
                this.togetherAI = {
                    apiKey: process.env.TOGETHER_API_KEY,
                    baseURL: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz',
                };
                logger.info('TogetherAI client initialized');
                logger.info(`TogetherAI base URL: ${this.togetherAI.baseURL}`);
            } else {
                logger.warn('TOGETHER_API_KEY not found in environment variables');
            }

            logger.info('AI service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize AI service:', error);
            throw error;
        }
    }

    // Text generation with fallback providers
    async generateText(prompt, options = {}) {
        const {
            model = 'gpt-4',
                maxTokens = 1000,
                temperature = 0.7,
                provider = this.currentProvider,
                systemPrompt = null,
        } = options;

        const providers = ['openai', 'anthropic', 'togetherai'];
        let lastError = null;

        for (const p of providers) {
            try {
                switch (p) {
                    case 'openai':
                        if (this.openai) {
                            return await this._generateWithOpenAI(prompt, {
                                model,
                                maxTokens,
                                temperature,
                                systemPrompt,
                            });
                        }
                        break;

                    case 'anthropic':
                        if (this.anthropic) {
                            return await this._generateWithAnthropic(prompt, {
                                model: model === 'gpt-4' ? 'claude-3-sonnet-20240229' : model,
                                maxTokens,
                                temperature,
                                systemPrompt,
                            });
                        }
                        break;

                    case 'togetherai':
                        if (this.togetherAI) {
                            return await this._generateWithTogetherAI(prompt, {
                                model,
                                maxTokens,
                                temperature,
                                systemPrompt,
                            });
                        }
                        break;
                }
            } catch (error) {
                lastError = error;
                logger.warn(`AI provider ${p} failed, trying next provider:`, error.message);
                continue;
            }
        }

        throw new Error(`All AI providers failed. Last error: ${lastError && lastError.message || lastError || 'Unknown error'}`);
    }

    async _generateWithOpenAI(prompt, options) {
        const messages = [];

        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });

        const response = await this.openai.chat.completions.create({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
        });

        return {
            text: response.choices[0].message.content,
            provider: 'openai',
            model: options.model,
            usage: response.usage,
        };
    }

    async _generateWithAnthropic(prompt, options) {
        const messages = [];

        if (options.systemPrompt) {
            messages.push({ role: 'user', content: `System: ${options.systemPrompt}\n\nUser: ${prompt}` });
        } else {
            messages.push({ role: 'user', content: prompt });
        }

        const response = await this.anthropic.messages.create({
            model: options.model,
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
        });

        return {
            text: response.content[0].text,
            provider: 'anthropic',
            model: options.model,
            usage: response.usage,
        };
    }

    async _generateWithTogetherAI(prompt, options) {
        try {
            logger.info('Attempting TogetherAI generation...');
            logger.info(`Model: ${options.model}`);
            logger.info(`Base URL: ${this.togetherAI.baseURL}`);

            const messages = [];

            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }

            messages.push({ role: 'user', content: prompt });

            const requestBody = {
                model: options.model,
                messages,
                max_tokens: options.maxTokens,
                temperature: options.temperature,
            };

            logger.info('Sending request to TogetherAI...');
            const response = await axios.post(
                `${this.togetherAI.baseURL}/v1/chat/completions`,
                requestBody, {
                    headers: {
                        'Authorization': `Bearer ${this.togetherAI.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            logger.info('TogetherAI response received successfully');
            return {
                text: response.data.choices[0].message.content,
                provider: 'togetherai',
                model: options.model,
                usage: response.data.usage,
            };
        } catch (error) {
            logger.error('TogetherAI generation failed:', error.message);
            if (error.response) {
                logger.error('TogetherAI API error:', error.response.data);
            }
            throw error;
        }
    }

    // Product description generation
    async generateProductDescription(productData) {
        const prompt = `Generate a compelling product description for:
Product: ${productData.title}
Category: ${productData.category}
Brand: ${productData.brand}
Price: $${productData.price}
Features: ${JSON.stringify(productData.attributes)}

Write a 2-3 paragraph description that highlights the benefits and features.`;

        return await this.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 300,
            temperature: 0.7,
            systemPrompt: 'You are a professional e-commerce copywriter. Write compelling, benefit-focused product descriptions.',
        });
    }

    // Ad copy generation
    async generateAdCopy(productData, platform = 'meta') {
        const platformPrompts = {
            meta: 'Facebook/Instagram ad copy',
            tiktok: 'TikTok ad copy',
            google: 'Google Ads copy',
        };

        const prompt = `Generate ${platformPrompts[platform]} for:
Product: ${productData.title}
Category: ${productData.category}
Price: $${productData.price}
Target audience: Online shoppers interested in ${productData.category}

Create 3 different ad variations with compelling headlines and descriptions.`;

        return await this.generateText(prompt, {
            model: 'microsoft/DialoGPT-medium',
            maxTokens: 500,
            temperature: 0.8,
            systemPrompt: 'You are a professional digital marketing copywriter specializing in e-commerce advertising.',
        });
    }

    // Email subject line generation
    async generateEmailSubject(productData, campaignType = 'launch') {
        const prompt = `Generate 5 compelling email subject lines for a ${campaignType} campaign featuring:
Product: ${productData.title}
Category: ${productData.category}
Price: $${productData.price}

Make them engaging, urgent, and optimized for open rates.`;

        return await this.generateText(prompt, {
            model: 'microsoft/DialoGPT-medium',
            maxTokens: 200,
            temperature: 0.9,
            systemPrompt: 'You are an email marketing expert. Create subject lines that drive high open rates.',
        });
    }

    // Customer support response
    async generateSupportResponse(customerQuery, productContext = null) {
        let prompt = `Customer query: "${customerQuery}"`;

        if (productContext) {
            prompt += `\n\nProduct context: ${JSON.stringify(productContext)}`;
        }

        prompt += '\n\nGenerate a helpful, professional response that addresses their concern.';

        return await this.generateText(prompt, {
            model: 'microsoft/DialoGPT-medium',
            maxTokens: 250,
            temperature: 0.3,
            systemPrompt: 'You are a helpful customer support representative. Be professional, empathetic, and solution-oriented.',
        });
    }

    // Set preferred provider
    setProvider(provider) {
        if (['openai', 'anthropic', 'togetherai'].includes(provider)) {
            this.currentProvider = provider;
            logger.info(`AI provider set to: ${provider}`);
        } else {
            throw new Error(`Invalid AI provider: ${provider}`);
        }
    }

    // Get available providers
    getAvailableProviders() {
        const providers = [];
        if (this.openai) providers.push('openai');
        if (this.anthropic) providers.push('anthropic');
        if (this.togetherAI) providers.push('togetherai');
        return providers;
    }
}

export const aiService = new AIService();