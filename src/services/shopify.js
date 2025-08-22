import Shopify from 'shopify-api-node';
import { logger } from '../utils/logger.js';
import { prisma } from '../db.js';

class ShopifyService {
    constructor() {
        this.clients = new Map(); // Store Shopify clients per workspace
    }

    // Initialize Shopify client for a store
    async initializeClient(store) {
        try {
            if (!store.accessToken) {
                throw new Error('Store access token not found');
            }

            const client = new Shopify({
                shopName: store.domain.replace('.myshopify.com', ''),
                accessToken: store.accessToken,
                apiVersion: '2024-01', // Use latest stable version
            });

            this.clients.set(store.id, client);
            logger.info(`Shopify client initialized for store: ${store.id}`);
            return client;
        } catch (error) {
            logger.error('Error initializing Shopify client:', error);
            throw error;
        }
    }

    // Get or create Shopify client for a store
    async getClient(storeId) {
        if (this.clients.has(storeId)) {
            return this.clients.get(storeId);
        }

        const store = await prisma.store.findUnique({
            where: { id: storeId },
        });

        if (!store) {
            throw new Error(`Store not found: ${storeId}`);
        }

        return await this.initializeClient(store);
    }

    // ========================================
    // PRODUCT OPERATIONS
    // ========================================

    async syncProducts(storeId, limit = 250) {
        try {
            const client = await this.getClient(storeId);
            const syncedProducts = [];

            // Get all products with a higher limit
            const products = await client.product.list({
                limit: limit
            });

            logger.info(`Fetched ${products.length} products from Shopify API`);

            for (const shopifyProduct of products) {
                const product = await this._syncProduct(storeId, shopifyProduct);
                syncedProducts.push(product);
            }

            logger.info(`Synced ${syncedProducts.length} products for store: ${storeId}`);
            return syncedProducts;
        } catch (error) {
            logger.error('Error syncing products:', error);
            throw error;
        }
    }

    async syncProduct(storeId, shopifyProductId) {
        try {
            const client = await this.getClient(storeId);
            const shopifyProduct = await client.product.get(shopifyProductId);

            const product = await this._syncProduct(storeId, shopifyProduct);
            logger.info(`Synced product: ${product.id}`);
            return product;
        } catch (error) {
            logger.error('Error syncing product:', error);
            throw error;
        }
    }

    async _syncProduct(storeId, shopifyProduct) {
        try {
            // Check if product already exists
            const firstVariant = shopifyProduct.variants && shopifyProduct.variants[0];
            const existingProduct = await prisma.product.findFirst({
                where: {
                    storeId,
                    sku: firstVariant && firstVariant.sku || null,
                },
            });

            const productData = {
                storeId,
                title: shopifyProduct.title,
                description: shopifyProduct.body_html,
                category: shopifyProduct.product_type,
                brand: shopifyProduct.vendor,
                price: parseFloat(firstVariant && firstVariant.price || 0),
                sku: firstVariant && firstVariant.sku,
                images: shopifyProduct.images.map(img => img.src),
                attributes: {
                    shopifyId: shopifyProduct.id,
                    handle: shopifyProduct.handle,
                    tags: shopifyProduct.tags,
                    vendor: shopifyProduct.vendor,
                    productType: shopifyProduct.product_type,
                    publishedAt: shopifyProduct.published_at,
                },
                status: shopifyProduct.status === 'active' ? 'ACTIVE' : 'INACTIVE',
            };

            if (existingProduct) {
                // Update existing product
                const updatedProduct = await prisma.product.update({
                    where: { id: existingProduct.id },
                    data: productData,
                });

                // Sync variants
                await this._syncVariants(existingProduct.id, shopifyProduct.variants);
                return updatedProduct;
            } else {
                // Create new product
                const newProduct = await prisma.product.create({
                    data: productData,
                });

                // Sync variants
                await this._syncVariants(newProduct.id, shopifyProduct.variants);
                return newProduct;
            }
        } catch (error) {
            logger.error('Error syncing product to database:', error);
            throw error;
        }
    }

    async _syncVariants(productId, shopifyVariants) {
        try {
            // Delete existing variants
            await prisma.variant.deleteMany({
                where: { productId },
            });

            // Create new variants
            for (const shopifyVariant of shopifyVariants) {
                await prisma.variant.create({
                    data: {
                        productId,
                        options: {
                            title: shopifyVariant.title,
                            sku: shopifyVariant.sku,
                            barcode: shopifyVariant.barcode,
                            weight: shopifyVariant.weight,
                            weightUnit: shopifyVariant.weight_unit,
                        },
                        price: parseFloat(shopifyVariant.price),
                        stock: shopifyVariant.inventory_quantity || 0,
                        sku: shopifyVariant.sku,
                    },
                });
            }
        } catch (error) {
            logger.error('Error syncing variants:', error);
            throw error;
        }
    }

    async createProduct(storeId, productData) {
        try {
            const client = await this.getClient(storeId);

            const shopifyProduct = await client.product.create({
                title: productData.title,
                body_html: productData.description,
                vendor: productData.brand,
                product_type: productData.category,
                tags: productData.tags || [],
                variants: [{
                    price: productData.price.toString(),
                    sku: productData.sku,
                    inventory_quantity: productData.stock || 0,
                }],
                images: productData.images && productData.images.map(url => ({ src: url })) || [],
            });

            // Sync the created product to our database
            const product = await this._syncProduct(storeId, shopifyProduct);
            logger.info(`Created product in Shopify: ${product.id}`);
            return product;
        } catch (error) {
            logger.error('Error creating product in Shopify:', error);
            throw error;
        }
    }

    async updateProduct(storeId, productId, updates) {
        try {
            const client = await this.getClient(storeId);

            // Get the product from our database to get Shopify ID
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            const shopifyId = product.attributes && product.attributes.shopifyId;
            if (!shopifyId) {
                throw new Error('Product not synced with Shopify');
            }

            const shopifyUpdates = {};
            if (updates.title) shopifyUpdates.title = updates.title;
            if (updates.description) shopifyUpdates.body_html = updates.description;
            if (updates.brand) shopifyUpdates.vendor = updates.brand;
            if (updates.category) shopifyUpdates.product_type = updates.category;

            const updatedShopifyProduct = await client.product.update(shopifyId, shopifyUpdates);

            // Sync the updated product to our database
            const updatedProduct = await this._syncProduct(storeId, updatedShopifyProduct);
            logger.info(`Updated product in Shopify: ${productId}`);
            return updatedProduct;
        } catch (error) {
            logger.error('Error updating product in Shopify:', error);
            throw error;
        }
    }

    // ========================================
    // ORDER OPERATIONS
    // ========================================

    async syncOrders(storeId, limit = 50) {
        try {
            const client = await this.getClient(storeId);
            const orders = await client.order.list({ limit, status: 'any' });

            const syncedOrders = [];

            for (const shopifyOrder of orders) {
                const order = await this._syncOrder(storeId, shopifyOrder);
                syncedOrders.push(order);
            }

            logger.info(`Synced ${syncedOrders.length} orders for store: ${storeId}`);
            return syncedOrders;
        } catch (error) {
            logger.error('Error syncing orders:', error);
            throw error;
        }
    }

    async syncOrder(storeId, shopifyOrderId) {
        try {
            const client = await this.getClient(storeId);
            const shopifyOrder = await client.order.get(shopifyOrderId);

            const order = await this._syncOrder(storeId, shopifyOrder);
            logger.info(`Synced order: ${order.id}`);
            return order;
        } catch (error) {
            logger.error('Error syncing order:', error);
            throw error;
        }
    }

    async _syncOrder(storeId, shopifyOrder) {
        try {
            // Check if order already exists
            const existingOrder = await prisma.order.findFirst({
                where: {
                    storeId,
                    metadata: {
                        path: ['shopifyId'],
                        equals: shopifyOrder.id,
                    },
                },
            });

            // Find or create customer
            let customer = null;
            if (shopifyOrder.customer) {
                customer = await this._syncCustomer(storeId, shopifyOrder.customer);
            }

            const orderData = {
                storeId,
                customerId: customer && customer.id,
                items: shopifyOrder.line_items.map(item => ({
                    id: item.id,
                    title: item.title,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    sku: item.sku,
                })),
                total: parseFloat(shopifyOrder.total_price),
                status: this._mapOrderStatus(shopifyOrder.financial_status),
                metadata: {
                    shopifyId: shopifyOrder.id,
                    orderNumber: shopifyOrder.order_number,
                    financialStatus: shopifyOrder.financial_status,
                    fulfillmentStatus: shopifyOrder.fulfillment_status,
                    currency: shopifyOrder.currency,
                    subtotalPrice: shopifyOrder.subtotal_price,
                    totalTax: shopifyOrder.total_tax,
                    totalDiscounts: shopifyOrder.total_discounts,
                },
            };

            if (existingOrder) {
                return await prisma.order.update({
                    where: { id: existingOrder.id },
                    data: orderData,
                });
            } else {
                return await prisma.order.create({
                    data: orderData,
                });
            }
        } catch (error) {
            logger.error('Error syncing order to database:', error);
            throw error;
        }
    }

    async _syncCustomer(storeId, shopifyCustomer) {
        try {
            // Check if customer already exists
            const existingCustomer = await prisma.customer.findFirst({
                where: {
                    storeId,
                    email: shopifyCustomer.email,
                },
            });

            const customerData = {
                storeId,
                email: shopifyCustomer.email,
                firstName: shopifyCustomer.first_name,
                lastName: shopifyCustomer.last_name,
                phone: shopifyCustomer.phone,
                country: shopifyCustomer.default_address && shopifyCustomer.default_address.country,
                traits: {
                    shopifyId: shopifyCustomer.id,
                    totalSpent: shopifyCustomer.total_spent,
                    ordersCount: shopifyCustomer.orders_count,
                    tags: shopifyCustomer.tags,
                    acceptsMarketing: shopifyCustomer.accepts_marketing,
                },
            };

            if (existingCustomer) {
                return await prisma.customer.update({
                    where: { id: existingCustomer.id },
                    data: customerData,
                });
            } else {
                return await prisma.customer.create({
                    data: customerData,
                });
            }
        } catch (error) {
            logger.error('Error syncing customer to database:', error);
            throw error;
        }
    }

    // ========================================
    // INVENTORY OPERATIONS
    // ========================================

    async updateInventory(storeId, productId, variantId, quantity) {
        try {
            const client = await this.getClient(storeId);

            // Get the product from our database to get Shopify IDs
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { variants: true },
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            const shopifyProductId = product.attributes && product.attributes.shopifyId;
            const variant = product.variants.find(v => v.id === variantId);

            if (!shopifyProductId || !variant) {
                throw new Error('Product or variant not synced with Shopify');
            }

            // Update inventory in Shopify
            await client.inventoryLevel.set({
                inventory_item_id: variant.sku, // This should be the inventory item ID
                location_id: 1, // Default location ID
                available: quantity,
            });

            // Update in our database
            await prisma.variant.update({
                where: { id: variantId },
                data: { stock: quantity },
            });

            logger.info(`Updated inventory for variant: ${variantId}`);
        } catch (error) {
            logger.error('Error updating inventory:', error);
            throw error;
        }
    }

    // ========================================
    // WEBHOOK OPERATIONS
    // ========================================

    async setupWebhooks(storeId, webhookUrl) {
        try {
            const client = await this.getClient(storeId);

            const webhooks = [{
                    topic: 'products/create',
                    address: `${webhookUrl}/shopify/products/create`,
                    format: 'json',
                },
                {
                    topic: 'products/update',
                    address: `${webhookUrl}/shopify/products/update`,
                    format: 'json',
                },
                {
                    topic: 'orders/create',
                    address: `${webhookUrl}/shopify/orders/create`,
                    format: 'json',
                },
                {
                    topic: 'orders/updated',
                    address: `${webhookUrl}/shopify/orders/updated`,
                    format: 'json',
                },
                {
                    topic: 'customers/create',
                    address: `${webhookUrl}/shopify/customers/create`,
                    format: 'json',
                },
                {
                    topic: 'customers/update',
                    address: `${webhookUrl}/shopify/customers/update`,
                    format: 'json',
                },
            ];

            for (const webhook of webhooks) {
                try {
                    await client.webhook.create(webhook);
                    logger.info(`Created webhook: ${webhook.topic}`);
                } catch (error) {
                    if (error.statusCode === 422) {
                        logger.warn(`Webhook already exists: ${webhook.topic}`);
                    } else {
                        logger.error(`Error creating webhook ${webhook.topic}:`, error);
                    }
                }
            }
        } catch (error) {
            logger.error('Error setting up webhooks:', error);
            throw error;
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    _mapOrderStatus(shopifyStatus) {
        const statusMap = {
            'pending': 'PENDING',
            'authorized': 'CONFIRMED',
            'paid': 'CONFIRMED',
            'partially_paid': 'CONFIRMED',
            'refunded': 'RETURNED',
            'voided': 'CANCELLED',
            'partially_refunded': 'CONFIRMED',
            'unpaid': 'PENDING',
        };

        return statusMap[shopifyStatus] || 'PENDING';
    }

    async getStoreStats(storeId) {
        try {
            const client = await this.getClient(storeId);

            const [products, orders] = await Promise.all([
                client.product.count(),
                client.order.count(),
            ]);

            return {
                products,
                orders,
                lastSync: new Date().toISOString(),
            };
        } catch (error) {
            logger.error('Error getting store stats:', error);
            throw error;
        }
    }

    async testConnection(storeId) {
        try {
            const client = await this.getClient(storeId);
            const shop = await client.shop.get();

            return {
                connected: true,
                shopName: shop.name,
                shopDomain: shop.domain,
                email: shop.email,
                currency: shop.currency,
            };
        } catch (error) {
            logger.error('Error testing Shopify connection:', error);
            return {
                connected: false,
                error: error.message,
            };
        }
    }
}

export const shopifyService = new ShopifyService();