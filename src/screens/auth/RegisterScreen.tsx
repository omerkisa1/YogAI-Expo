import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import AuthInput from '@/shared/components/AuthInput';
import Button from '@/shared/components/Button';
import Touchable from '@/shared/components/Touchable';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import type { AuthStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
interface RegisterFormValues {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const mapFirebaseError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return { text1: 'Kayıt başarısız', text2: 'Bu e-posta zaten kullanımda.' };
    case 'auth/weak-password':
      return { text1: 'Zayıf şifre', text2: 'Şifre en az 6 karakter olmalı.' };
    case 'auth/invalid-email':
      return { text1: 'Geçersiz e-posta', text2: 'Lütfen geçerli bir e-posta adresi girin.' };
    case 'auth/network-request-failed':
      return { text1: 'Bağlantı hatası', text2: 'İnternet bağlantınızı kontrol edin.' };
    default:
      return { text1: 'Kayıt başarısız', text2: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' };
  }
};

const RegisterScreen = ({ navigation }: Props) => {
  const { registerWithEmail, signInWithGoogle, isSubmitting } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
  });

  const passwordValue = watch('password');
  const loading = isSubmitting || isFormSubmitting;

  const onSubmit = handleSubmit(async values => {
    if (isOffline) {
      Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' });
      return;
    }
    try {
      await registerWithEmail(values.email.trim(), values.password, values.displayName.trim());
      Toast.show({ type: 'success', position: 'top', text1: 'Kayıt başarılı', text2: 'Hesabınız oluşturuldu.' });
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  const onGoogleRegister = async () => {
    if (isOffline) {
      Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok' });
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Controller
            name="displayName"
            control={control}
            rules={{ required: 'Ad soyad zorunlu', minLength: { value: 2, message: 'Ad soyad en az 2 karakter olmalı' } }}
            render={({ field: { value, onChange } }) => (
              <AuthInput
                label="Ad Soyad"
                placeholder="Adınız ve soyadınız"
                leftIcon="account-outline"
                value={value}
                onChangeText={onChange}
                error={errors.displayName?.message}
                autoCapitalize="words"
                textContentType="name"
                accessibilityLabel="Ad Soyad"
              />
            )}
          />

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
                accessibilityLabel="E-posta"
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
                textContentType="newPassword"
                accessibilityLabel="Şifre"
              />
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            rules={{
              required: 'Şifre tekrarı zorunlu',
              validate: value => value === passwordValue || 'Şifreler eşleşmiyor',
            }}
            render={({ field: { value, onChange } }) => (
              <AuthInput
                label="Şifre Tekrar"
                placeholder="Şifrenizi tekrar girin"
                leftIcon="lock-check-outline"
                value={value}
                onChangeText={onChange}
                error={errors.confirmPassword?.message}
                secureTextEntry={!isConfirmPasswordVisible}
                rightIcon={isConfirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setIsConfirmPasswordVisible(prev => !prev)}
                textContentType="newPassword"
                accessibilityLabel="Şifre tekrar"
              />
            )}
          />

          <Button title="Kayıt Ol" onPress={onSubmit} variant="primary" size="lg" fullWidth loading={loading} disabled={loading} accessibilityLabel="Kayıt ol" />

          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>veya</Text>
            <View style={styles.separatorLine} />
          </View>

          <Touchable
            onPress={() => void onGoogleRegister()}
            disabled={loading}
            style={[styles.googleButton, loading && styles.googleDisabled]}
            borderRadius={radius.full}
            accessibilityRole="button"
            accessibilityLabel="Google ile kayıt ol"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <>
                <View style={styles.googleIconWrap}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleLabel}>Google ile Kayıt Ol</Text>
              </>
            )}
          </Touchable>

          <View style={styles.footerRow}>
            <Text style={styles.footerMuted}>Zaten hesabın var mı? </Text>
            <Touchable onPress={() => navigation.navigate('Login')} borderRadius={radius.sm} accessibilityRole="button" accessibilityLabel="Giriş yap">
              <Text style={styles.footerBold}>Giriş Yap</Text>
            </Touchable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.huge,
  },
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
});

export default RegisterScreen;
