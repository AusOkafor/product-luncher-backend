import { logger } from '../utils/logger.js';

logger.info('🔍 Testing Webhook Endpoint');
logger.info('📋 This will test if the webhook endpoint is accessible');

// Test the webhook endpoint
async function testWebhookEndpoint() {
    try {
        const response = await fetch('http://localhost:3000/api/shopify/webhooks/orders/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: 'test123',
                shop_domain: 'austus-themes.myshopify.com'
            })
        });

        logger.info(`✅ Webhook endpoint response: ${response.status}`);
        const text = await response.text();
        logger.info(`📄 Response body: ${text}`);

    } catch (error) {
        logger.error(`❌ Error testing webhook endpoint: ${error.message}`);
    }
}

// Test a simple GET request to the shopify routes
async function testShopifyRoutes() {
    try {
        const response = await fetch('http://localhost:3000/api/shopify/stores');
        logger.info(`✅ Shopify routes response: ${response.status}`);
        const data = await response.json();
        logger.info(`📄 Stores: ${JSON.stringify(data, null, 2)}`);

    } catch (error) {
        logger.error(`❌ Error testing shopify routes: ${error.message}`);
    }
}

// Test the health endpoint
async function testHealthEndpoint() {
    try {
        const response = await fetch('http://localhost:3000/health');
        logger.info(`✅ Health endpoint response: ${response.status}`);
        const data = await response.json();
        logger.info(`📄 Health: ${JSON.stringify(data, null, 2)}`);

    } catch (error) {
        logger.error(`❌ Error testing health endpoint: ${error.message}`);
    }
}

async function runTests() {
    logger.info('🏥 Testing Health Endpoint...');
    await testHealthEndpoint();

    logger.info('');
    logger.info('🏪 Testing Shopify Routes...');
    await testShopifyRoutes();

    logger.info('');
    logger.info('🔗 Testing Webhook Endpoint...');
    await testWebhookEndpoint();

    logger.info('');
    logger.info('🎯 Test Complete!');
}

runTests();