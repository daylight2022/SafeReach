import { Linking, Alert, Platform } from 'react-native';

/**
 * 尝试打开微信
 */
export async function openWeChat() {
  const wechatScheme = 'weixin://';

  // 先检查本机是否装了微信
  const canOpen = await Linking.canOpenURL(wechatScheme);
  if (!canOpen) {
    Alert.alert('提示', '未检测到微信，请先安装微信');
    return;
  }

  // 真正调起
  try {
    await Linking.openURL(wechatScheme);
  } catch (e) {
    Alert.alert('提示', '打开微信失败：' + (e as Error).message);
  }
}
