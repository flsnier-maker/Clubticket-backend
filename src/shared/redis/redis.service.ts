import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

export class RedisService {
  private static instance: Redis;

  public static getInstance(): Redis {
    if (!RedisService.instance) {
      RedisService.instance = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

      // Registrar o Script Lua para Reserva Atômica de Estoque
      const luaScriptPath = path.join(__dirname, 'lua', 'reserve_stock.lua');
      if (fs.existsSync(luaScriptPath)) {
        const luaScript = fs.readFileSync(luaScriptPath, 'utf8');
        RedisService.instance.defineCommand('reserveStock', {
          numberOfKeys: 2,
          lua: luaScript,
        });
      }
    }

    return RedisService.instance;
  }
}