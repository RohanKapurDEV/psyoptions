import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import * as BufferLayout from 'buffer-layout';
import * as Layout from './layout';

const MAX_CONTRACTS = 10;

export type OptionWriter = {
  underlyingAssetAcctAddress: PublicKey;
  quoteAssetAcctAddress: PublicKey;
  contractTokenAcctAddress: PublicKey;
};
export const optionWriterStructArray = [
  Layout.publicKey('underlyingAssetAcctAddress'),
  Layout.publicKey('quoteAssetAcctAddress'),
  Layout.publicKey('contractTokenAcctAddress'),
] as BufferLayout.Layout<any>[];

export const OPTION_WRITER_LAYOUT = BufferLayout.struct(
  optionWriterStructArray,
);

export type OptionMarket = {
  optionMintAddress: PublicKey;
  underlyingAssetMintAddress: PublicKey;
  quoteAssetMintAddress: PublicKey;
  amountPerContract: BN;
  strikePrice: BN;
  expirationUnixTimestamp: number;
  underlyingAssetPoolAddress: PublicKey;
  registryLength: number;
  optionWriterRegistry: OptionWriter[];
};

export type DecodedOptionMarket = {
  optionMintAddress: PublicKey;
  underlyingAssetMintAddress: PublicKey;
  quoteAssetMintAddress: PublicKey;
  amountPerContract: BN;
  quoteAmountPerContract: BN;
  expirationUnixTimestamp: number;
  underlyingAssetPoolAddress: PublicKey;
  registryLength: number;
  optionWriterRegistry: OptionWriter[];
};

export const OPTION_MARKET_LAYOUT = BufferLayout.struct([
  Layout.publicKey('optionMintAddress'),
  Layout.publicKey('underlyingAssetMintAddress'),
  Layout.publicKey('quoteAssetMintAddress'),
  Layout.uint64('amountPerContract'),
  Layout.uint64('quoteAmountPerContract'),
  BufferLayout.ns64('expirationUnixTimestamp'),
  Layout.publicKey('underlyingAssetPoolAddress'),
  BufferLayout.u16('registryLength'),
  BufferLayout.seq(OPTION_WRITER_LAYOUT, MAX_CONTRACTS, 'optionWriterRegistry'),
]);

export class Market {
  programId: PublicKey;

  pubkey: PublicKey;

  marketData: OptionMarket;

  constructor(programId: PublicKey, pubkey: PublicKey, accountData: Buffer) {
    this.programId = programId;
    this.pubkey = pubkey;
    const {
      optionMintAddress,
      underlyingAssetMintAddress,
      quoteAssetMintAddress,
      amountPerContract,
      quoteAmountPerContract,
      expirationUnixTimestamp,
      underlyingAssetPoolAddress,
      registryLength,
      optionWriterRegistry,
    } = OPTION_MARKET_LAYOUT.decode(accountData) as DecodedOptionMarket;

    const processedMarketData = {
      optionMintAddress,
      underlyingAssetMintAddress,
      quoteAssetMintAddress,
      amountPerContract,
      strikePrice: quoteAmountPerContract.div(amountPerContract),
      expirationUnixTimestamp,
      underlyingAssetPoolAddress,
      registryLength,
      optionWriterRegistry,
    };

    this.marketData = processedMarketData;
  }

  /**
   * Get all the Markets the program has created.
   *
   * TODO the RPC request to solana could have a massive response because the
   * buffer sizes for a market are huge. We will need to break them out and
   * refactor.
   * @param {Connection} connection
   * @param {PublicKey} programId
   */
  static getAllMarkets = async (
    connection: Connection,
    programId: PublicKey,
  ) => {
    const res = await connection.getProgramAccounts(
      programId,
      connection.commitment,
    );
    return res.map(
      // eslint-disable-next-line prettier/prettier
      ({ pubkey, account }) => new Market(programId, pubkey, account.data),
    );
  };

  /**
   * Takes in an array of supported assets and filters the options markets to
   * only one's where the underlying asset and quote asseta are supported.
   * @param {Connection} connection
   * @param {PublicKey} programId
   * @param {PublicKey[]} assets
   */
  static getAllMarketsBySplSupport = async (
    connection: Connection,
    programId: PublicKey,
    assets: PublicKey[],
  ) => {
    // convert assets to an array of strings
    const assetAddresses = assets.map((asset) => asset.toString());
    // Get all the markets the program has created
    const markets = await Market.getAllMarkets(connection, programId);
    return markets.filter(
      (market) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        assetAddresses.includes(
          market.marketData.underlyingAssetMintAddress.toString(),
        ) &&
        assetAddresses.includes(
          market.marketData.quoteAssetMintAddress.toString(),
        ),
    );
  };
}
