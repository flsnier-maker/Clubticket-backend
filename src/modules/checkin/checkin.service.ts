import { PrismaService } from '../../shared/prisma/prisma.service';
import { TotpService } from '../tickets/totp.service';

interface ValidateCheckinInput {
  ticketCode: string;
  readHash: string;
  staffId: string;
  gateName: string;
  isOffline?: boolean;
}

export class CheckinService {
  private prisma = PrismaService.getInstance();

  public async validateAndCheckin({
    ticketCode,
    readHash,
    staffId,
    gateName,
    isOffline = false
  }: ValidateCheckinInput) {
    // 1. Busca o ingresso pelo código visível no bilhete
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode },
      include: { owner: { select: { name: true, cpf: true } } }
    });

    if (!ticket) {
      return { success: false, reason: 'INGRESSO_NAO_ENCONTRADO' };
    }

    // 2. Verificar se o ingresso já foi utilizado anteriormente
    if (ticket.status === 'USED') {
      return { 
        success: false, 
        reason: 'INGRESSO_JA_UTILIZADO',
        ownerName: ticket.owner.name 
      };
    }

    if (ticket.status !== 'VALID') {
      return { success: false, reason: `INGRESSO_INVALIDO_STATUS_${ticket.status}` };
    }

    // 3. Validar a matemática do Hash TOTP lido (muda a cada 10 segundos)
    const validation = TotpService.validateCode(ticket.totpSecret, readHash, 1);

    if (!validation.isValid) {
      return { 
        success: false, 
        reason: 'HASH_EXPIRADO_OU_PRINT_INVALIDO',
        message: 'O QR Code informado já expirou ou é um print de tela fraudulento.'
      };
    }

    // 4. Marca o ingresso como UTILIZADO e registra o log de check-in
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'USED' }
      }),
      this.prisma.ticketCheckin.create({
        data: {
          ticketId: ticket.id,
          staffId,
          gateName,
          readHash,
          isOffline
        }
      })
    ]);

    return {
      success: true,
      ownerName: ticket.owner.name,
      ownerCpf: ticket.owner.cpf,
      ticketCode: ticket.ticketCode
    };
  }
}