import { logger } from '../utils/logger.js';

logger.info('🔍 Debugging Webhook Route');
logger.info('📋 Testing webhook endpoint step by step');

// Test the webhook endpoint with detailed error handling
async function testWebhookEndpoint() {
    try {
        logger.info('🔗 Testing webhook endpoint...');

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

        logger.info(`✅ Response status: ${response.status}`);
        const text = await response.text();
        logger.info(`📄 Response body: ${text}`);

    } catch (error) {
        logger.error(`❌ Fetch error: ${error.message}`);
        logger.error(`❌ Error type: ${error.constructor.name}`);

        if (error.cause) {
            logger.error(`❌ Error cause: ${error.cause.message}`);
        }
    }
}

// Test a simple GET request to the same route
async function testWebhookGet() {
    try {
        logger.info('🔗 Testing webhook endpoint with GET...');

        const response = await fetch('http://localhost:3000/api/shopify/webhooks/orders/create', {
            method: 'GET'
        });

        logger.info(`✅ GET Response status: ${response.status}`);
        const text = await response.text();
        logger.info(`📄 GET Response body: ${text}`);

    } catch (error) {
        logger.error(`❌ GET Fetch error: ${error.message}`);
    }
}

// Test the base webhook path
async function testWebhookBase() {
    try {
        logger.info('🔗 Testing webhook base path...');

        const response = await fetch('http://localhost:3000/api/shopify/webhooks', {
            method: 'GET'
        });

        logger.info(`✅ Base Response status: ${response.status}`);
        const text = await response.text();
        logger.info(`📄 Base Response body: ${text}`);

    } catch (error) {
        logger.error(`❌ Base Fetch error: ${error.message}`);
    }
}

async function runTests() {
    logger.info('🏥 Testing webhook base path...');
    await testWebhookBase();

    logger.info('');
    logger.info('🔗 Testing webhook endpoint with GET...');
    await testWebhookGet();

    logger.info('');
    logger.info('🔗 Testing webhook endpoint with POST...');
    await testWebhookEndpoint();

    logger.info('');
    logger.info('🎯 Debug Complete!');
}

runTests();