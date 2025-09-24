/**
 * 用户私有备注管理工具
 * 使用 MMKV 存储在客户端本地，不与服务器同步
 */

import { storage } from './storage';
import { PersonalNote } from '@/types';

const PERSONAL_NOTES_KEY = 'personal_notes';

/**
 * 获取所有个人备注
 */
export const getAllPersonalNotes = (): Record<string, PersonalNote> => {
  try {
    const notesData = storage.getString(PERSONAL_NOTES_KEY);
    return notesData ? JSON.parse(notesData) : {};
  } catch (error) {
    console.error('获取个人备注失败:', error);
    return {};
  }
};

/**
 * 获取特定人员的个人备注
 */
export const getPersonalNote = (personId: string): PersonalNote | null => {
  try {
    const allNotes = getAllPersonalNotes();
    return allNotes[personId] || null;
  } catch (error) {
    console.error('获取个人备注失败:', error);
    return null;
  }
};

/**
 * 保存或更新个人备注
 */
export const savePersonalNote = (personId: string, note: string): boolean => {
  try {
    const allNotes = getAllPersonalNotes();
    
    allNotes[personId] = {
      personId,
      note,
      updatedAt: new Date().toISOString(),
    };
    
    storage.set(PERSONAL_NOTES_KEY, JSON.stringify(allNotes));
    return true;
  } catch (error) {
    console.error('保存个人备注失败:', error);
    return false;
  }
};

/**
 * 删除个人备注
 */
export const deletePersonalNote = (personId: string): boolean => {
  try {
    const allNotes = getAllPersonalNotes();
    
    if (allNotes[personId]) {
      delete allNotes[personId];
      storage.set(PERSONAL_NOTES_KEY, JSON.stringify(allNotes));
    }
    
    return true;
  } catch (error) {
    console.error('删除个人备注失败:', error);
    return false;
  }
};

/**
 * 清空所有个人备注
 */
export const clearAllPersonalNotes = (): boolean => {
  try {
    storage.delete(PERSONAL_NOTES_KEY);
    return true;
  } catch (error) {
    console.error('清空个人备注失败:', error);
    return false;
  }
};

/**
 * 导出个人备注（用于备份）
 */
export const exportPersonalNotes = (): string => {
  try {
    const allNotes = getAllPersonalNotes();
    return JSON.stringify(allNotes, null, 2);
  } catch (error) {
    console.error('导出个人备注失败:', error);
    return '{}';
  }
};

/**
 * 导入个人备注（用于恢复）
 */
export const importPersonalNotes = (notesJson: string): boolean => {
  try {
    const notes = JSON.parse(notesJson);
    storage.set(PERSONAL_NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error('导入个人备注失败:', error);
    return false;
  }
};
