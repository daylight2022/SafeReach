import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import { authService } from '@/services/api';
import { userStorage } from '@/utils/storage';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';

interface LoginScreenProps {
  setIsLoggedIn: (value: boolean) => void;
}

const LoginScreen = ({ setIsLoggedIn }: LoginScreenProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = () => {
    try {
      const savedData = userStorage.get();
      if (savedData) {
        setUsername(savedData.username || '');
        if (savedData.rememberMe && savedData.password) {
          setPassword(savedData.password);
          setRememberMe(true);
        }
      }
    } catch (error) {
      console.error('加载保存的凭据失败:', error);
    }
  };

  // 处理用户名输入，去除多余空格
  const handleUsernameChange = (text: string) => {
    // 去除首尾空格，但保留中间的空格（如果用户名确实包含空格）
    const cleanedText = text.replace(/^\s+|\s+$/g, '');
    setUsername(cleanedText);
  };

  const handleLogin = async () => {
    // 预处理用户名：去除首尾空格，转换为小写
    const cleanedUsername = username.trim().toLowerCase();
    const cleanedPassword = password.trim();

    if (!cleanedUsername || !cleanedPassword) {
      toast({
        title: '请输入账号和密码',
        preset: 'error',
        duration: 2,
      });
      return;
    }

    try {
      // 直接发送明文密码，后端会进行加密验证
      console.log('登录尝试:', cleanedUsername);

      // 使用新的API服务进行登录
      const result = await authService.login(cleanedUsername, cleanedPassword);

      console.log('res', result);
      if (!result.success) {
        console.error('登录失败:', result.message);
        toast({
          title: '登录失败',
          message: result.message || '账号或密码错误',
          preset: 'error',
          duration: 3,
        });
        return;
      }

      // 验证成功，存储用户信息
      const userData = {
        username: cleanedUsername,
        loginTime: new Date().toISOString(),
        rememberMe,
        ...(rememberMe && { password: cleanedPassword }), // 只有记住密码时才保存密码
      };

      const success = userStorage.save(userData);
      if (!success) {
        throw new Error('存储用户数据失败');
      }

      setIsLoggedIn(true);
      toast({
        title: '登录成功',
        preset: 'done',
        duration: 2,
      });
    } catch (error) {
      console.error('登录错误:', error);
      toast({
        title: '登录失败',
        message:
          error instanceof Error
            ? error.message
            : '网络连接异常，请检查网络设置',
        preset: 'error',
        duration: 3,
      });
    }
  };

  return (
    <LinearGradient colors={COLORS.primaryGradient} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="users" size={40} color={COLORS.white} />
          </View>
          <Text style={styles.title}>安心通</Text>
          <Text style={styles.subtitle}>
            轻松掌握在外动态，关怀提醒一键通达
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Icon
              name="user"
              size={16}
              color="rgba(255,255,255,0.6)"
              style={styles.inputIcon}
            />
            <TextInput
              placeholder="请输入账号"
              value={username}
              onChangeText={handleUsernameChange}
              style={styles.input}
              placeholderTextColor="rgba(255,255,255,0.6)"
              underlineColorAndroid="transparent"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon
              name="lock"
              size={16}
              color="rgba(255,255,255,0.6)"
              style={styles.inputIcon}
            />
            <TextInput
              placeholder="请输入密码"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={[styles.input, styles.passwordInput]}
              placeholderTextColor="rgba(255,255,255,0.6)"
              underlineColorAndroid="transparent"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon
                name={showPassword ? 'eye' : 'eye-slash'}
                size={16}
                color="rgba(255,255,255,0.6)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.rememberContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setRememberMe(!rememberMe)}
            >
              {rememberMe && (
                <Icon name="check" size={12} color={COLORS.white} />
              )}
            </TouchableOpacity>
            <Text style={styles.rememberText}>记住密码</Text>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>登录</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.white,
    height: '100%',
    paddingVertical: 0,
    textAlignVertical: 'center',
    paddingTop: 6,
  },
  passwordInput: {
    paddingRight: 8, // 为眼睛图标留出空间
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;
