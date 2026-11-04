import crypto from 'crypto';

export class TotpService {
  private static readonly TIME_STEP_SECONDS = 10; // O QR Code expira e muda a cada 10 segundos

  /**
   * Gerador de código HMAC com base no segredo do ingresso e no timestamp atual
   */
  public static generateCode(secret: string, timestamp: number = Date.now()): string {
    const timeBucket = Math.floor(timestamp / 1000 / this.TIME_STEP_SECONDS);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(Buffer.from(timeBucket.toString()));
    
    // Retorna os primeiros 8 caracteres em hexadecimal formatados
    return hmac.digest('hex').substring(0, 8).toUpperCase();
  }

  /**
   * Valida o Hash lido na portaria aceitando uma margem de tolerância (drift) 
   * para relógios levemente dessincronizados na catraca
   */
  public static validateCode(
    secret: string, 
    codeToValidate: string, 
    toleranceSteps: number = 1
  ): { isValid: boolean; stepOffset: number } {
    const now = Date.now();

    for (let offset = -toleranceSteps; offset <= toleranceSteps; offset++) {
      const timeForStep = now + offset * this.TIME_STEP_SECONDS * 1000;
      const expectedCode = this.generateCode(secret, timeForStep);

      if (expectedCode === codeToValidate) {
        return { isValid: true, stepOffset: offset };
      }
    }

    return { isValid: false, stepOffset: 0 };
  }
}