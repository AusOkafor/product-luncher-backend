import { prisma } from '../db.js';
import { aiLaunchService } from '../services/aiLaunchService.js';
import { aiService } from '../services/ai.js';
import { analyticsService } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

async function testAILaunch() {
    try {
        console.log('🚀 Testing AI Product Launch with Real Data...\n');

        // Initialize AI service first
        console.log('🔧 Initializing AI service...');
        await aiService.initialize();
        console.log('✅ AI service initialized\n');

        // Get a real product from the database
        const product = await prisma.product.findFirst({
            where: {
                store: {
                    domain: 'austus-themes.myshopify.com'
                }
            },
            include: {
                store: true,
                variants: true
            }
        });

        if (!product) {
            console.log('❌ No products found. Run sync:products first.');
            return;
        }

        console.log(`📦 Selected Product: ${product.title}`);
        console.log(`   Price: $${product.price}`);
        console.log(`   Category: ${product.category || 'N/A'}`);
        console.log(`   Brand: ${product.brand || 'N/A'}`);
        console.log(`   Variants: ${product.variants.length}`);
        console.log('');

        // Test different launch types
        const launchTypes = [
            'social_media',
            'email_campaign',
            'landing_page',
            'ad_creative',
            'product_description'
        ];

        console.log('🎯 Generating AI Launches...\n');

        for (const launchType of launchTypes) {
            try {
                console.log(`📝 Generating ${launchType} launch...`);

                const startTime = Date.now();
                const launch = await aiLaunchService.generateLaunch(product.id, launchType, {
                    targetAudience: 'Fashion-conscious consumers',
                    tone: 'Professional but trendy',
                    platform: 'Instagram'
                });
                const generationTime = Date.now() - startTime;

                console.log(`✅ ${launchType} launch created in ${generationTime}ms`);
                console.log(`   Title: ${launch.title}`);
                console.log(`   Status: ${launch.status}`);
                console.log(`   AI Model: ${launch.metadata.aiModel}`);
                console.log('');

                // Show sample content
                if (launch.content) {
                    console.log('📄 Sample Content:');
                    if (launch.content.headline) {
                        console.log(`   Headline: ${launch.content.headline}`);
                    }
                    if (launch.content.postCopy) {
                        console.log(`   Post Copy: ${launch.content.postCopy}`);
                    }
                    if (launch.content.subjectLine) {
                        console.log(`   Subject Line: ${launch.content.subjectLine}`);
                    }
                    if (launch.content.heroHeadline) {
                        console.log(`   Hero Headline: ${launch.content.heroHeadline}`);
                    }
                    if (launch.content.hashtags) {
                        console.log(`   Hashtags: ${launch.content.hashtags.join(', ')}`);
                    }
                    console.log('');
                }

            } catch (error) {
                console.error(`❌ Error generating ${launchType} launch:`, error.message);
                console.log('');
            }
        }

        // Test analytics tracking
        console.log('📊 Testing Analytics...\n');

        // Track a product view
        await analyticsService.trackProductView(product.id, 'test-user-123', 'test-session-456');
        console.log('✅ Product view tracked');

        // Get product analytics
        const analytics = await analyticsService.getProductAnalytics(product.id, '7d');
        console.log('✅ Product analytics retrieved');
        console.log(`   Views: ${analytics.views}`);
        console.log(`   Launches: ${analytics.launches}`);
        console.log(`   Conversions: ${analytics.conversions}`);
        console.log(`   Revenue: $${analytics.revenue}`);
        console.log('');

        // Get store analytics
        const storeAnalytics = await analyticsService.getStoreAnalytics(product.store.id, '7d');
        console.log('✅ Store analytics retrieved');
        console.log(`   Total Products: ${storeAnalytics.totalProducts}`);
        console.log(`   Total Launches: ${storeAnalytics.totalLaunches}`);
        console.log(`   Total Views: ${storeAnalytics.totalViews}`);
        console.log(`   Total Revenue: $${storeAnalytics.totalRevenue}`);
        console.log('');

        // Show top products
        if (storeAnalytics.topProducts.length > 0) {
            console.log('🏆 Top Performing Products:');
            storeAnalytics.topProducts.slice(0, 5).forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.title} - $${product.revenue} revenue`);
            });
            console.log('');
        }

        console.log('🎉 AI Launch Testing Complete!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('   1. View launches in Prisma Studio: npm run db:studio');
        console.log('   2. Test API endpoints with curl or Postman');
        console.log('   3. Build frontend dashboard to display launches');
        console.log('   4. Set up webhooks for real-time updates');

    } catch (error) {
        console.error('❌ Test failed:', error);
        logger.error('AI launch test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testAILaunch();