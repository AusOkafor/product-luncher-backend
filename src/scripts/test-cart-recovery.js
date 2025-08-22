import { prisma } from '../db.js';
import { cartRecoveryService } from '../services/cartRecoveryService.js';
import { logger } from '../utils/logger.js';

async function testCartRecovery() {
    try {
        logger.info('🧪 Testing Cart Recovery AI Agent...');

        // Get a cart with all relations
        const cart = await prisma.cart.findFirst({
            include: {
                customer: true,
                store: {
                    include: {
                        workspace: true
                    }
                }
            }
        });

        if (!cart) {
            logger.error('❌ No carts found in database');
            return;
        }

        logger.info(`📦 Found cart: ${cart.id}`);
        logger.info(`   Customer: ${cart.customer ? cart.customer.firstName : 'No customer'}`);
        logger.info(`   Store: ${cart.store ? cart.store.name : 'No store'}`);
        logger.info(`   Items: ${JSON.stringify(cart.items)}`);
        logger.info(`   Status: ${cart.status}`);

        // Test recovery message generation
        logger.info('\n🎯 Testing recovery message generation...');

        const recoveryMessage = await cartRecoveryService.generateRecoveryMessage(cart, {
            platform: 'whatsapp'
        });

        logger.info('✅ Recovery message generated successfully!');
        logger.info('\n📝 Message:');
        logger.info(recoveryMessage.message);

        // Test incentive generation
        logger.info('\n🎁 Testing incentive generation...');

        const incentive = await cartRecoveryService.generateIncentive(cart);

        logger.info('✅ Incentive generated successfully!');
        logger.info(`   Type: ${incentive.type}`);
        logger.info(`   Value: ${incentive.value}`);
        logger.info(`   Code: ${incentive.code}`);
        logger.info(`   Description: ${incentive.description}`);

        logger.info('\n🎉 Cart Recovery AI Agent is working!');

    } catch (error) {
        logger.error('❌ Error testing cart recovery:', error);
        logger.error('Stack trace:', error.stack);
    }
}

testCartRecovery();