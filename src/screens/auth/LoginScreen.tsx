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
import Input from '@/shared/components/Input';
import Touchable from '@/shared/components/Touchable';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import type { AuthStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface LoginFormValues { email: string; password: string }
interface PasswordResetFormValues { email: string }

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroSection}
          >
            <MaterialCommunityIcons name="meditation" size={64} color={colors.textOnPrimary} />
            <Text style={styles.brandTitle}>YogAI</Text>
            <Text style={styles.brandSubtitle}>Kişisel AI yoga asistanınız</Text>
          </LinearGradient>

          <View style={styles.formSection}>
            <Controller
              name="email"
              control={control}
              rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
              render={({ field: { value, onChange } }) => (
                <Input label="Email" placeholder="Email adresiniz" value={value} onChangeText={onChange} error={errors.email?.message} icon="email-outline" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" accessibilityLabel="Email adresi" />
              )}
            />

            <Controller
              name="password"
              control={control}
              rules={{ required: 'Şifre zorunlu', minLength: { value: 6, message: 'Şifre en az 6 karakter olmalı' } }}
              render={({ field: { value, onChange } }) => (
                <Input label="Şifre" placeholder="Şifrenizi girin" value={value} onChangeText={onChange} error={errors.password?.message} icon="lock-outline" secureTextEntry={!isPasswordVisible} rightIcon={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} onRightIconPress={() => setIsPasswordVisible(prev => !prev)} textContentType="password" accessibilityLabel="Şifre" />
              )}
            />

            <Touchable onPress={() => setIsResetSheetVisible(true)} disabled={isSubmitting} style={styles.forgotContainer} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Şifremi unuttum">
              <Text style={styles.forgotText}>Şifremi unuttum</Text>
            </Touchable>

            <Button title="Giriş Yap" onPress={onSubmit} variant="primary" size="lg" loading={isSubmitting} disabled={isSubmitting} fullWidth accessibilityLabel="Giriş yap" />

            {separator}

            <Touchable onPress={onGoogleSignIn} disabled={isSubmitting} style={[styles.googleButton, isSubmitting && styles.googleButtonDisabled]} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel="Google ile giriş yap">
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <>
                  <View style={styles.googleIconWrap}><Text style={styles.googleIconText}>G</Text></View>
                  <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
                </>
              )}
            </Touchable>

            <View style={styles.registerRow}>
              <Text style={styles.registerHint}>Hesabın yok mu?</Text>
              <Touchable onPress={() => navigation.navigate('Register')} style={styles.registerPressable} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Kayıt ol ekranına git">
                <Text style={styles.registerAction}>Kayıt Ol</Text>
              </Touchable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={isResetSheetVisible} onClose={() => setIsResetSheetVisible(false)} title="Şifre Sıfırlama">
        <Controller
          name="email"
          control={resetControl}
          rules={{ required: 'Email zorunlu', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli email adresi girin' } }}
          render={({ field: { value, onChange } }) => (
            <Input label="Email" placeholder="Email adresiniz" value={value} onChangeText={onChange} error={resetErrors.email?.message} icon="email-outline" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Şifre Sıfırlama email" />
          )}
        />
        <View style={styles.sheetActions}>
          <Button title="İptal" onPress={() => setIsResetSheetVisible(false)} variant="ghost" size="md" fullWidth accessibilityLabel="İptal" />
          <Button title="Sıfırlama Linki Gönder" onPress={onResetPassword} variant="primary" size="md" loading={isSubmitting} disabled={isSubmitting} fullWidth accessibilityLabel="Sıfırlama linki gönder" />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoid: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.huge },
  heroSection: { minHeight: 280, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  brandTitle: { ...typography.display, color: colors.textOnPrimary, marginTop: spacing.sm },
  brandSubtitle: { ...typography.bodySm, color: 'rgba(255,255,255,0.82)', marginTop: spacing.xs },
  formSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  forgotContainer: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { ...typography.bodySmMedium, color: colors.primary },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.base },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { ...typography.caption, color: colors.textMuted },
  googleButton: { minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleButtonDisabled: { opacity: 0.6 },
  googleIconWrap: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.borderLight, marginRight: spacing.sm },
  googleIconText: { ...typography.bodySmMedium, color: '#4285F4' },
  googleButtonText: { ...typography.buttonLg, color: colors.text },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  registerHint: { ...typography.bodySm, color: colors.textSecondary },
  registerPressable: { marginLeft: spacing.xs },
  registerAction: { ...typography.bodySmMedium, color: colors.primary },
  sheetActions: { gap: spacing.sm, marginTop: spacing.sm },
});

export default LoginScreen;
