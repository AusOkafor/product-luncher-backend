import { logger } from '../utils/logger.js';

async function verifyNgrok() {
    try {
        logger.info('🔍 Verifying ngrok setup...');

        const ngrokUrl = 'https://6168d803cd2d.ngrok-free.app';

        logger.info(`🌐 Your ngrok URL: ${ngrokUrl}`);
        logger.info('');
        logger.info('📋 To complete webhook setup:');
        logger.info('');
        logger.info('1️⃣ First, visit this URL in your browser:');
        logger.info(`   ${ngrokUrl}`);
        logger.info('');
        logger.info('2️⃣ You should see an ngrok warning page');
        logger.info('   Click "Visit Site" to accept');
        logger.info('');
        logger.info('3️⃣ Then run this command:');
        logger.info('   npm run setup:ngrok-webhooks');
        logger.info('');
        logger.info('4️⃣ Test webhook by adding a product to cart on your Shopify store');
        logger.info('');
        logger.info('💡 Keep ngrok running in the background!');

        // Test if the URL is accessible
        try {
            const response = await fetch(ngrokUrl);
            logger.info(`✅ ngrok URL is accessible (Status: ${response.status})`);
        } catch (error) {
            logger.warn(`⚠️ ngrok URL test failed: ${error.message}`);
            logger.info('This is normal if you haven\'t visited the URL yet.');
        }

    } catch (error) {
        logger.error('❌ Error verifying ngrok:', error);
    }
}

verifyNgrok();