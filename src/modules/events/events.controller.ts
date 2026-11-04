import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';

export class EventsController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const events = await prisma.event.findMany({
        include: {
          sectors: {
            include: {
              batches: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ events });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message || 'Erro ao listar eventos' });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = (request.body || {}) as any;
      const title = body.title || 'Novo Evento';
      const description = body.description || '';
      const locationInput = body.location || body.venueName || 'Estádio Tiberão';

      const parsedPrice = Math.round(Number(String(body.priceCents || body.priceInCents).replace(',', '.')) || 10000);
      const parsedQuantity = Math.floor(Number(body.totalQuantity || body.availableQty) || 1000);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

      // Garantir um utilizador organizador válido com CPF
      let defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        defaultUser = await prisma.user.create({
          data: {
            name: 'Organizador ClubTicket',
            email: `admin-${Date.now()}@clubticket.com`,
            cpf: String(Date.now()).padStart(11, '0').slice(0, 11),
            passwordHash: 'hash-padrao',
            role: 'ORGANIZER',
          },
        });
      }

      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const event = await prisma.event.create({
        data: {
          title,
          slug,
          description,
          bannerUrl: null,
          venueName: locationInput,
          city: body.city || 'Floriano',
          state: body.state || 'PI',
          address: body.address || 'Centro',
          startDate: nextWeek,
          endDate: nextMonth,
          status: 'PUBLISHED',
          organizerId: defaultUser.id,
          sectors: {
            create: [
              {
                name: body.sectorName || 'Pista VIP',
                batches: {
                  create: [
                    {
                      name: body.batchName || '1º Lote',
                      priceInCents: parsedPrice,
                      feeInCents: 0,
                      totalQuantity: parsedQuantity,
                      availableQty: parsedQuantity,
                      maxPerUser: 4,
                      startsAt: now,
                      endsAt: nextMonth,
                      isActive: true,
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          sectors: {
            include: {
              batches: true,
            },
          },
        },
      });

      return reply.status(201).send({ event });
    } catch (err: any) {
      console.error('ERRO NO PRISMA:', err);
      return reply.status(400).send({ message: err.message || 'Erro ao criar evento.' });
    }
  }
}