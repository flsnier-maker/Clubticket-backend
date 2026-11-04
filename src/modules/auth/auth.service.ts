import bcrypt from 'bcryptjs';
import { PrismaService } from '../../shared/prisma/prisma.service';

export class AuthService {
  private prisma = PrismaService.getInstance();

  async register(data: { name: string; email: string; cpf: string; password: string; role?: 'CUSTOMER' | 'ORGANIZER' | 'GATE_STAFF' }) {
    const userExists = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { cpf: data.cpf }] }
    });

    if (userExists) {
      throw new Error('E-mail ou CPF já cadastrado.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        passwordHash,
        role: data.role || 'CUSTOMER'
      },
      select: { id: true, name: true, email: true, role: true }
    });

    return user;
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) return null;

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}