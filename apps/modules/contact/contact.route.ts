import { Hono } from 'hono';
import { ContactController } from './contact.controller';
import { authGuard } from '../../middlewares/auth.middleware';

const app = new Hono<{ Bindings: Env }>();

/**
 * @description Submit Contact Form
 * @method POST
 * @param { String } name Sender Name
 * @param { String } email Sender Email
 * @param { String } [subject] Message Subject
 * @param { String } message Message Content
 */
app.post('/v1/api/contact', ContactController.submit);

/**
 * @description List Contact Messages (admin only)
 * @method GET
 */
app.get('/v1/api/contact', authGuard, ContactController.list);

/**
 * @description Get Contact Message by ID (admin only)
 * @method GET
 */
app.get('/v1/api/contact/:id', authGuard, ContactController.getById);

export { app as contactRoutes };
