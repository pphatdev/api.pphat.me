import { Context } from 'hono';
import { ContactService } from './contact.service';
import { CreateContactDto } from './contact.interface';
import { Res } from "../../shared/helpers/response";
import { parseListParams } from "../../shared/helpers/query";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 §4.5.3.1.3
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MIN_MESSAGE_LENGTH = 10;

// Practical HTML-form email pattern; not full RFC 5322, but rejects the
// obvious garbage while keeping the regex readable. Combined with the length
// cap this is sufficient for a contact form.
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * @description Coerce a value into a trimmed string or return null if it isn't
 * a string (arrays, numbers, and objects are all rejected up-front).
 */
function asTrimmedString(value: unknown): string | null {
	return typeof value === 'string' ? value.trim() : null;
}

export class ContactController {
    /**
     * @description List all contact messages
     * @method GET
     * @param { Context } c The Hono context
     * @returns { Promise<Response> } Paginated list of messages
     */
    static async list(c: Context) {
        const user = c.get('user');
        if (user?.role !== 'admin') return Res.forbidden();

        const { page, limit } = parseListParams(c.req.url);
        const result = await ContactService.list(c.env.DB, page, limit);
        return Res.ok(result);
    }

    /**
     * @description Get a contact message by ID
     * @method GET
     * @param { Context } c The Hono context
     * @returns { Promise<Response> } The message details
     */
    static async getById(c: Context) {
        const user = c.get('user');
        if (user?.role !== 'admin') return Res.forbidden();

        const id = c.req.param('id');
        if (!id) return Res.badRequest('Message ID is required');

        const message = await ContactService.getById(c.env.DB, id);
        if (!message) return Res.notFound();

        return Res.ok(message);
    }

    /**
     * @description Submit a new contact message
     * @method POST
     * @param { Context } c The Hono context
     * @returns { Promise<Response> } Success message
     */
    static async submit(c: Context) {
        try {
            const raw = await c.req.json().catch(() => null);
            if (!raw || typeof raw !== 'object') {
                return Res.badRequest('Invalid request body. Expected JSON.');
            }

            const name = asTrimmedString((raw as any).name);
            const email = asTrimmedString((raw as any).email);
            const subjectRaw = asTrimmedString((raw as any).subject);
            const message = asTrimmedString((raw as any).message);

            if (!name || !email || !message) {
                return Res.badRequest('Missing required fields');
            }

            if (name.length > MAX_NAME_LENGTH) {
                return Res.unprocessable(`name exceeds ${MAX_NAME_LENGTH} characters`);
            }
            if (email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
                return Res.unprocessable('Invalid email format');
            }
            if (subjectRaw && subjectRaw.length > MAX_SUBJECT_LENGTH) {
                return Res.unprocessable(`subject exceeds ${MAX_SUBJECT_LENGTH} characters`);
            }
            if (message.length < MIN_MESSAGE_LENGTH) {
                return Res.badRequest('Message must be at least 10 characters long');
            }
            if (message.length > MAX_MESSAGE_LENGTH) {
                return Res.unprocessable(`message exceeds ${MAX_MESSAGE_LENGTH} characters`);
            }

            const dto: CreateContactDto = {
                name,
                email,
                subject: subjectRaw || undefined,
                message,
            };

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

            // Persist inline; dispatch the email out-of-band so a slow/broken SMTP
            // never blocks the HTTP response (the reason the contact test was
            // timing out at 5s waiting on a DNS lookup to Gmail).
            await ContactService.saveMessage(c.env.DB, dto, meta);
            c.executionCtx.waitUntil(ContactService.notifyEmail(dto, smtp));

            return Res.created({ message: 'Message sent successfully' });
        } catch (error) {
            // Log the raw error server-side, return a generic body to clients.
            console.error('[CONTACT_SUBMIT_ERROR]', error);
            return Res.internalError('Failed to send message');
        }
    }
}
