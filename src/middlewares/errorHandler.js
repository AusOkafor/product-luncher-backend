import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (error, req, res, next) => {
    logger.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userId: req.user && req.user.userId,
    });

    // Handle specific error types
    if (error.name === 'ValidationError') {
        return ApiResponse.error(res, 'Validation failed', 400, error.message);
    }

    if (error.name === 'PrismaClientKnownRequestError') {
        return ApiResponse.error(res, 'Database operation failed', 500);
    }

    if (error.name === 'PrismaClientValidationError') {
        return ApiResponse.error(res, 'Invalid data provided', 400);
    }

    // Default error response
    return ApiResponse.error(
        res,
        process.env.NODE_ENV === 'production' ?
        'Internal server error' :
        error.message,
        500
    );
};