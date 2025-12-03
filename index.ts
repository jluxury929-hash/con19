
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME'
}

export enum StrategyType {
  ARBITRAGE = 'ARBITRAGE',
  MEV = 'MEV',
  LIQUIDATION = 'LIQUIDATION',
  FLASH_LOAN = 'FLASH_LOAN',
  MARKET_MAKING = 'MARKET_MAKING',
  TREND_FOLLOWING = 'TREND_FOLLOWING',
  MEAN_REVERSION = 'MEAN_REVERSION',
  MOMENTUM = 'MOMENTUM',
  STATISTICAL_ARBITRAGE = 'STATISTICAL_ARBITRAGE',
  TRIANGULAR_ARBITRAGE = 'TRIANGULAR_ARBITRAGE',
  CROSS_DEX = 'CROSS_DEX',
  CROSS_CHAIN = 'CROSS_CHAIN',
  SANDWICH = 'SANDWICH',
  FRONTRUN = 'FRONTRUN',
  BACKRUN = 'BACKRUN',
  JIT_LIQUIDITY = 'JIT_LIQUIDITY',
  VOLUME_ANALYSIS = 'VOLUME_ANALYSIS',
  ORDERBOOK_IMBALANCE = 'ORDERBOOK_IMBALANCE',
  FUNDING_RATE = 'FUNDING_RATE',
  BASIS_TRADING = 'BASIS_TRADING'
}

export enum ChainId {
  ETHEREUM = 1,
  BSC = 56,
  POLYGON = 137,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  AVALANCHE = 43114,
  FANTOM = 250
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: ChainId;
  name?: string;
  logoURI?: string;
}

export interface PriceData {
  token: string;
  price: number;
  timestamp: number;
  source: string;
  volume24h?: number;
  priceChange24h?: number;
  liquidity?: number;
}

export interface Opportunity {
  id: string;
  type: StrategyType;
  riskLevel: RiskLevel;
  estimatedProfit: number;
  estimatedProfitUSD: number;
  confidence: number;
  gasEstimate: number;
  tokens: Token[];
  dexes: string[];
  chainId: ChainId;
  timestamp: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  riskLevel: RiskLevel;
  enabled: boolean;
  priority: number;
  minProfitUSD: number;
  maxGasPrice: number;
  successRate: number;
  totalTrades: number;
  profitabletrades: number;
  totalProfitUSD: number;
  averageExecutionTime: number;
  lastExecuted?: number;
  parameters: Record<string, any>;
  execute: (opportunity: Opportunity) => Promise<TradeResult>;
  analyze: () => Promise<Opportunity[]>;
}

export interface TradeResult {
  success: boolean;
  transactionHash?: string;
  profit?: number;
  profitUSD?: number;
  gasUsed?: number;
  executionTime: number;
  error?: string;
  timestamp: number;
}

export interface MarketData {
  prices: Map<string, PriceData>;
  volumes: Map<string, number>;
  liquidities: Map<string, number>;
  lastUpdate: number;
}

export interface FlashLoanOpportunity {
  id: string;
  loanAmount: number;
  loanToken: Token;
  estimatedProfit: number;
  estimatedProfitUSD: number;
  confidence: number;
  riskScore: number;
  steps: FlashLoanStep[];
  gasEstimate: number;
  timestamp: number;
}

export interface FlashLoanStep {
  action: 'SWAP' | 'BORROW' | 'REPAY' | 'TRANSFER';
  dex?: string;
  tokenIn?: Token;
  tokenOut?: Token;
  amountIn?: number;
  expectedAmountOut?: number;
  slippage?: number;
}

export interface AIDecision {
  shouldExecute: boolean;
  confidence: number;
  reasoning: string;
  recommendedStrategies: string[];
  riskAssessment: {
    overallRisk: RiskLevel;
    factors: string[];
    score: number;
  };
  expectedProfit: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfitUSD: number;
  totalLossUSD: number;
  netProfitUSD: number;
  averageTradeTime: number;
  tradesPerSecond: number;
  successRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  timestamp: number;
}

export interface SystemStatus {
  isRunning: boolean;
  activeStrategies: number;
  totalStrategies: number;
  tradesExecuted: number;
  opportunitiesFound: number;
  currentBalance: number;
  profitToday: number;
  uptime: number;
  performance: PerformanceMetrics;
  lastUpdate: number;
}

export interface Config {
  server: {
    port: number;
    wsPort: number;
    environment: string;
  };
  trading: {
    maxTradesPerSecond: number;
    minProfitThresholdUSD: number;
    maxGasPriceGwei: number;
    enableFlashLoans: boolean;
    flashLoanAmountETH: number;
  };
  risk: {
    maxPositionSizeETH: number;
    maxDailyLossETH: number;
    stopLossPercent: number;
    enableRiskLimits: boolean;
  };
  strategies: {
    enableLowRisk: boolean;
    enableMediumRisk: boolean;
    enableHighRisk: boolean;
    maxActiveStrategies: number;
    rotationIntervalMs: number;
  };
  ai: {
    confidenceThreshold: number;
    enableOptimization: boolean;
    retrainingIntervalHours: number;
  };
}
