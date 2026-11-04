import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { UsersController } from './modules/users/users.controller';
import { EventsController } from './modules/events/events.controller';
import { OrdersController } from './modules/orders/orders.controller';

export async function buildApp() {
  const app = fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'supersecretkey' });

  const usersController = new UsersController();
  const eventsController = new EventsController();
  const ordersController = new OrdersController();

  await app.register(async (userApp) => {
    userApp.post('/register', usersController.register);
    userApp.post('/login', usersController.login);
    userApp.get('/me', usersController.me);
  }, { prefix: '/api/v1/users' });

  await app.register(async (eventApp) => {
    eventApp.get('/', eventsController.list);
    eventApp.post('/', eventsController.create);
  }, { prefix: '/api/v1/events' });

  await app.register(async (orderApp) => {
    orderApp.post('/reserve', ordersController.reserve);
    orderApp.post('/pay', ordersController.pay);
    orderApp.post('/webhook', ordersController.webhook);
    orderApp.get('/qr/:ticketCode', ordersController.getDynamicQr);
    orderApp.post('/checkin', ordersController.checkin);
  }, { prefix: '/api/v1/orders' });

  return app;
}