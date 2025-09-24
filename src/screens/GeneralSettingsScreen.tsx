import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';
import { generalStorage } from '@/utils/storage';

interface Props {
  navigation: NavigationProp<any>;
}

// 通用设置接口（只保留主题设置）
interface GeneralSettings {
  // 主题设置
  darkMode: boolean;
  soundEnabled: boolean;
}

const GeneralSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [settings, setSettings] = useState<GeneralSettings>({
    // 主题设置
    darkMode: false,
    soundEnabled: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = generalStorage.get('generalSettings');
      if (savedSettings) {
        // 只加载主题相关设置
        const themeSettings: GeneralSettings = {
          darkMode: savedSettings.darkMode ?? false,
          soundEnabled: savedSettings.soundEnabled ?? true,
        };
        setSettings(themeSettings);
      }
    } catch (error) {
      console.error('Load general settings error:', error);
    }
  };

  const saveSettings = (newSettings: GeneralSettings) => {
    try {
      // 获取现有设置，只更新主题相关部分
      const existingSettings = generalStorage.get('generalSettings') || {};
      const updatedSettings = { ...existingSettings, ...newSettings };
      generalStorage.set('generalSettings', updatedSettings);
      setSettings(newSettings);
      toast({
        title: '设置已保存',
        preset: 'done',
        duration: 2,
      });
    } catch (error) {
      toast({
        title: '保存失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  const handleToggle = (key: keyof GeneralSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
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
        <Text style={styles.title}>通用设置</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 主题设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>主题设置</Text>

          <SettingItem
            icon="moon-o"
            title="深色模式"
            subtitle="使用深色主题界面"
            value={settings.darkMode}
            onToggle={value => handleToggle('darkMode', value)}
            iconBgColor="#1F2937"
            iconColor="#F9FAFB"
          />

          <SettingItem
            icon="volume-up"
            title="声音提醒"
            subtitle="操作时播放提示音"
            value={settings.soundEnabled}
            onToggle={value => handleToggle('soundEnabled', value)}
            iconBgColor="#FFFBEB"
            iconColor={COLORS.warning}
          />
        </View>
      </ScrollView>
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
});

export default GeneralSettingsScreen;
