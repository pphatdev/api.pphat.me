import nodemailer from 'nodemailer';

export interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
}

/**
 * @description Send an OTP verification email
 * @param { string } to Recipient email
 * @param { string } code The verification code
 * @param { SmtpConfig } config SMTP configuration
 * @returns { Promise<void> }
 */
export async function sendOtpEmail(to: string, code: string, config: SmtpConfig): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		auth: {
			user: config.user,
			pass: config.pass,
		},
	});

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
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		auth: {
			user: config.user,
			pass: config.pass,
		},
	});

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
