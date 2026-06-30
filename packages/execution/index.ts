import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { insertAuditLog } from "../core/audit";

function getEnv(name: string): string | undefined {
  const _Deno = (globalThis as any).Deno;
  if (typeof _Deno !== "undefined" && typeof _Deno.env?.get === "function") {
    return _Deno.env.get(name) ?? undefined;
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

export function makeClientOrderId(tradeId: string, n = 1) {
  return `${tradeId}-${n}`;
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limitPrice?: number;
  stopPrice?: number;
  tif?: 'day' | 'ioc' | 'fok';
  clientOrderId?: string;
}

async function metaApiFetch(path: string, opts: RequestInit, accountId?: string) {
  const token = getEnv('METAAPI_TOKEN');
  const region = getEnv('METAAPI_REGION') || 'new-york';
  const base = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
  
  const headers = {
    'auth-token': token,
    ...(opts.headers || {}),
  } as Record<string, string>;
  
  // If path doesn't start with /users, auto-prefix it for the account
  const fullPath = path.startsWith('/users') 
    ? `${base}${path}` 
    : `${base}/users/current/accounts/${accountId || getEnv('METAAPI_ACCOUNT_ID')}${path}`;
    
  const res = await fetch(fullPath, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MetaAPI error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function placePaperOrder(
  order: OrderRequest,
  supabase?: SupabaseClient,
) {
  const client =
    supabase ||
    (() => {
      const url = getEnv('SUPABASE_URL');
      const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
      return url && key ? createClient(url, key) : undefined;
    })();

  if (client) {
    const { supabase: _supa, ...safeOrder } = order as any;
    await insertAuditLog(client, {
      actor_type: 'SYSTEM',
      action: 'PLACE_ORDER',
      entity_type: 'order',
      payload_json: safeOrder as unknown as Record<string, unknown>,
    });
  }

  // Map order type to MetaAPI actionType
  let actionType = 'ORDER_TYPE_BUY';
  if (order.type === 'market') {
    actionType = order.side === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';
  } else if (order.type === 'limit') {
    actionType = order.side === 'buy' ? 'ORDER_TYPE_BUY_LIMIT' : 'ORDER_TYPE_SELL_LIMIT';
  } else if (order.type === 'stop') {
    actionType = order.side === 'buy' ? 'ORDER_TYPE_BUY_STOP' : 'ORDER_TYPE_SELL_STOP';
  }

  const res = await metaApiFetch('/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actionType,
      symbol: order.symbol,
      volume: order.qty,
      openPrice: order.limitPrice || order.stopPrice,
      clientId: order.clientOrderId,
    }),
  });

  if (client) {
    await insertAuditLog(client, {
      actor_type: 'SYSTEM',
      action: 'ORDER_RESPONSE',
      entity_type: 'order',
      payload_json: res,
    });
  }
  return res;
}

export interface TrackedOrderRequest extends OrderRequest {
  tradeId: string;
  supabase: any;
  n?: number;
}

export async function placeAndTrackOrder(req: TrackedOrderRequest) {
  const clientOrderId =
    req.clientOrderId || makeClientOrderId(req.tradeId, req.n);
  
  // MetaAPI synchronously executes market orders and returns the result
  const orderRes = await placePaperOrder({ ...req, clientOrderId });

  const isFilled = orderRes.stringCode === 'ERR_NO_ERROR' || orderRes.orderId;
  const status = isFilled ? 'FILLED' : 'FAILED';

  const { data: orderRow } = await req.supabase
    .from('orders')
    .insert({
      trade_id: req.tradeId,
      broker: 'METAAPI',
      client_order_id: clientOrderId,
      type: req.type,
      side: req.side,
      qty: req.qty,
      status: status,
      price: orderRes.price,
      raw_request: {
        symbol: req.symbol,
        side: req.side,
        qty: req.qty,
        type: req.type,
        client_order_id: clientOrderId,
      },
      raw_response: orderRes,
    })
    .select('id')
    .single();

  if (!orderRow) {
    throw new Error('Failed to insert order into database');
  }

  // If filled, log the execution
  if (isFilled && orderRes.price) {
    await req.supabase.from('executions').insert({
      order_id: orderRow.id,
      price: Number(orderRes.price),
      qty: req.qty, // MetaAPI market orders usually fill the entire requested volume
      raw_fill: orderRes,
    });
  }

  return { orderId: orderRow.id, clientOrderId, filledQty: isFilled ? req.qty : 0, status };
}

export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export async function fetchPaperBars(
  symbol: string,
  timeframe = '1h',
  limit = 100,
): Promise<Bar[]> {
  try {
    const res = await metaApiFetch(`/historical-market-data/symbols/${symbol}/timeframes/${timeframe}/candles?limit=${limit}`, {
      method: 'GET'
    });
    
    // Map MetaAPI candles to the expected Bar interface
    return (res || []).map((c: any) => ({
      t: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.tickVolume || c.volume || 0,
    }));
  } catch (err) {
    console.warn(`Failed to fetch MetaAPI bars for ${symbol}:`, err);
    return [];
  }
}