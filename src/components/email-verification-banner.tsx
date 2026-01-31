import * as React from 'react';
import { useRouterState, defaultStringifySearch } from '@tanstack/react-router';
import { useIntlayer } from 'react-intlayer';
import { useServerFn } from '@tanstack/react-start';
import { Cross2Icon } from '@radix-ui/react-icons';

import { Button } from '~/components/ui/button';
import { toLocalizedString } from '~/lib/utils';
import { resendVerificationEmail } from '~/server/function/resend-verification-email.server';

interface EmailVerificationBannerProps {
  readonly email: string;
}

// Storage key for dismissed state
const DISMISSED_KEY = 'email-verification-banner-dismissed';

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const content = useIntlayer('auth');
  const location = useRouterState({ select: (state) => state.location });
  const resendFn = useServerFn(resendVerificationEmail);

  const [status, setStatus] = React.useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Check localStorage on mount (client-side only)
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => {
    setIsClient(true);
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch (err) {
      // Ignore localStorage errors
      console.warn('[EmailVerificationBanner] localStorage read error:', err);
    }
  }, []);

  const handleDismiss = React.useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch (err) {
      console.warn('[EmailVerificationBanner] localStorage write error:', err);
    }
    setIsDismissed(true);
  }, []);

  const searchString = React.useMemo(
    () => defaultStringifySearch(location.search),
    [location.search],
  );

  const callbackURL = React.useMemo(() => {
    const hash = location.hash ?? '';
    return `${location.pathname}${searchString}${hash}`;
  }, [location.hash, location.pathname, searchString]);

  const handleResend = React.useCallback(async () => {
    setStatus('pending');
    setError(null);

    try {
      await resendFn({ data: { callbackURL } });
      setStatus('success');
    } catch (err) {
      console.error('[auth] resend verification failed', err);
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
      setStatus('error');
    }
  }, [callbackURL, resendFn]);

  // Return null when dismissed to avoid wrapper div taking up space
  // Wait for client-side hydration to avoid flash of content
  if (isClient && isDismissed) {
    return null;
  }

  return (
    <div className="px-4 pt-4 md:px-6 shrink-0">
      <div
        className="relative rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
        aria-label={toLocalizedString(content.emailVerificationBanner.close)}
      >
        <Cross2Icon className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pr-8">
        <div className="space-y-1">
          <p className="font-semibold">{content.emailVerificationBanner.title}</p>
          <p>
            {toLocalizedString(content.emailVerificationBanner.message).replace('{email}', email)}
          </p>
          {status === 'success' ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {content.emailVerificationBanner.sentMessage}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={status === 'pending'}
          >
            {status === 'pending' ? 'Sending…' : 'Resend verification email'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
