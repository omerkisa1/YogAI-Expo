import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import BottomSheet from '@/shared/components/BottomSheet';
import Button from '@/shared/components/Button';
import AuthInput from '@/shared/components/AuthInput';
import Touchable from '@/shared/components/Touchable';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import type { AuthStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface LoginFormValues { email: string; password: string }
interface PasswordResetFormValues { email: string }

const serifBrand = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const mapFirebaseError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/user-not-found': return { text1: 'Giriş Başarısız', text2: 'Bu email ile kayıtlı kullanıcı bulunamadı.' };
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return { text1: 'Giriş Başarısız', text2: 'Şifre hatalı. Lütfen tekrar deneyin.' };
    case 'auth/invalid-email': return { text1: 'Geçersiz email', text2: 'Lütfen geçerli bir email adresi girin.' };
    case 'auth/too-many-requests': return { text1: 'Çok fazla deneme', text2: 'Lütfen bir süre bekleyip tekrar deneyin.' };
    case 'auth/network-request-failed': return { text1: 'Bağlantı hatası', text2: 'İnternet bağlantınızı kontrol edin.' };
    default: return { text1: 'Giriş Başarısız', text2: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' };
  }
};

const LoginScreen = ({ navigation }: Props) => {
  const { signInWithEmail, signInWithGoogle, resetPassword, isSubmitting } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isResetSheetVisible, setIsResetSheetVisible] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    setValue: setResetValue,
    formState: { errors: resetErrors },
  } = useForm<PasswordResetFormValues>({ defaultValues: { email: '' } });

  const currentEmail = watch('email');

  useEffect(() => {
    if (currentEmail?.trim()) setResetValue('email', currentEmail.trim());
  }, [currentEmail, setResetValue]);

  const separator = useMemo(
    () => (
      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>veya</Text>
        <View style={styles.separatorLine} />
      </View>
    ),
    [],
  );

  const onSubmit = handleSubmit(async values => {
    if (isOffline) { Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' }); return; }
    try {
      await signInWithEmail(values.email.trim(), values.password);
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  const onGoogleSignIn = async () => {
    if (isOffline) { Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' }); return; }
    try { await signInWithGoogle(); } catch (error) { const mapped = mapFirebaseError(error); Toast.show({ type: 'error', position: 'top', ...mapped }); }
  };

  const onResetPassword = handleResetSubmit(async values => {
    if (isOffline) { Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok' }); return; }
    try {
      await resetPassword(values.email.trim());
      setIsResetSheetVisible(false);
      Toast.show({ type: 'success', position: 'top', text1: 'Başarılı', text2: 'Şifre sıfırlama linki gönderildi.' });
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#EDE9E2', '#E5E0D8', '#EFEAE4']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <BlurView intensity={Platform.OS === 'ios' ? 28 : 22} tint="light" style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.wordmark}>YogAI</Text>

              <Controller
                name="email"
                control={control}
                rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
                render={({ field: { value, onChange } }) => (
                  <AuthInput
                    label="E-posta"
                    placeholder="E-postanızı girin"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    accessibilityLabel="E-posta adresi"
                  />
                )}
              />

              <Touchable
                onPress={() => setIsResetSheetVisible(true)}
                disabled={isSubmitting}
                style={styles.forgotRow}
                borderRadius={radius.md}
                accessibilityRole="button"
                accessibilityLabel="Şifremi unuttum"
              >
                <Text style={styles.forgotText}>Şifremi unuttum</Text>
              </Touchable>

              <Controller
                name="password"
                control={control}
                rules={{ required: 'Şifre zorunlu', minLength: { value: 6, message: 'Şifre en az 6 karakter olmalı' } }}
                render={({ field: { value, onChange } }) => (
                  <View style={styles.passwordBlock}>
                    <AuthInput
                      label="Şifre"
                      placeholder="Şifrenizi girin"
                      value={value}
                      onChangeText={onChange}
                      error={errors.password?.message}
                      secureTextEntry={!isPasswordVisible}
                      rightIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      onRightIconPress={() => setIsPasswordVisible(prev => !prev)}
                      textContentType="password"
                      accessibilityLabel="Şifre"
                    />
                  </View>
                )}
              />

              <Touchable
                onPress={onSubmit}
                disabled={isSubmitting}
                style={[styles.pillPrimary, isSubmitting && styles.pillDisabled]}
                borderRadius={radius.full}
                accessibilityRole="button"
                accessibilityLabel="Giriş yap"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <View style={styles.pillInner}>
                    <Text style={styles.pillPrimaryText}>Giriş yap</Text>
                    <MaterialCommunityIcons name="arrow-right" size={22} color={colors.textOnPrimary} />
                  </View>
                )}
              </Touchable>

              {separator}

              <Touchable onPress={onGoogleSignIn} disabled={isSubmitting} style={[styles.googleButton, isSubmitting && styles.googleButtonDisabled]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Google ile giriş yap">
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <>
                    <View style={styles.googleIconWrap}><Text style={styles.googleIconText}>G</Text></View>
                    <Text style={styles.googleButtonText}>Google ile giriş yap</Text>
                  </>
                )}
              </Touchable>
            </View>

            <View style={styles.footerRegister}>
              <Text style={styles.footerMuted}>{`YogAI'de yeni misin? `}</Text>
              <Touchable onPress={() => navigation.navigate('Register')} borderRadius={radius.sm} accessibilityRole="button" accessibilityLabel="Kayıt ol ekranına git">
                <Text style={styles.footerLinkBold}>Hesap oluştur</Text>
              </Touchable>
            </View>

            <Text style={styles.legalFooter}>
              Devam ederek Kullanım Şartları ve Gizlilik Politikası kapsamında veri işlenmesini kabul etmiş olursun.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BottomSheet visible={isResetSheetVisible} onClose={() => setIsResetSheetVisible(false)} title="Şifre sıfırlama">
        <Controller
          name="email"
          control={resetControl}
          rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
          render={({ field: { value, onChange } }) => (
            <AuthInput label="E-posta" placeholder="E-postanızı girin" value={value} onChangeText={onChange} error={resetErrors.email?.message} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Şifre sıfırlama e-postası" />
          )}
        />
        <View style={styles.sheetActions}>
          <Button title="İptal" onPress={() => setIsResetSheetVisible(false)} variant="ghost" size="md" fullWidth accessibilityLabel="İptal" />
          <Button title="Sıfırlama linki gönder" onPress={onResetPassword} variant="primary" size="md" loading={isSubmitting} disabled={isSubmitting} fullWidth accessibilityLabel="Sıfırlama linki gönder" />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    paddingBottom: spacing.huge,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + spacing.sm,
    ...shadows.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  wordmark: {
    fontFamily: serifBrand,
    fontSize: 36,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.xl,
    letterSpacing: 0.5,
  },
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.sm },
  forgotText: { ...typography.bodySmMedium, color: colors.primary },
  passwordBlock: { marginTop: -spacing.xs },
  pillPrimary: {
    minHeight: 54,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    ...shadows.sm,
  },
  pillDisabled: { opacity: 0.55 },
  pillInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pillPrimaryText: { ...typography.buttonLg, color: colors.textOnPrimary },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { ...typography.caption, color: colors.textMuted },
  googleButton: {
    minHeight: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonDisabled: { opacity: 0.6 },
  googleIconWrap: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderLight, marginRight: spacing.sm },
  googleIconText: { ...typography.bodySmMedium, color: '#4285F4' },
  googleButtonText: { ...typography.buttonMd, color: colors.text },
  footerRegister: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 2,
  },
  footerMuted: { ...typography.bodySm, color: colors.textSecondary },
  footerLinkBold: { ...typography.bodySmMedium, color: colors.primary, fontWeight: '700' },
  legalFooter: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18, paddingHorizontal: spacing.sm },
  sheetActions: { gap: spacing.sm, marginTop: spacing.sm },
});

export default LoginScreen;
