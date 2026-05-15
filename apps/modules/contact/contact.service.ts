import { ContactRepo } from './contact.repo';
import { CreateContactDto, ContactMessage } from './contact.interface';
import { sendContactEmail, SmtpConfig } from '../auth/email.service';

export class ContactService {
    /**
     * @description Process and save a contact message submission
     * @param { D1Database } db Database binding
     * @param { CreateContactDto } dto Message data
     * @param { object } meta Client metadata (IP, UA)
     * @param { SmtpConfig } smtp SMTP configuration
     * @returns { Promise<void> }
     */
    static async submit(
        db: D1Database,
        dto: CreateContactDto,
        meta: { ip: string; ua: string },
        smtp: SmtpConfig
    ): Promise<void> {
        const message: ContactMessage = {
            id: crypto.randomUUID(),
            ...dto,
            ip_address: meta.ip,
            user_agent: meta.ua,
            created_at: new Date().toISOString()
        };

        await ContactRepo.create(db, message);

        try {
            await sendContactEmail(
                {
                    name: dto.name,
                    email: dto.email,
                    subject: dto.subject || 'New Contact Message',
                    message: dto.message
                },
                smtp
            );
        } catch (error) {
            console.error('Failed to send contact email:', error);
            // We don't throw here to avoid failing the request if DB save was successful
            // but email failed (though ideally we'd have a retry mechanism)
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
