export const DEFAULT_TEMPLATES: Record<
  string,
  { channel: "EMAIL" | "SMS"; subject?: string; body: string }
> = {
  ETICKET: {
    channel: "EMAIL",
    subject: "Your ONETRIPS e-ticket — {{bookingRef}}",
    body: `Your flight is ticketed.

Booking {{bookingRef}}
PNR {{pnr}}
Ticket numbers: {{ticketNumbers}}

The e-ticket PDFs are attached. You can also download them from your ONETRIPS account.

ONETRIPS`,
  },
  OTP: {
    channel: "EMAIL",
    subject: "Your ONETRIPS verification code",
    body: `Your verification code is {{code}}.

Purpose: {{purpose}}
It expires in 10 minutes. If you did not request this, ignore this email.

ONETRIPS`,
  },
  PAYMENT_SUCCESS: {
    channel: "EMAIL",
    subject: "Payment received — {{bookingRef}}",
    body: `We received {{currency}} {{amount}} for booking {{bookingRef}}.

Your tickets will follow shortly.

ONETRIPS`,
  },
  SMS_OTP: {
    channel: "SMS",
    body: "ONETRIPS code {{code}} ({{purpose}}). Valid 10 min.",
  },
  SMS_TICKETED: {
    channel: "SMS",
    body: "ONETRIPS: booking {{bookingRef}} is ticketed. PNR {{pnr}}. Check email for PDFs.",
  },
  BOOKING_CANCELLED: {
    channel: "EMAIL",
    subject: "Booking cancelled — {{bookingRef}}",
    body: `Booking {{bookingRef}} has been cancelled.

If a payment was captured, the refund will follow.

ONETRIPS`,
  },
  BOOKING_REFUNDED: {
    channel: "EMAIL",
    subject: "Refund completed — {{bookingRef}}",
    body: `We refunded {{currency}} {{amount}} for booking {{bookingRef}}.

ONETRIPS`,
  },
  SMS_CANCELLED: {
    channel: "SMS",
    body: "ONETRIPS: booking {{bookingRef}} was cancelled ({{status}}).",
  },
  SUPPORT_ACK: {
    channel: "EMAIL",
    subject: "We received your support request",
    body: `Thanks for contacting ONETRIPS.

We received “{{subject}}” ({{requestId}}). A specialist will reply in your account inbox.

ONETRIPS`,
  },
  SUPPORT_UPDATE: {
    channel: "EMAIL",
    subject: "Support update — {{subject}}",
    body: `There is an update on your support request {{requestId}}.

Status: {{status}}

Sign in to ONETRIPS to read the reply.

ONETRIPS`,
  },
};

export function interpolate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(payload[key] ?? ""));
}
