import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import AuthInput from '@/shared/components/AuthInput';
import Touchable from '@/shared/components/Touchable';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import type { AuthStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
interface RegisterFormValues { displayName: string; email: string; password: string; confirmPassword: string }

const serifBrand = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

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
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="leaf" size={36} color={colors.primaryDark} />
              <Text style={styles.heroTitle}>{`YogAI'ye katıl`}</Text>
              <Text style={styles.heroSubtitle}>Farkındalıklı pratiğine başla.</Text>
            </View>

            <Controller name="displayName" control={control} rules={{ required: 'Ad Soyad zorunlu', minLength: { value: 2, message: 'Ad Soyad en az 2 karakter olmalı' } }}
              render={({ field: { value, onChange } }) => (
                <AuthInput label="Ad Soyad" placeholder="Adınızı girin" value={value} onChangeText={onChange} error={errors.displayName?.message} autoCapitalize="words" textContentType="name" accessibilityLabel="Ad Soyad" />
              )}
            />

            <Controller name="email" control={control} rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
              render={({ field: { value, onChange } }) => (
                <AuthInput label="E-posta" placeholder="E-postanızı girin" value={value} onChangeText={onChange} error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" accessibilityLabel="E-posta" />
              )}
            />

            <Controller name="password" control={control} rules={{ required: 'Şifre zorunlu', minLength: { value: 6, message: 'Şifre en az 6 karakter olmalı' } }}
              render={({ field: { value, onChange } }) => (
                <AuthInput label="Şifre" placeholder="Şifrenizi girin" value={value} onChangeText={onChange} error={errors.password?.message} secureTextEntry={!isPasswordVisible} rightIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} onRightIconPress={() => setIsPasswordVisible(prev => !prev)} textContentType="newPassword" accessibilityLabel="Şifre" />
              )}
            />

            <Controller name="confirmPassword" control={control} rules={{ required: 'Şifre tekrarı zorunlu', validate: value => value === passwordValue || 'Şifreler eşleşmiyor' }}
              render={({ field: { value, onChange } }) => (
                <AuthInput label="Şifre tekrar" placeholder="Şifrenizi tekrar girin" value={value} onChangeText={onChange} error={errors.confirmPassword?.message} secureTextEntry={!isConfirmPasswordVisible} rightIcon={isConfirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'} onRightIconPress={() => setIsConfirmPasswordVisible(prev => !prev)} textContentType="newPassword" accessibilityLabel="Şifre tekrar" />
              )}
            />

            <Touchable onPress={onSubmit} disabled={loading} style={[styles.pillPrimary, loading && styles.pillDisabled]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Hesap oluştur">
              {loading ? <ActivityIndicator size="small" color={colors.textOnPrimary} /> : <Text style={styles.pillPrimaryText}>Hesap oluştur</Text>}
            </Touchable>

            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>veya</Text>
              <View style={styles.separatorLine} />
            </View>

            <Touchable onPress={onGoogleRegister} disabled={loading} style={[styles.googleButton, loading && styles.googleButtonDisabled]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Google ile kayıt ol">
              {loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : (
                <>
                  <View style={styles.googleIconWrap}><Text style={styles.googleIconText}>G</Text></View>
                  <Text style={styles.googleButtonText}>Google ile kayıt ol</Text>
                </>
              )}
            </Touchable>

            <Touchable onPress={() => navigation.navigate('Login')} style={styles.backToLogin} borderRadius={radius.sm} accessibilityRole="button" accessibilityLabel="Giriş ekranına dön">
              <Text style={styles.backToLoginText}>Girişe dön</Text>
            </Touchable>

            <Text style={styles.legalFooter}>
              Kayıt olarak Kullanım Şartları ve Gizlilik Politikası çerçevesinde hesap verilerinin işlenmesini kabul etmiş olursun.
            </Text>
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
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.huge,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + spacing.sm,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: { alignItems: 'center', marginBottom: spacing.lg },
  heroTitle: {
    fontFamily: serifBrand,
    fontSize: 28,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.bodySm,
    fontFamily: serifBrand,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
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
  pillDisabled: { opacity: 0.65 },
  pillPrimaryText: { ...typography.buttonLg, color: colors.textOnPrimary },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { ...typography.caption, color: colors.textMuted },
  googleButton: {
    minHeight: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonDisabled: { opacity: 0.6 },
  googleIconWrap: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderLight, marginRight: spacing.sm },
  googleIconText: { ...typography.bodySmMedium, color: '#4285F4' },
  googleButtonText: { ...typography.buttonMd, color: colors.text },
  backToLogin: { alignSelf: 'center', marginTop: spacing.xl, paddingVertical: spacing.xs },
  backToLoginText: {
    ...typography.bodySm,
    fontFamily: serifBrand,
    color: colors.textSecondary,
  },
  legalFooter: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});

export default RegisterScreen;
