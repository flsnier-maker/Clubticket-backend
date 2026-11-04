import { FastifyReply, FastifyRequest } from 'fastify';
import { PaymentsService } from './payments.service';

interface WebhookBody {
  event: string;
  data: {
    id: string; // ID da transação no Gateway
    external_reference: string; // Nosso orderId
    status: string;
  };
}

export class PaymentsController {
  private paymentsService = new PaymentsService();

  public async handleWebhook(req: FastifyRequest<{ Body: WebhookBody }>, reply: FastifyReply) {
    const { event, data } = req.body;

    // Exemplo de payload estilo MercadoPago / Asaas
    if (event === 'payment.approved' || data?.status === 'approved') {
      try {
        await this.paymentsService.processPaymentApproved(data.id, data.external_reference);
        return reply.status(200).send({ received: true });
      } catch (error: any) {
        req.log.error(error);
        return reply.status(500).send({ error: 'FALHA_PROCESSAMENTO_WEBHOOK' });
      }
    }

    return reply.status(200).send({ message: 'Evento ignorado' });
  }
}