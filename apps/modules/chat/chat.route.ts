import { Hono } from 'hono';
import { ChatController } from './chat.controller';
import { authGuard } from '../../middlewares/auth.middleware';

const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.post('/v1/api/chat', authGuard, (c) => ChatController.chat(c));
chatRoutes.get('/v1/api/chat/history', authGuard, (c) => ChatController.getHistory(c));

export { chatRoutes };
