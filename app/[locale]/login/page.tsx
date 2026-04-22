import { isGoogleOAuthConfigured } from '@/lib/auth';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return <LoginForm googleConfigured={isGoogleOAuthConfigured()} />;
}
