import { FastifyReply, FastifyRequest } from 'fastify';
import { EventsService } from './events.service';

export class EventsController {
  private eventsService = new EventsService();

  async create(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const user = req.user as { id: string };
      const event = await this.eventsService.createEvent({ ...req.body as any, organizerId: user.id });
      return reply.status(201).send(event);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const events = await this.eventsService.listPublishedEvents();
    return reply.status(200).send(events);
  }
}