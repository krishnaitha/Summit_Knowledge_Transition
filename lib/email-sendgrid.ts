import sgMail from '@sendgrid/mail';

export async function sendEmail(to: string, subject: string, html: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      return { success: false, error: 'Email service not configured' };
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const from = process.env.SENDGRID_FROM_EMAIL || 'noreply@summit.app';

    const result = await sgMail.send({
      to,
      from,
      subject,
      html,
    });

    // SendGrid returns array of response metadata
    // Status code 202 = Accepted
    if (result[0]?.statusCode === 202) {
      return { success: true };
    }

    return { success: false, error: 'Email provider did not confirm delivery' };
  } catch (error: unknown) {
    // SendGrid throws a structured error with response status/body.
    const err = error as {
      message?: string;
      response?: {
        statusCode?: number;
        body?: {
          errors?: Array<{ message?: string }>;
        };
      };
    };

    const status = err.response?.statusCode;
    const providerMessage = err.response?.body?.errors?.[0]?.message;

    if (status === 403) {
      return {
        success: false,
        error:
          providerMessage ??
          'SendGrid rejected the request (403). Verify SENDGRID_FROM_EMAIL as a Single Sender or authenticated domain, and ensure the API key has Mail Send permission.',
      };
    }

    return {
      success: false,
      error: providerMessage ?? err.message ?? 'Failed to send email',
    };
  }
}
