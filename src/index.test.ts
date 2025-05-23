/**
 * @jest-environment node
 */
/*
  Smarty Pay Client WalletConnect
  @author Evgeny Dolganov <evgenij.dolganov@gmail.com>
*/

import { SmartyPayWalletConnectProvider } from './index';

import type { SmartyPayWalletConnectOpt } from './index';

describe('SmartyPayWalletConnectProvider', () => {
  const validAddress = '0x14186C8215985f33845722730c6382443Bf9EC65';
  const invalidAddress = validAddress.toLowerCase();

  describe('Web3Api', () => {
    let nativeProvider: any;
    let makeApiOpt: SmartyPayWalletConnectOpt;

    beforeEach(() => {
      // stub
      nativeProvider = {
        enable: jest.fn(() => true),
        request: jest.fn(),
        on: jest.fn(),
      };

      makeApiOpt = {
        customNativeProvider: () => nativeProvider,
      };
    });

    describe('getAddress', () => {
      test('should convert to case-sensitive address format', async () => {
        const api = SmartyPayWalletConnectProvider.makeWeb3Api(makeApiOpt);
        await api.connect();

        // check with invalid address
        nativeProvider.accounts = [invalidAddress];
        expect(await api.getAddress()).toBe(validAddress);

        // check with valid address
        nativeProvider.accounts = [validAddress];
        expect(await api.getAddress()).toBe(validAddress);
      });
    });
  });

  describe('hasWallet', () => {
    test('should always true', () => {
      expect(SmartyPayWalletConnectProvider.hasWallet()).toBe(true);
    });
  });
});
