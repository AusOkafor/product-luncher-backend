import { prisma } from '../db.js';
import { aiService } from './ai.js';
import { analyticsService } from './analytics.js';
import { logger } from '../utils/logger.js';

class AILaunchService {
    constructor() {
        this.launchTypes = {
            SOCIAL_MEDIA: 'social_media',
            EMAIL_CAMPAIGN: 'email_campaign',
            LANDING_PAGE: 'landing_page',
            AD_CREATIVE: 'ad_creative',
            PRODUCT_DESCRIPTION: 'product_description'
        };
    }

    // Generate AI launch for a product
    async generateLaunch(productId, launchType, options = {}) {
        const startTime = Date.now();

        try {
            // Get product data
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    store: {
                        include: { workspace: true }
                    },
                    variants: true
                }
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            logger.info(`Generating ${launchType} launch for product: ${product.title}`);

            // Generate content based on launch type
            let launchContent;
            switch (launchType) {
                case this.launchTypes.SOCIAL_MEDIA:
                    launchContent = await this._generateSocialMediaContent(product, options);
                    break;
                case this.launchTypes.EMAIL_CAMPAIGN:
                    launchContent = await this._generateEmailCampaign(product, options);
                    break;
                case this.launchTypes.LANDING_PAGE:
                    launchContent = await this._generateLandingPage(product, options);
                    break;
                case this.launchTypes.AD_CREATIVE:
                    launchContent = await this._generateAdCreative(product, options);
                    break;
                case this.launchTypes.PRODUCT_DESCRIPTION:
                    launchContent = await this._generateProductDescription(product, options);
                    break;
                default:
                    throw new Error(`Unknown launch type: ${launchType}`);
            }

            // Create launch record
            const launch = await prisma.launch.create({
                data: {
                    productId: product.id,
                    workspaceId: product.store.workspaceId,
                    name: launchContent.title,
                    inputs: {
                        productId: product.id,
                        launchType,
                        options,
                        productData: {
                            title: product.title,
                            price: product.price,
                            category: product.category,
                            brand: product.brand
                        }
                    },
                    outputs: {
                        title: launchContent.title,
                        description: launchContent.description,
                        content: launchContent.content,
                        aiModel: launchContent.aiModel,
                        generationTime: Date.now() - startTime
                    },
                    status: 'COMPLETED'
                }
            });

            // Track analytics
            await analyticsService.trackAILaunchCreation(productId, {
                type: launchType,
                aiModel: launchContent.aiModel,
                generationTime: Date.now() - startTime
            });

            logger.info(`AI launch created: ${launch.id} for product: ${product.title}`);
            return launch;

        } catch (error) {
            logger.error('Error generating AI launch:', error);
            throw error;
        }
    }

    // Generate social media content
    async _generateSocialMediaContent(product, options) {
        const prompt = `
Generate engaging social media content for this product:

Product: ${product.title}
Price: $${product.price}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'Unknown'}
Description: ${product.description || 'No description available'}

Generate:
1. A catchy headline (max 60 characters)
2. Engaging post copy (max 280 characters for Twitter)
3. 5 relevant hashtags
4. Call-to-action suggestion

Target audience: ${options.targetAudience || 'General consumers'}
Tone: ${options.tone || 'Professional but friendly'}
Platform: ${options.platform || 'Instagram'}

Make it compelling and conversion-focused.
        `;

        const response = await aiService.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 500,
            temperature: 0.7
        });

        return {
            title: `AI-Generated Social Media Launch for ${product.title}`,
            description: `Social media content for ${product.title}`,
            content: {
                headline: this._extractHeadline(response.text),
                postCopy: this._extractPostCopy(response.text),
                hashtags: this._extractHashtags(response.text),
                callToAction: this._extractCallToAction(response.text),
                fullResponse: response.text
            },
            aiModel: 'mistralai/Mistral-7B-Instruct-v0.1'
        };
    }

    // Generate email campaign
    async _generateEmailCampaign(product, options) {
        const prompt = `
Create an email marketing campaign for this product:

Product: ${product.title}
Price: $${product.price}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'Unknown'}
Description: ${product.description || 'No description available'}

Generate:
1. Email subject line (max 50 characters)
2. Preheader text (max 100 characters)
3. Email body content (engaging and conversion-focused)
4. Call-to-action button text
5. Follow-up email ideas

Campaign type: ${options.campaignType || 'Product Launch'}
Target audience: ${options.targetAudience || 'Existing customers'}
Tone: ${options.tone || 'Professional but friendly'}

Make it compelling and drive conversions.
        `;

        const response = await aiService.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 800,
            temperature: 0.7
        });

        return {
            title: `AI-Generated Email Campaign for ${product.title}`,
            description: `Email marketing campaign for ${product.title}`,
            content: {
                subjectLine: this._extractSubjectLine(response.text),
                preheader: this._extractPreheader(response.text),
                emailBody: this._extractEmailBody(response.text),
                callToAction: this._extractCallToAction(response.text),
                followUpIdeas: this._extractFollowUpIdeas(response.text),
                fullResponse: response.text
            },
            aiModel: 'mistralai/Mistral-7B-Instruct-v0.1'
        };
    }

    // Generate landing page content
    async _generateLandingPage(product, options) {
        const prompt = `
Create landing page content for this product:

Product: ${product.title}
Price: $${product.price}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'Unknown'}
Description: ${product.description || 'No description available'}

Generate:
1. Hero headline (compelling and benefit-focused)
2. Subheadline (supporting the main headline)
3. Key benefits (3-5 bullet points)
4. Product features section
5. Social proof section ideas
6. FAQ section (3-5 questions)
7. Call-to-action copy

Target audience: ${options.targetAudience || 'General consumers'}
Conversion goal: ${options.conversionGoal || 'Purchase'}
Tone: ${options.tone || 'Professional but friendly'}

Make it conversion-optimized and compelling.
        `;

        const response = await aiService.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 1000,
            temperature: 0.7
        });

        return {
            title: `AI-Generated Landing Page for ${product.title}`,
            description: `Landing page content for ${product.title}`,
            content: {
                heroHeadline: this._extractHeroHeadline(response.text),
                subheadline: this._extractSubheadline(response.text),
                benefits: this._extractBenefits(response.text),
                features: this._extractFeatures(response.text),
                socialProof: this._extractSocialProof(response.text),
                faq: this._extractFAQ(response.text),
                callToAction: this._extractCallToAction(response.text),
                fullResponse: response.text
            },
            aiModel: 'mistralai/Mistral-7B-Instruct-v0.1'
        };
    }

    // Generate ad creative
    async _generateAdCreative(product, options) {
        const prompt = `
Create ad creative content for this product:

Product: ${product.title}
Price: $${product.price}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'Unknown'}
Description: ${product.description || 'No description available'}

Generate:
1. Ad headline (max 40 characters)
2. Ad copy (max 125 characters)
3. Call-to-action button text
4. Target audience suggestions
5. Ad platform recommendations
6. Visual direction suggestions

Platform: ${options.platform || 'Facebook/Instagram'}
Target audience: ${options.targetAudience || 'General consumers'}
Campaign objective: ${options.objective || 'Conversions'}
Budget: ${options.budget || 'Medium'}

Make it compelling and conversion-focused.
        `;

        const response = await aiService.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 600,
            temperature: 0.7
        });

        return {
            title: `AI-Generated Ad Creative for ${product.title}`,
            description: `Ad creative content for ${product.title}`,
            content: {
                headline: this._extractAdHeadline(response.text),
                adCopy: this._extractAdCopy(response.text),
                callToAction: this._extractCallToAction(response.text),
                targetAudience: this._extractTargetAudience(response.text),
                platformRecommendations: this._extractPlatformRecommendations(response.text),
                visualDirection: this._extractVisualDirection(response.text),
                fullResponse: response.text
            },
            aiModel: 'mistralai/Mistral-7B-Instruct-v0.1'
        };
    }

    // Generate product description
    async _generateProductDescription(product, options) {
        const prompt = `
Create an enhanced product description for this product:

Product: ${product.title}
Current Price: $${product.price}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'Unknown'}
Current Description: ${product.description || 'No description available'}

Generate:
1. Enhanced product title (SEO-optimized)
2. Compelling product description (200-300 words)
3. Key features and benefits
4. Target audience
5. Use cases/scenarios
6. SEO keywords

Tone: ${options.tone || 'Professional but engaging'}
Target audience: ${options.targetAudience || 'General consumers'}
Focus: ${options.focus || 'Benefits and features'}

Make it compelling, SEO-friendly, and conversion-focused.
        `;

        const response = await aiService.generateText(prompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 800,
            temperature: 0.7
        });

        return {
            title: `AI-Generated Product Description for ${product.title}`,
            description: `Enhanced product description for ${product.title}`,
            content: {
                enhancedTitle: this._extractEnhancedTitle(response.text),
                description: this._extractDescription(response.text),
                features: this._extractFeatures(response.text),
                targetAudience: this._extractTargetAudience(response.text),
                useCases: this._extractUseCases(response.text),
                seoKeywords: this._extractSEOKeywords(response.text),
                fullResponse: response.text
            },
            aiModel: 'mistralai/Mistral-7B-Instruct-v0.1'
        };
    }

    // Helper methods to extract content from AI responses
    _extractHeadline(response) {
        const match = response.match(/headline[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Amazing Product Launch!';
    }

    _extractPostCopy(response) {
        const match = response.match(/post copy[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Check out this amazing product!';
    }

    _extractHashtags(response) {
        const match = response.match(/hashtags[:\s]+([^\n]+)/i);
        return match ? match[1].trim().split(',').map(h => h.trim()) : ['#product', '#launch'];
    }

    _extractCallToAction(response) {
        const match = response.match(/call.?to.?action[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Shop Now';
    }

    _extractSubjectLine(response) {
        const match = response.match(/subject line[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Amazing Product Launch!';
    }

    _extractPreheader(response) {
        const match = response.match(/preheader[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Don\'t miss this amazing offer!';
    }

    _extractEmailBody(response) {
        const match = response.match(/email body[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim() : 'Amazing product content here!';
    }

    _extractFollowUpIdeas(response) {
        const match = response.match(/follow.?up[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['Follow-up email 1', 'Follow-up email 2'];
    }

    _extractHeroHeadline(response) {
        const match = response.match(/hero headline[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Amazing Product Launch!';
    }

    _extractSubheadline(response) {
        const match = response.match(/subheadline[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Don\'t miss this amazing offer!';
    }

    _extractBenefits(response) {
        const match = response.match(/benefits[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['Benefit 1', 'Benefit 2'];
    }

    _extractFeatures(response) {
        const match = response.match(/features[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['Feature 1', 'Feature 2'];
    }

    _extractSocialProof(response) {
        const match = response.match(/social proof[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['Social proof idea 1', 'Social proof idea 2'];
    }

    _extractFAQ(response) {
        const match = response.match(/FAQ[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['FAQ 1', 'FAQ 2'];
    }

    _extractAdHeadline(response) {
        const match = response.match(/ad headline[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Amazing Product!';
    }

    _extractAdCopy(response) {
        const match = response.match(/ad copy[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Check out this amazing product!';
    }

    _extractTargetAudience(response) {
        const match = response.match(/target audience[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'General consumers';
    }

    _extractPlatformRecommendations(response) {
        const match = response.match(/platform[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Facebook, Instagram';
    }

    _extractVisualDirection(response) {
        const match = response.match(/visual[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Clean and modern';
    }

    _extractEnhancedTitle(response) {
        const match = response.match(/enhanced title[:\s]+([^\n]+)/i);
        return match ? match[1].trim() : 'Amazing Product';
    }

    _extractDescription(response) {
        const match = response.match(/description[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim() : 'Amazing product description here!';
    }

    _extractUseCases(response) {
        const match = response.match(/use cases[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
        return match ? match[1].trim().split('\n').filter(line => line.trim()) : ['Use case 1', 'Use case 2'];
    }

    _extractSEOKeywords(response) {
        const match = response.match(/keywords[:\s]+([^\n]+)/i);
        return match ? match[1].trim().split(',').map(k => k.trim()) : ['product', 'launch'];
    }

    // Get all launches for a product
    async getProductLaunches(productId) {
        try {
            const launches = await prisma.launch.findMany({
                where: { productId },
                orderBy: { createdAt: 'desc' }
            });

            return launches;
        } catch (error) {
            logger.error('Error getting product launches:', error);
            throw error;
        }
    }

    // Get launch by ID
    async getLaunch(launchId) {
        try {
            const launch = await prisma.launch.findUnique({
                where: { id: launchId },
                include: {
                    product: true
                }
            });

            return launch;
        } catch (error) {
            logger.error('Error getting launch:', error);
            throw error;
        }
    }
}

export const aiLaunchService = new AILaunchService();