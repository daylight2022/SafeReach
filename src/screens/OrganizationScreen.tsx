import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';
import { Department, User } from '@/types';
import { departmentService, userService } from '@/services/apiServices';
import { PermissionUtils } from '@/utils/permissions';

interface Props {
  navigation: NavigationProp<any>;
}

const OrganizationScreen: React.FC<Props> = ({ navigation }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentTree, setDepartmentTree] = useState<Department[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    code: '',
    description: '',
    parentId: '',
  });

  // 初始化数据
  useEffect(() => {
    initializeData();
  }, []);

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      loadDepartments();
    }, []),
  );

  const initializeData = async () => {
    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
      await loadDepartments();
    } catch (error) {
      console.error('初始化数据失败:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const [listResult, treeResult] = await Promise.all([
        departmentService.getDepartments(),
        departmentService.getDepartmentTree(),
      ]);

      if (listResult.success && listResult.data) {
        setDepartments(Array.isArray(listResult.data) ? listResult.data : []);
      }

      if (treeResult.success && treeResult.data) {
        setDepartmentTree(treeResult.data);
      }
    } catch (error) {
      console.error('加载部门数据失败:', error);
      toast({
        title: '加载数据失败',
        preset: 'error',
        duration: 2,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDepartments();
  };

  const handleAddDepartment = async () => {
    // 检查操作权限
    if (
      !currentUser ||
      !PermissionUtils.canAccessDepartmentManagement(currentUser)
    ) {
      toast({
        title: '权限不足，无法执行此操作',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    if (!newDepartment.name.trim()) {
      toast({
        title: '请输入部门名称',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    if (!newDepartment.code.trim()) {
      toast({
        title: '请输入部门编码',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    try {
      const result = await departmentService.createDepartment({
        name: newDepartment.name,
        code: newDepartment.code,
        description: newDepartment.description,
        parentId: newDepartment.parentId || undefined,
      });

      if (result.success) {
        setNewDepartment({ name: '', code: '', description: '', parentId: '' });
        setShowAddModal(false);
        await loadDepartments();

        toast({
          title: '添加成功',
          preset: 'done',
          duration: 2,
        });
      } else {
        toast({
          title: result.message || '添加失败',
          preset: 'error',
          duration: 2,
        });
      }
    } catch (error) {
      console.error('添加部门失败:', error);
      toast({
        title: '添加失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  const handleDeleteDepartment = (department: Department) => {
    // 检查操作权限
    if (
      !currentUser ||
      !PermissionUtils.canAccessDepartmentManagement(currentUser)
    ) {
      toast({
        title: '权限不足，无法执行此操作',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    Alert.alert(
      '确认删除',
      `确定要删除部门"${department.name}"吗？\n注意：删除部门会影响该部门下的所有用户和人员数据。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await departmentService.deleteDepartment(
                department.id,
              );

              if (result.success) {
                await loadDepartments();
                toast({
                  title: '删除成功',
                  preset: 'done',
                  duration: 2,
                });
              } else {
                toast({
                  title: result.message || '删除失败',
                  preset: 'error',
                  duration: 2,
                });
              }
            } catch (error) {
              console.error('删除部门失败:', error);
              toast({
                title: '删除失败',
                preset: 'error',
                duration: 2,
              });
            }
          },
        },
      ],
    );
  };

  const handleEditDepartment = (department: Department) => {
    // 检查操作权限
    if (
      !currentUser ||
      !PermissionUtils.canAccessDepartmentManagement(currentUser)
    ) {
      toast({
        title: '权限不足，无法执行此操作',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    setEditingDepartment(department);
    setNewDepartment({
      name: department.name,
      code: department.code,
      description: department.description || '',
      parentId: department.parentId || '',
    });
    setShowAddModal(true);
  };

  const handleUpdateDepartment = async () => {
    if (!editingDepartment) return;

    // 检查操作权限
    if (
      !currentUser ||
      !PermissionUtils.canAccessDepartmentManagement(currentUser)
    ) {
      toast({
        title: '权限不足，无法执行此操作',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    if (!newDepartment.name.trim()) {
      toast({
        title: '请输入部门名称',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    if (!newDepartment.code.trim()) {
      toast({
        title: '请输入部门编码',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    try {
      const result = await departmentService.updateDepartment(
        editingDepartment.id,
        {
          name: newDepartment.name,
          code: newDepartment.code,
          description: newDepartment.description,
          parentId: newDepartment.parentId || undefined,
        },
      );

      if (result.success) {
        setNewDepartment({ name: '', code: '', description: '', parentId: '' });
        setEditingDepartment(null);
        setShowAddModal(false);
        await loadDepartments();

        toast({
          title: '更新成功',
          preset: 'done',
          duration: 2,
        });
      } else {
        toast({
          title: result.message || '更新失败',
          preset: 'error',
          duration: 2,
        });
      }
    } catch (error) {
      console.error('更新部门失败:', error);
      toast({
        title: '更新失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  // 辅助函数：获取部门状态（兼容不同字段名）
  const getDepartmentStatus = (department: Department): boolean => {
    return department.isActive ?? department.isActive ?? true;
  };

  // 渲染树形结构的部门节点
  const renderDepartmentTree = (department: Department, level: number = 0) => {
    const hasChildren = department.children && department.children.length > 0;
    const isActive = getDepartmentStatus(department);

    return (
      <View key={department.id}>
        <View style={[styles.departmentTreeNode, { marginLeft: level * 20 }]}>
          {/* 层级指示器 */}
          <View style={styles.levelIndicator}>
            {level > 0 && <View style={styles.treeLine} />}
            <View
              style={[styles.treeIcon, hasChildren && styles.treeIconParent]}
            >
              <Icon
                name={hasChildren ? 'folder' : 'building'}
                size={16}
                color={hasChildren ? COLORS.primary : COLORS.darkGray}
              />
            </View>
          </View>

          {/* 部门信息 */}
          <View style={styles.departmentTreeInfo}>
            <View style={styles.departmentTreeHeader}>
              <Text
                style={[
                  styles.departmentTreeName,
                  level === 0 && styles.rootDepartmentName,
                ]}
              >
                {department.name}
              </Text>
              <Text style={styles.departmentTreeCode}>({department.code})</Text>
              <View style={styles.departmentTreeActions}>
                <TouchableOpacity
                  style={styles.treeEditButton}
                  onPress={() => handleEditDepartment(department)}
                >
                  <Icon name="edit" size={14} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.treeDeleteButton}
                  onPress={() => handleDeleteDepartment(department)}
                >
                  <Icon name="trash" size={14} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            </View>

            {department.description && (
              <Text style={styles.departmentTreeDescription}>
                {department.description}
              </Text>
            )}

            <View style={styles.departmentTreeMeta}>
              <Text style={styles.departmentTreeLevel}>
                层级 {department.level}
              </Text>
              <Text
                style={[
                  styles.departmentTreeStatus,
                  isActive ? styles.statusActive : styles.statusInactive,
                ]}
              >
                {isActive ? '启用' : '禁用'}
              </Text>
            </View>
          </View>
        </View>

        {/* 递归渲染子部门 */}
        {hasChildren &&
          department.children!.map(child =>
            renderDepartmentTree(child, level + 1),
          )}
      </View>
    );
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>部门管理</Text>
        <TouchableOpacity
          onPress={() => {
            // 检查操作权限
            if (
              !currentUser ||
              !PermissionUtils.canAccessDepartmentManagement(currentUser)
            ) {
              toast({
                title: '权限不足，无法执行此操作',
                preset: 'error',
                duration: 2,
              });
              return;
            }
            setShowAddModal(true);
          }}
        >
          <Icon name="plus" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* 统计卡片 */}
        <View style={styles.statsCard}>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: COLORS.primary }]}>
              {departments.length}
            </Text>
            <Text style={styles.statsLabel}>部门总数</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: COLORS.success }]}>
              {departments.filter(dept => dept.isActive).length}
            </Text>
            <Text style={styles.statsLabel}>启用部门</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={[styles.statsValue, { color: COLORS.warning }]}>
              {Math.max(...departments.map(dept => dept.level), 0)}
            </Text>
            <Text style={styles.statsLabel}>最大层级</Text>
          </View>
        </View>

        {/* 部门列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>部门组织架构</Text>
          <View style={styles.departmentTreeContainer}>
            {departmentTree.length > 0 ? (
              departmentTree.map(department => renderDepartmentTree(department))
            ) : (
              <View style={styles.emptyState}>
                <Icon name="building" size={48} color={COLORS.darkGray} />
                <Text style={styles.emptyText}>暂无部门数据</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 添加/编辑部门模态框 */}
      {showAddModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingDepartment ? '编辑部门' : '添加部门'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>部门名称 *</Text>
              <TextInput
                value={newDepartment.name}
                onChangeText={text =>
                  setNewDepartment({ ...newDepartment, name: text })
                }
                style={styles.input}
                placeholder="请输入部门名称"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>部门编码 *</Text>
              <TextInput
                value={newDepartment.code}
                onChangeText={text =>
                  setNewDepartment({ ...newDepartment, code: text })
                }
                style={styles.input}
                placeholder="请输入部门编码"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>部门描述</Text>
              <TextInput
                value={newDepartment.description}
                onChangeText={text =>
                  setNewDepartment({ ...newDepartment, description: text })
                }
                style={[styles.input, styles.textArea]}
                placeholder="请输入部门描述"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setEditingDepartment(null);
                  setNewDepartment({
                    name: '',
                    code: '',
                    description: '',
                    parentId: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButtonContainer}
                onPress={
                  editingDepartment
                    ? handleUpdateDepartment
                    : handleAddDepartment
                }
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>
                    {editingDepartment ? '更新' : '添加'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 16,
  },
  departmentCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  departmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  departmentIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentInfo: {
    flex: 1,
  },
  departmentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  departmentDescription: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  departmentCode: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  departmentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  departmentStats: {
    paddingLeft: 52,
  },
  departmentLevel: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginBottom: 2,
  },
  departmentStatus: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  memberCount: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  // 加载和权限相关样式
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  noPermissionText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.darkGray,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  submitButtonContainer: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },

  // 树形结构样式
  departmentTreeContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
  },
  departmentTreeNode: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  levelIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  treeLine: {
    width: 20,
    height: 1,
    backgroundColor: COLORS.darkGray,
    marginRight: 8,
  },
  treeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  treeIconParent: {
    backgroundColor: '#E3F2FD',
  },
  departmentTreeInfo: {
    flex: 1,
    backgroundColor: COLORS.gray,
    borderRadius: 8,
    padding: 12,
  },
  departmentTreeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  departmentTreeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginRight: 8,
  },
  rootDepartmentName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  departmentTreeCode: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginRight: 8,
  },
  departmentTreeActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  treeEditButton: {
    padding: 4,
    marginRight: 8,
  },
  treeDeleteButton: {
    padding: 4,
  },
  departmentTreeDescription: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginBottom: 8,
  },
  departmentTreeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  departmentTreeLevel: {
    fontSize: 11,
    color: COLORS.darkGray,
  },
  departmentTreeStatus: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },

  // 空状态样式
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.darkGray,
  },
});

export default OrganizationScreen;
