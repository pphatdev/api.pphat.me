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
