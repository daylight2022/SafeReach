import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { parseLeaveText, validateParsedInfo, ParsedLeaveInfo } from '@/utils/textParser';
import { COLORS } from '@/utils/constants';

interface SmartTextParserProps {
  onParsed: (data: ParsedLeaveInfo) => void;
  onClose: () => void;
}

const SmartTextParser: React.FC<SmartTextParserProps> = ({ onParsed, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedLeaveInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 示例模板文本
  const exampleText = `张其超9月16日离队行程：
休假地点：河南省郑州市二七区郑密路黄岗寺小区（自己家）
出行方式：
07：30-08：00，网约车，衡阳y区-衡阳东站；
08：54-13：38，G834次高铁，衡阳东站-郑州站；
13：45-14：00，私家车（车牌号豫AF07T9，父亲驾驶，驾龄20年，全程约8公里），郑州站-家中。
离队起止日期：9.16-10.9
本人联系方式：18126001324
单位跟踪联系人及电话：熊星  18594968961
第三方联系人姓名：  张长伟 
与本人关系：父子
第三方联系方式：15838113122
是否有地方驾驶证：否
是否有内部驾驶证：否
在外是否经常开车：否`;

  const handleParse = () => {
    if (!inputText.trim()) {
      Alert.alert('提示', '请输入要解析的文本');
      return;
    }

    setIsLoading(true);
    
    try {
      const parsed = parseLeaveText(inputText);
      const validation = validateParsedInfo(parsed);
      
      setParsedData(parsed);
      
      if (!validation.isValid) {
        Alert.alert(
          '解析完成',
          `已解析部分信息，但缺少以下字段：\n${validation.missingFields.join('、')}\n\n请手动补充完整信息。`,
          [{ text: '确定' }]
        );
      } else if (validation.warnings.length > 0) {
        Alert.alert(
          '解析完成',
          `解析成功！但有以下提醒：\n${validation.warnings.join('\n')}`,
          [{ text: '确定' }]
        );
      } else {
        // Alert.alert('解析完成', '所有信息解析成功！', [{ text: '确定' }]);
      }
    } catch (error) {
      Alert.alert('解析失败', '文本解析过程中出现错误，请检查输入格式');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseExample = () => {
    setInputText(exampleText);
  };

  const handleConfirm = () => {
    if (!parsedData) {
      Alert.alert('提示', '请先解析文本');
      return;
    }

    onParsed(parsedData);
    onClose();
  };

  const handleClear = () => {
    setInputText('');
    setParsedData(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>智能文本解析</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>输入文本</Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="请粘贴或输入休假人员信息文本..."
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={handleUseExample} style={styles.exampleButton}>
              <Text style={styles.exampleButtonText}>使用示例</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>清空</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleParse} 
              style={[styles.parseButton, isLoading && styles.disabledButton]}
              disabled={isLoading}
            >
              <Text style={styles.parseButtonText}>
                {isLoading ? '解析中...' : '解析'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {parsedData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>解析结果</Text>
            <View style={styles.resultContainer}>
              <ResultItem label="姓名" value={parsedData.name} />
              <ResultItem label="休假地点" value={parsedData.location} />
              <ResultItem label="开始日期" value={parsedData.startDate} />
              <ResultItem label="结束日期" value={parsedData.endDate} />
              <ResultItem label="休假天数" value={parsedData.days?.toString()} />
              <ResultItem label="本人联系方式" value={parsedData.phone} />
              <ResultItem label="紧急联系人" value={parsedData.emergencyContact} />
              <ResultItem label="紧急联系电话" value={parsedData.emergencyPhone} />
              <ResultItem label="备注" value={parsedData.notes} />
            </View>
          </View>
        )}
      </ScrollView>

      {parsedData && (
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmButtonText}>确认使用</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

interface ResultItemProps {
  label: string;
  value?: string;
}

const ResultItem: React.FC<ResultItemProps> = ({ label, value }) => {
  if (!value) return null;
  
  return (
    <View style={styles.resultItem}>
      <Text style={styles.resultLabel}>{label}：</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 120,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  exampleButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
    alignItems: 'center',
  },
  exampleButtonText: {
    color: COLORS.text,
    fontSize: 14,
  },
  clearButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lightGray,
    borderRadius: 6,
    alignItems: 'center',
  },
  clearButtonText: {
    color: COLORS.text,
    fontSize: 14,
  },
  parseButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    alignItems: 'center',
  },
  parseButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray,
  },
  resultContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    width: 100,
  },
  resultValue: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SmartTextParser;
