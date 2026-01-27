/* eslint-disable no-console */
import { createFileRoute } from '@tanstack/react-router';
import { sendEmail } from '~/server/email';

// Safe mask for API keys
const maskApiKey = (key?: string) => {
  if (!key) return 'not-set';
  if (key.length < 10) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

export const Route = createFileRoute('/api/test-email')({
  server: {
    handlers: {
      GET: async () => {
        // Log environment configuration
        const config = {
          provider: process.env.EMAIL_PROVIDER || 'not-set',
          resendApiKey: process.env.RESEND_API_KEY ? maskApiKey(process.env.RESEND_API_KEY) : 'not-set',
          emailFrom: process.env.EMAIL_FROM || 'not-set',
          emailVerificationEnabled: process.env.ENABLE_EMAIL_VERIFICATION || 'not-set',
          nodeEnv: process.env.NODE_ENV || 'unknown',
        };

        console.log('[test-email] Email configuration:', config);

        try {
          await sendEmail({
            to: 'test@example.com',
            subject: 'Test Email',
            html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<h1>Test Email</h1>
						<p>If you can see this email, the email system is working correctly!</p>
						<p>Provider: ${process.env.EMAIL_PROVIDER || 'console'}</p>
						<p>Time: ${new Date().toISOString()}</p>
					</div>
				`,
          });

          return Response.json({
            success: true,
            message: 'Test email sent!',
            config,
          });
        } catch (error) {
          console.error('Failed to send test email:', error);
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              config,
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
