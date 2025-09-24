import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';
import Clipboard from '@react-native-clipboard/clipboard';

interface Props {
  navigation: NavigationProp<any>;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface ContactInfo {
  type: string;
  icon: string;
  title: string;
  value: string;
  action: () => void;
}

const HelpCenterScreen: React.FC<Props> = ({ navigation }) => {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: '如何添加新的人员信息？',
      answer: '在人员管理页面点击右上角的"+"按钮，填写相关信息后保存即可。',
      category: '基础操作',
    },
    {
      id: '2',
      question: '如何设置联系提醒？',
      answer: '进入"我的"->"提醒设置"，可以设置紧急联系提醒的阈值和时间。',
      category: '提醒设置',
    },
    {
      id: '3',
      question: '数据如何备份？',
      answer:
        '系统会自动将数据同步到云端，您也可以在隐私设置中手动开启数据备份功能。',
      category: '数据管理',
    },
    {
      id: '4',
      question: '忘记密码怎么办？',
      answer: '请联系系统管理员重置密码，或通过注册邮箱找回密码。',
      category: '账户问题',
    },
    {
      id: '5',
      question: '如何查看联系统计？',
      answer: '在统计页面可以查看详细的联系数据和趋势分析。',
      category: '数据统计',
    },
    {
      id: '6',
      question: '系统支持哪些联系方式？',
      answer: '目前支持电话、短信、微信等多种联系方式的记录。',
      category: '功能说明',
    },
  ];

  const contactInfo: ContactInfo[] = [
    {
      type: 'phone',
      icon: 'phone',
      title: '开发者电话',
      value: '18594930897',
      action: () => {
        Linking.openURL('tel:18594930897').catch(() => {
          toast({
            title: '无法拨打电话',
            preset: 'error',
            duration: 2,
          });
        });
      },
    },
    {
      type: 'wechat',
      icon: 'wechat',
      title: '开发者微信',
      value: 'zkdmsw_',
      action: () => {
        Clipboard.setString('zkdmsw_');
        toast({ title: '微信号已复制到剪贴板', preset: 'done', duration: 2 });
        Alert.alert(
          '添加微信',
          '微信号 zkdmsw_ 已复制到剪贴板\n请打开微信添加好友',
        );
      },
    },
  ];

  const categories = [...new Set(faqData.map(item => item.category))];

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const renderFAQItem = (item: FAQItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.faqItem}
      onPress={() => toggleFAQ(item.id)}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Icon
          name={expandedFAQ === item.id ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={COLORS.darkGray}
        />
      </View>
      {expandedFAQ === item.id && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderContactItem = (item: ContactInfo) => (
    <TouchableOpacity
      key={item.type}
      style={styles.contactItem}
      onPress={item.action}
    >
      <View style={styles.contactLeft}>
        <View style={styles.contactIcon}>
          <Icon name={item.icon} size={20} color={COLORS.primary} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>{item.title}</Text>
          <Text style={styles.contactValue}>{item.value}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>帮助中心</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 快速入门 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速入门</Text>
          <View style={styles.quickStartGrid}>
            <TouchableOpacity style={styles.quickStartItem}>
              <View style={styles.quickStartIcon}>
                <Icon name="play-circle" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickStartText}>新手指南</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickStartItem}>
              <View style={styles.quickStartIcon}>
                <Icon name="video-camera" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.quickStartText}>视频教程</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickStartItem}>
              <View style={styles.quickStartIcon}>
                <Icon name="file-text" size={24} color={COLORS.warning} />
              </View>
              <Text style={styles.quickStartText}>使用手册</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickStartItem}>
              <View style={styles.quickStartIcon}>
                <Icon name="lightbulb-o" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.quickStartText}>使用技巧</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 常见问题 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>常见问题</Text>
          {categories.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {faqData
                .filter(item => item.category === category)
                .map(renderFAQItem)}
            </View>
          ))}
        </View>

        {/* 联系我 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系我</Text>
          <Text style={styles.sectionDescription}>
            我是独立开发者，专注于移动应用开发。如有问题或建议，欢迎随时联系。
          </Text>
          {contactInfo.map(renderContactItem)}
        </View>

        {/* 反馈建议 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>反馈建议</Text>
          <TouchableOpacity style={styles.feedbackItem}>
            <View style={styles.feedbackLeft}>
              <View style={styles.feedbackIcon}>
                <Icon name="comment" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.feedbackTitle}>意见反馈</Text>
                <Text style={styles.feedbackSubtitle}>告诉我们您的想法</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.feedbackItem}>
            <View style={styles.feedbackLeft}>
              <View style={styles.feedbackIcon}>
                <Icon name="star" size={20} color={COLORS.warning} />
              </View>
              <View>
                <Text style={styles.feedbackTitle}>应用评分</Text>
                <Text style={styles.feedbackSubtitle}>为应用打分并评价</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
          </TouchableOpacity>
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
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  quickStartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickStartItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.gray,
    borderRadius: 12,
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStartText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginBottom: 8,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  faqAnswerText: {
    fontSize: 14,
    color: COLORS.darkGray,
    lineHeight: 20,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  feedbackItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  feedbackLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feedbackTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    marginBottom: 2,
  },
  feedbackSubtitle: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
});

export default HelpCenterScreen;
