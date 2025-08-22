import { prisma } from '../db.js';

async function getStoreId() {
    try {
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                accessToken: { not: null }
            }
        });

        if (store) {
            console.log(`Store ID: ${store.id}`);
            console.log(`Store Name: ${store.name}`);
            console.log(`Store Domain: ${store.domain}`);
        } else {
            console.log('No store found with access token');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

getStoreId();