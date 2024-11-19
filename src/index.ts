/*
  Smarty Pay Client WalletConnect
  @author Evgeny Dolganov <evgenij.dolganov@gmail.com>
*/

import Provider from '@walletconnect/ethereum-provider';
import { Blockchains, util } from 'smartypay-client-model';
import { Web3Common } from 'smartypay-client-web3-common';

import type { RawProvider, Web3Api, Web3ApiEvent, Web3ApiProvider } from 'smartypay-client-web3-common';

const Name = 'WalletConnect';

// Test api key, may be deleted any time
const TestApiKey = 'e38ce8e95346af313bfe015d76fcc1a0';

export interface SmartyPayWalletConnectOpt {
  customNativeProvider?: () => Promise<Provider>;
  walletConnectApiKey?: string;
}

export const SmartyPayWalletConnectProvider: Web3ApiProvider = {
  name(): string {
    return Name;
  },
  makeWeb3Api(opt?: SmartyPayWalletConnectOpt): Web3Api {
    return new SmartyPayWalletConnect(opt);
  },
  hasWallet(): boolean {
    return true;
  },
};

class SmartyPayWalletConnect implements Web3Api {
  private useWalletEvents = false;
  private listeners = new util.ListenersMap<Web3ApiEvent>();
  private nativeProvider: Provider | undefined;

  constructor(readonly opt?: SmartyPayWalletConnectOpt) {}

  addListener(event: Web3ApiEvent, listener: (...args: any[]) => void) {
    this.listeners.addListener(event, listener);
  }

  removeListener(listener: (...args: any[]) => void) {
    this.listeners.removeListener(listener);
  }

  name(): string {
    return Name;
  }

  static apiName = Name;

  hasWallet(): boolean {
    return SmartyPayWalletConnectProvider.hasWallet();
  }

  async connect() {
    if (this.isConnected()) {
      return;
    }

    if (!this.hasWallet()) {
      throw util.makeError(Name, 'no WalletConnect');
    }

    const apiKey = this.opt?.walletConnectApiKey || TestApiKey;

    // make provider
    const provider: Provider = this.opt?.customNativeProvider
      ? await this.opt.customNativeProvider()
      : await makeWalletConnectProvider(apiKey);

    // Show QR code screen
    await provider.enable();

    this.nativeProvider = provider;
    this.listeners.fireEvent('wallet-connected');

    // add listeners only once
    if (this.useWalletEvents) {
      return;
    }
    this.useWalletEvents = true;

    provider.on('accountsChanged', (accounts: string[]) => {
      // skip events on disconnected state
      if (this.nativeProvider !== provider) {
        return;
      }

      const newAddress = accounts && accounts.length > 0 ? accounts[0] : undefined;
      if (!newAddress) {
        this.disconnect().catch(console.error);
      } else {
        this.listeners.fireEvent('wallet-account-changed', newAddress);
      }
    });

    provider.on('chainChanged', (chainId: string) => {
      // skip events on disconnected state
      if (this.nativeProvider !== provider) {
        return;
      }

      this.listeners.fireEvent('wallet-network-changed', Web3Common.toNumberFromHex(chainId));
    });

    provider.on('disconnect', () => {
      this.disconnect().catch(console.error);
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getAddress() {
    const provider = this.checkConnection();
    return Web3Common.getNormalAddress(provider.accounts[0]);
  }

  async getChainId() {
    const provider = this.checkConnection();
    const chainId: any = await provider.request({ method: 'eth_chainId' });
    return Number.isInteger(chainId) ? chainId : Number(chainId);
  }

  async disconnect() {
    if (!this.nativeProvider) {
      return;
    }

    try {
      await this.nativeProvider.disconnect();
    } catch (e) {
      console.error(`${Name}: disconnect error`, e);
    }

    this.nativeProvider = undefined;
    this.listeners.fireEvent('wallet-disconnected');
  }

  isConnected(): boolean {
    return !!this.nativeProvider;
  }

  getRawProvider(): RawProvider {
    const provider = this.checkConnection();
    return provider as RawProvider;
  }

  checkConnection(): Provider {
    if (!this.nativeProvider) {
      throw util.makeError(Name, 'WalletConnect provider not connected');
    }
    return this.nativeProvider;
  }
}

async function makeWalletConnectProvider(apiKey: string): Promise<Provider> {
  const rpcMap = {
    [Web3Common.toHexString(1)]: 'https://cloudflare-eth.com',
    [Web3Common.toHexString(3)]: 'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    [Web3Common.toHexString(4)]: 'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    [Web3Common.toHexString(5)]: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    [Web3Common.toHexString(6)]: 'https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    [Blockchains.EthereumSepolia.chainIdHex]: Blockchains.EthereumSepolia.rpc,
    [Blockchains.BinanceMainNet.chainIdHex]: Blockchains.BinanceMainNet.rpc,
    [Blockchains.BinanceTestNet.chainIdHex]: Blockchains.BinanceTestNet.rpc,
    [Blockchains.PolygonMainNet.chainIdHex]: Blockchains.PolygonMainNet.rpc,
    [Blockchains.PolygonAmoy.chainIdHex]: Blockchains.PolygonAmoy.rpc,
    [Blockchains.ArbitrumMainNet.chainIdHex]: Blockchains.ArbitrumMainNet.rpc,
    [Blockchains.ArbitrumSepolia.chainIdHex]: Blockchains.ArbitrumSepolia.rpc,
  };

  const config = {
    projectId: apiKey,
    // Valid pair of "chains" and "optionalChains" params.
    // See "chains not supported" issuie: https://github.com/MetaMask/metamask-mobile/issues/6688
    chains: [1],
    optionalChains: Object.keys(rpcMap).map((hexKey) => Web3Common.toNumberFromHex(hexKey)),
    showQrModal: true,
    rpcMap,
  } as any;

  return Provider.init(config);
}
