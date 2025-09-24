import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppState } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '@/utils/constants';
import { userStorage } from '@/utils/storage';
import { useFocusEffect } from '@react-navigation/native';
import { authEvents } from '@/utils/authEvents';

// Import screens
import LoginScreen from '@/screens/LoginScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import PersonListScreen from '@/screens/PersonListScreen';
import PersonDetailScreen from '@/screens/PersonDetailScreen';
import AddPersonScreen from '@/screens/AddPersonScreen';
import StatisticsScreen from '@/screens/StatisticsScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import PersonalInfoScreen from '@/screens/PersonalInfoScreen';
import GeneralSettingsScreen from '@/screens/GeneralSettingsScreen';
import ReminderSettingsScreen from '@/screens/ReminderSettingsScreen';
import OrganizationScreen from '@/screens/OrganizationScreen';
import HelpCenterScreen from '@/screens/HelpCenterScreen';
import AboutScreen from '@/screens/AboutScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'home'; // 默认图标
          if (route.name === 'Dashboard') iconName = 'home';
          else if (route.name === 'PersonList') iconName = 'users';
          else if (route.name === 'Statistics') iconName = 'bar-chart';
          else if (route.name === 'Profile') iconName = 'user';

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.darkGray,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12 },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: '首页' }}
      />
      <Tab.Screen
        name="PersonList"
        component={PersonListScreen}
        options={{ title: '人员' }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{ title: '统计' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: '我的' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 检查登录状态的函数
  const checkLoginStatus = React.useCallback(() => {
    const isUserLoggedIn = userStorage.isLoggedIn();
    setIsLoggedIn(isUserLoggedIn);
  }, []);

  // 初始检查登录状态
  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  // 当导航器获得焦点时重新检查登录状态
  useFocusEffect(
    React.useCallback(() => {
      checkLoginStatus();
    }, [checkLoginStatus]),
  );

  // 监听应用状态变化，当应用从后台回到前台时检查登录状态
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkLoginStatus();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [checkLoginStatus]);

  // 监听认证事件，立即响应登录状态变化
  useEffect(() => {
    const removeListener = authEvents.addListener(checkLoginStatus);
    return removeListener;
  }, [checkLoginStatus]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <Stack.Screen name="Login">
          {props => <LoginScreen {...props} setIsLoggedIn={setIsLoggedIn} />}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
          <Stack.Screen name="AddPerson" component={AddPersonScreen} />
          <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
          <Stack.Screen
            name="GeneralSettings"
            component={GeneralSettingsScreen}
          />
          <Stack.Screen
            name="ReminderSettings"
            component={ReminderSettingsScreen}
          />
          <Stack.Screen name="Organization" component={OrganizationScreen} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
