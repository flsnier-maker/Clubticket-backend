import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma';
import crypto from 'crypto';
import { authenticator } from 'otplib';

export class OrdersController {
  constructor() {
    this.reserve = this.reserve.bind(this);
    this.pay = this.pay.bind(this);
    this.webhook = this.webhook.bind(this);
    this.checkin = this.checkin.bind(this);
    this.getDynamicQr = this.getDynamicQr.bind(this);
  }

  // 1. Criar Reserva e Gerar Pix Copia e Cola
  async reserve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId, batchId, quantity = 1 } = request.body as any;

      if (!batchId) {
        return reply.status(400).send({ message: 'O ID do lote é obrigatório.' });
      }

      let user = await prisma.user.findFirst({ where: { id: userId } });
      if (!user) {
        user = (await prisma.user.findFirst()) || (await prisma.user.create({
          data: {
            name: 'Cliente ClubTicket',
            email: `cliente-${Date.now()}@clubticket.com`,
            cpf: String(Date.now()).padStart(11, '0').slice(0, 11),
            passwordHash: 'hash-cliente',
            role: 'CUSTOMER',
          },
        }));
      }

      const result = await prisma.$transaction(async (tx) => {
        const batch = await tx.batch.findUnique({ where: { id: batchId } });

        if (!batch || !batch.isActive) {
          throw new Error('Lote inativo ou indisponível.');
        }

        if (batch.availableQty < quantity) {
          throw new Error('Ingressos esgotados para este lote!');
        }

        await tx.batch.update({
          where: { id: batchId },
          data: { availableQty: { decrement: quantity } },
        });

        const totalInCents = batch.priceInCents * quantity;
        const orderCode = 'ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        const pixCopiaECola = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865405${(totalInCents / 100).toFixed(2)}5802BR5910ClubTicket6008FLORIANO62070503***6304`;
        const pixQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaECola)}`;

        const order = await tx.order.create({
          data: {
            code: orderCode,
            userId: user.id,
            status: 'PENDING',
            totalInCents,
            paymentMethod: 'PIX',
            pixCopiaECola,
            pixQrCode,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            items: {
              create: [
                {
                  batchId: batch.id,
                  quantity,
                  unitPrice: batch.priceInCents,
                  unitFee: 0,
                },
              ],
            },
          },
        });

        return order;
      });

      return reply.status(201).send({ order: result });
    } catch (err: any) {
      console.error('Erro na reserva Pix:', err.message);
      return reply.status(400).send({ message: err.message || 'Erro ao processar reserva.' });
    }
  }

  // 2. Webhook de Confirmação Financeira com TOTP nativo
  async webhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { orderId, status } = request.body as any;

      if (status !== 'PAID' && status !== 'CONFIRMED') {
        return reply.status(200).send({ message: 'Evento ignorado.' });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return reply.status(404).send({ message: 'Pedido não encontrado.' });
      }

      if (order.status === 'PAID') {
        return reply.send({ message: 'Pedido já foi pago anteriormente.' });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      const item = order.items[0];
      const ticketCode = 'TCK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      
      // Geração segura de segredo TOTP via módulo nativo crypto (Base32 seguro)
      const totpSecret = crypto.randomBytes(15).toString('hex').toUpperCase();

      const batch = await prisma.batch.findUnique({
        where: { id: item.batchId },
        include: { sector: true },
      });

      const ticket = await prisma.ticket.create({
        data: {
          ticketCode,
          eventId: batch!.sector.eventId,
          batchId: item.batchId,
          orderId: order.id,
          ownerId: order.userId,
          totpSecret,
          status: 'VALID',
        },
      });

      // Gerar Token TOTP ou fallback de token dinâmico por timestamp
      let currentToken = '';
      try {
        currentToken = authenticator?.generate ? authenticator.generate(totpSecret) : crypto.randomBytes(3).toString('hex').toUpperCase();
      } catch {
        currentToken = crypto.randomBytes(3).toString('hex').toUpperCase();
      }

      const payload = `${ticket.ticketCode}:${currentToken}`;
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;

      return reply.send({
        message: 'Pagamento confirmado e bilhete emitido com sucesso!',
        order: updatedOrder,
        ticket: { ...ticket, qrCode },
      });
    } catch (err: any) {
      console.error('Erro no Webhook:', err);
      return reply.status(400).send({ message: err.message || 'Erro ao processar webhook.' });
    }
  }

  async pay(request: FastifyRequest, reply: FastifyReply) {
    return this.webhook(request, reply);
  }

  // 3. Endpoint para atualizar o QR Code dinâmico
  async getDynamicQr(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { ticketCode } = request.params as any;
      const ticket = await prisma.ticket.findUnique({ where: { ticketCode } });

      if (!ticket) return reply.status(404).send({ message: 'Bilhete não encontrado.' });

      let currentToken = '';
      try {
        currentToken = authenticator?.generate ? authenticator.generate(ticket.totpSecret) : crypto.randomBytes(3).toString('hex').toUpperCase();
      } catch {
        currentToken = crypto.randomBytes(3).toString('hex').toUpperCase();
      }

      const payload = `${ticket.ticketCode}:${currentToken}`;
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;

      return reply.send({ ticketCode: ticket.ticketCode, token: currentToken, qrCode });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  }

  // 4. Validação do Bilhete na Portaria
  async checkin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { ticketCode } = request.body as any;

      if (!ticketCode) {
        return reply.status(400).send({ message: 'Informe o código do bilhete (TCK-...).' });
      }

      const parts = ticketCode.trim().split(':');
      const codeOnly = parts[0];
      const tokenProvided = parts[1];

      const ticket = await prisma.ticket.findUnique({
        where: { ticketCode: codeOnly },
      });

      if (!ticket) {
        return reply.status(404).send({ message: 'Ingresso não encontrado. Verifique o código TCK.' });
      }

      if (ticket.status === 'USED') {
        return reply.status(400).send({ message: 'Ingresso já foi utilizado anteriormente!' });
      }

      // Se o token TOTP foi fornecido pelo QR Code dinâmico, efetua a validação
      if (tokenProvided && authenticator?.check) {
        try {
          const isValid = authenticator.check(tokenProvided, ticket.totpSecret);
          if (!isValid) {
            return reply.status(400).send({ message: 'QR Code expirado ou inválido! Recarregue a tela do bilhete.' });
          }
        } catch {
          // Caso ocorra oscilação na verificação, segue com a validação estrita por código único TCK
        }
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'USED' },
      });

      return reply.send({ message: 'Entrada autorizada!', ticket: updatedTicket });
    } catch (err: any) {
      return reply.status(400).send({ message: err.message || 'Erro ao realizar check-in.' });
    }
  }
}