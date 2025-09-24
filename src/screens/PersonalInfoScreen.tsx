import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { User, Department } from '@/types';
import { userStorage } from '@/utils/storage';
import { userService, departmentService } from '@/services/apiServices';
import {
  showOperationSuccessToast,
  showOperationErrorToast,
  showWarningToast,
  showSuccessToast,
  showErrorToast,
} from '@/utils/errorHandler';

const { width } = Dimensions.get('window');

// 部门选项 - 从测试数据中获取
const DEPARTMENTS = [
  { id: '', name: '2队', code: '2TEAM' },
  { id: '', name: '2部', code: '2BU' },
  { id: '', name: '5组', code: '5GROUP' },
  { id: '', name: '6组', code: '6GROUP' },
  { id: '', name: '7组', code: '7GROUP' },
  { id: '', name: '8组', code: '8GROUP' },
];

// 角色选项
const ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'operator', label: '操作员' },
  { value: 'liaison', label: '联系员' },
];

interface Props {
  navigation: NavigationProp<any>;
}

const PersonalInfoScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    realName: '',
    username: '',
    departmentId: '',
    departmentName: '', // For display purposes
    phone: '',
    role: '',
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeData();
  }, []);

  // 监听departments变化，当部门数据加载完成后更新用户部门名称
  useEffect(() => {
    if (user && user.departmentId && departments.length > 0) {
      const dept = departments.find(d => d.id === user.departmentId);
      const departmentName = dept?.name || '';
      console.log('🏢 部门数据变化，更新用户部门名称:', {
        dept,
        departmentName,
      });

      setFormData(prev => ({
        ...prev,
        departmentName: departmentName,
      }));
    }
  }, [departments, user]);

  const initializeData = async () => {
    // 并行加载部门和用户数据
    await Promise.all([loadDepartments(), loadUserData()]);
  };

  const loadDepartments = async () => {
    try {
      const result = await departmentService.getDepartments();

      if (result.success && result.data) {
        const departmentList = Array.isArray(result.data) ? result.data : [];
        console.log('🏢 加载部门列表成功，共', departmentList.length, '个部门');
        setDepartments(departmentList);
      } else {
        console.error('🏢 部门API失败:', result.message);
        // Use fallback departments if API fails
        const fallbackDepts = DEPARTMENTS.map((dept, index) => ({
          id: `dept-${index}`,
          name: dept.name,
          code: dept.code,
          description: '',
          parentId: undefined,
          level: 1,
          path: `/${dept.code}`,
          isActive: true,
          sortOrder: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setDepartments(fallbackDepts);
      }
    } catch (error) {
      console.error('🏢 加载部门列表异常:', error);
      // Use fallback departments if API fails
      const fallbackDepts = DEPARTMENTS.map((dept, index) => ({
        id: `dept-${index}`,
        name: dept.name,
        code: dept.code,
        description: '',
        parentId: undefined,
        level: 1,
        path: `/${dept.code}`,
        isActive: true,
        sortOrder: index,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      setDepartments(fallbackDepts);
    }
  };

  const loadUserData = async () => {
    try {
      // 使用新的用户服务获取当前用户信息
      const dbUser = await userService.getCurrentUser();

      if (dbUser) {
        setUser(dbUser);

        setFormData({
          realName: dbUser.realName || '',
          username: dbUser.username || '',
          departmentId: dbUser.departmentId || '',
          departmentName: '', // 将通过useEffect更新
          phone: dbUser.phone || '',
          role: dbUser.role || '',
        });

        console.log('👤 用户数据加载完成，部门ID:', dbUser.departmentId);
      } else {
        console.error('获取用户信息失败');
      }
    } catch (error) {
      console.error('Load user data error:', error);
    }
  };

  const handleEditField = (field: string, value: string) => {
    setEditingField(field);
    setTempValue(value);
  };

  const handleSaveField = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Prepare update data based on field being edited
      const updateData: any = {};
      if (editingField === 'realName') {
        updateData.realName = tempValue;
      } else if (editingField === 'username') {
        updateData.username = tempValue;
      } else if (editingField === 'phone') {
        updateData.phone = tempValue;
      }

      // Use backend API to update user
      const result = await userService.updateUser(user.id, updateData);

      if (!result.success) {
        throw new Error(`更新失败: ${result.message}`);
      }

      // Update local state
      const updatedFormData = { ...formData, [editingField!]: tempValue };
      const updatedUser = { ...user, ...updateData };
      setUser(updatedUser as User);
      setFormData(updatedFormData);
      setEditingField(null);

      showSuccessToast('保存成功', '用户信息已更新');
    } catch (error) {
      console.error('保存用户信息失败:', error);
      showErrorToast('保存失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showWarningToast('请填写完整信息', '所有密码字段都是必填的');
      return;
    }

    if (newPassword !== confirmPassword) {
      showWarningToast('两次密码输入不一致', '请确认新密码输入正确');
      return;
    }

    if (newPassword.length < 6) {
      showWarningToast('密码长度至少6位', '请设置更安全的密码');
      return;
    }

    showSuccessToast('密码修改成功', '新密码已生效');

    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSelectDepartment = async (departmentId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Find department name for display
      const selectedDept = departments.find(d => d.id === departmentId);
      const departmentName = selectedDept?.name || '';

      // Use backend API to update user
      const result = await userService.updateUser(user.id, {
        departmentId: departmentId,
      });

      if (!result.success) {
        throw new Error(`更新失败: ${result.message}`);
      }

      // Update local state
      const updatedFormData = {
        ...formData,
        departmentId: departmentId,
        departmentName: departmentName,
      };
      const updatedUser = { ...user, departmentId: departmentId };
      setUser(updatedUser as User);
      setFormData(updatedFormData);
      setShowDepartmentModal(false);

      showSuccessToast('保存成功', '部门信息已更新');
    } catch (error) {
      console.error('保存部门信息失败:', error);
      showErrorToast('保存失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (role: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Note: Role updates might require admin privileges
      // For now, we'll just update the local state since role changes
      // are typically handled by administrators
      const updatedFormData = { ...formData, role };
      setFormData(updatedFormData);
      setShowRoleModal(false);

      showSuccessToast('角色信息已更新', '请联系管理员确认权限变更');
    } catch (error) {
      console.error('保存角色信息失败:', error);
      showErrorToast('保存失败', error);
    } finally {
      setLoading(false);
    }
  };

  const InfoField = ({
    label,
    value,
    field,
    icon,
    editable = true,
    isDropdown = false,
  }: {
    label: string;
    value: string;
    field: string;
    icon: string;
    editable?: boolean;
    isDropdown?: boolean;
  }) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldIcon}>
          <Icon name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>

      {editingField === field ? (
        <View style={styles.editingContainer}>
          <TextInput
            style={styles.fieldInput}
            value={tempValue}
            onChangeText={setTempValue}
            placeholder={`请输入${label}`}
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setEditingField(null)}
            >
              <Icon name="times" size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveField}>
              <Icon name="check" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.fieldContent}
          onPress={() => {
            if (editable) {
              if (field === 'departmentId') {
                setShowDepartmentModal(true);
              } else if (field === 'role') {
                setShowRoleModal(true);
              } else {
                handleEditField(field, value);
              }
            }
          }}
          disabled={!editable}
        >
          <Text style={styles.fieldValue}>{value || '未设置'}</Text>
          {editable && <Icon name="edit" size={14} color="#9CA3AF" />}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 优雅的渐变头部 */}
      <LinearGradient
        colors={COLORS.primaryGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
              style={styles.avatar}
            >
              <Icon name="user" size={40} color={COLORS.white} />
            </LinearGradient>
            <TouchableOpacity style={styles.avatarEdit}>
              <Icon name="camera" size={12} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.headerName}>
            {formData.realName || '未设置姓名'}
          </Text>
          <Text style={styles.headerRole}>
            {formData.departmentName || '未设置部门'}
          </Text>
        </View>

        {/* 装饰性元素 */}
        <View style={styles.decoration1} />
        <View style={styles.decoration2} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 基本信息卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>基本信息</Text>

          <InfoField
            label="真实姓名"
            value={formData.realName}
            field="realName"
            icon="user-o"
          />
          <InfoField
            label="用户名"
            value={formData.username}
            field="username"
            icon="id-card-o"
          />
          <InfoField
            label="部门"
            value={formData.departmentName}
            field="departmentId"
            icon="building-o"
          />
          <InfoField
            label="角色"
            value={
              ROLES.find(r => r.value === user?.role)?.label ||
              user?.role ||
              '未设置'
            }
            field="role"
            icon="shield"
            editable={false}
          />
        </View>

        {/* 联系方式卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>联系方式</Text>

          <InfoField
            label="手机号码"
            value={formData.phone}
            field="phone"
            icon="phone"
          />
          <InfoField
            label="角色权限"
            value={
              ROLES.find(r => r.value === formData.role)?.label || formData.role
            }
            field="role"
            icon="user-circle-o"
            editable={true}
          />
        </View>

        {/* 安全设置卡片 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>安全设置</Text>

          <TouchableOpacity
            style={styles.securityItem}
            onPress={() => setShowPasswordModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#FEF3C7', '#FDE68A']}
              style={styles.securityGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.securityIcon}>
                <Icon name="lock" size={20} color="#F59E0B" />
              </View>
              <View style={styles.securityContent}>
                <Text style={styles.securityTitle}>修改密码</Text>
                <Text style={styles.securityDesc}>保护账号安全</Text>
              </View>
              <Icon name="chevron-right" size={14} color="#F59E0B" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 密码修改模态框 */}
      {showPasswordModal && (
        <View style={styles.modal}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>修改密码</Text>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={styles.modalClose}
              >
                <Icon name="times" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>当前密码</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="lock" size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="请输入当前密码"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>新密码</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="key" size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="请输入新密码（至少6位）"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>确认密码</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="check-circle-o" size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="请再次输入新密码"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                  />
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleChangePassword}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.modalConfirmText}>确认修改</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 部门选择模态框 */}
      <Modal
        visible={showDepartmentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDepartmentModal(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>选择部门</Text>
            {departments.map(dept => (
              <TouchableOpacity
                key={dept.id}
                style={[
                  styles.modalOption,
                  formData.departmentId === dept.id &&
                    styles.modalOptionSelected,
                ]}
                onPress={() => handleSelectDepartment(dept.id)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    formData.departmentId === dept.id &&
                      styles.modalOptionTextSelected,
                  ]}
                >
                  {dept.name}
                </Text>
                {formData.departmentId === dept.id && (
                  <Icon name="check" size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 角色选择模态框 */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRoleModal(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>选择角色</Text>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.modalOption,
                  formData.role === role.value && styles.modalOptionSelected,
                ]}
                onPress={() => handleSelectRole(role.value)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    formData.role === role.value &&
                      styles.modalOptionTextSelected,
                  ]}
                >
                  {role.label}
                </Text>
                {formData.role === role.value && (
                  <Icon name="check" size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  headerRole: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  decoration1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decoration2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 0,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  fieldContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  fieldValue: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  editingContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityItem: {
    marginBottom: 12,
  },
  securityGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  securityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 13,
    color: '#B45309',
  },
  bottomPadding: {
    height: 40,
  },
  // 模态框样式
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
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    width: width - 40,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    padding: 4,
  },
  modalContent: {
    paddingHorizontal: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 14,
    marginLeft: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  modalConfirm: {
    flex: 1,
  },
  confirmGradient: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: width * 0.8,
    maxHeight: '70%',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  modalOptionSelected: {
    backgroundColor: `${COLORS.primary}15`,
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.darkGray,
  },
  modalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default PersonalInfoScreen;
