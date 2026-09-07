import { Redirect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { WelcomeScreen } from '../native/screens/WelcomeScreen';

export default function Index() {
  const { isAuthenticated } = useAuth();

  // A returning signed-in (or guest-mode) user should never see onboarding
  // again — go straight to the app instead of re-showing Welcome.
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <WelcomeScreen />;
}
