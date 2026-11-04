import { FastifyReply, FastifyRequest } from 'fastify';
import { CheckinService } from './checkin.service';

interface CheckinBody {
  ticketCode: string;
  readHash: string;
  staffId: string;
  gateName: string;
  isOffline?: boolean;
}

export class CheckinController {
  private checkinService = new CheckinService();

  public async processCheckin(req: FastifyRequest<{ Body: CheckinBody }>, reply: FastifyReply) {
    const { ticketCode, readHash, staffId, gateName, isOffline } = req.body;

    if (!ticketCode || !readHash || !staffId) {
      return reply.status(400).send({ error: 'CAMPOS_OBRIGATORIOS_AUSENTES' });
    }

    try {
      const result = await this.checkinService.validateAndCheckin({
        ticketCode,
        readHash,
        staffId,
        gateName: gateName || 'Portaria Principal',
        isOffline: isOffline || false
      });

      if (!result.success) {
        return reply.status(422).send(result);
      }

      return reply.status(200).send({
        message: 'Acesso Liberado!',
        data: result
      });
    } catch (error: any) {
      req.log.error(error);
      return reply.status(500).send({ error: 'ERRO_INTERNO_PORTARIA' });
    }
  }
}