'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface Props {
  token: string;
  callbackUrl: string;
  loadingLabel: string;
  errorLabel: string;
}

export function ActivateClient({ token, callbackUrl, loadingLabel, errorLabel }: Props) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await signIn('activation-token', {
        token,
        callbackUrl,
        redirect: false,
      });
      if (cancelled) return;
      if (!result || result.error) {
        setError(errorLabel);
        return;
      }
      // signIn with redirect:false returns { url } we navigate to ourselves —
      // gives the browser a moment to commit the session cookie before leaving.
      window.location.assign(result.url ?? callbackUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, callbackUrl, errorLabel]);

  if (error) {
    return (
      <p className="text-center text-[14px] text-[var(--danger)]">{error}</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--text-3)] border-t-[var(--brand-primary)]" />
      <p className="text-[14px] text-[var(--text-2)]">{loadingLabel}</p>
    </div>
  );
}
