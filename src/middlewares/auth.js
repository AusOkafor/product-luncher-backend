import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return ApiResponse.error(res, 'Access token required', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                workspaces: {
                    where: { workspaceId: decoded.workspaceId },
                    include: {
                        workspace: true,
                    },
                },
            },
        });

        if (!user || !user.isActive) {
            return ApiResponse.error(res, 'User not found or inactive', 401);
        }

        if (user.workspaces.length === 0) {
            return ApiResponse.error(res, 'User not member of workspace', 403);
        }

        // Add user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            workspaceId: decoded.workspaceId,
            role: user.workspaces[0].role,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return ApiResponse.error(res, 'Invalid token', 401);
        }

        console.error('Authentication error:', error);
        return ApiResponse.error(res, 'Authentication failed', 500);
    }
};

export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return ApiResponse.error(res, 'Authentication required', 401);
        }

        if (!roles.includes(req.user.role)) {
            return ApiResponse.error(res, 'Insufficient permissions', 403);
        }

        next();
    };
};