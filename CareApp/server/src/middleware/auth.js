import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export const signToken = (user) =>
  jwt.sign(user, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

export const requireAuth = (roles = []) => (req, _res, next) => {
  const expectedRoles = Array.isArray(roles) ? roles : [roles];
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    next(new HttpError(401, 'Authentication is required.'));
    return;
  }

  try {
    const user = jwt.verify(token, env.jwtSecret);
    if (expectedRoles.length && !expectedRoles.includes(user.role)) {
      throw new HttpError(403, 'You do not have permission to access this resource.');
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, 'Invalid or expired session.'));
  }
};
