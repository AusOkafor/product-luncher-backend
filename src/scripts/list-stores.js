import { prisma } from '../db.js';

async function listStores() {
    try {
        console.log('📋 Listing all stores in database...\n');

        const stores = await prisma.store.findMany({
            include: {
                workspace: {
                    select: { name: true, slug: true }
                }
            }
        });

        console.log(`Found ${stores.length} stores:\n`);

        stores.forEach((store, index) => {
            console.log(`${index + 1}. ${store.name}`);
            console.log(`   Domain: ${store.domain}`);
            console.log(`   Platform: ${store.platform}`);
            console.log(`   Workspace: ${store.workspace.name}`);
            console.log(`   Has Access Token: ${store.accessToken ? 'Yes' : 'No'}`);
            console.log(`   Status: ${store.status}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error listing stores:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listStores();