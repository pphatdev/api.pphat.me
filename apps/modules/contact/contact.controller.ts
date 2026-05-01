import { Context } from 'hono';
import { ContactService } from './contact.service';
import { CreateContactDto } from './contact.interface';
import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";

export class ContactController {
    static async list(c: Context) {
        const user = c.get('user');
        if (user?.role !== 'admin') return Res.forbidden();

        const { page, limit } = parseListParams(c.req.url);
        const result = await ContactService.list(c.env.DB, page, limit);
        return Res.ok(result);
    }

    static async getById(c: Context) {
        const user = c.get('user');
        if (user?.role !== 'admin') return Res.forbidden();

        const id = c.req.param('id');
        if (!id) return Res.badRequest('Message ID is required');

        const message = await ContactService.getById(c.env.DB, id);
        if (!message) return Res.notFound();

        return Res.ok(message);
    }

    static async submit(c: Context) {
        try {
            const body = await c.req.json<CreateContactDto>();

            // Basic validation
            if (!body.name || !body.email || !body.message) {
                return Res.unprocessable('Missing required fields');
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(body.email)) {
                return Res.unprocessable('Invalid email format');
            }

            if (body.message.length < 10) {
                return Res.unprocessable('Message must be at least 10 characters long');
            }

            const meta = {
                ip: c.req.header('cf-connecting-ip') || 'unknown',
                ua: c.req.header('user-agent') || 'unknown'
            };

            const smtp = {
                host: c.env.SMTP_HOST,
                port: parseInt(c.env.SMTP_PORT, 10),
                user: c.env.SMTP_USER,
                pass: c.env.SMTP_PASS,
                from: c.env.SMTP_FROM
            };

            await ContactService.submit(c.env.DB, body, meta, smtp);

            return c.json({ message: 'Message sent successfully' }, 201);
        } catch (error: any) {
            console.error('Contact submission error:', error);
            return c.json({ error: error.message || 'Internal server error' }, 500);
        }
    }
}
