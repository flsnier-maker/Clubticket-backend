import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';

interface CreateReservationInput {
  userId: string;
  batchId: string;
  quantity: number;
}

export async function createReservationService({ userId, batchId, quantity }: CreateReservationInput) {
  // 1. Chave de bloqueio/estoque no Redis para o lote
  const redisKey = `batch:${batchId}:available`;
  const lockKey = `lock:batch:${batchId}`;

  // Tenta adquirir um lock temporário para evitar race conditions simultâneas
  const acquiredLock = await redis.set(lockKey, 'locked', 'NX', 'EX', 5);
  
  if (!acquiredLock) {
    throw new Error('Muitas requisições simultâneas. Tente novamente em alguns segundos.');
  }

  try {
    // 2. Verificar quantidade disponível direto no Prisma/DB
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });

    if (!batch || !batch.isActive) {
      throw new Error('Lote de ingressos indisponível ou inválido.');
    }

    if (quantity > batch.maxPerUser) {
      throw new Error(`Limite máximo de ${batch.maxPerUser} ingressos por usuário excedido.`);
    }

    if (batch.availableQty < quantity) {
      throw new Error('Ingressos esgotados para este lote.');
    }

    // 3. Criar ordem em status PENDING com expiração de 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const totalInCents = (batch.priceInCents + batch.feeInCents) * quantity;
    const orderCode = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      // Abater quantidade disponível no lote
      await tx.batch.update({
        where: { id: batchId },
        data: {
          availableQty: {
            decrement: quantity,
          },
        },
      });

      // Criar a reserva/pedido
      return await tx.order.create({
        data: {
          code: orderCode,
          userId,
          status: 'PENDING',
          totalInCents,
          expiresAt,
          items: {
            create: {
              batchId,
              quantity,
              unitPrice: batch.priceInCents,
              unitFee: batch.feeInCents,
            },
          },
        },
        include: {
          items: true,
        },
      });
    });

    return order;
  } finally {
    // Libera a trava do Redis
    await redis.del(lockKey);
  }
}