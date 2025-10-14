/**
 * 智能文本解析工具
 * 用于从休假人员模板文本中自动提取字段信息
 */

export interface ParsedLeaveInfo {
  name?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  relationship?: string;
  hasLocalLicense?: boolean;
  hasInternalLicense?: boolean;
  driveFrequently?: boolean;
  notes?: string;
}

/**
 * 解析休假人员模板文本
 * @param text 输入的模板文本
 * @returns 解析后的字段信息
 */
export function parseLeaveText(text: string): ParsedLeaveInfo {
  const result: ParsedLeaveInfo = {};

  // 清理文本，移除多余的空白字符
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // 1. 提取人员姓名（从第一行或者明确的姓名模式）
  const namePatterns = [
    /^([^0-9\s]{2,4})[0-9月日]/, // 开头的中文姓名后跟数字或日期
    /([^0-9\s]{2,4})(?:离队|休假)/, // 姓名后跟"离队"或"休假"
  ];

  for (const pattern of namePatterns) {
    const nameMatch = cleanText.match(pattern);
    if (nameMatch) {
      result.name = nameMatch[1].trim();
      break;
    }
  }

  // 2. 提取休假地点
  const locationPatterns = [
    /休假地点[：:]\s*([^\r\n]+)/,
    /地点[：:]\s*([^\r\n]+)/,
  ];

  for (const pattern of locationPatterns) {
    const locationMatch = text.match(pattern); // 使用原始text而不是cleanText，保留换行符
    if (locationMatch) {
      let location = locationMatch[1].trim();

      // 移除括号内容
      location = location.replace(/[（\(].*?[）\)]/, '');

      // 如果包含其他字段标识符，截取到该标识符之前
      const fieldMarkers = [
        '本人联系方式',
        '联系方式',
        '出行方式',
        '起止日期',
        '离队起止日期',
      ];
      for (const marker of fieldMarkers) {
        const markerIndex = location.indexOf(marker);
        if (markerIndex !== -1) {
          location = location.substring(0, markerIndex).trim();
          break;
        }
      }

      result.location = location;
      break;
    }
  }

  // 3. 提取起止日期
  const datePatterns = [
    /离队起止日期[：:]\s*([0-9]{1,2}\.?[0-9]{1,2})\s*[-–—]\s*([0-9]{1,2}\.?[0-9]{1,2})/,
    /起止日期[：:]\s*([0-9]{1,2}\.?[0-9]{1,2})\s*[-–—]\s*([0-9]{1,2}\.?[0-9]{1,2})/,
    /([0-9]{1,2}\.?[0-9]{1,2})\s*[-–—]\s*([0-9]{1,2}\.?[0-9]{1,2})/,
  ];

  for (const pattern of datePatterns) {
    const dateMatch = cleanText.match(pattern);
    if (dateMatch) {
      const startDateStr = dateMatch[1].replace('.', '-');
      const endDateStr = dateMatch[2].replace('.', '-');

      // 转换为完整日期格式 (假设是2025年)
      const currentYear = new Date().getFullYear();
      result.startDate = convertToFullDate(startDateStr, currentYear);
      result.endDate = convertToFullDate(endDateStr, currentYear);

      // 计算天数（使用日历日期差，不是绝对24小时）
      if (result.startDate && result.endDate) {
        const start = new Date(result.startDate);
        const end = new Date(result.endDate);
        // 只取日期部分，忽略时间
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        result.days = Math.floor((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
      break;
    }
  }

  // 4. 提取本人联系方式
  const phonePatterns = [
    /本人联系方式[：:]\s*([0-9]{11})/,
    /联系方式[：:]\s*([0-9]{11})/,
    /手机[：:]\s*([0-9]{11})/,
  ];

  for (const pattern of phonePatterns) {
    const phoneMatch = cleanText.match(pattern);
    if (phoneMatch) {
      result.phone = phoneMatch[1];
      break;
    }
  }

  // 5. 提取第三方联系人姓名
  const emergencyContactPatterns = [
    /第三方联系人姓名[：:]\s*([^0-9\s]{2,4})/,
    /紧急联系人[：:]\s*([^0-9\s]{2,4})/,
    /联系人[：:]\s*([^0-9\s]{2,4})/,
  ];

  for (const pattern of emergencyContactPatterns) {
    const contactMatch = cleanText.match(pattern);
    if (contactMatch) {
      result.emergencyContact = contactMatch[1].trim();
      break;
    }
  }

  // 6. 提取第三方联系方式
  const emergencyPhonePatterns = [
    /第三方联系方式[：:]\s*([0-9]{11})/,
    /紧急联系方式[：:]\s*([0-9]{11})/,
  ];

  for (const pattern of emergencyPhonePatterns) {
    const emergencyPhoneMatch = cleanText.match(pattern);
    if (emergencyPhoneMatch) {
      result.emergencyPhone = emergencyPhoneMatch[1];
      break;
    }
  }

  // 7. 提取关系
  const relationshipPatterns = [
    /与本人关系[：:]\s*([^0-9\s]{2,4})/,
    /关系[：:]\s*([^0-9\s]{2,4})/,
  ];

  for (const pattern of relationshipPatterns) {
    const relationshipMatch = cleanText.match(pattern);
    if (relationshipMatch) {
      result.relationship = relationshipMatch[1].trim();
      break;
    }
  }

  // 8. 提取驾驶证信息
  const localLicenseMatch = cleanText.match(/是否有地方驾驶证[：:]\s*(是|否)/);
  if (localLicenseMatch) {
    result.hasLocalLicense = localLicenseMatch[1] === '是';
  }

  const internalLicenseMatch =
    cleanText.match(/是否有内部驾驶证[：:]\s*(是|否)/);
  if (internalLicenseMatch) {
    result.hasInternalLicense = internalLicenseMatch[1] === '是';
  }

  const driveFrequentlyMatch =
    cleanText.match(/在外是否经常开车[：:]\s*(是|否)/);
  if (driveFrequentlyMatch) {
    result.driveFrequently = driveFrequentlyMatch[1] === '是';
  }

  // 9. 生成备注信息
  const notes = [];
  if (result.hasLocalLicense !== undefined) {
    notes.push(`地方驾驶证：${result.hasLocalLicense ? '有' : '无'}`);
  }
  if (result.hasInternalLicense !== undefined) {
    notes.push(`内部驾驶证：${result.hasInternalLicense ? '有' : '无'}`);
  }
  if (result.driveFrequently !== undefined) {
    notes.push(`在外开车：${result.driveFrequently ? '经常' : '不经常'}`);
  }

  if (notes.length > 0) {
    result.notes = notes.join('；');
  }

  return result;
}

/**
 * 将简化日期格式转换为完整日期格式
 * @param dateStr 简化日期字符串，如 "9-16" 或 "10-9"
 * @param year 年份
 * @returns 完整日期字符串，如 "2025-09-16"
 */
function convertToFullDate(dateStr: string, year: number): string {
  const parts = dateStr.split('-');
  if (parts.length !== 2) return '';

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 验证解析结果的完整性
 * @param parsed 解析结果
 * @returns 验证结果和缺失字段
 */
export function validateParsedInfo(parsed: ParsedLeaveInfo): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // 必填字段检查
  if (!parsed.name) missingFields.push('姓名');
  if (!parsed.location) missingFields.push('休假地点');
  if (!parsed.startDate) missingFields.push('开始日期');
  if (!parsed.endDate) missingFields.push('结束日期');
  if (!parsed.phone) missingFields.push('本人联系方式');
  if (!parsed.emergencyContact) missingFields.push('紧急联系人姓名');
  if (!parsed.emergencyPhone) missingFields.push('紧急联系人电话');

  // 警告检查
  if (parsed.days && parsed.days > 30) {
    warnings.push('休假天数超过30天，请确认是否正确');
  }

  if (
    parsed.phone &&
    parsed.emergencyPhone &&
    parsed.phone === parsed.emergencyPhone
  ) {
    warnings.push('本人联系方式与紧急联系人电话相同');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
