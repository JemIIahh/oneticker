import { parseAbi, type PublicClient } from 'viem';

/**
 * APRO tokenized-equity feeds on BSC mainnet (1% deviation, 1 h heartbeat), from
 * https://docs.apro.com/en/data-push/price-feed-contract, read 22 Sep 2026. Only bStocks are covered.
 */
export const APRO_FEEDS_BSC: Record<string, `0x${string}`> = {
  NVDAB: '0x310EFC9Fefe89B8085F89E91Ac782Bef6416499E',
  TSLAB: '0xe1bc21701Bc8FFa39DaecDb8f58263C1d5e1c0bc',
  QQQB: '0x2708567c468db65a72095716FCff023dcDfEA07A',
  CRCLB: '0x48e6876A8CDa6cf8db2089128cF20a18e58089D2',
  METAB: '0x32Fd1E5E20b091Df7286EE8C69937C4A8D619885',
  MSFTB: '0xBC92F296c48E31409eD4DbD638F1fbe0ee5A3724',
  // MSTRB: not listed by APRO on 22 Sep 2026.
};

export const APRO_HEARTBEAT_SEC = 3600;

/** Chainlink AggregatorV3 shape; whether APRO matches it is what the first live read establishes. */
const aggregatorAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

export interface OracleReading {
  feed: `0x${string}`;
  description: string;
  decimals: number;
  /** answer / 10^decimals */
  price: number;
  roundId: string;
  updatedAt: Date;
  ageSec: number;
  raw: { roundId: string; answer: string; startedAt: string; updatedAt: string; answeredInRound: string };
}

export async function readAproFeed(client: PublicClient, feed: `0x${string}`, now = new Date()): Promise<OracleReading> {
  const contract = { address: feed, abi: aggregatorAbi } as const;
  const [decimals, description, round] = await Promise.all([
    client.readContract({ ...contract, functionName: 'decimals' }),
    client.readContract({ ...contract, functionName: 'description' }),
    client.readContract({ ...contract, functionName: 'latestRoundData' }),
  ]);
  const [roundId, answer, startedAt, updatedAt, answeredInRound] = round;
  const updated = new Date(Number(updatedAt) * 1000);
  return {
    feed,
    description,
    decimals,
    price: Number(answer) / 10 ** decimals,
    roundId: roundId.toString(),
    updatedAt: updated,
    ageSec: Math.floor((now.getTime() - updated.getTime()) / 1000),
    raw: {
      roundId: roundId.toString(),
      answer: answer.toString(),
      startedAt: startedAt.toString(),
      updatedAt: updatedAt.toString(),
      answeredInRound: answeredInRound.toString(),
    },
  };
}
