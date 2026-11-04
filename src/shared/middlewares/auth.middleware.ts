import { FastifyReply, FastifyRequest } from 'fastify';

export function verifyRole(allowedRoles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      const user = req.user as { role: string };

      if (!allowedRoles.includes(user.role)) {
        return reply.status(403).send({ error: 'ACESSO_NEGADO', message: 'Sem permissão para este recurso.' });
      }
    } catch (err) {
      return reply.status(401).send({ error: 'NAO_AUTORIZADO', message: 'Token inválido ou expirado.' });
    }
  };
}