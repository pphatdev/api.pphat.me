import { ContactMessage } from './contact.interface';
import { PaginatedResult } from '../../shared/interfaces';

export class ContactRepo {
    /**
     * @description Create a new contact message record
     * @param { D1Database } db Database binding
     * @param { ContactMessage } data Message data
     * @returns { Promise<void> }
     */
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

    /**
     * @description List contact messages from the database
     * @param { D1Database } db Database binding
     * @param { number } [page=1] Page number
     * @param { number } [limit=10] Records per page
     * @returns { Promise<PaginatedResult<ContactMessage>> } Paginated results
     */
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
    
    /**
     * @description Find a contact message by ID
     * @param { D1Database } db Database binding
     * @param { string } id Message ID
     * @returns { Promise<ContactMessage | null> } The message record or null
     */
    static async getById(db: D1Database, id: string): Promise<ContactMessage | null> {
        return await db.prepare('SELECT * FROM contact_messages WHERE id = ?').bind(id).first<ContactMessage>();
    }
}
