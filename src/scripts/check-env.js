import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('🔍 Checking Environment Variables...\n')

const envVars = [
    'TOGETHER_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'DATABASE_URL',
    'SHOPIFY_STORE_DOMAIN',
    'SHOPIFY_ACCESS_TOKEN'
]

envVars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
        // Mask the API key for security
        const maskedValue = varName.includes('API_KEY') || varName.includes('TOKEN') ?
            value.substring(0, 8) + '...' + value.substring(value.length - 4) :
            value
        console.log(`✅ ${varName}: ${maskedValue}`)
    } else {
        console.log(`❌ ${varName}: NOT SET`)
    }
})

console.log('\n📋 Environment check complete!')