import { User } from '@/types';

/**
 * 权限检查工具函数
 */
export const PermissionUtils = {
  /**
   * 检查用户是否为管理员
   */
  isAdmin: (user: User | null): boolean => {
    return user?.role === 'admin';
  },

  /**
   * 检查用户是否为操作员
   */
  isOperator: (user: User | null): boolean => {
    return user?.role === 'operator';
  },

  /**
   * 检查用户是否为联络员
   */
  isLiaison: (user: User | null): boolean => {
    return user?.role === 'liaison';
  },

  /**
   * 检查用户是否有管理员或操作员权限
   */
  isAdminOrOperator: (user: User | null): boolean => {
    return user?.role === 'admin' || user?.role === 'operator';
  },

  /**
   * 检查用户是否可以访问部门管理功能
   */
  canAccessDepartmentManagement: (user: User | null): boolean => {
    return PermissionUtils.isAdmin(user);
  },

  /**
   * 检查用户是否可以访问提醒设置功能
   */
  canAccessReminderSettings: (user: User | null): boolean => {
    return PermissionUtils.isAdmin(user);
  },

  /**
   * 检查用户是否可以创建/编辑人员
   */
  canManagePersons: (user: User | null): boolean => {
    return PermissionUtils.isAdminOrOperator(user);
  },

  /**
   * 检查用户是否可以删除人员
   */
  canDeletePersons: (user: User | null): boolean => {
    return PermissionUtils.isAdmin(user);
  },

  /**
   * 检查用户是否可以管理用户账号
   */
  canManageUsers: (user: User | null): boolean => {
    return PermissionUtils.isAdmin(user);
  },

  /**
   * 检查操作员是否应该隐藏首页内容
   */
  shouldHideDashboard: (user: User | null): boolean => {
    return PermissionUtils.isOperator(user);
  },

  /**
   * 获取用户角色的中文显示名称
   */
  getRoleDisplayName: (role: string): string => {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'operator':
        return '操作员';
      case 'liaison':
        return '联络员';
      default:
        return '未知角色';
    }
  },

  /**
   * 获取用户权限描述
   */
  getPermissionDescription: (user: User | null): string => {
    if (!user) return '未登录';
    
    switch (user.role) {
      case 'admin':
        return '可以访问所有功能，管理部门结构和系统设置';
      case 'operator':
        return '可以管理本部门及下属部门的人员信息';
      case 'liaison':
        return '可以查看本部门及下属部门的人员信息，添加联系记录';
      default:
        return '权限未知';
    }
  },
};
