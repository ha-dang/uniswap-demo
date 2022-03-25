// import TextField from "@mui/material/TextField";
// import Button from "@mui/material/Button";
import { useState } from "react";
import { ethers } from "ethers";
import { Pool } from "@uniswap/v3-sdk";
import {
  CurrencyAmount,
  Price,
  Token,
  TradeType,
  Percent,
} from "@uniswap/sdk-core";
import { ChainId } from "@uniswap/smart-order-router";
// import * as IUniswapV3PoolABIAll from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { Route } from "@uniswap/v3-sdk";
import { Trade } from "@uniswap/v3-sdk";
// import * as QuoterABI from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import IUniswapV3PoolABI from "../abis/IUniswapV3PoolABI.json";
import QuoterABI from "../abis/Quoter.json";
import { AlphaRouter } from "@uniswap/smart-order-router";
import { BigNumber } from "ethers";

function GetPrice({ poolDetail }) {
  const tokenA = poolDetail.token0;
  const tokenB = poolDetail.token1;
  const [amountIn, setAmountIn] = useState(0);
  const tokenAPrice = 0;
  const tokenBPrice = 0;
  const [liquidity, setLiquidity] = useState(0);
  const [outputAmt, setOutputAmount] = useState(0);
  const [executionPrice, setExecutionPrice] = useState(0);
  const [midPrice, setMidPrice] = useState(0);
  const [priceImpact, setPriceImpact] = useState(0);
  const [invertedPrice, setInvertedPrice] = useState(0);

  const provider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/3b76d6bafcf64d7689e7bc1213ffdbfe"
  );

  const MY_ADDRESS = "0x949Ab3B865e07Cf4e14D35375A3E405A67B5101A";
  const V3_SWAP_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
  const poolAddress = poolDetail.id;
  const router = new AlphaRouter({ chainId: 1, provider: provider });
  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    provider
  );

  const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const quoterContract = new ethers.Contract(
    quoterAddress,
    QuoterABI,
    provider
  );

  // interface Immutables {
  //   factory: string;
  //   token0: string;
  //   token1: string;
  //   fee: number;
  //   tickSpacing: number;
  //   maxLiquidityPerTick: ethers.BigNumber;
  // }

  // interface State {
  //   liquidity: ethers.BigNumber;
  //   sqrtPriceX96: ethers.BigNumber;
  //   tick: number;
  //   observationIndex: number;
  //   observationCardinality: number;
  //   observationCardinalityNext: number;
  //   feeProtocol: number;
  //   unlocked: boolean;
  // }

  async function getPoolImmutables() {
    const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
      await Promise.all([
        poolContract.factory(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.maxLiquidityPerTick(),
      ]);

    const immutables = {
      factory,
      token0,
      token1,
      fee,
      tickSpacing,
      maxLiquidityPerTick,
    };
    return immutables;
  }

  async function getPoolState() {
    // note that data here can be desynced if the call executes over the span of two or more blocks.
    const [liquidity, slot] = await Promise.all([
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    const PoolState = {
      liquidity,
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
    };

    return PoolState;
  }

  const getContractDecimals = async (address, abi, provider) => {
    let contract = new ethers.Contract(address, abi, provider);

    let decimals = await contract.decimals();
    return decimals;
  };

  const handleContractPrice = (amtIn) => {
    async function contractPrice(amtIn) {
      const [immutables, state] = await Promise.all([
        getPoolImmutables(),
        getPoolState(),
      ]);

      // create instances of the Token object to represent the two tokens in the given pool
      let address0 = immutables.token0;
      let address1 = immutables.token1;
      let abi = ["function decimals() view returns (uint8)"];
      let decimals0 = await getContractDecimals(address0, abi, provider);
      let decimals1 = await getContractDecimals(address1, abi, provider);
      const TokenA = new Token(
        ChainId.ROPSTEN,
        address0,
        decimals0,
        tokenA.symbol,
        tokenA.name
      );

      const TokenB = new Token(
        ChainId.ROPSTEN,
        address1,
        decimals1,
        tokenB.symbol,
        tokenB.name
      );

      // create an instance of the pool object for the given pool
      const poolExample = new Pool(
        TokenA,
        TokenB,
        immutables.fee,
        state.sqrtPriceX96.toString(), //note the description discrepancy - sqrtPriceX96 and sqrtRatioX96 are interchangable values
        state.liquidity.toString(),
        state.tick
      );

      // assign an input amount for the swap
      let amt = amtIn.toString();
      amt = ethers.utils.parseUnits(amt, decimals0);
      const amountIn = amt;

      // call the quoter contract to determine the amount out of a swap, given an amount in
      const quotedAmountOut =
        await quoterContract.callStatic.quoteExactInputSingle(
          immutables.token0,
          immutables.token1,
          immutables.fee,
          amountIn.toString(),
          0
        );

      // create an instance of the route object in order to construct a trade object
      const swapRoute = new Route([poolExample], TokenA, TokenB);

      // create an unchecked trade instance
      const uncheckedTradeExample = await Trade.createUncheckedTrade({
        route: swapRoute,
        inputAmount: CurrencyAmount.fromRawAmount(TokenA, amountIn),
        outputAmount: CurrencyAmount.fromRawAmount(
          TokenB,
          quotedAmountOut.toString()
        ),
        tradeType: TradeType.EXACT_INPUT,
      });
      setOutputAmount(
        uncheckedTradeExample.outputAmount.toSignificant(decimals1)
      );
      console.log("price");
      setExecutionPrice();
      setMidPrice();
      setPriceImpact();
      // print the quote and the unchecked trade instance in the console
      console.log("The unchecked trade object is", uncheckedTradeExample);
    }
    contractPrice(amtIn);
  };

  const handleSwap = async (amtIn) => {
    console.log("price1");
    const [immutables, state] = await Promise.all([
      getPoolImmutables(),
      getPoolState(),
    ]);

    // create instances of the Token object to represent the two tokens in the given pool
    let address0 = immutables.token0;
    let address1 = immutables.token1;
    let abi = ["function decimals() view returns (uint8)"];
    let decimals0 = await getContractDecimals(address0, abi, provider);
    let decimals1 = await getContractDecimals(address1, abi, provider);
    const TokenA = new Token(
      1,
      address0,
      decimals0,
      tokenA.symbol,
      tokenA.name
    );

    const TokenB = new Token(
      ChainId.MAINNET,
      address1,
      decimals1,
      tokenB.symbol,
      tokenB.name
    );

    // const WETH = new Token(
    //   1,
    //   "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    //   18,
    //   "WETH",
    //   "Wrapped Ether"
    // );

    // const USDC = new Token(
    //   ChainId.MAINNET,
    //   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    //   6,
    //   "USDC",
    //   "USD//C"
    // );

    let amt = amtIn.toString();
    amt = ethers.utils.parseUnits(amt, decimals0);
    const amountIn = amt;

    // const typedValueParsed = "100000000000000000000";
    const tokenAAmount = CurrencyAmount.fromRawAmount(TokenA, amountIn);

    const route = await router.route(
      tokenAAmount,
      TokenB,
      TradeType.EXACT_INPUT,
      {
        recipient: MY_ADDRESS,
        slippageTolerance: new Percent(5, 100), // 5%
        deadline: Math.floor(Date.now() / 1000 + 1800),
      }
    );

    console.log("show values", tokenAAmount, TokenB, TradeType.EXACT_INPUT, {
      recipient: MY_ADDRESS,
      slippageTolerance: new Percent(5, 100), // 5%
      deadline: Math.floor(Date.now() / 1000 + 1800),
    });

    console.log(route);

    console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed(6)}`);

    const transaction = {
      data: route.methodParameters.calldata,
      to: V3_SWAP_ROUTER_ADDRESS,
      // value: BigNumber.from(route.methodParameters.value),
      from: MY_ADDRESS,
      // gasPrice: BigNumber.from(route.gasPriceWei),
    };

    const rs = await provider.sendTransaction(transaction);
    console.log("rs", rs);
  };

  return (
    <>
      <div className="flex flex-col w-[800px] m-auto justify-center items-center">
        <div className="flex m-4 gap-5">
          {amountIn > 0 && (
            <button
              variant="contained"
              onClick={() => handleContractPrice(amountIn)}
            >
              Contract price
            </button>
          )}

          <input
            label="Amount of token A"
            variant="standard"
            color="warning"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            type="number"
          />
        </div>
        <div className="flex flex-col text-left">
          <p>
            Token A:{" "}
            <strong>
              {tokenA.symbol}{" "}
              <span className="text-zinc-400">(${tokenAPrice})</span>
            </strong>
          </p>
          <p>
            Token B:{" "}
            <strong>
              {tokenB.symbol}{" "}
              <span className="text-zinc-400">(${tokenBPrice})</span>
            </strong>
          </p>
          <strong className="text-zinc-400">Amount in: {amountIn}</strong>
          <p> Expected output: {outputAmt}</p>
          <p> Gas price:{executionPrice} </p>
          <p> Mid price: {midPrice} </p>
          {/* <p> Price impace: {priceImpact} </p>
          <p> Inverted price: {invertedPrice} </p> */}
          <button onClick={() => handleSwap(amountIn)}> Swap </button>
        </div>
      </div>
    </>
  );
}

export default GetPrice;
