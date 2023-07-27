/**
 * CLOSE
 *   - if the request is successful, the circuit remains closed
 *   - if the request fails, the circuit moves to the open state
 *   - fail timeout: 2 sec
 *   - fail threshold: 5
 * 
 * OPEN
 *  - if the circuit is open, the request fails immediately
 *  - after a cooldown, the circuit moves to the half-open state
 *  - cooldown: 5 sec
 * 
 * HALF-OPEN
 *  - if the request is successful, the circuit moves to the closed state
 *  - if the request fails, the circuit moves to the open state
 */

import { Request } from 'express';

const CircuitBreakerStatus = {
  CLOSE: 'CLOSE',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF-OPEN'
} as const;
type CircuitBreakerStatus = typeof CircuitBreakerStatus[keyof typeof CircuitBreakerStatus];

type ApiState = {
  status: CircuitBreakerStatus;
  failCount: number;
  nextTry: number;
}

export class CircuitBreaker {
  private readonly FAIL_THRESHOLD = 3;
  private readonly COOLDOWN = 5000;

  private readonly endpointMap: Map<string, ApiState>;

  constructor() {
    this.endpointMap = new Map<string, ApiState>();
  }

  checkRequest(req: Request) {
    const endpoint = `${req.method}:${req.url}`;

    return this.isAvailable(endpoint);
  }

  initState(endpoint: string) {
    this.endpointMap.set(endpoint, {
      status: CircuitBreakerStatus.CLOSE,
      failCount: 0,
      nextTry: 0
    });
  }

  onFailure(endpoint: string) {
    const state = this.endpointMap.get(endpoint);
    if (state === undefined) return;

    state.failCount += 1;
    if (state.failCount > this.FAIL_THRESHOLD) {
      console.log(`${endpoint} fail threshold reached. ${state.status} -> OPEN`);
      state.status = CircuitBreakerStatus.OPEN;
      state.nextTry = Date.now() + this.COOLDOWN;
    }
  }

  onSuccess(endpoint: string) {
    this.initState(endpoint);
  }

  isAvailable(endpoint: string) {
    const state = this.endpointMap.get(endpoint);
    if (state === undefined) {
      this.initState(endpoint);
      return true;
    }

    if (state.status === CircuitBreakerStatus.CLOSE) {
      return true;
    }
    console.log(`${endpoint} is not available. status: ${state.status}`);

    const now = Date.now();
    if (state.nextTry <= now && state.status !== CircuitBreakerStatus.HALF_OPEN) {
      state.status = CircuitBreakerStatus.HALF_OPEN;
      console.log(`${endpoint} is not available. OPEN -> HALF_OPEN`);
      return true;
    }
    console.log(`${endpoint} is not available. next try: ${state.nextTry}`);

    return false;
  }
}