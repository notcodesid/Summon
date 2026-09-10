import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from 'npm:@solana/web3.js@1.98.4'
import bs58 from 'npm:bs58@6.0.0'
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { AuthError, requirePrivyUserId } from '../_shared/privy.ts'
import { serviceClient } from '../_shared/supabase.ts'

const DEFAULT_RPC_URL = 'https://api.devnet.solana.com'
/** 0.01 SOL — covers PDA rent (~0.001) + fees, nothing worth stealing. */
const DEFAULT_DRIP_LAMPORTS = 10_000_000
const DEFAULT_DAILY_CAP = 100

function sponsorKeypair(): Keypair {
  const secret = Deno.env.get('SPONSOR_PRIVATE_KEY') ?? ''
  if (!secret) throw new Error('Server is missing SPONSOR_PRIVATE_KEY')
  return Keypair.fromSecretKey(bs58.decode(secret.trim()))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const privyUserId = await requirePrivyUserId(req)
    const supabase = serviceClient()
    const body = (await req.json()) as { walletAddress?: string }
    const walletAddress = (body.walletAddress ?? '').trim()

    let destination: PublicKey
    try {
      destination = new PublicKey(walletAddress)
    } catch {
      return errorResponse('Invalid wallet address', 400)
    }

    // Idempotent: one drip per user, ever.
    const { data: existing, error: readError } = await supabase
      .from('sponsor_drips')
      .select('signature, amount_lamports')
      .eq('privy_user_id', privyUserId)
      .maybeSingle()
    if (readError) {
      console.error('drip read', readError)
      return errorResponse('Could not check drip status', 500)
    }
    if (existing) {
      return jsonResponse({ ok: true, already: true, signature: existing.signature })
    }

    // Global daily cap — bounds the damage if fake accounts flood in.
    const dailyCap = Number(Deno.env.get('SPONSOR_DAILY_CAP') ?? DEFAULT_DAILY_CAP)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('sponsor_drips')
      .select('privy_user_id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (countError) {
      console.error('drip cap read', countError)
      return errorResponse('Could not check drip status', 500)
    }
    if ((count ?? 0) >= dailyCap) {
      return errorResponse('Drip limit reached, try again tomorrow', 429)
    }

    const amountLamports = Number(Deno.env.get('DRIP_LAMPORTS') ?? DEFAULT_DRIP_LAMPORTS)
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') ?? DEFAULT_RPC_URL
    const connection = new Connection(rpcUrl, 'confirmed')
    const sponsor = sponsorKeypair()

    const balance = await connection.getBalance(sponsor.publicKey).catch(() => 0)
    if (balance < amountLamports + 5_000) {
      console.error('drip sponsor low funds')
      return errorResponse('Sponsor wallet is empty, try again later', 500)
    }

    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    const transaction = new Transaction({
      feePayer: sponsor.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: sponsor.publicKey,
        toPubkey: destination,
        lamports: amountLamports,
      }),
    )
    transaction.sign(sponsor)
    const signature = await connection.sendRawTransaction(transaction.serialize())
    await connection.confirmTransaction(signature, 'confirmed').catch(() => {})

    const { error: insertError } = await supabase.from('sponsor_drips').insert({
      privy_user_id: privyUserId,
      wallet_address: destination.toBase58(),
      amount_lamports: amountLamports,
      signature,
    })
    if (insertError) {
      console.error('drip insert', insertError)
      // Money already sent — report success so the app proceeds.
    }

    return jsonResponse({ ok: true, already: false, signature, amountLamports })
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, 401)
    console.error('drip failed', error)
    const message = error instanceof Error && error.message.includes('SPONSOR_PRIVATE_KEY')
      ? 'Drip is not configured yet'
      : 'Drip failed'
    return errorResponse(message, 500)
  }
})
