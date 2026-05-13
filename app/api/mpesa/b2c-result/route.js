import { createClient } from '@supabase/supabase-js';
import {
  finalizeWithdrawalDebit,
  markWithdrawalFailedByOriginator,
  withdrawalIdFromOriginator,
} from '@/lib/sellerWithdrawal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Safaricom may send nested Result + ResultParameters in several shapes. */
function parseB2cResultBody(body) {
  if (!body || typeof body !== 'object') return null;

  const result = body.Result || body.result;
  if (!result || typeof result !== 'object') return null;

  const resultCode = result.ResultCode ?? result.resultCode;
  const resultDesc = result.ResultDesc ?? result.resultDesc ?? '';
  const originator =
    result.OriginatorConversationID ||
    result.originatorConversationID ||
    result.OriginatorConversationId;
  const conversationId = result.ConversationID || result.conversationID || result.ConversationId;
  const transactionId = result.TransactionID || result.transactionID;

  let receipt = transactionId || null;
  const rp = result.ResultParameters || result.resultParameters;
  if (rp && typeof rp === 'object') {
    const params = rp.ResultParameter || rp.resultParameter;
    const list = Array.isArray(params) ? params : params ? [params] : [];
    const map = {};
    for (const item of list) {
      const k = item?.Key ?? item?.key;
      const v = item?.Value ?? item?.value;
      if (k) map[k] = v;
    }
    if (map.TransactionReceipt) receipt = String(map.TransactionReceipt);
    else if (map.ReceiptNo) receipt = String(map.ReceiptNo);
  }

  return {
    resultCode: resultCode != null ? String(resultCode) : '',
    resultDesc: String(resultDesc || ''),
    originatorConversationId: originator != null ? String(originator) : '',
    conversationId: conversationId != null ? String(conversationId) : null,
    transactionReceipt: receipt != null ? String(receipt) : null,
  };
}

export async function GET() {
  return Response.json({
    ok: true,
    service: 'safe-hands-mpesa-b2c-result',
    methods: ['POST'],
  });
}

/**
 * POST /api/mpesa/b2c-result
 * Daraja B2C ResultURL / QueueTimeOutURL — completes or fails a withdrawal_request.
 */
export async function POST(request) {
  try {
    let body;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        console.warn('b2c-result: non-json body', text?.slice(0, 200));
        return Response.json({ ResultCode: 0, ResultDesc: 'Ignored non-json' });
      }
    }

    const parsed = parseB2cResultBody(body);
    if (!parsed?.originatorConversationId) {
      console.warn('b2c-result: could not parse OriginatorConversationID', JSON.stringify(body).slice(0, 500));
      return Response.json({ ResultCode: 0, ResultDesc: 'No originator — acknowledged' });
    }

    const success = parsed.resultCode === '0';

    if (!success) {
      await markWithdrawalFailedByOriginator(supabase, parsed.originatorConversationId, {
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
        conversationId: parsed.conversationId,
      });
      return Response.json({ ResultCode: 0, ResultDesc: 'Acknowledged' });
    }

    const wid = withdrawalIdFromOriginator(parsed.originatorConversationId);
    if (!wid) {
      await markWithdrawalFailedByOriginator(supabase, parsed.originatorConversationId, {
        resultCode: 'PARSE',
        resultDesc: 'Could not map originator to withdrawal id',
        conversationId: parsed.conversationId,
      });
      return Response.json({ ResultCode: 0, ResultDesc: 'Acknowledged' });
    }

    const fin = await finalizeWithdrawalDebit(supabase, wid, {
      simulated: false,
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
      conversationId: parsed.conversationId,
      mpesaTransactionId: parsed.transactionReceipt,
    });

    if (!fin.ok) {
      console.error('finalizeWithdrawalDebit:', fin.error, wid);
    }

    return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (e) {
    console.error('b2c-result:', e);
    return Response.json({ ResultCode: 0, ResultDesc: 'Error logged' }, { status: 200 });
  }
}
