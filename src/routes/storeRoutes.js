import { Router } from 'express'

const router = Router()

// TODO: Implement store routes
router.get('/', (req, res) => {
    res.json({ message: 'Store routes - to be implemented' })
})

export { router as storeRoutes }