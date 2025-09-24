/**
 * 简洁的存储管理工具
 * 统一管理应用数据存储
 */

import { MMKV } from 'react-native-mmkv';

// 创建存储实例
export const storage = new MMKV({
  id: 'app',
  encryptionKey: 'SafeReach',
});

// 用户数据类型
export interface UserData {
  username: string;
  loginTime: string;
  rememberMe: boolean;
  password?: string; // 记住密码时保存
}

// 存储键名
export const KEYS = {
  USER: 'user',
  SETTINGS: 'settings',
  PERSON_NOTES: 'person_notes_', // 个人备注前缀，后面跟人员ID
} as const;

/**
 * 用户数据操作
 */
export const userStorage = {
  save: (userData: UserData): boolean => {
    try {
      storage.set(KEYS.USER, JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error('保存用户数据失败:', error);
      return false;
    }
  },

  get: (): UserData | null => {
    try {
      const data = storage.getString(KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('获取用户数据失败:', error);
      return null;
    }
  },

  clear: (): boolean => {
    try {
      storage.delete(KEYS.USER);
      return true;
    } catch (error) {
      console.error('清除用户数据失败:', error);
      return false;
    }
  },

  isLoggedIn: (): boolean => {
    return userStorage.get() !== null;
  },

  // 获取当前用户的完整信息（从API）
  getCurrentUser: async () => {
    try {
      const { userService } = await import('@/services/apiServices');
      return await userService.getCurrentUser();
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
      return null;
    }
  },
};

/**
 * 通用存储操作
 */
export const generalStorage = {
  set: (key: string, value: any): boolean => {
    try {
      storage.set(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`存储失败 ${key}:`, error);
      return false;
    }
  },

  get: (key: string): any => {
    try {
      const data = storage.getString(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`读取失败 ${key}:`, error);
      return null;
    }
  },

  delete: (key: string): boolean => {
    try {
      storage.delete(key);
      return true;
    } catch (error) {
      console.error(`删除失败 ${key}:`, error);
      return false;
    }
  },

  clear: (): boolean => {
    try {
      storage.clearAll();
      return true;
    } catch (error) {
      console.error('清空存储失败:', error);
      return false;
    }
  },
};

// 个人备注数据类型
export interface PersonNote {
  personId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 个人备注存储操作
 */
export const personNoteStorage = {
  // 保存个人备注
  save: (personId: string, note: string): boolean => {
    try {
      const noteData: PersonNote = {
        personId,
        note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 如果已存在备注，保留创建时间
      const existing = personNoteStorage.get(personId);
      if (existing) {
        noteData.createdAt = existing.createdAt;
      }

      storage.set(`${KEYS.PERSON_NOTES}${personId}`, JSON.stringify(noteData));
      return true;
    } catch (error) {
      console.error(`保存个人备注失败 ${personId}:`, error);
      return false;
    }
  },

  // 获取个人备注
  get: (personId: string): PersonNote | null => {
    try {
      const data = storage.getString(`${KEYS.PERSON_NOTES}${personId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`获取个人备注失败 ${personId}:`, error);
      return null;
    }
  },

  // 删除个人备注
  delete: (personId: string): boolean => {
    try {
      storage.delete(`${KEYS.PERSON_NOTES}${personId}`);
      return true;
    } catch (error) {
      console.error(`删除个人备注失败 ${personId}:`, error);
      return false;
    }
  },

  // 检查是否有备注
  hasNote: (personId: string): boolean => {
    const note = personNoteStorage.get(personId);
    return note !== null && note.note.trim().length > 0;
  },

  // 获取所有备注（用于数据管理）
  getAll: (): PersonNote[] => {
    try {
      const allKeys = storage.getAllKeys();
      const noteKeys = allKeys.filter(key => key.startsWith(KEYS.PERSON_NOTES));

      return noteKeys
        .map(key => {
          const data = storage.getString(key);
          return data ? JSON.parse(data) : null;
        })
        .filter(note => note !== null);
    } catch (error) {
      console.error('获取所有个人备注失败:', error);
      return [];
    }
  },
};
