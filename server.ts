
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server as WebSocketServer } from 'ws';
import { config } from '../config';
import { tradingEngine } from '../engine/tradingEngine';
import { strategyRegistry } from '../strategies/strategyRegistry';
import { aiDecisionEngine } from '../ai/decisionEngine';
import { priceFeedAggregator } from '../market/priceFeeds';
import { flashLoanEngine } from '../flashloan/flashLoanEngine';
import { walletManager } from '../blockchain/wallet';
import { blockchainProvider } from '../blockchain/provider';
import logger from '../utils/logger';

export class APIServer {
  private app: express.Application;
  private wsServer: WebSocketServer | null = null;
  private wsClients: Set<any> = new Set();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // System status
    this.app.get('/api/status', async (req: Request, res: Response) => {
      try {
        const status = tradingEngine.getSystemStatus();
        const balances = await walletManager.getAllBalances();
        
        res.json({
          ...status,
          balances,
          providerHealth: blockchainProvider.getHealthStatus()
        });
      } catch (error) {
        logger.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status' });
      }
    });

    // Start trading engine
    this.app.post('/api/start', async (req: Request, res: Response) => {
      try {
        if (tradingEngine.isEngineRunning()) {
          return res.status(400).json({ error: 'Engine already running' });
        }

        await tradingEngine.start();
        flashLoanEngine.startScanning();

        res.json({
          success: true,
          message: 'Trading engine started',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Error starting engine:', error);
        res.status(500).json({ error: 'Failed to start engine' });
      }
    });

    // Stop trading engine
    this.app.post('/api/stop', async (req: Request, res: Response) => {
      try {
        if (!tradingEngine.isEngineRunning()) {
          return res.status(400).json({ error: 'Engine not running' });
        }

        await tradingEngine.stop();
        flashLoanEngine.stopScanning();

        res.json({
          success: true,
          message: 'Trading engine stopped',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Error stopping engine:', error);
        res.status(500).json({ error: 'Failed to stop engine' });
      }
    });

    // Get performance metrics
    this.app.get('/api/metrics', (req: Request, res: Response) => {
      try {
        const metrics = tradingEngine.getPerformanceMetrics();
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // Get strategies
    this.app.get('/api/strategies', (req: Request, res: Response) => {
      try {
        const { type, risk, active } = req.query;
        
        let strategies = strategyRegistry.getAllStrategies();

        if (type) {
          strategies = strategies.filter(s => s.type === type);
        }

        if (risk) {
          strategies = strategies.filter(s => s.riskLevel === risk);
        }

        if (active === 'true') {
          strategies = strategies.filter(s => s.enabled);
        }

        res.json({
          total: strategies.length,
          strategies: strategies.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            riskLevel: s.riskLevel,
            enabled: s.enabled,
            priority: s.priority,
            successRate: s.successRate,
            totalTrades: s.totalTrades,
            totalProfitUSD: s.totalProfitUSD
          }))
        });
      } catch (error) {
        logger.error('Error getting strategies:', error);
        res.status(500).json({ error: 'Failed to get strategies' });
      }
    });

    // Get strategy statistics
    this.app.get('/api/strategies/stats', (req: Request, res: Response) => {
      try {
        const stats = strategyRegistry.getStrategyStats();
        const topPerforming = strategyRegistry.getTopPerformingStrategies(10);

        res.json({
          ...stats,
          topPerforming: topPerforming.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            successRate: s.successRate,
            totalProfitUSD: s.totalProfitUSD,
            totalTrades: s.totalTrades
          }))
        });
      } catch (error) {
        logger.error('Error getting strategy stats:', error);
        res.status(500).json({ error: 'Failed to get strategy stats' });
      }
    });

    // Activate strategy
    this.app.post('/api/strategies/:id/activate', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        strategyRegistry.activateStrategy(id);
        
        res.json({
          success: true,
          message: 'Strategy activated',
          strategyId: id
        });
      } catch (error) {
        logger.error('Error activating strategy:', error);
        res.status(500).json({ error: 'Failed to activate strategy' });
      }
    });

    // Deactivate strategy
    this.app.post('/api/strategies/:id/deactivate', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        strategyRegistry.deactivateStrategy(id);
        
        res.json({
          success: true,
          message: 'Strategy deactivated',
          strategyId: id
        });
      } catch (error) {
        logger.error('Error deactivating strategy:', error);
        res.status(500).json({ error: 'Failed to deactivate strategy' });
      }
    });

    // Get prices
    this.app.get('/api/prices', (req: Request, res: Response) => {
      try {
        const { token, source } = req.query;

        if (token) {
          const price = priceFeedAggregator.getPrice(token as string, source as string);
          return res.json(price);
        }

        const allPrices = priceFeedAggregator.getAllPrices();
        const pricesArray = Array.from(allPrices.values());

        res.json({
          total: pricesArray.length,
          prices: pricesArray
        });
      } catch (error) {
        logger.error('Error getting prices:', error);
        res.status(500).json({ error: 'Failed to get prices' });
      }
    });

    // Get arbitrage opportunities
    this.app.get('/api/arbitrage', (req: Request, res: Response) => {
      try {
        const minProfit = parseFloat(req.query.minProfit as string) || 0.5;
        const opportunities = priceFeedAggregator.findArbitrageOpportunities(minProfit);

        res.json({
          total: opportunities.length,
          opportunities
        });
      } catch (error) {
        logger.error('Error getting arbitrage opportunities:', error);
        res.status(500).json({ error: 'Failed to get arbitrage opportunities' });
      }
    });

    // Get flash loan opportunities
    this.app.get('/api/flashloans', (req: Request, res: Response) => {
      try {
        const opportunities = flashLoanEngine.getOpportunities();
        const best = flashLoanEngine.getBestOpportunity();
        const stats = flashLoanEngine.getStatistics();

        res.json({
          total: opportunities.length,
          opportunities,
          best,
          statistics: stats
        });
      } catch (error) {
        logger.error('Error getting flash loan opportunities:', error);
        res.status(500).json({ error: 'Failed to get flash loan opportunities' });
      }
    });

    // Simulate flash loan
    this.app.post('/api/flashloans/:id/simulate', async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const opportunities = flashLoanEngine.getOpportunities();
        const opportunity = opportunities.find(o => o.id === id);

        if (!opportunity) {
          return res.status(404).json({ error: 'Opportunity not found' });
        }

        const simulation = await flashLoanEngine.simulateFlashLoan(opportunity);
        res.json(simulation);
      } catch (error) {
        logger.error('Error simulating flash loan:', error);
        res.status(500).json({ error: 'Failed to simulate flash loan' });
      }
    });

    // Get wallet balance
    this.app.get('/api/wallet/balance', async (req: Request, res: Response) => {
      try {
        const balances = await walletManager.getAllBalances();
        
        res.json({
          address: walletManager.getAddress(),
          balances
        });
      } catch (error) {
        logger.error('Error getting balance:', error);
        res.status(500).json({ error: 'Failed to get balance' });
      }
    });

    // Get AI performance
    this.app.get('/api/ai/performance', (req: Request, res: Response) => {
      try {
        const performance = aiDecisionEngine.getStrategyPerformance();
        const performanceArray = Array.from(performance.entries()).map(([type, perf]) => ({
          strategyType: type,
          ...perf
        }));

        res.json({
          total: performanceArray.length,
          performance: performanceArray
        });
      } catch (error) {
        logger.error('Error getting AI performance:', error);
        res.status(500).json({ error: 'Failed to get AI performance' });
      }
    });

    // Reset metrics
    this.app.post('/api/metrics/reset', (req: Request, res: Response) => {
      try {
        tradingEngine.resetMetrics();
        
        res.json({
          success: true,
          message: 'Metrics reset successfully'
        });
      } catch (error) {
        logger.error('Error resetting metrics:', error);
        res.status(500).json({ error: 'Failed to reset metrics' });
      }
    });

    // Get configuration
    this.app.get('/api/config', (req: Request, res: Response) => {
      try {
        res.json(config);
      } catch (error) {
        logger.error('Error getting config:', error);
        res.status(500).json({ error: 'Failed to get config' });
      }
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });
  }

  private setupWebSocket(): void {
    this.wsServer = new WebSocketServer({ port: config.server.wsPort });

    this.wsServer.on('connection', (ws) => {
      logger.info('WebSocket client connected');
      this.wsClients.add(ws);

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });

      // Send initial status
      this.sendToClient(ws, {
        type: 'status',
        data: tradingEngine.getSystemStatus()
      });
    });

    logger.info(`WebSocket server started on port ${config.server.wsPort}`);
  }

  private setupEventListeners(): void {
    // Broadcast performance updates
    tradingEngine.on('performance_update', (metrics) => {
      this.broadcast({
        type: 'performance',
        data: metrics
      });
    });

    // Broadcast trade executions
    tradingEngine.on('trade_executed', (data) => {
      this.broadcast({
        type: 'trade',
        data
      });
    });

    // Broadcast opportunities
    tradingEngine.on('opportunity', (opportunity) => {
      this.broadcast({
        type: 'opportunity',
        data: opportunity
      });
    });
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    
    this.wsClients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(data);
        } catch (error) {
          logger.error('Error broadcasting to client:', error);
        }
      }
    });
  }

  private sendToClient(client: any, message: any): void {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending to client:', error);
      }
    }
  }

  public start(): void {
    this.app.listen(config.server.port, () => {
      logger.info(`API Server started on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.environment}`);
      logger.info(`WebSocket server running on port ${config.server.wsPort}`);
    });
  }

  public stop(): void {
    if (this.wsServer) {
      this.wsServer.close();
      logger.info('WebSocket server stopped');
    }
  }
}

export const apiServer = new APIServer();
