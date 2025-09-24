import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';
import { reminderSettingsService, userService } from '@/services/apiServices';
import { User } from '@/types';
import { PermissionUtils } from '@/utils/permissions';

interface Props {
  navigation: NavigationProp<any>;
}

// 提醒设置接口
interface ReminderSettings {
  pushEnabled: boolean;
  urgentReminder: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
  vibrationEnabled: boolean;
  reminderTime: string;
  urgentThreshold: number;
  suggestThreshold: number;
}

const ReminderSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<ReminderSettings>({
    pushEnabled: true,
    urgentReminder: true,
    dailyReport: false,
    weeklyReport: true,
    vibrationEnabled: true,
    reminderTime: '09:00',
    urgentThreshold: 10,
    suggestThreshold: 7,
  });

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showThresholdInput, setShowThresholdInput] = useState(false);
  const [inputThresholdType, setInputThresholdType] = useState<
    'urgent' | 'suggest'
  >('urgent');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
      await loadSettings();
    } catch (error) {
      console.error('初始化数据失败:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await reminderSettingsService.getReminderSettings();
      if (response.success && response.data) {
        const reminderSettings: ReminderSettings = {
          pushEnabled: response.data.pushEnabled,
          urgentReminder: response.data.urgentReminder,
          dailyReport: response.data.dailyReport,
          weeklyReport: response.data.weeklyReport,
          vibrationEnabled: response.data.vibrationEnabled,
          reminderTime: response.data.reminderTime,
          urgentThreshold: response.data.urgentThreshold,
          suggestThreshold: response.data.suggestThreshold,
        };
        setSettings(reminderSettings);
      }
    } catch (error) {
      console.error('Load reminder settings error:', error);
      toast({
        title: '加载设置失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  const saveSettings = async (newSettings: ReminderSettings) => {
    // 检查操作权限
    if (
      !currentUser ||
      !PermissionUtils.canAccessReminderSettings(currentUser)
    ) {
      toast({
        title: '权限不足，无法执行此操作',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    try {
      const response = await reminderSettingsService.updateReminderSettings({
        pushEnabled: newSettings.pushEnabled,
        urgentReminder: newSettings.urgentReminder,
        dailyReport: newSettings.dailyReport,
        weeklyReport: newSettings.weeklyReport,
        vibrationEnabled: newSettings.vibrationEnabled,
        reminderTime: newSettings.reminderTime,
        urgentThreshold: newSettings.urgentThreshold,
        suggestThreshold: newSettings.suggestThreshold,
      });

      if (response.success && response.data) {
        setSettings(newSettings);
        toast({
          title: '设置已保存',
          preset: 'done',
          duration: 2,
        });
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('Save reminder settings error:', error);
      toast({
        title: '保存失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  const handleToggle = async (key: keyof ReminderSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  // 提醒设置相关函数
  const timeOptions = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
  ];

  const handleTimeChange = async (time: string) => {
    const newSettings = { ...settings, reminderTime: time };
    await saveSettings(newSettings);
    setShowTimePicker(false);
  };

  const handleThresholdChange = async (
    type: 'urgent' | 'suggest',
    value: number,
  ) => {
    const newSettings = {
      ...settings,
      [type === 'urgent' ? 'urgentThreshold' : 'suggestThreshold']:
        Math.round(value),
    };
    await saveSettings(newSettings);
  };

  const handleThresholdInputOpen = (type: 'urgent' | 'suggest') => {
    setInputThresholdType(type);
    setInputValue(
      settings[
        type === 'urgent' ? 'urgentThreshold' : 'suggestThreshold'
      ].toString(),
    );
    setShowThresholdInput(true);
  };

  const handleThresholdInputSave = async () => {
    const value = parseInt(inputValue);
    const minValue = inputThresholdType === 'urgent' ? 3 : 1;
    const maxValue = inputThresholdType === 'urgent' ? 30 : 14;

    if (isNaN(value) || value < minValue || value > maxValue) {
      toast({
        title: `请输入 ${minValue}-${maxValue} 之间的数字`,
        preset: 'error',
        duration: 2,
      });
      return;
    }

    await handleThresholdChange(inputThresholdType, value);
    setShowThresholdInput(false);
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    value,
    onToggle,
    iconBgColor = '#EEF2FF',
    iconColor = COLORS.primary,
  }: {
    icon: string;
    title: string;
    subtitle: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    iconBgColor?: string;
    iconColor?: string;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: iconBgColor }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E7EB', true: COLORS.primary }}
        thumbColor={value ? COLORS.white : '#F3F4F6'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>提醒设置</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 基础提醒设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基础提醒设置</Text>

          <SettingItem
            icon="bell"
            title="推送通知"
            subtitle="开启后可接收系统推送消息"
            value={settings.pushEnabled}
            onToggle={value => handleToggle('pushEnabled', value)}
          />

          <SettingItem
            icon="mobile"
            title="震动提醒"
            subtitle="通知时震动提醒"
            value={settings.vibrationEnabled}
            onToggle={value => handleToggle('vibrationEnabled', value)}
            iconBgColor="#F3E8FF"
            iconColor="#8B5CF6"
          />

          <SettingItem
            icon="exclamation-triangle"
            title="紧急联系提醒"
            subtitle="超过阈值天数未联系时提醒"
            value={settings.urgentReminder}
            onToggle={value => handleToggle('urgentReminder', value)}
            iconBgColor="#FEF2F2"
            iconColor={COLORS.danger}
          />
        </View>

        {/* 联系阈值设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系阈值设置</Text>

          {/* 紧急阈值设置 */}
          <View style={styles.thresholdItem}>
            <View style={styles.thresholdHeader}>
              <View style={styles.settingIcon}>
                <Icon name="clock-o" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>紧急阈值</Text>
                <Text style={styles.settingSubtitle}>超过此天数标记为紧急</Text>
              </View>
            </View>
            <View style={styles.thresholdControls}>
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() =>
                  handleThresholdChange(
                    'urgent',
                    Math.max(3, settings.urgentThreshold - 1),
                  )
                }
              >
                <Icon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thresholdValue}
                onPress={() => handleThresholdInputOpen('urgent')}
              >
                <Text style={styles.thresholdValueText}>
                  {settings.urgentThreshold}天
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() =>
                  handleThresholdChange(
                    'urgent',
                    Math.min(30, settings.urgentThreshold + 1),
                  )
                }
              >
                <Icon name="plus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.thresholdRange}>
              <Text style={styles.rangeText}>
                范围：3-30天（点击数字快速输入）
              </Text>
            </View>
          </View>

          {/* 建议阈值设置 */}
          <View style={styles.thresholdItem}>
            <View style={styles.thresholdHeader}>
              <View style={styles.settingIcon}>
                <Icon name="clock-o" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>建议阈值</Text>
                <Text style={styles.settingSubtitle}>
                  超过此天数标记为建议联系
                </Text>
              </View>
            </View>
            <View style={styles.thresholdControls}>
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() =>
                  handleThresholdChange(
                    'suggest',
                    Math.max(1, settings.suggestThreshold - 1),
                  )
                }
              >
                <Icon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thresholdValue}
                onPress={() => handleThresholdInputOpen('suggest')}
              >
                <Text style={styles.thresholdValueText}>
                  {settings.suggestThreshold}天
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thresholdButton}
                onPress={() =>
                  handleThresholdChange(
                    'suggest',
                    Math.min(14, settings.suggestThreshold + 1),
                  )
                }
              >
                <Icon name="plus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.thresholdRange}>
              <Text style={styles.rangeText}>
                范围：1-14天（点击数字快速输入）
              </Text>
            </View>
          </View>
        </View>

        {/* 报告设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>报告设置</Text>

          <SettingItem
            icon="file-text-o"
            title="每日报告"
            subtitle="每日发送联系情况报告"
            value={settings.dailyReport}
            onToggle={value => handleToggle('dailyReport', value)}
            iconBgColor="#F0FDF4"
            iconColor={COLORS.success}
          />

          <SettingItem
            icon="calendar"
            title="每周报告"
            subtitle="每周发送联系统计报告"
            value={settings.weeklyReport}
            onToggle={value => handleToggle('weeklyReport', value)}
            iconBgColor="#DBEAFE"
            iconColor="#3B82F6"
          />

          {/* 报告时间设置 */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowTimePicker(true)}
          >
            <View style={styles.settingLeft}>
              <View
                style={[styles.settingIcon, { backgroundColor: '#FFFBEB' }]}
              >
                <Icon name="clock-o" size={20} color={COLORS.warning} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>报告时间</Text>
                <Text style={styles.settingSubtitle}>设置报告发送时间</Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.rightText}>{settings.reminderTime}</Text>
              <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 时间选择器模态框 */}
      {showTimePicker && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择报告时间</Text>
            <ScrollView style={styles.timeList}>
              {timeOptions.map(time => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    settings.reminderTime === time && styles.timeOptionActive,
                  ]}
                  onPress={() => handleTimeChange(time)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      settings.reminderTime === time &&
                        styles.timeOptionTextActive,
                    ]}
                  >
                    {time}
                  </Text>
                  {settings.reminderTime === time && (
                    <Icon name="check" size={16} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 阈值输入模态框 */}
      {showThresholdInput && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              设置{inputThresholdType === 'urgent' ? '紧急' : '建议'}阈值
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.thresholdInput}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="请输入天数"
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
              />
              <Text style={styles.inputUnit}>天</Text>
            </View>
            <Text style={styles.inputHint}>
              {inputThresholdType === 'urgent'
                ? '范围：3-30天'
                : '范围：1-14天'}
            </Text>
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={styles.inputCancel}
                onPress={() => setShowThresholdInput(false)}
              >
                <Text style={styles.inputCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inputSave}
                onPress={handleThresholdInputSave}
              >
                <Text style={styles.inputSaveText}>确定</Text>
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
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    padding: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightText: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  // 阈值设置样式
  thresholdItem: {
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  thresholdControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  thresholdButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  thresholdValue: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  thresholdValueText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  thresholdRange: {
    alignItems: 'center',
  },
  rangeText: {
    fontSize: 12,
    color: COLORS.darkGray,
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
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  timeList: {
    maxHeight: 200,
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  timeOptionActive: {
    backgroundColor: '#EEF2FF',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  timeOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.darkGray,
  },
  // 输入框样式
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  thresholdInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
  inputUnit: {
    fontSize: 16,
    color: COLORS.darkGray,
    marginLeft: 8,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inputCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  inputCancelText: {
    fontSize: 16,
    color: COLORS.darkGray,
  },
  inputSave: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  inputSaveText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default ReminderSettingsScreen;
