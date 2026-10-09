import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Client IDs come from env; the native module needs a development build.
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
}

export async function getGoogleIdToken(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response: any = await GoogleSignin.signIn();
  const idToken = response?.idToken ?? response?.data?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token');
  }
  return idToken;
}

export function isGoogleSignInCancelled(error: any): boolean {
  return (
    error?.code === statusCodes.SIGN_IN_CANCELLED ||
    error?.code === 'SIGN_IN_CANCELLED'
  );
}
