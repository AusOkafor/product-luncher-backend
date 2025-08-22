import { prisma } from '../db.js';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

class UGCTrendSpotterService {
    constructor() {
        this.platforms = ['instagram', 'tiktok', 'twitter', 'youtube'];
        this.trendKeywords = new Set();
        this.contentHooks = new Map();
    }

    // Ingest UGC from social platforms
    async ingestUGC(platform, options = {}) {
        try {
            const { hashtags = [], keywords = [], limit = 100 } = options;

            logger.info(`Ingesting UGC from ${platform} with ${hashtags.length} hashtags`);

            let ugcData = [];

            switch (platform.toLowerCase()) {
                case 'instagram':
                    ugcData = await this.ingestInstagramUGC(hashtags, keywords, limit);
                    break;
                case 'tiktok':
                    ugcData = await this.ingestTikTokUGC(hashtags, keywords, limit);
                    break;
                case 'twitter':
                    ugcData = await this.ingestTwitterUGC(hashtags, keywords, limit);
                    break;
                case 'youtube':
                    ugcData = await this.ingestYouTubeUGC(hashtags, keywords, limit);
                    break;
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }

            // Process and store UGC data
            const processedData = await this.processUGCData(ugcData, platform);

            logger.info(`Ingested ${processedData.length} UGC items from ${platform}`);
            return processedData;
        } catch (error) {
            logger.error(`Error ingesting UGC from ${platform}:`, error);
            throw error;
        }
    }

    // Ingest Instagram UGC (simulated for demo)
    async ingestInstagramUGC(hashtags, keywords, limit) {
        // Simulate Instagram API response
        const mockData = [];
        const fashionHashtags = ['#fashion', '#style', '#ootd', '#fashionista', '#streetstyle'];
        const productKeywords = ['shirt', 'dress', 'jewelry', 'accessories', 'fashion'];

        for (let i = 0; i < limit; i++) {
            const hashtag = fashionHashtags[Math.floor(Math.random() * fashionHashtags.length)];
            const keyword = productKeywords[Math.floor(Math.random() * productKeywords.length)];

            mockData.push({
                id: `ig_${Date.now()}_${i}`,
                platform: 'instagram',
                content: `Love this new ${keyword}! ${hashtag} #trending #viral`,
                author: `user_${Math.floor(Math.random() * 1000)}`,
                engagement: Math.floor(Math.random() * 10000),
                likes: Math.floor(Math.random() * 5000),
                comments: Math.floor(Math.random() * 500),
                shares: Math.floor(Math.random() * 200),
                hashtags: [hashtag, '#trending', '#viral'],
                keywords: [keyword],
                media_url: `https://example.com/ig_${i}.jpg`,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
                sentiment: Math.random() > 0.5 ? 'positive' : 'neutral'
            });
        }

        return mockData;
    }

    // Ingest TikTok UGC (simulated for demo)
    async ingestTikTokUGC(hashtags, keywords, limit) {
        const mockData = [];
        const tiktokTrends = ['#fyp', '#viral', '#trending', '#fashiontok', '#stylecheck'];
        const productKeywords = ['outfit', 'haul', 'review', 'styling', 'fashion'];

        for (let i = 0; i < limit; i++) {
            const trend = tiktokTrends[Math.floor(Math.random() * tiktokTrends.length)];
            const keyword = productKeywords[Math.floor(Math.random() * productKeywords.length)];

            mockData.push({
                id: `tt_${Date.now()}_${i}`,
                platform: 'tiktok',
                content: `Amazing ${keyword} video! ${trend} #fashion #style`,
                author: `tiktoker_${Math.floor(Math.random() * 1000)}`,
                engagement: Math.floor(Math.random() * 50000),
                likes: Math.floor(Math.random() * 20000),
                comments: Math.floor(Math.random() * 1000),
                shares: Math.floor(Math.random() * 500),
                hashtags: [trend, '#fashion', '#style'],
                keywords: [keyword],
                media_url: `https://example.com/tt_${i}.mp4`,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                sentiment: Math.random() > 0.6 ? 'positive' : 'neutral',
                video_duration: Math.floor(Math.random() * 60) + 15 // 15-75 seconds
            });
        }

        return mockData;
    }

    // Ingest Twitter UGC (simulated for demo)
    async ingestTwitterUGC(hashtags, keywords, limit) {
        const mockData = [];
        const twitterTrends = ['#fashion', '#style', '#ootd', '#fashionweek', '#trending'];
        const productKeywords = ['shirt', 'dress', 'jewelry', 'accessories'];

        for (let i = 0; i < limit; i++) {
            const trend = twitterTrends[Math.floor(Math.random() * twitterTrends.length)];
            const keyword = productKeywords[Math.floor(Math.random() * productKeywords.length)];

            mockData.push({
                id: `tw_${Date.now()}_${i}`,
                platform: 'twitter',
                content: `Just got this amazing ${keyword}! ${trend} #loveit`,
                author: `twitter_user_${Math.floor(Math.random() * 1000)}`,
                engagement: Math.floor(Math.random() * 5000),
                likes: Math.floor(Math.random() * 2000),
                comments: Math.floor(Math.random() * 200),
                shares: Math.floor(Math.random() * 100),
                hashtags: [trend, '#loveit'],
                keywords: [keyword],
                media_url: `https://example.com/tw_${i}.jpg`,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                sentiment: Math.random() > 0.5 ? 'positive' : 'neutral'
            });
        }

        return mockData;
    }

    // Ingest YouTube UGC (simulated for demo)
    async ingestYouTubeUGC(hashtags, keywords, limit) {
        const mockData = [];
        const youtubeTrends = ['#fashion', '#haul', '#review', '#styling', '#fashionvideo'];
        const productKeywords = ['haul', 'review', 'styling', 'fashion', 'outfit'];

        for (let i = 0; i < limit; i++) {
            const trend = youtubeTrends[Math.floor(Math.random() * youtubeTrends.length)];
            const keyword = productKeywords[Math.floor(Math.random() * productKeywords.length)];

            mockData.push({
                id: `yt_${Date.now()}_${i}`,
                platform: 'youtube',
                content: `Fashion ${keyword} video - must watch! ${trend} #fashion #style`,
                author: `youtuber_${Math.floor(Math.random() * 1000)}`,
                engagement: Math.floor(Math.random() * 100000),
                likes: Math.floor(Math.random() * 10000),
                comments: Math.floor(Math.random() * 2000),
                shares: Math.floor(Math.random() * 500),
                hashtags: [trend, '#fashion', '#style'],
                keywords: [keyword],
                media_url: `https://example.com/yt_${i}.mp4`,
                created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                sentiment: Math.random() > 0.6 ? 'positive' : 'neutral',
                video_duration: Math.floor(Math.random() * 600) + 300 // 5-15 minutes
            });
        }

        return mockData;
    }

    // Process and store UGC data
    async processUGCData(ugcData, platform) {
        const processedData = [];

        for (const item of ugcData) {
            try {
                // Generate embeddings for content
                const embedding = await this.generateContentEmbedding(item.content);

                // Extract trends and keywords
                const trends = await this.extractTrends(item);
                const keywords = await this.extractKeywords(item.content);

                // Calculate engagement score
                const engagementScore = this.calculateEngagementScore(item);

                // Store in database
                const storedUGC = await prisma.ugcContent.create({
                    data: {
                        platform,
                        contentId: item.id,
                        author: item.author,
                        content: item.content,
                        engagement: item.engagement,
                        likes: item.likes,
                        comments: item.comments,
                        shares: item.shares,
                        hashtags: item.hashtags,
                        keywords,
                        trends,
                        mediaUrl: item.media_url,
                        sentiment: item.sentiment,
                        engagementScore,
                        embedding: embedding,
                        publishedAt: item.created_at,
                        ingestedAt: new Date()
                    }
                });

                processedData.push(storedUGC);

                // Update trend tracking
                this.updateTrendTracking(trends, keywords, engagementScore);

            } catch (error) {
                logger.error('Error processing UGC item:', error);
            }
        }

        return processedData;
    }

    // Generate content embedding
    async generateContentEmbedding(content) {
        try {
            // For now, create a simple embedding (in production, use a proper embedding model)
            const words = content.toLowerCase().split(/\s+/);
            const embedding = new Array(384).fill(0); // 384-dimensional embedding

            // Simple hash-based embedding
            words.forEach((word, index) => {
                const hash = this.simpleHash(word);
                const position = hash % 384;
                embedding[position] += 1;
            });

            // Normalize
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                embedding.forEach((val, index) => {
                    embedding[index] = val / magnitude;
                });
            }

            return embedding;
        } catch (error) {
            logger.error('Error generating embedding:', error);
            return new Array(384).fill(0);
        }
    }

    // Simple hash function for embedding generation
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Extract trends from UGC item
    async extractTrends(item) {
        const trends = [];

        // Extract hashtags as trends
        if (item.hashtags) {
            trends.push(...item.hashtags.filter(tag =>
                tag.toLowerCase().includes('trend') ||
                tag.toLowerCase().includes('viral') ||
                tag.toLowerCase().includes('fyp') ||
                tag.toLowerCase().includes('fashion')
            ));
        }

        // Extract keywords as potential trends
        if (item.keywords) {
            trends.push(...item.keywords);
        }

        // Use AI to identify additional trends
        try {
            const prompt = `
Analyze this social media content and identify trending topics, hashtags, or themes:

Content: "${item.content}"
Platform: ${item.platform}
Engagement: ${item.engagement}

Identify 3-5 trending topics, hashtags, or themes that are relevant to fashion/e-commerce.
Return only the trends, one per line, without explanations.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 100,
                temperature: 0.7
            });

            const aiTrends = response.text.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .map(trend => `#${trend.replace(/\s+/g, '')}`);

            trends.push(...aiTrends);
        } catch (error) {
            logger.error('Error extracting AI trends:', error);
        }

        return [...new Set(trends)]; // Remove duplicates
    }

    // Extract keywords from content
    async extractKeywords(content) {
        try {
            const prompt = `
Extract relevant fashion/e-commerce keywords from this content:

"${content}"

Return only the keywords, separated by commas, without explanations.
Focus on product names, styles, colors, and fashion-related terms.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 100,
                temperature: 0.5
            });

            return response.text.split(',')
                .map(keyword => keyword.trim())
                .filter(keyword => keyword.length > 0);
        } catch (error) {
            logger.error('Error extracting keywords:', error);
            return [];
        }
    }

    // Calculate engagement score
    calculateEngagementScore(item) {
        const likesWeight = 1;
        const commentsWeight = 3;
        const sharesWeight = 5;

        const score = (item.likes * likesWeight) +
            (item.comments * commentsWeight) +
            (item.shares * sharesWeight);

        return score;
    }

    // Update trend tracking
    updateTrendTracking(trends, keywords, engagementScore) {
        trends.forEach(trend => {
            if (!this.trendKeywords.has(trend)) {
                this.trendKeywords.add(trend);
            }
        });

        keywords.forEach(keyword => {
            if (!this.contentHooks.has(keyword)) {
                this.contentHooks.set(keyword, []);
            }
            this.contentHooks.get(keyword).push(engagementScore);
        });
    }

    // Detect trending topics
    async detectTrendingTopics(days = 7, platform = null) {
        try {
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            const whereClause = {
                publishedAt: {
                    gte: startDate
                }
            };

            if (platform) {
                whereClause.platform = platform;
            }

            const ugcData = await prisma.ugcContent.findMany({
                where: whereClause,
                select: {
                    trends: true,
                    keywords: true,
                    engagementScore: true,
                    platform: true
                }
            });

            // Aggregate trends
            const trendScores = new Map();

            ugcData.forEach(item => {
                if (item.trends) {
                    item.trends.forEach(trend => {
                        if (!trendScores.has(trend)) {
                            trendScores.set(trend, { score: 0, count: 0, platforms: new Set() });
                        }
                        const trendData = trendScores.get(trend);
                        trendData.score += item.engagementScore;
                        trendData.count += 1;
                        trendData.platforms.add(item.platform);
                    });
                }
            });

            // Sort by score and return top trends
            const sortedTrends = Array.from(trendScores.entries())
                .map(([trend, data]) => ({
                    trend,
                    score: data.score,
                    count: data.count,
                    platforms: Array.from(data.platforms),
                    averageScore: data.score / data.count
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 20);

            logger.info(`Detected ${sortedTrends.length} trending topics`);
            return sortedTrends;
        } catch (error) {
            logger.error('Error detecting trending topics:', error);
            throw error;
        }
    }

    // Generate content hook suggestions
    async generateContentHookSuggestions(productId, platform = 'instagram') {
            try {
                const product = await prisma.product.findUnique({
                    where: { id: productId }
                });

                if (!product) {
                    throw new Error('Product not found');
                }

                // Get trending topics
                const trendingTopics = await this.detectTrendingTopics(7, platform);

                // Generate content hooks using AI
                const prompt = `
Generate 5 engaging content hook suggestions for this product on ${platform}:

Product: ${product.title}
Price: $${product.price}
Category: ${product.category}
Description: ${product.description}

Current Trending Topics:
${trendingTopics.slice(0, 10).map(t => `- ${t.trend} (${t.count} mentions)`).join('\n')}

Generate:
1. Hook-style opening lines
2. Trending hashtag combinations
3. Content angles that leverage current trends
4. Call-to-action suggestions
5. Platform-specific format recommendations

Make them viral-worthy and trend-aware.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 600,
                temperature: 0.8
            });

            const hooks = this.parseContentHooks(response.text);
            
            // Store content hooks
            const storedHooks = await prisma.contentHook.create({
                data: {
                    productId: product.id,
                    platform,
                    hooks,
                    trendingTopics: trendingTopics.slice(0, 10).map(t => t.trend),
                    generatedAt: new Date(),
                    status: 'ACTIVE'
                }
            });

            return {
                contentHooks: storedHooks,
                hooks,
                trendingTopics: trendingTopics.slice(0, 10)
            };
        } catch (error) {
            logger.error('Error generating content hook suggestions:', error);
            throw error;
        }
    }

    // Parse content hooks from AI response
    parseContentHooks(response) {
        const hooks = [];
        const lines = response.split('\n').filter(line => line.trim());
        
        let currentHook = {};
        let hookNumber = 1;
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('hook') || lowerLine.includes('opening')) {
                if (Object.keys(currentHook).length > 0) {
                    hooks.push(currentHook);
                }
                currentHook = { id: hookNumber++, type: 'opening' };
            } else if (lowerLine.includes('hashtag')) {
                currentHook.hashtags = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('angle') || lowerLine.includes('content')) {
                currentHook.angle = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('call') || lowerLine.includes('cta')) {
                currentHook.cta = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (currentHook.type && line.trim()) {
                if (!currentHook.content) {
                    currentHook.content = line.trim();
                } else {
                    currentHook.content += ' ' + line.trim();
                }
            }
        }
        
        if (Object.keys(currentHook).length > 0) {
            hooks.push(currentHook);
        }
        
        return hooks;
    }

    // Embedding-based search
    async searchSimilarContent(query, platform = null, limit = 10) {
        try {
            // Generate embedding for query
            const queryEmbedding = await this.generateContentEmbedding(query);
            
            // Find similar content using cosine similarity
            const allContent = await prisma.ugcContent.findMany({
                where: platform ? { platform } : {},
                select: {
                    id: true,
                    content: true,
                    platform: true,
                    engagementScore: true,
                    hashtags: true,
                    embedding: true
                }
            });

            // Calculate similarities
            const similarities = allContent.map(item => {
                const similarity = this.calculateCosineSimilarity(queryEmbedding, item.embedding);
                return {
                    ...item,
                    similarity
                };
            });

            // Sort by similarity and return top results
            const topResults = similarities
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            logger.info(`Found ${topResults.length} similar content items for query: "${query}"`);
            return topResults;
        } catch (error) {
            logger.error('Error searching similar content:', error);
            throw error;
        }
    }

    // Calculate cosine similarity between two embeddings
    calculateCosineSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            magnitude1 += embedding1[i] * embedding1[i];
            magnitude2 += embedding2[i] * embedding2[i];
        }

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }

        return dotProduct / (magnitude1 * magnitude2);
    }

    // Get UGC insights and analytics
    async getUGCInsights(days = 30, platform = null) {
        try {
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const whereClause = {
                publishedAt: {
                    gte: startDate
                }
            };
            
            if (platform) {
                whereClause.platform = platform;
            }

            const ugcData = await prisma.ugcContent.findMany({
                where: whereClause
            });

            const insights = {
                totalContent: ugcData.length,
                totalEngagement: ugcData.reduce((sum, item) => sum + item.engagement, 0),
                averageEngagement: ugcData.length > 0 ? 
                    ugcData.reduce((sum, item) => sum + item.engagement, 0) / ugcData.length : 0,
                topTrends: await this.getTopTrends(ugcData),
                platformBreakdown: this.getPlatformBreakdown(ugcData),
                sentimentAnalysis: this.getSentimentAnalysis(ugcData),
                topKeywords: this.getTopKeywords(ugcData)
            };

            return insights;
        } catch (error) {
            logger.error('Error getting UGC insights:', error);
            throw error;
        }
    }

    // Get top trends from UGC data
    async getTopTrends(ugcData) {
        const trendCounts = new Map();
        
        ugcData.forEach(item => {
            if (item.trends) {
                item.trends.forEach(trend => {
                    trendCounts.set(trend, (trendCounts.get(trend) || 0) + 1);
                });
            }
        });

        return Array.from(trendCounts.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([trend, count]) => ({ trend, count }));
    }

    // Get platform breakdown
    getPlatformBreakdown(ugcData) {
        const breakdown = {};
        
        ugcData.forEach(item => {
            breakdown[item.platform] = (breakdown[item.platform] || 0) + 1;
        });

        return breakdown;
    }

    // Get sentiment analysis
    getSentimentAnalysis(ugcData) {
        const sentiments = {};
        
        ugcData.forEach(item => {
            sentiments[item.sentiment] = (sentiments[item.sentiment] || 0) + 1;
        });

        return sentiments;
    }

    // Get top keywords
    getTopKeywords(ugcData) {
        const keywordCounts = new Map();
        
        ugcData.forEach(item => {
            if (item.keywords) {
                item.keywords.forEach(keyword => {
                    keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
                });
            }
        });

        return Array.from(keywordCounts.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 15)
            .map(([keyword, count]) => ({ keyword, count }));
    }
}

export const ugcTrendSpotterService = new UGCTrendSpotterService();