import * as express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CircuitBreaker } from './circuitBreaker';

const app = express();
const circuitBreaker = new CircuitBreaker();

const PORT = 3333;
const API_SERVICE_URL = 'http://localhost:3000';

const proxy = createProxyMiddleware({
  target: API_SERVICE_URL,
  changeOrigin: true,
  selfHandleResponse: false,
  proxyTimeout: 2000,
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxy Request Interceptor', proxyReq.method, proxyReq.path);
    const isAvailable = circuitBreaker.checkRequest(req);

    if (!isAvailable) {
      console.log('Service unavailable');
      proxyReq.destroy();
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Proxy Response Interceptor', proxyRes.method, proxyRes.url, proxyRes.statusCode);

    const endpoint = `${req.method}:${req.url}`;
    const statusCode = proxyRes.statusCode || 500;
    if (statusCode >= 400) {
      circuitBreaker.onFailure(endpoint);
    } else {
      circuitBreaker.onSuccess(endpoint);
    }
  },
  onError: (err, req, res) => {
    console.log('Proxy Error Interceptor', err.message, req.destroyed);
    const endpoint = `${req.method}:${req.url}`;
    if (req.destroyed) circuitBreaker.onFailure(endpoint);
    res.end('Service unavailable');
  }
});

app.use('/api', proxy);

app.listen(PORT, () => {
  console.log(`Starting Proxy at ${PORT}`);
});