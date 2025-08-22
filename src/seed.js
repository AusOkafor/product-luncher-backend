import { prisma } from './db.js';
import { logger } from './utils/logger.js';

async function main() {
    logger.info('Starting database seeding...');

    try {
        // Create a demo workspace
        const workspace = await prisma.workspace.upsert({
            where: { id: 'demo-workspace' },
            update: {},
            create: {
                id: 'demo-workspace',
                name: 'Demo Workspace',
                slug: 'demo-workspace',
                plan: 'STARTER',
                ownerId: 'demo-user',
            },
        });

        // Create a demo user
        const user = await prisma.user.upsert({
            where: { id: 'demo-user' },
            update: {},
            create: {
                id: 'demo-user',
                email: 'demo@example.com',
                passwordHash: 'demo-hash',
                role: 'ADMIN',
                isActive: true,
            },
        });

        // Create workspace member
        await prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: user.id,
                }
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: user.id,
                role: 'OWNER',
            },
        });

        // Create a demo store
        const store = await prisma.store.upsert({
            where: { id: 'demo-store' },
            update: {},
            create: {
                id: 'demo-store',
                name: 'Demo Store',
                workspaceId: workspace.id,
                platform: 'SHOPIFY',
                domain: 'demo-store.myshopify.com',
                status: 'ACTIVE',
            },
        });

        // Create a demo product
        const product = await prisma.product.upsert({
            where: { id: 'demo-product' },
            update: {},
            create: {
                id: 'demo-product',
                storeId: store.id,
                title: 'Demo Product',
                description: 'This is a demo product for testing',
                category: 'Electronics',
                brand: 'Demo Brand',
                price: 99.99,
                sku: 'DEMO-001',
                images: ['https://example.com/image1.jpg'],
                attributes: {
                    color: 'Black',
                    size: 'Medium',
                },
            },
        });

        logger.info('Database seeded successfully!');
        logger.info('Demo data created:');
        logger.info(`- Workspace: ${workspace.name}`);
        logger.info(`- User: ${user.email}`);
        logger.info(`- Store: ${store.domain}`);
        logger.info(`- Product: ${product.title}`);

    } catch (error) {
        logger.error('Error seeding database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    });