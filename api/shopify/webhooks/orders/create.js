import { shopifyService } from '../../../src/services/shopify.js'
import { prisma } from '../../../src/db.js'
import { logger } from '../../../src/utils/logger.js'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const shopifyOrder = req.body

        // Debug: Log the webhook payload
        logger.info(`Webhook: Order created - ${shopifyOrder && shopifyOrder.id ? shopifyOrder.id : 'NO_ID'}`)
        logger.info(`Webhook payload: ${JSON.stringify(shopifyOrder, null, 2)}`)
        logger.info(`Webhook payload keys: ${shopifyOrder ? Object.keys(shopifyOrder).join(', ') : 'NO_BODY'}`)

        if (!shopifyOrder || !shopifyOrder.id) {
            logger.error('Invalid webhook payload - missing order ID')
            return res.status(400).send('Invalid webhook payload')
        }

        // Find store by domain (try multiple possible field names)
        const shopDomain = shopifyOrder.shop_domain || shopifyOrder.domain
        logger.info(`Shop domain from webhook: ${shopDomain || 'NOT_FOUND'}`)

        const store = await prisma.store.findFirst({
            where: {
                domain: shopDomain,
                platform: 'SHOPIFY'
            }
        })

        if (!store) {
            logger.error(`Store not found for domain: ${shopDomain}`)
            logger.error(`Available domains: austus-themes.myshopify.com, your-store.myshopify.com`)

            // Try to find any Shopify store as fallback
            const fallbackStore = await prisma.store.findFirst({
                where: { platform: 'SHOPIFY' }
            })

            if (fallbackStore) {
                logger.info(`Using fallback store: ${fallbackStore.domain}`)
                const order = await shopifyService.syncOrder(fallbackStore.id, shopifyOrder.id)
                logger.info(`Synced new order: ${order.id}`)
                res.status(200).send('OK')
                return
            }

            return res.status(404).send('Store not found')
        }

        // Sync the new order
        const order = await shopifyService.syncOrder(store.id, shopifyOrder.id)

        logger.info(`Synced new order: ${order.id}`)
        res.status(200).send('OK')
    } catch (error) {
        logger.error('Error handling order creation webhook:', error)
        logger.error('Error stack:', error.stack)
        res.status(500).send('Error')
    }
}