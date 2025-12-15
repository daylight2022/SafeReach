import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../utils/constants';
import { Department, PersonStatus } from '../types';

type PersonType = 'employee' | 'intern' | 'manager';
type LeaveType = 'vacation' | 'business' | 'study' | 'hospitalization' | 'care';

type SectionKey = 'department' | 'leaveType' | 'personType' | 'status';

interface Props {
  departments: Department[];

  currentStatus: PersonStatus[];
  onStatusChange: (status: PersonStatus[]) => void;

  currentPersonType: PersonType[];
  onPersonTypeChange: (type: PersonType[]) => void;

  currentDepartment: string[];
  onDepartmentChange: (departmentIds: string[]) => void;

  currentLeaveType: LeaveType[];
  onLeaveTypeChange: (types: LeaveType[]) => void;
}

const PersonFilterBar: React.FC<Props> = ({
  departments,
  currentStatus,
  onStatusChange,
  currentPersonType,
  onPersonTypeChange,
  currentDepartment,
  onDepartmentChange,
  currentLeaveType,
  onLeaveTypeChange,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  const departmentOptions = useMemo(() => {
    const filteredDepartments = departments.filter(dept => dept.level > 1);
    return filteredDepartments.map(dept => ({
      value: dept.id,
      label: dept.name,
      color: COLORS.primary,
    }));
  }, [departments]);

  const statusOptions = useMemo(
    () =>
      [
        { value: 'urgent' as const, label: '紧急', color: COLORS.danger },
        { value: 'suggest' as const, label: '建议', color: COLORS.warning },
        { value: 'normal' as const, label: '正常', color: COLORS.success },
      ],
    [],
  );

  const personTypeOptions = useMemo(
    () =>
      [
        { value: 'employee' as const, label: '员工', color: COLORS.primary },
        { value: 'manager' as const, label: '小组长', color: COLORS.success },
        { value: 'intern' as const, label: '实习生', color: '#F59E0B' },
      ],
    [],
  );

  const leaveTypeOptions = useMemo(
    () =>
      [
        { value: 'vacation' as const, label: '休假', color: '#10B981' },
        { value: 'business' as const, label: '出差', color: '#3B82F6' },
        { value: 'study' as const, label: '学习', color: '#8B5CF6' },
        { value: 'hospitalization' as const, label: '住院', color: '#EF4444' },
        { value: 'care' as const, label: '陪护', color: '#F59E0B' },
      ],
    [],
  );

  const toggleSelection = <T,>(
    currentSelection: T[],
    value: T,
    onChange: (selection: T[]) => void,
  ) => {
    if (currentSelection.includes(value)) {
      onChange(currentSelection.filter(item => item !== value));
    } else {
      onChange([...currentSelection, value]);
    }
  };

  const getSectionSummary = (key: SectionKey) => {
    switch (key) {
      case 'department':
        return currentDepartment.length > 0 ? `${currentDepartment.length}项` : '全部';
      case 'leaveType':
        return currentLeaveType.length > 0 ? `${currentLeaveType.length}项` : '全部';
      case 'personType':
        return currentPersonType.length > 0 ? `${currentPersonType.length}项` : '全部';
      case 'status':
        return currentStatus.length > 0 ? `${currentStatus.length}项` : '全部';
      default:
        return '全部';
    }
  };

  const renderDropdown = () => {
    if (!activeSection) return null;

    const headerTitleMap: Record<SectionKey, string> = {
      department: '单位',
      leaveType: '在外',
      personType: '类型',
      status: '状态',
    };

    const onClearCurrent = () => {
      switch (activeSection) {
        case 'department':
          onDepartmentChange([]);
          return;
        case 'leaveType':
          onLeaveTypeChange([]);
          return;
        case 'personType':
          onPersonTypeChange([]);
          return;
        case 'status':
          onStatusChange([]);
          return;
      }
    };

    const renderGrid = <T,>(
      options: Array<{ value: T; label: string; color: string }>,
      selectedValues: T[],
      onToggle: (value: T) => void,
    ) => {
      return (
        <View style={styles.grid}>
          {options.map(option => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <TouchableOpacity
                key={String(option.value)}
                style={[styles.gridItem, isSelected && styles.gridItemActive]}
                onPress={() => onToggle(option.value)}
              >
                <View style={styles.gridItemContent}>
                  <View style={[styles.dot, { backgroundColor: option.color }]} />
                  <Text
                    numberOfLines={1}
                    style={[styles.gridItemText, isSelected && styles.gridItemTextActive]}
                  >
                    {option.label}
                  </Text>
                </View>

                <Icon
                  name={isSelected ? 'check' : 'plus'}
                  size={12}
                  color={isSelected ? COLORS.primary : '#9CA3AF'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    };

    return (
      <View style={styles.dropdown}>
        <View style={styles.dropdownHeader}>
          <Text style={styles.dropdownTitle}>{headerTitleMap[activeSection]}</Text>
          <View style={styles.dropdownActions}>
            <TouchableOpacity style={styles.dropdownActionBtn} onPress={onClearCurrent}>
              <Text style={styles.dropdownActionText}>清空</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownActionBtn, styles.dropdownActionBtnPrimary]}
              onPress={() => setActiveSection(null)}
            >
              <Text style={[styles.dropdownActionText, styles.dropdownActionTextPrimary]}>
                完成
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.dropdownList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.dropdownListContent}
        >
          {activeSection === 'department' &&
            renderGrid(
              departmentOptions,
              currentDepartment,
              value => toggleSelection(currentDepartment, value, onDepartmentChange),
            )}

          {activeSection === 'leaveType' &&
            renderGrid(
              leaveTypeOptions,
              currentLeaveType,
              value => toggleSelection(currentLeaveType, value, onLeaveTypeChange),
            )}

          {activeSection === 'personType' &&
            renderGrid(
              personTypeOptions,
              currentPersonType,
              value => toggleSelection(currentPersonType, value, onPersonTypeChange),
            )}

          {activeSection === 'status' &&
            renderGrid(
              statusOptions,
              currentStatus,
              value => toggleSelection(currentStatus, value, onStatusChange),
            )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}
        style={styles.pillsContainer}
      >
        <TouchableOpacity
          style={[styles.pill, activeSection === 'department' && styles.pillActive]}
          onPress={() => {
            setActiveSection(prev => (prev === 'department' ? null : 'department'));
          }}
        >
          <Text style={[styles.pillLabel, activeSection === 'department' && styles.pillLabelActive]}>
            单位
          </Text>
          <Text
            style={[styles.pillValue, activeSection === 'department' && styles.pillValueActive]}
          >
            {getSectionSummary('department')}
          </Text>
          <Icon
            name={activeSection === 'department' ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={activeSection === 'department' ? COLORS.primary : '#6B7280'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, activeSection === 'leaveType' && styles.pillActive]}
          onPress={() => {
            setActiveSection(prev => (prev === 'leaveType' ? null : 'leaveType'));
          }}
        >
          <Text style={[styles.pillLabel, activeSection === 'leaveType' && styles.pillLabelActive]}>
            在外
          </Text>
          <Text style={[styles.pillValue, activeSection === 'leaveType' && styles.pillValueActive]}>
            {getSectionSummary('leaveType')}
          </Text>
          <Icon
            name={activeSection === 'leaveType' ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={activeSection === 'leaveType' ? COLORS.primary : '#6B7280'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, activeSection === 'personType' && styles.pillActive]}
          onPress={() => {
            setActiveSection(prev => (prev === 'personType' ? null : 'personType'));
          }}
        >
          <Text
            style={[styles.pillLabel, activeSection === 'personType' && styles.pillLabelActive]}
          >
            类型
          </Text>
          <Text style={[styles.pillValue, activeSection === 'personType' && styles.pillValueActive]}>
            {getSectionSummary('personType')}
          </Text>
          <Icon
            name={activeSection === 'personType' ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={activeSection === 'personType' ? COLORS.primary : '#6B7280'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, activeSection === 'status' && styles.pillActive]}
          onPress={() => {
            setActiveSection(prev => (prev === 'status' ? null : 'status'));
          }}
        >
          <Text style={[styles.pillLabel, activeSection === 'status' && styles.pillLabelActive]}>
            状态
          </Text>
          <Text style={[styles.pillValue, activeSection === 'status' && styles.pillValueActive]}>
            {getSectionSummary('status')}
          </Text>
          <Icon
            name={activeSection === 'status' ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={activeSection === 'status' ? COLORS.primary : '#6B7280'}
          />
        </TouchableOpacity>
      </ScrollView>

      {renderDropdown()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  pillsContainer: {
    maxHeight: 36,
  },
  pillsContent: {
    gap: 8,
    paddingRight: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  pillLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  pillLabelActive: {
    color: COLORS.primary,
  },
  pillValue: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  pillValueActive: {
    color: COLORS.primary,
  },
  dropdown: {
    marginTop: 10,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dropdownTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  dropdownActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  dropdownActionBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  dropdownActionText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  dropdownActionTextPrimary: {
    color: COLORS.white,
  },
  dropdownList: {
    maxHeight: 240,
  },
  dropdownListContent: {
    padding: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gridItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  gridItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gridItemText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },
  gridItemTextActive: {
    color: COLORS.primary,
  },
});

export default PersonFilterBar;
