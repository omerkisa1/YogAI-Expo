import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import Input from '@/shared/components/Input';
import Touchable from '@/shared/components/Touchable';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import type { AuthStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
interface RegisterFormValues { displayName: string; email: string; password: string; confirmPassword: string }

const mapFirebaseError = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use': return { text1: 'Kayıt Başarısız', text2: 'Bu email zaten kullanımda.' };
    case 'auth/weak-password': return { text1: 'Zayıf Şifre', text2: 'Şifre en az 6 karakter olmalı.' };
    case 'auth/invalid-email': return { text1: 'Geçersiz email', text2: 'Lütfen geçerli bir email adresi girin.' };
    case 'auth/network-request-failed': return { text1: 'Bağlantı hatası', text2: 'İnternet bağlantınızı kontrol edin.' };
    default: return { text1: 'Kayıt Başarısız', text2: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' };
  }
};

const RegisterScreen = ({ navigation }: Props) => {
  const { registerWithEmail, signInWithGoogle, isSubmitting } = useAuth();
  const { isOffline } = useNetworkStatus();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const { control, handleSubmit, watch, formState: { errors, isSubmitting: isFormSubmitting } } = useForm<RegisterFormValues>({
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
  });

  const passwordValue = watch('password');
  const loading = isSubmitting || isFormSubmitting;

  const onSubmit = handleSubmit(async values => {
    if (isOffline) { Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok', text2: 'Lütfen bağlantınızı kontrol edip tekrar deneyin.' }); return; }
    try {
      await registerWithEmail(values.email.trim(), values.password, values.displayName.trim());
      Toast.show({ type: 'success', position: 'top', text1: 'Kayıt başarılı', text2: 'Hesabınız oluşturuldu.' });
    } catch (error) {
      const mapped = mapFirebaseError(error);
      Toast.show({ type: 'error', position: 'top', ...mapped });
    }
  });

  const onGoogleRegister = async () => {
    if (isOffline) { Toast.show({ type: 'error', position: 'top', text1: 'İnternet bağlantısı yok' }); return; }
    try { await signInWithGoogle(); } catch (error) { const mapped = mapFirebaseError(error); Toast.show({ type: 'error', position: 'top', ...mapped }); }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Touchable onPress={() => navigation.goBack()} style={styles.backButton} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Geri">
              <MaterialCommunityIcons name="chevron-left" size={24} color={colors.primary} />
              <Text style={styles.backText}>Geri</Text>
            </Touchable>
            <Text style={styles.headerTitle}>Hesap Oluştur</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.subtitle}>Yeni hesabınızla YogAI dünyasına katılın</Text>

            <Controller name="displayName" control={control} rules={{ required: 'Ad Soyad zorunlu', minLength: { value: 2, message: 'Ad Soyad en az 2 karakter olmalı' } }}
              render={({ field: { value, onChange } }) => (
                <Input label="Ad Soyad" placeholder="Ad Soyad" value={value} onChangeText={onChange} error={errors.displayName?.message} icon="account-outline" autoCapitalize="words" textContentType="name" accessibilityLabel="Ad Soyad" />
              )}
            />

            <Controller name="email" control={control} rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
              render={({ field: { value, onChange } }) => (
                <Input label="Email" placeholder="Email adresiniz" value={value} onChangeText={onChange} error={errors.email?.message} icon="email-outline" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" accessibilityLabel="Email" />
              )}
            />

            <Controller name="password" control={control} rules={{ required: 'Şifre zorunlu', minLength: { value: 6, message: 'Şifre en az 6 karakter olmalı' } }}
              render={({ field: { value, onChange } }) => (
                <Input label="Şifre" placeholder="Şifrenizi girin" value={value} onChangeText={onChange} error={errors.password?.message} icon="lock-outline" secureTextEntry={!isPasswordVisible} rightIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} onRightIconPress={() => setIsPasswordVisible(prev => !prev)} accessibilityLabel="Şifre" />
              )}
            />

            <Controller name="confirmPassword" control={control} rules={{ required: 'Şifre tekrarı zorunlu', validate: value => value === passwordValue || 'Şifreler eşleşmiyor' }}
              render={({ field: { value, onChange } }) => (
                <Input label="Şifre Tekrar" placeholder="Şifrenizi tekrar girin" value={value} onChangeText={onChange} error={errors.confirmPassword?.message} icon="lock-check-outline" secureTextEntry={!isConfirmPasswordVisible} rightIcon={isConfirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'} onRightIconPress={() => setIsConfirmPasswordVisible(prev => !prev)} accessibilityLabel="Şifre tekrar" />
              )}
            />

            <Touchable onPress={onSubmit} disabled={loading} style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel="Kayıt ol">
              {loading ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : <Text style={styles.primaryButtonText}>Kayıt Ol</Text>}
            </Touchable>

            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>veya</Text>
              <View style={styles.separatorLine} />
            </View>

            <Touchable onPress={onGoogleRegister} disabled={loading} style={[styles.googleButton, loading && styles.googleButtonDisabled]} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel="Google ile kayıt ol">
              {loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : (
                <>
                  <View style={styles.googleIconWrap}><Text style={styles.googleIconText}>G</Text></View>
                  <Text style={styles.googleButtonText}>Google ile Kayıt Ol</Text>
                </>
              )}
            </Touchable>

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>Zaten hesabın var mı?</Text>
              <Touchable onPress={() => navigation.navigate('Login')} style={styles.loginPressable} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Giriş yap ekranına git">
                <Text style={styles.loginAction}>Giriş Yap</Text>
              </Touchable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoid: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.base, paddingBottom: spacing.huge },
  headerRow: { marginTop: spacing.xs, marginBottom: spacing.base },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  backText: { ...typography.bodySmMedium, color: colors.primary },
  headerTitle: { ...typography.h3, color: colors.text, marginTop: spacing.xs },
  formSection: { paddingTop: spacing.xs, paddingBottom: spacing.xl },
  subtitle: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.base },
  primaryButton: { minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { ...typography.buttonLg, color: colors.textOnPrimary },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.base },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { ...typography.caption, color: colors.textMuted },
  googleButton: { minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleButtonDisabled: { opacity: 0.6 },
  googleIconWrap: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderLight, marginRight: spacing.sm },
  googleIconText: { ...typography.bodySmMedium, color: '#4285F4' },
  googleButtonText: { ...typography.buttonLg, color: colors.text },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  loginHint: { ...typography.bodySm, color: colors.textSecondary },
  loginPressable: { marginLeft: spacing.xs },
  loginAction: { ...typography.bodySmMedium, color: colors.primary },
});

export default RegisterScreen;
