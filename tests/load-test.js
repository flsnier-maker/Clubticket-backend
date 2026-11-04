import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuração do Cenário de Carga Massiva
export const options = {
  stages: [
    { duration: '10s', target: 500 },   // Rampa rápida: 500 usuários ativos em 10s
    { duration: '30s', target: 3000 },  // Pico de Venda: 3.000 usuários simultâneos por 30s
    { duration: '10s', target: 0 },     // Desaceleração
  ],
  thresholds: {
    // 95% das requisições devem ser respondidas em menos de 200ms
    http_req_duration: ['p(95)<200'],
    // Menos de 1% de erros 5xx de servidor permitidos
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';

export default function () {
  // Simula IDs aleatórios de usuários e lote VIP
  const userId = `usr_test_${Math.floor(Math.random() * 100000)}`;
  const batchId = 'lote-vip-01';

  const payload = JSON.stringify({
    userId: userId,
    batchId: batchId,
    quantity: 2,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Dispara a requisição de reserva
  const res = http.post(`${BASE_URL}/orders/reserve`, payload, params);

  // Validações
  check(res, {
    'Status é 201 (Sucesso) ou 409 (Esgotado sem erro 500)': (r) => r.status === 201 || r.status === 409,
    'Tempo de resposta abaixo de 200ms': (r) => r.timings.duration < 200,
  });

  // Pausa realista entre cliques (1 segundo)
  sleep(1);
}