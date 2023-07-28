import * as express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CircuitBreaker } from './circuitBreaker';

const app = express();
const circuitBreaker = new CircuitBreaker();

const PORT = 3333;
const API_SERVICE_URL = 'http://localhost:3000';
const TIMEOUT = 5000;

const proxy = createProxyMiddleware({
  target: API_SERVICE_URL,
  changeOrigin: true,
  selfHandleResponse: true,
  proxyTimeout: TIMEOUT,
  logLevel: 'silent',
  onProxyReq: (proxyReq, req, res) => {
    // console.log('Proxy Request Interceptor', proxyReq.method, proxyReq.path);
    const isAvailable = circuitBreaker.checkRequest(req);

    if (!isAvailable) {
      console.log(`${req.method}:${req.url} Service Unavailable Try Again Later`);
      res.sendStatus(429);
      // proxyReq.destroy();
    }

    return proxyReq;
  },
  onProxyRes: (proxyRes, req, res) => {
    // console.log(`Proxy Response Interceptor ${req.method}:${req.url} ${proxyRes.statusCode}`);
    const endpoint = `${req.method}:${req.url}`;
    const statusCode = proxyRes.statusCode || 500;
    if (statusCode >= 400) {
      circuitBreaker.onFailure(endpoint);
    } else {
      circuitBreaker.onSuccess(endpoint);
    }

    if (!res.headersSent) {
      res.statusCode = statusCode || 500;
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }
    proxyRes.pipe(res);
  },
  onError: (err, req, res) => {
    console.log('Proxy Error Interceptor', err.message, req.destroyed);
    const endpoint = `${req.method}:${req.url}`;
    circuitBreaker.onFailure(endpoint);
    res.sendStatus(res.statusCode || 500);
  },
  
});

app.use('/api', proxy);

app.listen(PORT, () => {
  console.log(`Starting Proxy at ${PORT}`);
});