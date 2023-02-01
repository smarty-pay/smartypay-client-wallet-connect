/*
  SMARTy Pay Client WalletConnect
  @author Evgeny Dolganov <evgenij.dolganov@gmail.com>
*/

import {Web3Api, Web3ApiEvent, RawProvider, Web3ApiProvider} from 'smartypay-client-web3-common';
import {Blockchains, util} from 'smartypay-client-model';
import WalletConnectProvider from "@walletconnect/web3-provider";

const Name = 'WalletConnect';


export const SmartyPayWalletConnectProvider: Web3ApiProvider = {
  name(): string {
    return Name;
  },
  makeWeb3Api(): Web3Api {
    return new SmartyPayWalletConnect();
  },
  hasWallet(): boolean {
    return true;
  }
}

class SmartyPayWalletConnect implements Web3Api {

  private useWalletEvents = false;
  private listeners = new util.ListenersMap<Web3ApiEvent>();
  private nativeProvider: WalletConnectProvider|undefined;

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

    // Show QR code screen
    const provider = makeWalletConnectProvider();
    await provider.enable();

    this.nativeProvider = provider;
    this.listeners.fireEvent('wallet-connected');

    // add listeners only once
    if(this.useWalletEvents){
      return;
    }
    this.useWalletEvents = true;

    provider.on('accountsChanged', (accounts: string[]) => {

      // skip events on disconnected state
      if( this.nativeProvider !== provider){
        return;
      }

      const newAddress = accounts && accounts.length > 0 ? accounts[0] : undefined;
      if (!newAddress) {
        this.disconnect();
      } else {
        this.listeners.fireEvent('wallet-account-changed', newAddress);
      }
    });

    provider.on('chainChanged', (chainId: number) => {

      // skip events on disconnected state
      if( this.nativeProvider !== provider){
        return;
      }

      this.listeners.fireEvent('wallet-network-changed', chainId);
    });
  }

  async getAddress() {
    const provider = this.checkConnection();
    const accounts = await provider.request({method: 'eth_requestAccounts'});
    return accounts[0];
  }

  async getChainId() {
    const provider = this.checkConnection();
    const chainId: any = await provider.request({method: 'eth_chainId'});
    return Number.isInteger(chainId)? chainId : Number(chainId);
  }

  async disconnect() {

    try {
      this.nativeProvider?.disconnect();
    } catch (e){
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

  checkConnection(): WalletConnectProvider {
    if (!this.nativeProvider) {
      throw util.makeError(Name,'WalletConnect provider not connected');
    }
    return this.nativeProvider;
  }
}



function makeWalletConnectProvider(): WalletConnectProvider {

  const rpc = {
    1: 'https://cloudflare-eth.com',
    3: 'https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    4: 'https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    5: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    6: 'https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    [Blockchains.BinanceMainNet.chainId]: Blockchains.BinanceMainNet.rpc,
    [Blockchains.BinanceTestNet.chainId]: Blockchains.BinanceTestNet.rpc,
    [Blockchains.PolygonMainNet.chainId]: Blockchains.PolygonMainNet.rpc,
    [Blockchains.PolygonMumbaiNet.chainId]: Blockchains.PolygonMumbaiNet.rpc,
    [Blockchains.ArbitrumMainNet.chainId]: Blockchains.ArbitrumMainNet.rpc,
    [Blockchains.ArbitrumTestNet.chainId]: Blockchains.ArbitrumTestNet.rpc,
  }

  return new WalletConnectProvider({
    rpc
  });
}