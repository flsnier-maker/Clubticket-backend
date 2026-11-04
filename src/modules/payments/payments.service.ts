import { PrismaService } from '../../shared/prisma/prisma.service';
import { TotpService } from '../tickets/totp.service';
import crypto from 'crypto';

export class PaymentsService {
  private prisma = PrismaService.getInstance();

  public async processPaymentApproved(gatewayTxId: string, orderId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Busca o pedido e seus itens
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        throw new Error(`Pedido ${orderId} não encontrado.`);
      }

      // Evita processamento duplicado (Idempotência)
      if (order.status === 'PAID') {
        return { message: 'Pedido já processado anteriormente.' };
      }

      // 2. Atualiza o pedido para PAGO
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          gatewayTxId
        }
      });

      // 3. Baixa estoque definitivo no PostgreSQL e gera os ingressos com chave TOTP
      for (const item of order.items) {
        await tx.batch.update({
          where: { id: item.batchId },
          data: { availableQty: { decrement: item.quantity } }
        });

        // Buscar o evento correspondente ao lote
        const batchWithEvent = await tx.batch.findUnique({
          where: { id: item.batchId },
          select: { sector: { select: { eventId: true } } }
        });

        const eventId = batchWithEvent!.sector.eventId;

        // Criar os ingressos individuais do comprador
        for (let i = 0; i < item.quantity; i++) {
          const secret = crypto.randomBytes(20).toString('hex'); // Segredo de 40 caracteres em hex

          await tx.ticket.create({
            data: {
              ticketCode: `TCK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              eventId,
              batchId: item.batchId,
              orderId: order.id,
              ownerId: order.userId,
              totpSecret: secret,
              status: 'VALID'
            }
          });
        }
      }

      return { success: true, orderId: order.id };
    });
  }
}