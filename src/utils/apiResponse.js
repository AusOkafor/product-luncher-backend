export class ApiResponse {
    static success(res, data, statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    static error(res, message, statusCode = 500, errors) {
        return res.status(statusCode).json({
            success: false,
            error: {
                message,
                statusCode,
                timestamp: new Date().toISOString(),
                ...(errors && { details: errors }),
            },
        });
    }

    static paginated(res, data, pagination) {
        return res.status(200).json({
            success: true,
            data,
            pagination,
            timestamp: new Date().toISOString(),
        });
    }
}