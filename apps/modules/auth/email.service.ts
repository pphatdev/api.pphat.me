import nodemailer from 'nodemailer';

export interface SmtpConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
}

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

	await transporter.sendMail({
		from: config.from,
		to: config.user, // Send TO the owner
		replyTo: `${data.name} <${data.email}>`,
		subject: `[Contact Form] ${data.subject || 'New Message'}`,
		text: `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`,
		html: `
			<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;padding:24px">
				<h2 style="color:#111827;margin-top:0">New Contact Message</h2>
				<p><strong>From:</strong> ${data.name} (${data.email})</p>
				<p><strong>Subject:</strong> ${data.subject || 'N/A'}</p>
				<hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0" />
				<div style="white-space:pre-wrap;color:#374151">${data.message}</div>
			</div>
		`,
	});
}
