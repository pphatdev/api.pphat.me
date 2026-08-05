import { ContactRepo } from './contact.repo';
import { CreateContactDto, ContactMessage } from './contact.interface';
import { sendContactEmail, SmtpConfig } from '../auth/email.service';

export class ContactService {
    /**
     * @description Persist the contact message to D1. Fast path — no network I/O.
     * The email notification is a separate call (`notifyEmail`) so the caller can
     * dispatch it via `ctx.waitUntil()` without blocking the HTTP response.
     * @param { D1Database } db Database binding
     * @param { CreateContactDto } dto Message data
     * @param { object } meta Client metadata (IP, UA)
     * @returns { Promise<void> }
     */
    static async saveMessage(
        db: D1Database,
        dto: CreateContactDto,
        meta: { ip: string; ua: string },
    ): Promise<void> {
        const message: ContactMessage = {
            id: crypto.randomUUID(),
            ...dto,
            ip_address: meta.ip,
            user_agent: meta.ua,
            created_at: new Date().toISOString()
        };
        await ContactRepo.create(db, message);
    }

    /**
     * @description Send the operator notification email for a contact submission.
     * Meant to be dispatched via `ctx.waitUntil()` — swallows errors so a broken
     * SMTP config doesn't surface to the submitter.
     * @param { CreateContactDto } dto Message data
     * @param { SmtpConfig } smtp SMTP configuration
     * @returns { Promise<void> }
     */
    static async notifyEmail(dto: CreateContactDto, smtp: SmtpConfig): Promise<void> {
        try {
            await sendContactEmail(
                {
                    name: dto.name,
                    email: dto.email,
                    subject: dto.subject || 'New Contact Message',
                    message: dto.message,
                },
                smtp,
            );
        } catch (error) {
            console.error('Failed to send contact email:', error);
        }
    }

    /**
     * @description List contact messages with pagination
     * @param { D1Database } db Database binding
     * @param { number } page Page number
     * @param { number } limit Records per page
     * @returns { Promise<PaginatedResult<ContactMessage>> } Paginated messages
     */
    static async list(db: D1Database, page: number, limit: number) {
        return await ContactRepo.list(db, page, limit);
    }

    /**
     * @description Get a contact message by ID
     * @param { D1Database } db Database binding
     * @param { string } id Message ID
     * @returns { Promise<ContactMessage | null> } The message or null
     */
    static async getById(db: D1Database, id: string) {
        return await ContactRepo.getById(db, id);
    }
}
