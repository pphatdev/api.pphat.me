export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject?: string;
    message: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
}

export interface CreateContactDto {
    name: string;
    email: string;
    subject?: string;
    message: string;
}
