import CryptoJS from 'crypto-js';

/**
 * 密码加密函数 - 使用 MD5
 * 注意：MD5 不是最安全的加密方式，但为了兼容性使用
 */
export function hashPassword(password: string): string {
  return CryptoJS.MD5(password).toString();
}

/**
 * 验证密码
 */
export function verifyPassword(
  password: string,
  hashedPassword: string,
): boolean {
  return hashPassword(password) === hashedPassword;
}

/**
 * MD5 加密函数（别名，保持兼容性）
 */
export function md5Hash(text: string): string {
  return hashPassword(text);
}

/**
 * 生成随机密码
 */
export function generateRandomPassword(length: number = 12): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  return password;
}
