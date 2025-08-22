import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { validateRequest } from '../middlewares/validateRequest.js'
import { authenticate } from '../middlewares/auth.js'
import { LaunchController } from '../controllers/LaunchController.js'

const router = Router()
const launchController = new LaunchController()

// Apply authentication to all launch routes
router.use(authenticate)

/**
 * @route POST /api/launches
 * @desc Create a new launch
 * @access Private
 */
router.post(
    '/', [
        body('productId').optional().isString(),
        body('productUrl').optional().isURL(),
        body('brandTone').isString().notEmpty(),
        body('targetAudience').isString().notEmpty(),
        body('launchWindow').isString().notEmpty(),
        body('budget').isNumeric().isFloat({ min: 0 }),
        body('platforms').optional().isArray(),
        body('additionalNotes').optional().isString()
    ],
    validateRequest,
    launchController.createLaunch
)

/**
 * @route GET /api/launches
 * @desc Get all launches for workspace
 * @access Private
 */
router.get(
    '/', [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('status').optional().isIn(['DRAFT', 'GENERATING', 'COMPLETED', 'FAILED', 'SCHEDULED'])
    ],
    validateRequest,
    launchController.getLaunches
)

/**
 * @route GET /api/launches/:id
 * @desc Get launch by ID
 * @access Private
 */
router.get(
    '/:id', [
        param('id').isString().notEmpty()
    ],
    validateRequest,
    launchController.getLaunch
)

/**
 * @route POST /api/launches/:id/generate
 * @desc Generate launch assets
 * @access Private
 */
router.post(
    '/:id/generate', [
        param('id').isString().notEmpty()
    ],
    validateRequest,
    launchController.generateLaunch
)

/**
 * @route POST /api/launches/:id/export/:target
 * @desc Export launch to platform
 * @access Private
 */
router.post(
    '/:id/export/:target', [
        param('id').isString().notEmpty(),
        param('target').isIn(['shopify', 'klaviyo', 'meta', 'tiktok'])
    ],
    validateRequest,
    launchController.exportLaunch
)

/**
 * @route GET /api/launches/:id/metrics
 * @desc Get launch metrics
 * @access Private
 */
router.get(
    '/:id/metrics', [
        param('id').isString().notEmpty()
    ],
    validateRequest,
    launchController.getLaunchMetrics
)

/**
 * @route PUT /api/launches/:id
 * @desc Update launch
 * @access Private
 */
router.put(
    '/:id', [
        param('id').isString().notEmpty(),
        body('name').optional().isString(),
        body('inputs').optional().isObject(),
        body('scheduleAt').optional().isISO8601()
    ],
    validateRequest,
    launchController.updateLaunch
)

/**
 * @route DELETE /api/launches/:id
 * @desc Delete launch
 * @access Private
 */
router.delete(
    '/:id', [
        param('id').isString().notEmpty()
    ],
    validateRequest,
    launchController.deleteLaunch
)

export { router as launchRoutes }