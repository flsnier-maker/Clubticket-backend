import { PrismaService } from '../../shared/prisma/prisma.service';

export class EventsService {
  private prisma = PrismaService.getInstance();

  async createEvent(data: {
    title: string;
    slug: string;
    venueName: string;
    city: string;
    state: string;
    address: string;
    startDate: Date;
    endDate: Date;
    organizerId: string;
  }) {
    return await this.prisma.event.create({ data });
  }

  async createSectorAndBatch(eventId: string, sectorName: string, batchData: { name: string; priceInCents: number; feeInCents: number; totalQuantity: number; startsAt: Date; endsAt: Date }) {
    return await this.prisma.sector.create({
      data: {
        eventId,
        name: sectorName,
        batches: {
          create: {
            name: batchData.name,
            priceInCents: batchData.priceInCents,
            feeInCents: batchData.feeInCents,
            totalQuantity: batchData.totalQuantity,
            availableQty: batchData.totalQuantity,
            startsAt: batchData.startsAt,
            endsAt: batchData.endsAt,
          }
        }
      },
      include: { batches: true }
    });
  }

  async listPublishedEvents() {
    return await this.prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      include: { sectors: { include: { batches: true } } }
    });
  }
}