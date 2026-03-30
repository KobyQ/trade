import { DEFAULT_SYMBOLS, DEFAULT_TIMEFRAME } from '@/config/constants';
import { MockMarketDataProvider } from '@/providers/market-data';
import { SupabaseCandleRepository } from '@/repositories/candle-repository';
import { SignalRepository } from '@/repositories/signal-repository';
import { log } from '@/lib/logger';
import { IngestionService } from './ingestion-service';
import { computeFeatureSnapshot } from './feature-engine';
import { generateSignal } from './signal-engine';
import { evaluateRisk } from './risk-engine';
import { AlertService } from './alert-service';
import { DisabledLlmProvider } from './llm-provider';

export async function runCoreJobs(): Promise<{ processed: number }> {
  const candleRepo = new SupabaseCandleRepository();
  const signalRepo = new SignalRepository();
  const provider = new MockMarketDataProvider();
  const ingestion = new IngestionService(provider, candleRepo);
  const alertService = new AlertService();

  let processed = 0;

  for (const symbol of DEFAULT_SYMBOLS) {
    try {
      await ingestion.ingest(symbol, DEFAULT_TIMEFRAME, 280);
      const candles = await candleRepo.getRecent(symbol, DEFAULT_TIMEFRAME, 280);
      const feature = computeFeatureSnapshot(candles);
      await signalRepo.saveFeatureSnapshot(feature);

      const config = await signalRepo.getStrategyConfig(symbol, DEFAULT_TIMEFRAME);
      const signal = await generateSignal(feature, config, new DisabledLlmProvider());
      const risk = evaluateRisk(signal, config, {
        openTrades: 0,
        dailyRiskUsedPct: 0,
        consecutiveLosses: 0,
        duplicateWithinMinutes: false,
        nowIso: new Date().toISOString(),
      });

      const runId = await signalRepo.logSignalRun({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        marketSnapshot: candles,
        features: feature,
        deterministicResult: { passed: signal.deterministic_checks_passed },
        aiOutput: signal.llm_used ? { used: true } : { used: false },
        finalSignal: signal,
      });

      await signalRepo.saveDecision(runId, signal, risk);

      if (risk.approved && signal.setup_valid && signal.setup_type !== 'no_trade') {
        await alertService.sendEmail(`New signal ${symbol}`, JSON.stringify(signal));
      }

      processed += 1;
    } catch (error) {
      log('error', 'jobs.symbol_failed', { symbol, error: String(error) });
      await signalRepo.logSignalRun({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        marketSnapshot: [],
        features: {
          symbol,
          timeframe: DEFAULT_TIMEFRAME,
          timestamp: new Date().toISOString(),
          ema20: 0,
          ema50: 0,
          ema200: 0,
          atr14: 0,
          adx14: 0,
          rsi14: 0,
          sessionTag: 'off_hours',
          volatilityRegime: 'normal',
          trendRegime: 'range',
          pullbackReclaimState: 'none',
        },
        deterministicResult: null,
        aiOutput: null,
        finalSignal: {
          symbol,
          timeframe: DEFAULT_TIMEFRAME,
          timestamp: new Date().toISOString(),
          setup_valid: false,
          bias: 'neutral',
          setup_type: 'no_trade',
          entry: null,
          stop_loss: null,
          take_profit: null,
          risk_reward: null,
          confidence: 0,
          reasons: ['job failed'],
          invalidation: [],
          deterministic_checks_passed: false,
          llm_used: false,
          raw_features_json: {},
        },
        errorMessage: String(error),
      });
    }
  }

  return { processed };
}
