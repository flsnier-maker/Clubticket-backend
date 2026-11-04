import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';

export class AuthController {
  private authService = new AuthService();

  async register(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const user = await this.authService.register(req.body as any);
      return reply.status(201).send({ message: 'Usuário cadastrado com sucesso!', user });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  }

  async login(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    const { email, password } = req.body as any;
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    const token = await reply.jwtSign({ id: user.id, role: user.role }, { expiresIn: '1d' });
    return reply.status(200).send({ token, user });
  }
}