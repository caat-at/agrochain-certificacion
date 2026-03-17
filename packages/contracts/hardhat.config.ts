import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat default account #0
const POLYGON_AMOY_RPC = process.env.POLYGON_AMOY_RPC ?? "https://rpc-amoy.polygon.technology";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    // Red local para desarrollo y tests
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Polygon Amoy Testnet
    amoy: {
      url: POLYGON_AMOY_RPC,
      chainId: 80002,
      accounts: [PRIVATE_KEY],
      gasPrice: 200000000000, // 200 gwei (actual Amoy)
    },
    // Polygon Mainnet (solo produccion)
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC ?? "https://polygon-rpc.com",
      chainId: 137,
      accounts: [PRIVATE_KEY],
      gasPrice: 50000000000, // 50 gwei
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    token: "MATIC",
  },
};

export default config;
