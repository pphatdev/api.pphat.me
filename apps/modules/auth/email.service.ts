import nodemailer from 'nodemailer';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

export interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
}

/**
 * @description First IPv4 address of an SMTP host, or null if it has none or
 * the lookup fails (then the hostname is used as before).
 * @param { string } host SMTP hostname
 * @param { (host: string) => Promise<string[]> } [resolve4] Resolver (injectable for tests)
 * @returns { Promise<string | null> }
 */
export async function smtpIpv4(host: string, resolve4: (host: string) => Promise<string[]> = dns.resolve4): Promise<string | null> {
	if (isIP(host)) return isIP(host) === 4 ? host : null;
	try {
		return (await resolve4(host))[0] ?? null;
	} catch {
		return null;
	}
}

/**
 * @description One SMTP transport for every mailer. Connects over IPv4:
 * nodemailer tries IPv6 first and relies on Node's family fallback, which the
 * Workers runtime doesn't do, so on a network without IPv6 (local wrangler
 * dev) every send failed with ENETUNREACH. `servername` keeps SNI and the
 * certificate check against the real hostname when connecting by address.
 * @param { SmtpConfig } config SMTP configuration
 * @returns { Promise<nodemailer.Transporter> }
 */
async function createSmtpTransport(config: SmtpConfig) {
	const address = await smtpIpv4(config.host);
	return nodemailer.createTransport({
		host: address ?? config.host,
		servername: config.host,
		port: config.port,
		secure: config.port === 465,
		auth: { user: config.user, pass: config.pass },
		// Fail fast instead of holding the request open on a stuck server.
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000,
	} as Parameters<typeof nodemailer.createTransport>[0]);
}

/**
 * @description Send an OTP verification email
 * @param { string } to Recipient email
 * @param { string } code The verification code
 * @param { SmtpConfig } config SMTP configuration
 * @returns { Promise<void> }
 */
export async function sendOtpEmail(to: string, code: string, config: SmtpConfig): Promise<void> {
	const transporter = await createSmtpTransport(config);

	await transporter.sendMail({
		from: config.from,
		to,
		subject: 'Your verification code',
		text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes. Do not share it with anyone.`,
		html: `
			<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
				<h2>Verification Code</h2>
				<p>Use the code below to complete your sign-in:</p>
				<div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:8px;text-align:center">
					${code}
				</div>
				<p style="color:#6b7280;font-size:14px;margin-top:16px">
					This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
				</p>
			</div>
		`,
	});
}

/**
 * @description Escape the five characters that carry meaning in HTML so
 * submitter-supplied strings render as literal text rather than markup.
 * @param { string } input Raw string
 * @returns { string } HTML-safe string
 */
function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * @description Strip CR/LF from a value going into an SMTP header. nodemailer
 * generally guards its known headers, but the `replyTo` field is composed from
 * two user-supplied fragments (`name` and `email`) so a defense-in-depth pass
 * here removes the CRLF-injection surface entirely.
 * @param { string } input Raw string
 * @returns { string } String with all CR/LF removed
 */
function stripHeaderNewlines(input: string): string {
	return input.replace(/[\r\n]+/g, ' ');
}

export interface ContactEmailRendered {
	replyTo: string;
	subject: string;
	text: string;
	html: string;
}

/**
 * @description Build the operator-facing contact email. Pure: no I/O. Escapes
 * every submitter-supplied field before templating so an `<img onerror>` or a
 * `</div><script>` payload lands in the owner's inbox as literal text.
 * @param { object } data Contact form data
 * @returns { ContactEmailRendered } The rendered email pieces
 */
export function renderContactEmail(
	data: { name: string; email: string; subject: string; message: string },
): ContactEmailRendered {
	const nameHeader = stripHeaderNewlines(data.name);
	const emailHeader = stripHeaderNewlines(data.email);
	const subjectHeader = stripHeaderNewlines(data.subject || 'New Message');

	const name = escapeHtml(data.name);
	const email = escapeHtml(data.email);
	const subject = escapeHtml(data.subject || 'N/A');
	const message = escapeHtml(data.message);

	return {
		replyTo: `${nameHeader} <${emailHeader}>`,
		subject: `[Contact Form] ${subjectHeader}`,
		text: `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`,
		html: `
			<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:24px">
				<h2 style="color:#111827;margin-top:0">New Contact Message</h2>
				<p><strong>From:</strong> ${name} (${email})</p>
				<p><strong>Subject:</strong> ${subject}</p>
				<hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0" />
				<div style="white-space:pre-wrap;color:#374151">${message}</div>
			</div>
		`,
	};
}

/**
 * @description Send a contact form message to the site owner
 * @param { object } data Contact form data
 * @param { SmtpConfig } config SMTP configuration
 * @returns { Promise<void> }
 */
export async function sendContactEmail(
	data: { name: string; email: string; subject: string; message: string },
	config: SmtpConfig
): Promise<void> {
	const transporter = await createSmtpTransport(config);

	const rendered = renderContactEmail(data);
	await transporter.sendMail({
		from: config.from,
		to: config.user, // Send TO the owner
		replyTo: rendered.replyTo,
		subject: rendered.subject,
		text: rendered.text,
		html: rendered.html,
	});
}

export interface InvitationEmailData {
	inviterName: string | null;
	articleTitle: string;
	/** Where the invitee accepts: the admin app's posts page. */
	url: string;
}

/**
 * @description Render a contributor invitation. The inviter's name and the
 * article title are written by users, so they are HTML-escaped in the body
 * and kept out of the subject entirely: the subject is fixed text, so the
 * message can't be turned into a custom-subject mailer.
 * @param { InvitationEmailData } data Invitation details
 * @returns { { subject: string; text: string; html: string } }
 */
export function renderInvitationEmail(data: InvitationEmailData): { subject: string; text: string; html: string } {
	const inviter = stripHeaderNewlines(data.inviterName?.trim() || 'Someone');
	const title = stripHeaderNewlines(data.articleTitle.trim() || 'an article');
	return {
		subject: "You're invited to contribute on pphat.me",
		text:
			`${inviter} invited you to contribute to "${title}" on pphat.me.\n\n` +
			`Sign in with this email address to accept or decline:\n${data.url}\n\n` +
			`If you weren't expecting this, you can ignore this email.`,
		html: `
			<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
				<h2>You're invited to contribute</h2>
				<p><strong>${escapeHtml(inviter)}</strong> invited you to contribute to
				<strong>${escapeHtml(title)}</strong> on pphat.me.</p>
				<p>Sign in with this email address to accept or decline.</p>
				<p><a href="${escapeHtml(data.url)}" style="display:inline-block;padding:10px 16px;background:#14b8a6;color:#fff;border-radius:8px;text-decoration:none">Open my posts</a></p>
				<p style="color:#6b7280;font-size:14px">If you weren't expecting this, you can ignore this email.</p>
			</div>
		`,
	};
}

/**
 * @description Send a contributor invitation email
 * @param { string } to Invitee address
 * @param { InvitationEmailData } data Invitation details
 * @param { SmtpConfig } config SMTP configuration
 * @returns { Promise<void> }
 */
export async function sendInvitationEmail(to: string, data: InvitationEmailData, config: SmtpConfig): Promise<void> {
	const transporter = await createSmtpTransport(config);
	await transporter.sendMail({ from: config.from, to, ...renderInvitationEmail(data) });
}
