import { Router } from 'express';
import { login, refresh, logout, logoutAll, me } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const loginSchema = {
  body: z.object({
    username: z.string().min(1, 'Username is required').optional(),
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(1, 'Password is required'),
  }).refine(
    (data) => data.username || data.email,
    { message: 'Either username or email is required' }
  ),
};

const refreshSchema = {
  body: z.object({
    // Accept token from body OR rely on httpOnly cookie (both are valid)
    refreshToken: z.string().min(1).optional(),
  }),
};

const logoutSchema = {
  body: z.object({
    refreshToken: z.string().optional(),
  }),
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
router.post('/login', validateRequest(loginSchema), login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', validateRequest(refreshSchema), refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and revoke tokens
 * @access  Private
 */
router.post('/logout', authenticate, validateRequest(logoutSchema), logout);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post('/logout-all', authenticate, logoutAll);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authenticate, me);

export default router;
