/**
 * 认证事件管理器
 * 用于在应用中传递认证状态变化事件
 */

type AuthEventListener = () => void;

class AuthEventManager {
  private listeners: AuthEventListener[] = [];

  /**
   * 添加认证状态变化监听器
   */
  addListener(listener: AuthEventListener): () => void {
    this.listeners.push(listener);
    
    // 返回移除监听器的函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 触发认证状态变化事件
   */
  emit(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Auth event listener error:', error);
      }
    });
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(): void {
    this.listeners = [];
  }
}

// 导出单例实例
export const authEvents = new AuthEventManager();

/**
 * 便捷的Hook用于监听认证状态变化
 */
export const useAuthEvents = (callback: AuthEventListener): void => {
  React.useEffect(() => {
    const removeListener = authEvents.addListener(callback);
    return removeListener;
  }, [callback]);
};

// 为了避免React导入问题，我们需要在使用时导入React
import React from 'react';
