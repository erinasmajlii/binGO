import { Redirect } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { RegisterScreen } from '../native/screens/RegisterScreen';

export default function Register() {
  const { isAuthenticated } = useAuth();

  // Don't show the registration form to someone already signed in (e.g. if
  // they navigate back to this route manually).
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <RegisterScreen />;
}
