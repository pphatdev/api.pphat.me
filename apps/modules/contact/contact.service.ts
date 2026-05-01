import { ContactRepo } from './contact.repo';
import { CreateContactDto, ContactMessage } from './contact.interface';
import { sendContactEmail, SmtpConfig } from '../auth/email.service';

export class ContactService {
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

    static async list(db: D1Database, page: number, limit: number) {
        return await ContactRepo.list(db, page, limit);
    }

    static async getById(db: D1Database, id: string) {
        return await ContactRepo.getById(db, id);
    }
}
