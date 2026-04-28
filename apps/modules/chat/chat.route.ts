import { Hono } from 'hono';
import { ChatController } from './chat.controller';
import { optionalAuth, authGuard } from '../../middlewares/auth.middleware';

const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.post('/v1/api/chat', optionalAuth, (c) => ChatController.chat(c));
chatRoutes.get('/v1/api/chat/history', authGuard, (c) => ChatController.getHistory(c));

export { chatRoutes };
