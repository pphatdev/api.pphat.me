import { ContactMessage } from './contact.interface';
import { PaginatedResult } from '../../shared/interfaces';

export class ContactRepo {
    static async create(db: D1Database, data: ContactMessage): Promise<void> {
        await db.prepare(`
        INSERT INTO contact_messages (id, name, email, subject, message, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.id,
            data.name,
            data.email,
            data.subject || '',
            data.message,
            data.ip_address,
            data.user_agent,
            data.created_at
        ).run();
    }

    static async list(db: D1Database, page = 1, limit = 10): Promise<PaginatedResult<ContactMessage>> {
        const offset = (page - 1) * limit;
        
        const { results } = await db.prepare(`
          SELECT * FROM contact_messages 
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        `).bind(limit, offset).all<ContactMessage>();
    
        const total = await db.prepare('SELECT COUNT(*) as count FROM contact_messages').first<number>('count');
        const count = total || 0;

        return { 
            data: results || [], 
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }
    
    static async getById(db: D1Database, id: string): Promise<ContactMessage | null> {
        return await db.prepare('SELECT * FROM contact_messages WHERE id = ?').bind(id).first<ContactMessage>();
    }
}
