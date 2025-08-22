import { prisma } from '../db.js';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

class AdCreativeOptimizerService {
    constructor() {
        this.metaClient = null;
        this.initializeMetaClient();
    }

    async initializeMetaClient() {
        try {
            if (process.env.META_ACCESS_TOKEN) {
                this.metaClient = {
                    accessToken: process.env.META_ACCESS_TOKEN,
                    baseURL: 'https://graph.facebook.com/v18.0'
                };
                logger.info('Meta Ads API client initialized');
            } else {
                logger.warn('Meta Ads API credentials not found. Performance data will be simulated.');
            }
        } catch (error) {
            logger.error('Error initializing Meta client:', error);
        }
    }

    // Ingest performance data from Meta Ads API
    async ingestPerformanceData(adAccountId, dateRange = 'last_30d') {
        try {
            if (!this.metaClient) {
                logger.warn('Meta client not configured. Using simulated data.');
                return await this.generateSimulatedPerformanceData();
            }

            const response = await axios.get(`${this.metaClient.baseURL}/act_${adAccountId}/insights`, {
                params: {
                    access_token: this.metaClient.accessToken,
                    fields: 'campaign_name,adset_name,ad_name,impressions,clicks,spend,ctr,cpc,cpm,conversions',
                    time_range: dateRange,
                    level: 'ad'
                }
            });

            const performanceData = response.data.data;
            logger.info(`Ingested ${performanceData.length} ad performance records`);

            // Store performance data
            for (const record of performanceData) {
                await this.storePerformanceRecord(record);
            }

            return performanceData;
        } catch (error) {
            logger.error('Error ingesting performance data:', error);
            throw error;
        }
    }

    // Generate simulated performance data for testing
    async generateSimulatedPerformanceData() {
        const simulatedData = [];
        const adNames = ['Teal Shirt Ad A', 'Teal Shirt Ad B', 'Teal Shirt Ad C', 'Blue Dress Ad A', 'Blue Dress Ad B'];

        for (let i = 0; i < 20; i++) {
            const adName = adNames[Math.floor(Math.random() * adNames.length)];
            const impressions = Math.floor(Math.random() * 10000) + 1000;
            const clicks = Math.floor(Math.random() * impressions * 0.1);
            const spend = Math.floor(Math.random() * 500) + 50;
            const conversions = Math.floor(Math.random() * clicks * 0.1);

            simulatedData.push({
                ad_name: adName,
                impressions,
                clicks,
                spend: spend.toFixed(2),
                ctr: ((clicks / impressions) * 100).toFixed(2),
                cpc: (spend / clicks).toFixed(2),
                cpm: ((spend / impressions) * 1000).toFixed(2),
                conversions: conversions || 0
            });
        }

        return simulatedData;
    }

    // Store performance record in database
    async storePerformanceRecord(record) {
        try {
            await prisma.adPerformance.create({
                data: {
                    adName: record.ad_name,
                    impressions: parseInt(record.impressions) || 0,
                    clicks: parseInt(record.clicks) || 0,
                    spend: parseFloat(record.spend) || 0,
                    ctr: parseFloat(record.ctr) || 0,
                    cpc: parseFloat(record.cpc) || 0,
                    cpm: parseFloat(record.cpm) || 0,
                    conversions: parseInt(record.conversions) || 0,
                    performanceData: record,
                    recordedAt: new Date()
                }
            });
        } catch (error) {
            logger.error('Error storing performance record:', error);
        }
    }

    // Multi-armed bandit optimization
    async optimizeAdCreative(adSetId, options = {}) {
        try {
            const { explorationRate = 0.2, learningRate = 0.1 } = options;

            // Get current ad performance
            const adPerformance = await prisma.adPerformance.findMany({
                where: {
                    adName: {
                        contains: adSetId
                    }
                },
                orderBy: {
                    recordedAt: 'desc'
                },
                take: 100
            });

            if (adPerformance.length === 0) {
                logger.info('No performance data available. Using exploration mode.');
                return await this.generateNewAdVariation(adSetId, 'exploration');
            }

            // Calculate performance scores
            const performanceScores = this.calculatePerformanceScores(adPerformance);

            // Multi-armed bandit decision
            const shouldExplore = Math.random() < explorationRate;

            if (shouldExplore) {
                logger.info('Exploration mode: Generating new ad variation');
                return await this.generateNewAdVariation(adSetId, 'exploration');
            } else {
                logger.info('Exploitation mode: Optimizing best performing ad');
                return await this.optimizeBestPerformingAd(adSetId, performanceScores);
            }
        } catch (error) {
            logger.error('Error optimizing ad creative:', error);
            throw error;
        }
    }

    // Calculate performance scores for ads
    calculatePerformanceScores(adPerformance) {
        const adScores = {};

        for (const record of adPerformance) {
            if (!adScores[record.adName]) {
                adScores[record.adName] = {
                    totalImpressions: 0,
                    totalClicks: 0,
                    totalSpend: 0,
                    totalConversions: 0,
                    avgCtr: 0,
                    avgCpc: 0,
                    score: 0
                };
            }

            const score = adScores[record.adName];
            score.totalImpressions += record.impressions;
            score.totalClicks += record.clicks;
            score.totalSpend += record.spend;
            score.totalConversions += record.conversions;
        }

        // Calculate weighted scores
        for (const adName in adScores) {
            const score = adScores[adName];
            score.avgCtr = score.totalImpressions > 0 ? (score.totalClicks / score.totalImpressions) * 100 : 0;
            score.avgCpc = score.totalClicks > 0 ? score.totalSpend / score.totalClicks : 0;

            // Performance score = (CTR * 0.4) + (Conversion Rate * 0.4) + (1/CPC * 0.2)
            const conversionRate = score.totalClicks > 0 ? (score.totalConversions / score.totalClicks) * 100 : 0;
            const cpcScore = score.avgCpc > 0 ? 1 / score.avgCpc : 0;

            score.score = (score.avgCtr * 0.4) + (conversionRate * 0.4) + (cpcScore * 0.2);
        }

        return adScores;
    }

    // Generate new ad variation
    async generateNewAdVariation(adSetId, mode = 'exploration') {
        try {
            const prompt = `
Generate a new ad creative variation for our e-commerce product:

Product: Teal Shirt
Price: $10
Category: Fashion
Target Audience: Fashion-conscious consumers aged 18-35

Mode: ${mode === 'exploration' ? 'Exploration - Try something new and creative' : 'Optimization - Improve on what works'}

Generate:
1. Ad Headline (max 40 characters)
2. Ad Copy (max 125 characters)
3. Call-to-Action button text
4. Visual direction suggestions
5. Target audience refinements
6. A/B testing hypothesis

Make it compelling, conversion-focused, and suitable for Facebook/Instagram ads.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 400,
                temperature: mode === 'exploration' ? 0.9 : 0.7
            });

            const adCreative = this.parseAdCreativeResponse(response.text);

            // Store the new ad creative
            const storedCreative = await prisma.adCreative.create({
                data: {
                    adSetId,
                    headline: adCreative.headline,
                    adCopy: adCreative.adCopy,
                    callToAction: adCreative.callToAction,
                    visualDirection: adCreative.visualDirection,
                    targetAudience: adCreative.targetAudience,
                    hypothesis: adCreative.hypothesis,
                    mode,
                    status: 'DRAFT',
                    generatedAt: new Date()
                }
            });

            return {
                adCreative: storedCreative,
                mode,
                generatedContent: adCreative
            };
        } catch (error) {
            logger.error('Error generating ad variation:', error);
            throw error;
        }
    }

    // Optimize best performing ad
    async optimizeBestPerformingAd(adSetId, performanceScores) {
        try {
            // Find best performing ad
            const bestAd = Object.entries(performanceScores)
                .sort(([, a], [, b]) => b.score - a.score)[0];

            if (!bestAd) {
                return await this.generateNewAdVariation(adSetId, 'exploration');
            }

            const [bestAdName, bestAdScore] = bestAd;

            const prompt = `
Optimize this high-performing ad creative based on performance data:

Current Ad: ${bestAdName}
Performance Score: ${bestAdScore.score.toFixed(2)}
CTR: ${bestAdScore.avgCtr.toFixed(2)}%
CPC: $${bestAdScore.avgCpc.toFixed(2)}
Conversions: ${bestAdScore.totalConversions}

Product: Teal Shirt
Price: $10

Generate an optimized version that:
1. Maintains what's working well
2. Improves weak areas
3. Tests new elements
4. Increases conversion potential

Generate:
1. Optimized Headline
2. Optimized Ad Copy
3. Improved Call-to-Action
4. Visual improvements
5. A/B testing variations
6. Optimization rationale

Make it even more compelling while building on proven success.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 500,
                temperature: 0.7
            });

            const optimizedCreative = this.parseAdCreativeResponse(response.text);

            // Store the optimized creative
            const storedCreative = await prisma.adCreative.create({
                data: {
                    adSetId,
                    headline: optimizedCreative.headline,
                    adCopy: optimizedCreative.adCopy,
                    callToAction: optimizedCreative.callToAction,
                    visualDirection: optimizedCreative.visualDirection,
                    targetAudience: optimizedCreative.targetAudience,
                    hypothesis: optimizedCreative.hypothesis,
                    mode: 'optimization',
                    status: 'DRAFT',
                    generatedAt: new Date(),
                    performanceData: {
                        originalAd: bestAdName,
                        originalScore: bestAdScore.score,
                        optimizationTarget: 'improve_conversion_rate'
                    }
                }
            });

            return {
                adCreative: storedCreative,
                mode: 'optimization',
                originalAd: bestAdName,
                originalScore: bestAdScore.score,
                generatedContent: optimizedCreative
            };
        } catch (error) {
            logger.error('Error optimizing best performing ad:', error);
            throw error;
        }
    }

    // Parse AI response into structured ad creative
    parseAdCreativeResponse(response) {
        const lines = response.split('\n').filter(line => line.trim());

        const creative = {
            headline: '',
            adCopy: '',
            callToAction: '',
            visualDirection: '',
            targetAudience: '',
            hypothesis: ''
        };

        let currentSection = '';

        for (const line of lines) {
            const lowerLine = line.toLowerCase();

            if (lowerLine.includes('headline')) {
                currentSection = 'headline';
                creative.headline = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('copy') || lowerLine.includes('description')) {
                currentSection = 'adCopy';
                creative.adCopy = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('call') || lowerLine.includes('cta')) {
                currentSection = 'callToAction';
                creative.callToAction = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('visual') || lowerLine.includes('image')) {
                currentSection = 'visualDirection';
                creative.visualDirection = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('target') || lowerLine.includes('audience')) {
                currentSection = 'targetAudience';
                creative.targetAudience = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (lowerLine.includes('hypothesis') || lowerLine.includes('test')) {
                currentSection = 'hypothesis';
                creative.hypothesis = line.split(':')[1] && line.split(':')[1].trim() || line.trim();
            } else if (currentSection && line.trim()) {
                // Append to current section
                creative[currentSection] += ' ' + line.trim();
            }
        }

        return creative;
    }

    // A/B testing automation
    async setupABTest(adSetId, testConfig = {}) {
        try {
            const {
                testName = 'Ad Creative A/B Test',
                    duration = 7, // days
                    budget = 100,
                    metrics = ['ctr', 'cpc', 'conversions']
            } = testConfig;

            // Generate A and B variations
            const variationA = await this.generateNewAdVariation(adSetId, 'exploration');
            const variationB = await this.generateNewAdVariation(adSetId, 'exploration');

            // Create A/B test record
            const abTest = await prisma.abTest.create({
                data: {
                    adSetId,
                    testName,
                    variationA: variationA.adCreative.id,
                    variationB: variationB.adCreative.id,
                    duration,
                    budget,
                    metrics,
                    status: 'ACTIVE',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
                }
            });

            logger.info(`A/B test created: ${abTest.id}`);
            return abTest;
        } catch (error) {
            logger.error('Error setting up A/B test:', error);
            throw error;
        }
    }

    // Get optimization recommendations
    async getOptimizationRecommendations(adSetId) {
        try {
            const performanceData = await prisma.adPerformance.findMany({
                where: {
                    adName: {
                        contains: adSetId
                    }
                },
                orderBy: {
                    recordedAt: 'desc'
                },
                take: 50
            });

            if (performanceData.length === 0) {
                return {
                    recommendations: ['No performance data available. Start with exploration mode.'],
                    insights: []
                };
            }

            const scores = this.calculatePerformanceScores(performanceData);
            const recommendations = [];
            const insights = [];

            // Analyze performance patterns
            const avgCtr = performanceData.reduce((sum, p) => sum + p.ctr, 0) / performanceData.length;
            const avgCpc = performanceData.reduce((sum, p) => sum + p.cpc, 0) / performanceData.length;

            if (avgCtr < 1.0) {
                recommendations.push('Low CTR detected. Focus on more compelling headlines and visuals.');
            }

            if (avgCpc > 2.0) {
                recommendations.push('High CPC detected. Optimize targeting and ad relevance.');
            }

            // Find best and worst performers
            const sortedAds = Object.entries(scores).sort(([, a], [, b]) => b.score - a.score);
            const bestAd = sortedAds[0];
            const worstAd = sortedAds[sortedAds.length - 1];

            insights.push({
                type: 'best_performer',
                ad: bestAd[0],
                score: bestAd[1].score,
                recommendation: 'Scale this ad and use as base for optimization'
            });

            insights.push({
                type: 'worst_performer',
                ad: worstAd[0],
                score: worstAd[1].score,
                recommendation: 'Pause this ad and learn from best performers'
            });

            return {
                recommendations,
                insights,
                performanceSummary: {
                    totalAds: performanceData.length,
                    avgCtr,
                    avgCpc,
                    bestScore: bestAd[1].score,
                    worstScore: worstAd[1].score
                }
            };
        } catch (error) {
            logger.error('Error getting optimization recommendations:', error);
            throw error;
        }
    }
}

export const adCreativeOptimizerService = new AdCreativeOptimizerService();