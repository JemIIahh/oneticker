import { parseAbi, type PublicClient } from 'viem';

/** BEP-677 / EIP-8056 core plus the pending-multiplier extension. Multipliers are scaled by 1e18. */
const abi = parseAbi([
  'function uiMultiplier() view returns (uint256)',
  'function newUIMultiplier() view returns (uint256)',
  'function effectiveAt() view returns (uint256)',
]);

export const MULTIPLIER_ONE = 10n ** 18n;

export interface MultiplierReading {
  token: `0x${string}`;
  /** uiMultiplier / 1e18: UI units (shares) per raw token unit. */
  multiplier: number;
  raw: { uiMultiplier: string; newUIMultiplier: string | null; effectiveAt: string | null };
  /** Scheduled change, when the token exposes one and it is in the future. */
  pending: { multiplier: number; effectiveAt: Date } | null;
}

export async function readMultiplier(client: PublicClient, token: `0x${string}`, now = new Date()): Promise<MultiplierReading> {
  const uiMultiplier = await client.readContract({ address: token, abi, functionName: 'uiMultiplier' });
  // The pending extension is REQUIRED by the spec, but read it defensively: a revert means "none exposed".
  const [newUIMultiplier, effectiveAt] = await Promise.all([
    client.readContract({ address: token, abi, functionName: 'newUIMultiplier' }).catch(() => null),
    client.readContract({ address: token, abi, functionName: 'effectiveAt' }).catch(() => null),
  ]);
  const effective = effectiveAt === null ? null : new Date(Number(effectiveAt) * 1000);
  const pending =
    newUIMultiplier !== null && effective !== null && effective > now && newUIMultiplier !== uiMultiplier
      ? { multiplier: Number(newUIMultiplier) / 1e18, effectiveAt: effective }
      : null;
  return {
    token,
    multiplier: Number(uiMultiplier) / 1e18,
    raw: { uiMultiplier: uiMultiplier.toString(), newUIMultiplier: newUIMultiplier?.toString() ?? null, effectiveAt: effectiveAt?.toString() ?? null },
    pending,
  };
}
