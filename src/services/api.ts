import { MMKV } from 'react-native-mmkv';
import { API_BASE_URL } from '@/config/api';

// 创建存储实例
const storage = new MMKV({
  id: 'app',
  encryptionKey: 'SafeReach',
});

// 用户数据类型
export interface UserData {
  username: string;
  loginTime: string;
  rememberMe: boolean;
  password?: string;
  token?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API错误类型
export interface ApiError {
  success: false;
  message: string;
  error?: string;
}

// 认证服务
class AuthService {
  private static instance: AuthService;
  private token: string | null = null;

  private constructor() {
    this.loadToken();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private loadToken(): void {
    this.token = storage.getString('auth_token') || null;
  }

  private saveToken(token: string): void {
    this.token = token;
    storage.set('auth_token', token);
  }

  private clearToken(): void {
    this.token = null;
    storage.delete('auth_token');
  }

  public getToken(): string | null {
    return this.token;
  }

  public isAuthenticated(): boolean {
    return this.token !== null;
  }

  // 用户登录
  async login(username: string, password: string): Promise<ApiResponse> {
    try {
      console.log('🚀 开始登录请求:', {
        url: `${API_BASE_URL}/auth/login`,
        username,
        isDev: __DEV__,
      });

      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📡 登录响应状态:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        console.error('❌ HTTP错误:', response.status, response.statusText);
        return {
          success: false,
          message: `服务器错误 (${response.status}): ${response.statusText}`,
        };
      }

      const result = await response.json();
      console.log('📦 登录响应数据:', result);

      if (result.success) {
        this.saveToken(result.data.token);
        // 保存用户数据
        const userData: UserData = {
          username,
          loginTime: new Date().toISOString(),
          rememberMe: false,
          token: result.data.token,
        };
        storage.set('user_data', JSON.stringify(userData));
        console.log('✅ 登录成功，Token已保存');
      }

      return result;
    } catch (error) {
      console.error('❌ 登录请求失败:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        url: `${API_BASE_URL}/auth/login`,
        isDev: __DEV__,
      });

      // 区分不同类型的错误
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: '请求超时，请检查网络连接或稍后重试',
        };
      }

      if (
        error instanceof TypeError &&
        error.message.includes('Network request failed')
      ) {
        return {
          success: false,
          message: '网络连接失败，请检查网络设置或联系管理员',
        };
      }

      return {
        success: false,
        message: `登录失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`,
      };
    }
  }

  // 验证token
  async verifyToken(): Promise<ApiResponse> {
    if (!this.token) {
      return {
        success: false,
        message: '未找到认证令牌',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!result.success) {
        this.clearToken();
      }

      return result;
    } catch (error) {
      console.error('Token验证失败:', error);
      return {
        success: false,
        message: 'Token验证失败',
      };
    }
  }

  // 刷新token
  async refreshToken(): Promise<ApiResponse> {
    if (!this.token) {
      return {
        success: false,
        message: '未找到认证令牌',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        this.saveToken(result.data.token);
      } else {
        this.clearToken();
      }

      return result;
    } catch (error) {
      console.error('Token刷新失败:', error);
      return {
        success: false,
        message: 'Token刷新失败',
      };
    }
  }

  // 登出
  logout(): void {
    this.clearToken();
    storage.delete('user_data');
  }
}

// API请求工具类
class ApiClient {
  private authService: AuthService;

  constructor() {
    this.authService = AuthService.getInstance();
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = this.authService.getToken();

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const result = await response.json();

      // 如果token过期，尝试刷新
      if (response.status === 401 && result.message?.includes('token')) {
        const refreshResult = await this.authService.refreshToken();
        if (refreshResult.success) {
          // 重新发送请求
          const newToken = this.authService.getToken();
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
              ...defaultHeaders,
              ...options.headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
          return retryResponse.json();
        }
      }

      return result;
    } catch (error) {
      console.error('API请求失败:', error);
      return {
        success: false,
        message: '网络请求失败',
      };
    }
  }

  // GET请求
  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ApiResponse<T>> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params)}`
      : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  // POST请求
  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT请求
  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE请求
  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// 导出单例实例
export const authService = AuthService.getInstance();
export const apiClient = new ApiClient();

// 导出类型
// export type { UserData };
