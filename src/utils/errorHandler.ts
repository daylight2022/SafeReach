/**
 * 错误处理工具
 * 统一处理API错误并提供用户友好的提示信息
 */

import { toast } from 'burnt';

// 错误类型枚举
export enum ErrorType {
  NETWORK = 'network',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

// 错误信息映射
const ERROR_MESSAGES = {
  [ErrorType.NETWORK]: '网络连接异常，请检查网络设置后重试',
  [ErrorType.PERMISSION]: '权限不足，无法执行此操作',
  [ErrorType.VALIDATION]: '输入信息有误，请检查后重试',
  [ErrorType.NOT_FOUND]: '请求的资源不存在',
  [ErrorType.SERVER]: '服务器内部错误，请稍后重试',
  [ErrorType.UNKNOWN]: '操作失败，请稍后重试',
};

/**
 * 根据错误信息判断错误类型
 */
export function getErrorType(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN;

  const errorMessage = typeof error === 'string' ? error : error.message || '';
  const lowerMessage = errorMessage.toLowerCase();

  // 网络相关错误
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('网络') ||
    lowerMessage.includes('连接') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('fetch')
  ) {
    return ErrorType.NETWORK;
  }

  // 权限相关错误
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('权限') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('无权限') ||
    lowerMessage.includes('不允许')
  ) {
    return ErrorType.PERMISSION;
  }

  // 验证相关错误
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('验证') ||
    lowerMessage.includes('格式') ||
    lowerMessage.includes('必填') ||
    lowerMessage.includes('不能为空')
  ) {
    return ErrorType.VALIDATION;
  }

  // 资源不存在
  if (
    lowerMessage.includes('not found') ||
    lowerMessage.includes('不存在') ||
    lowerMessage.includes('未找到')
  ) {
    return ErrorType.NOT_FOUND;
  }

  // 服务器错误
  if (
    lowerMessage.includes('server') ||
    lowerMessage.includes('internal') ||
    lowerMessage.includes('服务器') ||
    lowerMessage.includes('500') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503')
  ) {
    return ErrorType.SERVER;
  }

  return ErrorType.UNKNOWN;
}

/**
 * 获取用户友好的错误信息
 */
export function getUserFriendlyMessage(error: any): string {
  if (!error) return ERROR_MESSAGES[ErrorType.UNKNOWN];

  // 如果是API响应错误，优先使用API返回的消息
  if (typeof error === 'object' && error.message) {
    return error.message;
  }

  // 如果是字符串错误，直接返回
  if (typeof error === 'string') {
    return error;
  }

  // 根据错误类型返回默认消息
  const errorType = getErrorType(error);
  return ERROR_MESSAGES[errorType];
}

/**
 * 显示成功提示
 */
export function showSuccessToast(title: string, message?: string) {
  toast({
    title,
    message,
    preset: 'done',
    duration: 2,
  });
}

/**
 * 显示错误提示
 */
export function showErrorToast(title: string, error: any) {
  const errorType = getErrorType(error);
  const message = getUserFriendlyMessage(error);

  toast({
    title,
    message,
    preset: 'error',
    duration: errorType === ErrorType.NETWORK ? 4 : 3,
  });
}

/**
 * 显示警告提示
 */
export function showWarningToast(title: string, message?: string) {
  toast({
    title,
    message,
    preset: 'error', // burnt库没有warning类型，使用error
    duration: 3,
  });
}

/**
 * 显示信息提示
 */
export function showInfoToast(title: string, message?: string) {
  toast({
    title,
    message,
    preset: 'done',
    duration: 2,
  });
}

/**
 * 处理API响应结果
 */
export function handleApiResponse(
  result: any,
  successTitle: string,
  errorTitle: string,
  successMessage?: string,
): boolean {
  if (result.success) {
    showSuccessToast(successTitle, successMessage);
    return true;
  } else {
    showErrorToast(errorTitle, result.message || result);
    return false;
  }
}

/**
 * 显示加载提示
 */
export function showLoadingToast(message: string = '加载中...') {
  toast({
    title: message,
    preset: 'done',
    duration: 1,
  });
}

/**
 * 显示操作确认提示
 */
export function showConfirmationToast(message: string) {
  toast({
    title: message,
    preset: 'done',
    duration: 1.5,
  });
}

/**
 * 根据操作类型显示相应的成功提示
 */
export function showOperationSuccessToast(
  operation: 'create' | 'update' | 'delete' | 'contact',
  itemName?: string,
) {
  const messages = {
    create: {
      title: '创建成功',
      message: itemName ? `${itemName}已成功创建` : '新项目已成功添加到系统',
    },
    update: {
      title: '更新成功',
      message: itemName ? `${itemName}信息已更新` : '信息已成功更新',
    },
    delete: {
      title: '删除成功',
      message: itemName ? `${itemName}已从系统中移除` : '项目已成功删除',
    },
    contact: { title: '联系成功', message: '已记录本次联系' },
  };

  const { title, message } = messages[operation];
  showSuccessToast(title, message);
}

/**
 * 根据操作类型显示相应的失败提示
 */
export function showOperationErrorToast(
  operation: 'create' | 'update' | 'delete' | 'contact' | 'load',
  error: any,
  itemName?: string,
) {
  const titles = {
    create: '创建失败',
    update: '更新失败',
    delete: '删除失败',
    contact: '联系失败',
    load: '加载失败',
  };

  showErrorToast(titles[operation], error);
}
