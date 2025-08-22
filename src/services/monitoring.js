import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { logger } from '../utils/logger.js';

class MonitoringService {
    constructor() {
        this.sentryInitialized = false;
        this.posthog = null;
    }

    async initialize() {
        try {
            // Initialize Sentry
            if (process.env.SENTRY_DSN) {
                Sentry.init({
                    dsn: process.env.SENTRY_DSN,
                    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
                    integrations: [],
                    tracesSampleRate: 1.0,
                    profilesSampleRate: 1.0,
                });
                this.sentryInitialized = true;
                logger.info('Sentry initialized successfully');
            } else {
                logger.warn('Sentry DSN not found, error monitoring disabled');
            }

            // Initialize PostHog
            if (process.env.POSTHOG_API_KEY) {
                this.posthog = new PostHog(process.env.POSTHOG_API_KEY, {
                    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
                });
                logger.info('PostHog initialized successfully');
            } else {
                logger.warn('PostHog API key not found, analytics disabled');
            }

            logger.info('Monitoring service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize monitoring service:', error);
            throw error;
        }
    }

    // ========================================
    // SENTRY ERROR MONITORING
    // ========================================

    captureException(error, context = {}) {
        if (!this.sentryInitialized) {
            logger.error('Sentry not initialized, logging error locally:', error);
            return;
        }

        try {
            Sentry.withScope((scope) => {
                // Add context data
                Object.entries(context).forEach(([key, value]) => {
                    scope.setExtra(key, value);
                });

                // Set user context if available
                if (context.user) {
                    scope.setUser({
                        id: context.user.id,
                        email: context.user.email,
                        workspaceId: context.user.workspaceId,
                    });
                }

                // Set tags
                if (context.tags) {
                    Object.entries(context.tags).forEach(([key, value]) => {
                        scope.setTag(key, value);
                    });
                }

                Sentry.captureException(error);
            });
        } catch (sentryError) {
            logger.error('Error capturing exception in Sentry:', sentryError);
        }
    }

    captureMessage(message, level = 'info', context = {}) {
        if (!this.sentryInitialized) {
            logger.log(level, message, context);
            return;
        }

        try {
            Sentry.withScope((scope) => {
                // Add context data
                Object.entries(context).forEach(([key, value]) => {
                    scope.setExtra(key, value);
                });

                // Set user context if available
                if (context.user) {
                    scope.setUser({
                        id: context.user.id,
                        email: context.user.email,
                        workspaceId: context.user.workspaceId,
                    });
                }

                // Set tags
                if (context.tags) {
                    Object.entries(context.tags).forEach(([key, value]) => {
                        scope.setTag(key, value);
                    });
                }

                Sentry.captureMessage(message, level);
            });
        } catch (sentryError) {
            logger.error('Error capturing message in Sentry:', sentryError);
        }
    }

    setUser(user) {
        if (!this.sentryInitialized) return;

        try {
            Sentry.setUser({
                id: user.id,
                email: user.email,
                workspaceId: user.workspaceId,
            });
        } catch (error) {
            logger.error('Error setting Sentry user:', error);
        }
    }

    setTag(key, value) {
        if (!this.sentryInitialized) return;

        try {
            Sentry.setTag(key, value);
        } catch (error) {
            logger.error('Error setting Sentry tag:', error);
        }
    }

    setContext(name, context) {
        if (!this.sentryInitialized) return;

        try {
            Sentry.setContext(name, context);
        } catch (error) {
            logger.error('Error setting Sentry context:', error);
        }
    }

    // ========================================
    // POSTHOG ANALYTICS
    // ========================================

    trackEvent(eventName, properties = {}, userId = null) {
        if (!this.posthog) {
            logger.debug(`PostHog not initialized, event not tracked: ${eventName}`);
            return;
        }

        try {
            if (userId) {
                this.posthog.capture({
                    distinctId: userId,
                    event: eventName,
                    properties,
                });
            } else {
                this.posthog.capture({
                    event: eventName,
                    properties,
                });
            }

            logger.debug(`PostHog event tracked: ${eventName}`);
        } catch (error) {
            logger.error('Error tracking PostHog event:', error);
        }
    }

    identifyUser(userId, properties = {}) {
        if (!this.posthog) {
            logger.debug('PostHog not initialized, user identification skipped');
            return;
        }

        try {
            this.posthog.identify({
                distinctId: userId,
                properties,
            });

            logger.debug(`PostHog user identified: ${userId}`);
        } catch (error) {
            logger.error('Error identifying PostHog user:', error);
        }
    }

    setUserProperties(userId, properties) {
        if (!this.posthog) {
            logger.debug('PostHog not initialized, user properties not set');
            return;
        }

        try {
            this.posthog.set({
                distinctId: userId,
                properties,
            });

            logger.debug(`PostHog user properties set for: ${userId}`);
        } catch (error) {
            logger.error('Error setting PostHog user properties:', error);
        }
    }

    // ========================================
    // BUSINESS EVENT TRACKING
    // ========================================

    trackUserSignup(user) {
        this.trackEvent('user_signed_up', {
            userId: user.id,
            email: user.email,
            workspaceId: user.workspaceId,
            signupMethod: 'email',
        }, user.id);

        this.identifyUser(user.id, {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            workspaceId: user.workspaceId,
        });
    }

    trackWorkspaceCreated(workspace, user) {
        this.trackEvent('workspace_created', {
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            plan: workspace.plan,
            userId: user.id,
        }, user.id);
    }

    trackStoreConnected(store, user) {
        this.trackEvent('store_connected', {
            storeId: store.id,
            storeName: store.name,
            platform: store.platform,
            workspaceId: store.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackLaunchCreated(launch, user) {
        this.trackEvent('launch_created', {
            launchId: launch.id,
            launchName: launch.name,
            productId: launch.productId,
            workspaceId: launch.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackLaunchCompleted(launch, user) {
        this.trackEvent('launch_completed', {
            launchId: launch.id,
            launchName: launch.name,
            productId: launch.productId,
            workspaceId: launch.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackAdCreativeGenerated(creative, user) {
        this.trackEvent('ad_creative_generated', {
            creativeId: creative.id,
            platform: creative.platform,
            launchId: creative.launchId,
            workspaceId: creative.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackMessageSent(message, user) {
        this.trackEvent('message_sent', {
            messageId: message.id,
            channel: message.channel,
            direction: message.direction,
            workspaceId: message.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackSubscriptionCreated(subscription, user) {
        this.trackEvent('subscription_created', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            workspaceId: subscription.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackSubscriptionCancelled(subscription, user) {
        this.trackEvent('subscription_cancelled', {
            subscriptionId: subscription.id,
            plan: subscription.plan,
            workspaceId: subscription.workspaceId,
            userId: user.id,
        }, user.id);
    }

    trackFeatureUsage(feature, user, workspaceId) {
        this.trackEvent('feature_used', {
            feature,
            workspaceId,
            userId: user.id,
            timestamp: new Date().toISOString(),
        }, user.id);
    }

    // ========================================
    // PERFORMANCE MONITORING
    // ========================================

    startTransaction(name, operation = 'default') {
        if (!this.sentryInitialized) {
            return {
                finish: () => {},
                setTag: () => {},
                setData: () => {},
            };
        }

        try {
            return Sentry.startTransaction({
                name,
                op: operation,
            });
        } catch (error) {
            logger.error('Error starting Sentry transaction:', error);
            return {
                finish: () => {},
                setTag: () => {},
                setData: () => {},
            };
        }
    }

    // ========================================
    // HEALTH CHECKS
    // ========================================

    async healthCheck() {
        const health = {
            sentry: this.sentryInitialized,
            posthog: !!this.posthog,
            timestamp: new Date().toISOString(),
        };

        // Test Sentry if initialized
        if (this.sentryInitialized) {
            try {
                this.captureMessage('Health check test', 'info');
                health.sentryStatus = 'healthy';
            } catch (error) {
                health.sentryStatus = 'error';
                health.sentryError = error.message;
            }
        }

        // Test PostHog if initialized
        if (this.posthog) {
            try {
                this.trackEvent('health_check', { timestamp: new Date().toISOString() });
                health.posthogStatus = 'healthy';
            } catch (error) {
                health.posthogStatus = 'error';
                health.posthogError = error.message;
            }
        }

        return health;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    getSentryClient() {
        return this.sentryInitialized ? Sentry : null;
    }

    getPostHogClient() {
        return this.posthog;
    }

    isInitialized() {
        return {
            sentry: this.sentryInitialized,
            posthog: !!this.posthog,
        };
    }
}

export const monitoringService = new MonitoringService();