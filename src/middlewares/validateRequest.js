import { validationResult } from 'express-validator'
import { ApiResponse } from '../utils/apiResponse.js'

export const validateRequest = (req, res, next) => {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        return ApiResponse.error(res, 'Validation failed', 400, {
            errors: errors.array()
        })
    }

    next()
}