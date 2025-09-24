import jwt from 'jsonwebtoken';
import { config } from 'dotenv-flow';

config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  departmentId?: string;
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'safereach-api',
    audience: 'safereach-app',
  } as jwt.SignOptions);
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'safereach-api',
      audience: 'safereach-app',
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    console.error('JWT 验证失败:', error);
    return null;
  }
}

/**
 * 从 Authorization header 中提取 token
 */
export function extractTokenFromHeader(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
