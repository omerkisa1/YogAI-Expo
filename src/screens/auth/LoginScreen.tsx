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
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface LoginFormValues {
  email: string;
  password: string;
}
interface PasswordResetFormValues {
  email: string;
}

const mapFirebaseError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/user-not-found':
      return { text1: 'Giriş başarısız', text2: 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.' };
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return { text1: 'Giriş başarısız', text2: 'Şifre hatalı. Lütfen tekrar deneyin.' };
    case 'auth/invalid-email':
      return { text1: 'Geçersiz e-posta', text2: 'Lütfen geçerli bir e-posta adresi girin.' };
    case 'auth/too-many-requests':
      return { text1: 'Çok fazla deneme', text2: 'Lütfen bir süre bekleyip tekrar deneyin.' };
    case 'auth/network-request-failed':
      return { text1: 'Bağlantı hatası', text2: 'İnternet bağlantınızı kontrol edin.' };
    default:
      return { text1: 'Giriş başarısız', text2: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' };
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
    if (isOffline) {
      Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' });
      return;
    }
    try {
      await signInWithEmail(values.email.trim(), values.password);
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  const onGoogleSignIn = async () => {
    if (isOffline) {
      Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' });
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  };

  const onResetPassword = handleResetSubmit(async values => {
    if (isOffline) {
      Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok' });
      return;
    }
    try {
      await resetPassword(values.email.trim());
      setIsResetSheetVisible(false);
      Toast.show({ type: 'success', position: 'top', text1: 'Başarılı', text2: 'Şifre sıfırlama bağlantısı gönderildi.' });
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <View style={styles.flex}>
          <LinearGradient
            colors={[...colors.gradientPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <MaterialCommunityIcons name="meditation" size={64} color={colors.textOnPrimary} />
            <Text style={styles.brand}>YogAI</Text>
            <Text style={styles.tagline}>Kişisel AI yoga asistanınız</Text>
          </LinearGradient>

          <KeyboardAvoidingView style={styles.lower} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: 'E-posta zorunlu',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli e-posta adresi girin' },
                }}
                render={({ field: { value, onChange } }) => (
                  <AuthInput
                    label="E-posta"
                    placeholder="E-posta adresiniz"
                    leftIcon="email-outline"
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

              <Controller
                name="password"
                control={control}
                rules={{ required: 'Şifre zorunlu', minLength: { value: 6, message: 'Şifre en az 6 karakter olmalı' } }}
                render={({ field: { value, onChange } }) => (
                  <AuthInput
                    label="Şifre"
                    placeholder="Şifreniz"
                    leftIcon="lock-outline"
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                    secureTextEntry={!isPasswordVisible}
                    rightIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                    onRightIconPress={() => setIsPasswordVisible(prev => !prev)}
                    textContentType="password"
                    accessibilityLabel="Şifre"
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

              <Button
                title="Giriş Yap"
                onPress={() => void onSubmit()}
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                disabled={isSubmitting}
                accessibilityLabel="Giriş yap"
              />

              {separator}

              <Touchable
                onPress={() => void onGoogleSignIn()}
                disabled={isSubmitting}
                style={[styles.googleButton, isSubmitting && styles.googleDisabled]}
                borderRadius={radius.full}
                accessibilityRole="button"
                accessibilityLabel="Google ile giriş yap"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <>
                    <View style={styles.googleIconWrap}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.googleLabel}>Google ile Giriş Yap</Text>
                  </>
                )}
              </Touchable>

              <View style={styles.footerRow}>
                <Text style={styles.footerMuted}>Hesabın yok mu? </Text>
                <Touchable onPress={() => navigation.navigate('Register')} borderRadius={radius.sm} accessibilityRole="button" accessibilityLabel="Kayıt ol">
                  <Text style={styles.footerBold}>Kayıt Ol</Text>
                </Touchable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      <BottomSheet visible={isResetSheetVisible} onClose={() => setIsResetSheetVisible(false)} title="Şifre sıfırlama">
        <Controller
          name="email"
          control={resetControl}
          rules={{
            required: 'E-posta zorunlu',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli e-posta adresi girin' },
          }}
          render={({ field: { value, onChange } }) => (
            <AuthInput
              label="E-posta"
              placeholder="E-posta adresiniz"
              leftIcon="email-outline"
              value={value}
              onChangeText={onChange}
              error={resetErrors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Şifre sıfırlama e-postası"
            />
          )}
        />
        <View style={styles.sheetActions}>
          <Button title="İptal" onPress={() => setIsResetSheetVisible(false)} variant="ghost" size="md" fullWidth accessibilityLabel="İptal" />
          <Button
            title="Sıfırlama bağlantısı gönder"
            onPress={onResetPassword}
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
            accessibilityLabel="Sıfırlama bağlantısı gönder"
          />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeTop: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  hero: {
    flex: 0.35,
    minHeight: 200,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  brand: { ...typography.display, color: colors.textOnPrimary, marginTop: spacing.md },
  tagline: { ...typography.bodySm, color: 'rgba(255,255,255,0.82)', marginTop: spacing.sm, textAlign: 'center' },
  lower: { flex: 0.65 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.huge },
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.sm },
  forgotText: { ...typography.bodySm, color: colors.primary, fontWeight: '700' },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { ...typography.caption, color: colors.textMuted },
  googleButton: {
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googleDisabled: { opacity: 0.6 },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  googleG: { ...typography.bodySmMedium, color: '#4285F4' },
  googleLabel: { ...typography.buttonMd, color: colors.text },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.xl },
  footerMuted: { ...typography.bodySm, color: colors.textSecondary },
  footerBold: { ...typography.bodySmMedium, color: colors.primary, fontWeight: '700' },
  sheetActions: { gap: spacing.sm, marginTop: spacing.sm },
});

export default LoginScreen;
