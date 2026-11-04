import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Criar Utilizador Administrador / Produtor
  const passwordHash = await bcrypt.hash('admin123', 10);
  const organizer = await prisma.user.upsert({
    where: { email: 'produtor@uniticket.com.br' },
    update: {},
    create: {
      name: 'Produtor do Evento',
      email: 'produtor@uniticket.com.br',
      cpf: '00000000000',
      passwordHash,
      role: 'ORGANIZER',
    },
  });

  // 2. Criar Evento de Teste
  const event = await prisma.event.create({
    data: {
      title: 'Mega Evento 50k',
      slug: 'mega-evento-50k',
      venueName: 'Estádio Esportivo',
      city: 'São Paulo',
      state: 'SP',
      address: 'Av. Principal, 1000',
      startDate: new Date('2027-07-15T22:00:00Z'),
      endDate: new Date('2027-07-16T06:00:00Z'),
      status: 'PUBLISHED',
      organizerId: organizer.id,
      sectors: {
        create: {
          name: 'Pista VIP',
          batches: {
            create: {
              name: '1º Lote VIP',
              priceInCents: 15000, // R$ 150,00
              feeInCents: 1500,    // R$ 15,00
              totalQuantity: 1000,
              availableQty: 1000,
              startsAt: new Date(),
              endsAt: new Date('2027-07-14T23:59:59Z'),
            },
          },
        },
      },
    },
    include: {
      sectors: {
        include: { batches: true },
      },
    },
  });

  console.log('✅ Base de dados populada com sucesso!');
  console.log(`ID do Lote Criado para testes: ${event.sectors[0].batches[0].id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });