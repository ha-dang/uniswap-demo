import "./App.css";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import GetPrice from "./components/GetPrice";
// import Button from "@mui/material/Button";

import { useWeb3React } from "@web3-react/core";

import { InjectedConnector } from "@web3-react/injected-connector";
const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42],
});

function App() {
  const [data, setData] = useState([]);
  const [showGetPrice, setShowGetPrice] = useState(false);
  const [poolDetail, setPoolDetail] = useState(null);
  const [balance, setBalance] = useState(0);

  const { active, account, library, activate, deactivate } = useWeb3React();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    async function getData() {
      if (!library) return;
      console.log({ library });
      const balance = await library.eth.getBalance(account);
      setBalance(balance / 1e18);
    }

    getData();
  }, [account, library]);

  const fetchData = async () => {
    var data = JSON.stringify({
      query: `{
      pools(orderDirection: desc, orderBy: totalValueLockedETH 
      first: 10
        
      ){
        id
        feeTier
        liquidity
        token0Price
        token1Price
        totalValueLockedETH
        volumeUSD
        token0 {
          id
          name,
          symbol
          decimals
        }
        token1 {
         id
          name,
          symbol
          decimals
        }
      }
    }`,
      variables: {},
    });

    var config = {
      method: "post",
      url: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
      data: data,
    };

    var result = await axios(config);
    console.log("returnedData", result);
    setData(result.data.data.pools);
  };

  const handleGetPrice = useCallback((poolDetail) => {
    setShowGetPrice(true);
    setPoolDetail(poolDetail);
    console.log("get price");
  }, []);

  const handleConnectWallet = () => {};

  const handleDeconnectWallet = () => {};
  return (
    <div className="App">
      {!active ? (
        <button variant="contained" onClick={() => activate(injected)}>
          Connect wallet
        </button>
      ) : (
        <button variant="contained" onClick={() => handleDeconnectWallet()}>
          Deconnect wallet
        </button>
      )}
      {showGetPrice && <GetPrice poolDetail={poolDetail} />}
      {data.map((pool, index) => {
        return (
          <PoolDetail
            poolData={pool}
            key={index}
            onClick={() => handleGetPrice(pool)}
          />
        );
      })}
    </div>
  );
}

function PoolDetail({ poolData, onClick }) {
  return (
    <div
      className="flex flex-col m-2 border-2 align-center border-blue-500 rounded-sm"
      onClick={onClick}
    >
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Pool info</h2>
        <p>address: {poolData.id}</p>
        <p>liquidity: {poolData.liquidity}</p>
      </div>
      <br></br>
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Token 0</h2>
        <p>address: {poolData.token0.id}</p>
        <p>
          name:{" "}
          <strong>
            {" "}
            {poolData.token0.name},{poolData.token0.symbol}{" "}
          </strong>
        </p>
      </div>
      <br></br>
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Token 1</h2>
        <p>address: {poolData.token1.id}</p>
        <p>
          {" "}
          name:{" "}
          <strong>
            {poolData.token1.name}, {poolData.token1.symbol}
          </strong>
        </p>
      </div>
    </div>
  );
}

export default App;
