import { ListDiscoveryResourcesResponse } from "t402/types";
import { T402RequestParams } from "./utils/t402Client";

export interface ElectronWindow extends Window {
  electron: {
    ipcRenderer: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    OnSignMessage: (callback: (message: string) => Promise<string>) => void;
    OnDiscoveryList: (callback: () => Promise<ListDiscoveryResourcesResponse>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OnMakeT402Request: (callback: (params: T402RequestParams) => Promise<any>) => void;
    OnGetWalletAddress: (callback: () => Promise<string>) => void;
  };
}
