import { aiService } from '../services/ai.js';
import { logger } from '../utils/logger.js';

async function testAIService() {
    try {
        console.log('🤖 Testing AI Service...\n');

        // Initialize AI service
        console.log('🔧 Initializing AI service...');
        await aiService.initialize();
        console.log('✅ AI service initialized');

        // Check available providers
        const providers = aiService.getAvailableProviders();
        console.log(`📋 Available providers: ${providers.join(', ')}`);

        if (providers.length === 0) {
            console.log('❌ No AI providers available. Check your environment variables:');
            console.log('   - TOGETHER_API_KEY');
            console.log('   - OPENAI_API_KEY');
            console.log('   - ANTHROPIC_API_KEY');
            return;
        }

        // Test simple text generation
        console.log('\n🧪 Testing text generation...');
        const testPrompt = 'Write a short product description for a blue t-shirt.';

        const result = await aiService.generateText(testPrompt, {
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            maxTokens: 100,
            temperature: 0.7
        });

        console.log('✅ Text generation successful!');
        console.log(`📝 Generated text: ${result.text}`);
        console.log(`🤖 Provider: ${result.provider}`);
        console.log(`🔧 Model: ${result.model}`);

        // Test product description generation
        console.log('\n📦 Testing product description generation...');
        const productData = {
            title: 'Blue T-Shirt',
            category: 'Clothing',
            brand: 'Fashion Brand',
            price: 25,
            attributes: {
                material: 'Cotton',
                size: 'M',
                color: 'Blue'
            }
        };

        const productDescription = await aiService.generateProductDescription(productData);
        console.log('✅ Product description generated!');
        console.log(`📝 Description: ${productDescription.text}`);

        console.log('\n🎉 AI Service Test Complete!');

    } catch (error) {
        console.error('❌ AI Service test failed:', error);
        logger.error('AI Service test failed:', error);
    }
}

// Run the test
testAIService();