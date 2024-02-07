import "./App.scss";
import "./gh-fork-ribbon.css";
import "@near-wallet-selector/modal-ui/styles.css";
import React from "react";
import Big from "big.js";
import * as nearAPI from "near-api-js";
import { HuePicker, GithubPicker } from "react-color";
import { Weapons } from "./Weapons";
import { sha256 } from "js-sha256";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupNearSnap } from "@near-wallet-selector/near-snap";
import { setupWelldoneWallet } from "@near-wallet-selector/welldone-wallet";
import { setupLedger } from "@near-wallet-selector/ledger";
import { setupNearMobileWallet } from "@near-wallet-selector/near-mobile-wallet";
import { setupMintbaseWallet } from "@near-wallet-selector/mintbase-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import ls from "local-storage";

const defaultCodeHash = "11111111111111111111111111111111";

export const LsKey = "dacha:v01:";
const LsKeyAccountId = LsKey + ":accountId:";

const TGas = Big(10).pow(12);
const MaxGasPerTransaction = TGas.mul(300);
const MaxGasPerTransaction2FA = TGas.mul(220);
const randomPublicKey = nearAPI.utils.PublicKey.from(
  "ed25519:8fWHD35Rjd78yeowShh9GwhRudRtLLsGCRjZtgPjAtw9"
);
const StorageCostPerByte = Big(10).pow(19);
const OneNear = Big(10).pow(24);
const AccountSafetyMargin = OneNear.div(2);
const OnePotato = Big(10).pow(21);
const OneDacha = Big(10).pow(18);

const IsMainnet = window.location.hostname === "dacha.finance";
const TestNearConfig = {
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  contractName: "dev-1638904065122-71210869985191",
  walletUrl: "https://wallet.testnet.near.org",
  refContractName: "ref-finance-101.testnet",
  wrapNearContractName: "wrap.testnet",
};
const MainNearConfig = {
  networkId: "mainnet",
  nodeUrl: "https://rpc.mainnet.near.org",
  contractName: "v1.dacha-finance.near",
  walletUrl: "https://wallet.near.org",
  refContractName: "v2.ref-finance.near",
  wrapNearContractName: "wrap.near",
};
const NearConfig = IsMainnet ? MainNearConfig : TestNearConfig;

async function setupSelector() {
  return setupWalletSelector({
    network: NearConfig.networkId,
    modules: [
      setupHereWallet(),
      setupMintbaseWallet(),
      setupMyNearWallet(),
      setupMeteorWallet(),
    ],
  });
}

function setupContract(near, contractId, options) {
  const { viewMethods = [], changeMethods = [] } = options;
  const contract = {
    near,
    contractId,
  };
  viewMethods.forEach((methodName) => {
    contract[methodName] = (args) =>
      near.viewCall(contractId, methodName, args);
  });
  changeMethods.forEach((methodName) => {
    contract[methodName] = (args, gas, deposit) =>
      near.functionCall(contractId, methodName, args || {}, gas, deposit);
  });
  return contract;
}

async function viewCall(
  provider,
  blockId,
  contractId,
  methodName,
  args,
  finality
) {
  args = args || {};
  const result = await provider.query({
    request_type: "call_function",
    account_id: contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    block_id: blockId,
    finality,
  });

  return (
    result.result &&
    result.result.length > 0 &&
    JSON.parse(Buffer.from(result.result).toString())
  );
}

const UseLegacyFunctionCallCreator = true;
const functionCallCreator = UseLegacyFunctionCallCreator
  ? (methodName, args, gas, deposit) => ({
      type: "FunctionCall",
      params: {
        methodName,
        args,
        gas,
        deposit,
      },
    })
  : nearAPI.transactions.functionCall;

async function functionCall(
  near,
  contractName,
  methodName,
  args,
  gas,
  deposit
) {
  try {
    const wallet = await (await near.selector).wallet();

    return await wallet.signAndSendTransaction({
      receiverId: contractName,
      actions: [
        functionCallCreator(
          methodName,
          args,
          gas ?? TGas.mul(30).toFixed(0),
          deposit ?? "0"
        ),
      ],
    });
  } catch (e) {
    // const msg = e.toString();
    // if (msg.indexOf("does not have enough balance") !== -1) {
    //   return await refreshAllowanceObj.refreshAllowance();
    // }
    throw e;
  }
}

async function accountState(near, accountId) {
  const account = new nearAPI.Account(
    near.nearConnection.connection,
    accountId
  );
  return await account.state();
}

const defaultAccount = {
  loading: true,
  signedAccountId: ls.get(LsKeyAccountId) ?? undefined,
  accountId: ls.get(LsKeyAccountId) ?? undefined,
  state: null,
  near: null,
};

async function updateAccount(near, walletState) {
  near.connectedContractId = walletState?.contract?.contractId;
  if (
    near.connectedContractId &&
    near.connectedContractId !== NearConfig.contractName
  ) {
    const selector = await near.selector;
    const wallet = await selector.wallet();
    await wallet.signOut();
    near.connectedContractId = null;
    walletState = selector.store.getState();
  }
  near.accountId = walletState?.accounts?.[0]?.accountId ?? null;
  if (near.accountId) {
    near.publicKey = null;
    try {
      if (walletState?.selectedWalletId === "here-wallet") {
        const hereKeystore = ls.get("herewallet:keystore");
        near.publicKey = nearAPI.KeyPair.fromString(
          hereKeystore[NearConfig.networkId].accounts[near.accountId]
        ).getPublicKey();
      }
    } catch (e) {
      console.error(e);
    }
    if (!near.publicKey) {
      try {
        near.publicKey = nearAPI.KeyPair.fromString(
          ls.get(
            walletState?.selectedWalletId === "meteor-wallet"
              ? `_meteor_wallet${near.accountId}:${NearConfig.networkId}`
              : `near-api-js:keystore:${near.accountId}:${NearConfig.networkId}`
          )
        ).getPublicKey();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

const loadAccount = async (near, setAccount) => {
  const signedAccountId = near.accountId;
  if (signedAccountId) {
    ls.set(LsKeyAccountId, signedAccountId);
  } else {
    ls.remove(LsKeyAccountId);
  }
  const account = {
    loading: false,
    signedAccountId,
    accountId: signedAccountId,
    state: null,
    near,
    refresh: async () => await loadAccount(near, setAccount),
  };
  if (signedAccountId) {
    const [state] = await Promise.all([
      // near.contract.storage_balance_of({
      //   account_id: signedAccountId,
      // }),
      near.accountState(signedAccountId),
    ]);
    // account.storageBalance = storageBalance;
    account.state = state;
  }

  setAccount(account);
};

export const Potato = (
  <span role="img" aria-label="potato" className="berry">
    🥔
  </span>
);

export const Dacha = (
  <span role="img" aria-label="dacha" className="berry">
    🏡
  </span>
);

// const Berry = {
//   Potato: "Potato",
// };

const BoardHeight = 50;
const BoardWidth = 50;
const NumLinesPerFetch = 50;
const ExpectedLineLength = 4 + 8 * BoardWidth;
const CellWidth = 12;
const CellHeight = 12;
const MaxNumColors = 31;
const BatchOfPixels = 100;
// 500 ms
const BatchTimeout = 500;
const RefreshBoardTimeout = 1000;
const MaxWorkTime = 10 * 60 * 1000;
// const OneDayMs = 24 * 60 * 60 * 1000;

const intToColor = (c) => `#${c.toString(16).padStart(6, "0")}`;
const intToColorWithAlpha = (c, a) =>
  `#${c.toString(16).padStart(6, "0")}${Math.round(255 * a)
    .toString(16)
    .padStart(2, "0")}`;

const rgbaToInt = (cr, cg, cb, ca, bgColor) => {
  const bb = bgColor & 255;
  const bg = (bgColor >> 8) & 255;
  const br = (bgColor >> 16) & 255;

  const r = Math.round(cr * ca + br * (1 - ca));
  const g = Math.round(cg * ca + bg * (1 - ca));
  const b = Math.round(cb * ca + bb * (1 - ca));
  return (r << 16) + (g << 8) + b;
};

const imgColorToInt = (c, bgColor) => {
  const cr = c & 255;
  const cg = (c >> 8) & 255;
  const cb = (c >> 16) & 255;
  const ca = ((c >> 24) & 255) / 255;
  return rgbaToInt(cr, cg, cb, ca, bgColor);
};

const int2hsv = (cInt) => {
  cInt = intToColor(cInt).substr(1);
  const r = parseInt(cInt.substr(0, 2), 16) / 255;
  const g = parseInt(cInt.substr(2, 2), 16) / 255;
  const b = parseInt(cInt.substr(4, 2), 16) / 255;
  let v = Math.max(r, g, b),
    c = v - Math.min(r, g, b);
  let h =
    c && (v === r ? (g - b) / c : v === g ? 2 + (b - r) / c : 4 + (r - g) / c);
  return [60 * (h < 0 ? h + 6 : h), v && c / v, v];
};
const transparentColor = (c, a) =>
  `rgba(${c >> 16}, ${(c >> 8) & 0xff}, ${c & 0xff}, ${a})`;
const generateGamma = (hue) => {
  const gammaColors = [];
  for (let i = 0; i < MaxNumColors; ++i) {
    gammaColors.push(`hsl(${hue}, 100%, ${(100 * i) / (MaxNumColors - 1)}%)`);
  }
  return gammaColors;
};
const decodeLine = (line) => {
  let buf = Buffer.from(line, "base64");
  if (buf.length !== ExpectedLineLength) {
    throw new Error("Unexpected encoded line length");
  }
  let pixels = [];
  for (let i = 4; i < buf.length; i += 8) {
    let color = buf.readUInt32LE(i);
    let ownerIndex = buf.readUInt32LE(i + 4);
    pixels.push({
      color,
      ownerIndex,
    });
  }
  return pixels;
};

const WeaponsCheat = "3RsmJFsbD5JeiRFCCDJVFPnVrux83hgURbWArpghHBD6";
const CodeLength = 9;

export class App extends React.Component {
  constructor(props) {
    super(props);

    const colors = [
      "#000000",
      "#666666",
      "#aaaaaa",
      "#FFFFFF",
      "#F44E3B",
      "#D33115",
      "#9F0500",
      "#FE9200",
      "#E27300",
      "#C45100",
      "#FCDC00",
      "#FCC400",
      "#FB9E00",
      "#DBDF00",
      "#B0BC00",
      "#808900",
      "#A4DD00",
      "#68BC00",
      "#194D33",
      "#68CCCA",
      "#16A5A5",
      "#0C797D",
      "#73D8FF",
      "#009CE0",
      "#0062B1",
      "#AEA1FF",
      "#7B64FF",
      "#653294",
      "#FDA1FF",
      "#FA28FF",
      "#AB149E",
    ].map((c) => c.toLowerCase());
    const currentColor = parseInt(
      colors[Math.floor(Math.random() * colors.length)].substring(1),
      16
    );
    const defaultAlpha = 1; // 0.25;

    // const timeMs = new Date().getTime();

    this.state = {
      connected: false,
      signedIn: false,
      accountId: null,
      pendingPixels: 0,
      boardLoaded: false,
      selectedCell: null,
      alpha: defaultAlpha,
      currentColor,
      pickerColor: intToColorWithAlpha(currentColor, defaultAlpha),
      colors,
      gammaColors: generateGamma(0),
      pickingColor: false,
      owners: [],
      accounts: {},
      highlightedAccountIndex: -1,
      selectedOwnerIndex: false,
      weaponsOn: false,
      weaponsCodeKeys: [],
      watchMode: false,
      refPool: false,
      unmintedAmount: Big(0),
      loading: false,
      totalSupply: Big(0),
      dachaSupply: Big(10000).mul(OneDacha),
      accountBalance: Big(0),
      refBalance: Big(0),
    };

    this._buttonDown = false;
    this._oldCounts = {};
    this._numFailedTxs = 0;
    this._balanceRefreshTimer = null;
    this.canvasRef = React.createRef();
    this._context = false;
    this._lines = false;
    this._queue = [];
    this._pendingPixels = [];
    this._refreshBoardTimer = null;
    this._sendQueueTimer = null;
    this._stopRefreshTime = new Date().getTime() + MaxWorkTime;
    this._accounts = {};

    this._initNear().then(() => {
      this.setState(
        {
          connected: true,
          signedIn: !!this._accountId,
          accountId: this._accountId,
          ircAccountId: this._accountId?.replace(".", "_"),
        },
        () => {
          if (window.location.hash.indexOf("watch") >= 0) {
            setTimeout(() => this.enableWatchMode(), 500);
          }
        }
      );
    });
  }

  componentDidMount() {
    const canvas = this.canvasRef.current;
    this._context = canvas.getContext("2d");

    const click = async () => {
      if (this.state.watchMode) {
        return;
      }
      if (this.state.rendering) {
        await this.drawImg(this.state.selectedCell);
      } else if (this.state.pickingColor) {
        this.pickColor(this.state.selectedCell);
      } else {
        this.saveColor();
        await this.drawPixel(this.state.selectedCell);
      }
    };

    const mouseMove = (e) => {
      let x, y;
      if ("touches" in e) {
        if (e.touches.length > 1) {
          return true;
        } else {
          const rect = e.target.getBoundingClientRect();
          x = e.targetTouches[0].clientX - rect.left;
          y = e.targetTouches[0].clientY - rect.top;
        }
      } else {
        x = e.offsetX;
        y = e.offsetY;
      }
      x = Math.trunc((x / e.target.clientWidth) * BoardWidth);
      y = Math.trunc((y / e.target.clientHeight) * BoardWidth);
      let cell = null;
      if (x >= 0 && x < BoardWidth && y >= 0 && y < BoardHeight) {
        cell = { x, y };
      }
      if (JSON.stringify(cell) !== JSON.stringify(this.state.selectedCell)) {
        this.setState(
          {
            selectedCell: cell,
            selectedOwnerIndex:
              this._lines &&
              cell &&
              this._lines[cell.y] &&
              this._lines[cell.y][cell.x].ownerIndex,
          },
          async () => {
            this.renderCanvas();
            if (this.state.selectedCell !== null && this._buttonDown) {
              await click();
            }
          }
        );
      }
      e.preventDefault();
      return false;
    };

    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("touchmove", mouseMove);

    const mouseDown = async (e) => {
      this._buttonDown = true;
      if (this.state.selectedCell !== null) {
        await click();
      }
    };

    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("touchstart", mouseDown);

    const unselectCell = () => {
      this.setState(
        {
          selectedCell: null,
        },
        () => this.renderCanvas()
      );
    };

    const mouseUp = async (e) => {
      this._buttonDown = false;
      if ("touches" in e) {
        unselectCell();
      }
    };

    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("touchend", mouseUp);

    canvas.addEventListener("mouseleave", unselectCell);

    canvas.addEventListener("mouseenter", (e) => {
      if (this._buttonDown) {
        if (!("touches" in e) && !(e.buttons & 1)) {
          this._buttonDown = false;
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      e.altKey && this.enablePickColor();
    });

    document.addEventListener("keyup", (e) => {
      const weaponsCodeKeys = [
        e.key.toLowerCase().charCodeAt(0),
        ...this.state.weaponsCodeKeys,
      ].slice(0, CodeLength);
      const codeHash = nearAPI.utils.serialize.base_encode(
        new Uint8Array(sha256.array(weaponsCodeKeys))
      );
      this.setState({
        weaponsCodeKeys,
        weaponsOn: this.state.weaponsOn || codeHash === WeaponsCheat,
      });
      !e.altKey && this.disablePickColor();
    });
  }

  enablePickColor() {
    this.setState(
      {
        pickingColor: true,
      },
      () => {
        this.renderCanvas();
      }
    );
  }

  disablePickColor() {
    this.setState(
      {
        pickingColor: false,
      },
      () => {
        this.renderCanvas();
      }
    );
  }

  pickColor(cell) {
    if (!this.state.signedIn || !this._lines || !this._lines[cell.y]) {
      return;
    }
    const color = this._lines[cell.y][cell.x].color;

    this.setState(
      {
        currentColor: color,
        alpha: 1,
        pickerColor: intToColorWithAlpha(color, 1),
        gammaColors: generateGamma(int2hsv(color)[0]),
        pickingColor: false,
      },
      () => {
        this.renderCanvas();
      }
    );
  }

  async refreshAllowance() {
    alert(
      "You're out of access key allowance. Need sign in again to refresh it"
    );
    await this.logOut();
    await this.requestSignIn();
  }

  async _sendQueue() {
    const pixels = this._queue.slice(0, BatchOfPixels);
    this._queue = this._queue.slice(BatchOfPixels);
    this._pendingPixels = pixels;

    try {
      await this._contract.draw(
        {
          pixels,
        },
        "75000000000000"
      );
      this._numFailedTxs = 0;
    } catch (error) {
      const msg = error.toString();
      if (msg.indexOf("does not have enough balance") !== -1) {
        await this.refreshAllowance();
        return;
      }
      console.log("Failed to send a transaction", error);
      this._numFailedTxs += 1;
      if (this._numFailedTxs < 3) {
        this._queue = this._queue.concat(this._pendingPixels);
        this._pendingPixels = [];
      } else {
        this._pendingPixels = [];
        this._queue = [];
      }
    }
    try {
      await Promise.all([this.refreshBoard(true), this.refreshAccountStats()]);
    } catch (e) {
      // ignore
    }
    this._pendingPixels.forEach((p) => {
      if (this._pending[p.y][p.x] === p.color) {
        this._pending[p.y][p.x] = -1;
      }
    });
    this._pendingPixels = [];
  }

  async _pingQueue(ready) {
    if (this._sendQueueTimer) {
      clearTimeout(this._sendQueueTimer);
      this._sendQueueTimer = null;
    }

    if (
      this._pendingPixels.length === 0 &&
      (this._queue.length >= BatchOfPixels || ready)
    ) {
      await this._sendQueue();
    }
    if (this._queue.length > 0) {
      this._sendQueueTimer = setTimeout(async () => {
        await this._pingQueue(true);
      }, BatchTimeout);
    }
  }

  async drawImg(cell) {
    if (!this.state.signedIn || !this._lines || !this._lines[cell.y]) {
      return;
    }
    const balance = this.state.account ? this.state.account.potatoBalance : 0;

    if (balance - this.state.pendingPixels < this.state.potatoNeeded) {
      return;
    }

    const img = this.imageData;
    const w = img.width;
    const h = img.height;
    const x = cell.x - Math.trunc(w / 2);
    const y = cell.y - Math.trunc(h / 2);
    const d = new Uint32Array(this.imageData.data.buffer);
    for (let i = 0; i < h; ++i) {
      for (let j = 0; j < w; ++j) {
        const imgColor = d[i * w + j];
        if (
          imgColor &&
          y + i >= 0 &&
          y + i < BoardHeight &&
          x + j >= 0 &&
          x + j < BoardWidth
        ) {
          const bgColor = this._lines[y + i]
            ? this._lines[y + i][x + j].color
            : 0;
          const color = imgColorToInt(imgColor, bgColor);
          if (color !== bgColor) {
            this._queue.push({
              x: x + j,
              y: y + i,
              color,
            });
          }
        }
      }
    }
    this.setState({
      rendering: false,
    });

    this._stopRefreshTime = new Date().getTime() + MaxWorkTime;
    await this._pingQueue(false);
  }

  async drawPixel(cell) {
    if (!this.state.signedIn || !this._lines || !this._lines[cell.y]) {
      return;
    }
    const balance = this.state.account ? this.state.account.potatoBalance : 0;
    if (balance - this.state.pendingPixels < 1) {
      return;
    }

    const bgColor = this._lines[cell.y] ? this._lines[cell.y][cell.x].color : 0;
    const cb = this.state.currentColor & 255;
    const cg = (this.state.currentColor >> 8) & 255;
    const cr = (this.state.currentColor >> 16) & 255;
    const color = rgbaToInt(cr, cg, cb, this.state.alpha, bgColor);

    if (
      this._pending[cell.y][cell.x] !== color &&
      this._lines[cell.y][cell.x].color !== color
    ) {
      this._pending[cell.y][cell.x] = color;
    } else {
      return;
    }

    this._queue.push({
      x: cell.x,
      y: cell.y,
      color,
    });

    this._stopRefreshTime = new Date().getTime() + MaxWorkTime;
    await this._pingQueue(false);
  }

  parseAccount(account, accountId) {
    if (!account) {
      account = {
        accountId,
        accountIndex: -1,
        potatoBalance: 0.0,
        numPixels: 0,
      };
    } else {
      account = {
        accountId: account.account_id,
        accountIndex: account.account_index,
        potatoBalance: parseFloat(account.potato_balance) / this._pixelCost,
        numPixels: account.num_pixels,
      };
    }
    account.startTime = new Date().getTime();
    account.potatoPixels = account.numPixels;
    account.potatoRewardPerDay = account.potatoPixels / 10;
    account.potatoRewardPerMs =
      account.potatoRewardPerDay / (24 * 60 * 60 * 1000);
    return account;
  }

  async getAccount(accountId) {
    return this.parseAccount(
      await this._contract.get_account({ account_id: accountId }),
      accountId
    );
  }

  async getAccountByIndex(accountIndex) {
    return this.parseAccount(
      await this._contract.get_account_by_index({
        account_index: accountIndex,
      }),
      "unknown"
    );
  }

  async refreshAccountStats() {
    let account = await this.getAccount(this._accountId);
    if (this._balanceRefreshTimer) {
      clearInterval(this._balanceRefreshTimer);
      this._balanceRefreshTimer = null;
    }

    this.setState({
      pendingPixels: this._pendingPixels.length + this._queue.length,
      account,
    });

    this._balanceRefreshTimer = setInterval(() => {
      const t = new Date().getTime() - account.startTime;
      this.setState({
        account: Object.assign({}, account, {
          potatoBalance: account.potatoBalance + t * account.potatoRewardPerMs,
        }),
        pendingPixels: this._pendingPixels.length + this._queue.length,
      });
    }, 100);
  }

  async _initNear() {
    const selector = await setupSelector();
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const nearConnection = await nearAPI.connect(
      Object.assign({ deps: { keyStore } }, NearConfig)
    );
    this._selector = selector;
    this._keyStore = keyStore;
    const _near = (this._near = {
      selector,
      keyStore,
      nearConnection,
    });

    const setAccount = (account) => {
      this._account = account;
      this._accountId = account.accountId;
      this.setState({
        account,
        signedIn: !!this._accountId,
        accountId: this._accountId,
      });
    };

    selector.store.observable.subscribe(async (walletState) => {
      await updateAccount(_near, walletState);
      try {
        await loadAccount(_near, setAccount);
      } catch (e) {
        console.error(e);
      }
    });

    const transformBlockId = (blockId) =>
      blockId === "optimistic" || blockId === "final"
        ? {
            finality: blockId,
            blockId: undefined,
          }
        : blockId !== undefined && blockId !== null
        ? {
            finality: undefined,
            blockId: parseInt(blockId),
          }
        : {
            finality: "optimistic",
            blockId: undefined,
          };

    _near.viewCall = (contractId, methodName, args, blockHeightOrFinality) => {
      const { blockId, finality } = transformBlockId(blockHeightOrFinality);
      return viewCall(
        _near.nearConnection.connection.provider,
        blockId ?? undefined,
        contractId,
        methodName,
        args,
        finality
      );
    };
    _near.functionCall = (contractName, methodName, args, gas, deposit) =>
      functionCall(_near, contractName, methodName, args, gas, deposit);
    _near.accountState = (accountId) => accountState(_near, accountId);

    // this._accountId = this._walletConnection.getAccountId();
    //
    // this._account = this._walletConnection.account();
    this._contract = setupContract(this._near, NearConfig.contractName, {
      viewMethods: [
        "get_account",
        "get_account_by_index",
        "get_lines",
        "get_line_versions",
        "get_pixel_cost",
        "get_pool_id",
        "get_account_balance",
        "get_account_num_pixels",
        "get_account_id_by_index",
        "get_unminted_amount",
        "ft_total_supply",
      ],
      changeMethods: ["draw", "ping"],
    });
    this._refFinanceContract = setupContract(
      this._near,
      NearConfig.refContractName,
      {
        viewMethods: ["get_pool", "get_deposit"],
        changeMethods: [],
      }
    );
    this._wrapNearContract = setupContract(
      this._near,
      NearConfig.wrapNearContractName,
      {
        viewMethods: ["storage_balance_of", "ft_balance_of"],
        changeMethods: ["storage_deposit", "near_deposit", "ft_transfer_call"],
      }
    );

    this._sendTransactions = async (items) => {
      const maxGasPerTransaction = MaxGasPerTransaction;

      const transactions = [];
      let actions = [];
      let currentReceiverId = null;
      let currentTotalGas = Big(0);
      items.push([null, null]);
      console.log("Sending items", items);
      items.forEach(([receiverId, action]) => {
        const actionGas =
          action && action.type === "FunctionCall"
            ? Big(action.params?.gas || "0")
            : Big(0);
        const newTotalGas = currentTotalGas.add(actionGas);
        if (
          receiverId !== currentReceiverId ||
          newTotalGas.gt(maxGasPerTransaction)
        ) {
          if (currentReceiverId !== null) {
            transactions.push({
              receiverId: currentReceiverId,
              actions,
            });
            actions = [];
          }
          currentTotalGas = actionGas;
          currentReceiverId = receiverId;
        } else {
          currentTotalGas = newTotalGas;
        }
        actions.push(action);
      });
      console.log("Sending transactions", transactions);
      const wallet = await (await _near.selector).wallet();
      return await wallet.signAndSendTransactions({ transactions });
    };
    this._modal = setupModal(await selector, {
      contractId: NearConfig.contractName,
    });

    const [rawPixelCost, potatoPoolId] = await Promise.all([
      this._contract.get_pixel_cost(),
      this._contract.get_pool_id(),
    ]);

    this._potatoPoolId = potatoPoolId;
    this._pixelCost = parseFloat(rawPixelCost);
    if (this._accountId) {
      await this.refreshAccountStats();
    }
    this._lineVersions = Array(BoardHeight).fill(-1);
    this._lines = Array(BoardHeight).fill(false);
    this._pending = Array(BoardHeight).fill(false);
    this._pending.forEach((v, i, a) => (a[i] = Array(BoardWidth).fill(-1)));
    await this.refreshBoard(true);
  }

  async refreshBoard(forced) {
    if (this._refreshBoardTimer) {
      clearTimeout(this._refreshBoardTimer);
      this._refreshBoardTimer = null;
    }
    const t = new Date().getTime();
    if (this.state.watchMode || t < this._stopRefreshTime) {
      this._refreshBoardTimer = setTimeout(async () => {
        await this.refreshBoard(false);
      }, RefreshBoardTimeout);
    }

    if (!forced && document.hidden) {
      return;
    }

    const lineVersions = await this._contract.get_line_versions();
    let needLines = [];
    for (let i = 0; i < BoardHeight; ++i) {
      if (lineVersions[i] !== this._lineVersions[i]) {
        needLines.push(i);
      }
    }
    let requestLines = [];
    for (let i = 0; i < needLines.length; i += NumLinesPerFetch) {
      requestLines.push(needLines.slice(i, i + NumLinesPerFetch));
    }

    let results = await Promise.all(
      requestLines.map((lines) => this._contract.get_lines({ lines }))
    );
    results = results.flat();
    requestLines = requestLines.flat();
    for (let i = 0; i < requestLines.length; ++i) {
      let lineIndex = requestLines[i];
      this._lines[lineIndex] = decodeLine(results[i]);
    }

    this._lineVersions = lineVersions;
    if (!this.state.watchMode) {
      this._refreshRef();
      this._refreshOwners();
    }
    this.renderCanvas();
  }

  async _fetchRefPool() {
    const rawPool = await this._refFinanceContract.get_pool({
      pool_id: this._potatoPoolId,
    });
    const potato = Big(rawPool.amounts[0]);
    const near = Big(rawPool.amounts[1]);
    const fee = rawPool.total_fee;
    return { potato, near, fee };
  }

  async _refreshRef() {
    const [
      refPool,
      rawUnmintedAmount,
      rawTotalSupply,
      rawRefBalance,
    ] = await Promise.all([
      this._fetchRefPool(),
      this._contract.get_unminted_amount(),
      this._contract.ft_total_supply(),
      this._refFinanceContract.get_deposit({
        account_id: NearConfig.contractName,
        token_id: NearConfig.wrapNearContractName,
      }),
    ]);
    const unmintedAmount = Big(rawUnmintedAmount);
    const totalSupply = Big(rawTotalSupply);
    const refBalance = Big(rawRefBalance);
    this.setState({
      unmintedAmount,
      totalSupply,
      refPool,
      refBalance,
    });
  }

  _refreshOwners() {
    const counts = {};
    this._lines.flat().forEach((cell) => {
      counts[cell.ownerIndex] = (counts[cell.ownerIndex] || 0) + 1;
    });
    delete counts[0];
    const sortedKeys = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a]
    );
    this.setState({
      owners: sortedKeys.map((accountIndex) => {
        accountIndex = parseInt(accountIndex);
        return {
          accountIndex,
          numPixels: counts[accountIndex],
        };
      }),
    });
    sortedKeys.forEach(async (accountIndex) => {
      accountIndex = parseInt(accountIndex);
      if (
        !(accountIndex in this._accounts) ||
        counts[accountIndex] !== (this._oldCounts[accountIndex] || 0)
      ) {
        try {
          this._accounts[accountIndex] = await this.getAccountByIndex(
            accountIndex
          );
        } catch (err) {
          console.log("Failed to fetch account index #", accountIndex, err);
        }
        this.setState({
          accounts: Object.assign({}, this._accounts),
        });
      }
    });
    this.setState({
      accounts: Object.assign({}, this._accounts),
    });
    this._oldCounts = counts;
  }

  renderCanvas() {
    if (!this._context || !this._lines) {
      return;
    }

    const ctx = this._context;

    for (let i = 0; i < BoardHeight; ++i) {
      const line = this._lines[i];
      if (!line) {
        continue;
      }
      for (let j = 0; j < BoardWidth; ++j) {
        const p = line[j];
        ctx.fillStyle = intToColor(p.color);
        ctx.fillRect(j * CellWidth, i * CellHeight, CellWidth, CellHeight);
        if (this.state.highlightedAccountIndex >= 0) {
          if (p.ownerIndex !== this.state.highlightedAccountIndex) {
            ctx.fillStyle = "rgba(32, 32, 32, 0.8)";
            ctx.fillRect(
              j * CellWidth,
              i * CellHeight,
              CellWidth / 2,
              CellHeight / 2
            );
            ctx.fillRect(
              (j + 0.5) * CellWidth,
              (i + 0.5) * CellHeight,
              CellWidth / 2,
              CellHeight / 2
            );
            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillRect(
              j * CellWidth,
              (i + 0.5) * CellHeight,
              CellWidth / 2,
              CellHeight / 2
            );
            ctx.fillRect(
              (j + 0.5) * CellWidth,
              i * CellHeight,
              CellWidth / 2,
              CellHeight / 2
            );
          } else {
            ctx.beginPath();
            ctx.strokeStyle = ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 0.5;
            ctx.rect(
              j * CellWidth + 0.5,
              i * CellHeight + 0.5,
              CellWidth - 1,
              CellHeight - 1
            );
            ctx.stroke();
            ctx.closePath();
          }
        }
      }
    }

    this._pendingPixels.concat(this._queue).forEach((p) => {
      ctx.fillStyle = intToColor(p.color);
      ctx.fillRect(p.x * CellWidth, p.y * CellHeight, CellWidth, CellHeight);
    });

    if (this.state.selectedCell && !this.state.watchMode) {
      const c = this.state.selectedCell;
      if (this.state.rendering) {
        const img = this.imageData;
        const w = img.width;
        const h = img.height;
        const x = c.x - Math.trunc(w / 2);
        const y = c.y - Math.trunc(h / 2);
        const d = new Uint32Array(this.imageData.data.buffer);
        for (let i = 0; i < h; ++i) {
          for (let j = 0; j < w; ++j) {
            const color = d[i * w + j];
            if (
              color &&
              y + i >= 0 &&
              y + i < BoardHeight &&
              x + j >= 0 &&
              x + j < BoardWidth
            ) {
              const bgColor = this._lines[y + i]
                ? this._lines[y + i][x + j].color
                : 0;
              ctx.fillStyle = intToColor(imgColorToInt(color, bgColor));
              ctx.fillRect(
                (x + j) * CellWidth,
                (y + i) * CellHeight,
                CellWidth,
                CellHeight
              );
            }
          }
        }
      } else if (this.state.pickingColor) {
        const color = this._lines[c.y] ? this._lines[c.y][c.x].color : 0;
        ctx.beginPath();
        ctx.strokeStyle = ctx.fillStyle = transparentColor(color, 0.5);
        ctx.lineWidth = CellWidth * 4;
        ctx.arc(
          (c.x + 0.5) * CellWidth,
          (c.y + 0.5) * CellHeight,
          CellWidth * 4,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.closePath();

        ctx.beginPath();
        ctx.strokeStyle = ctx.fillStyle = transparentColor(color, 1);
        ctx.lineWidth = CellWidth * 2;
        ctx.arc(
          (c.x + 0.5) * CellWidth,
          (c.y + 0.5) * CellHeight,
          CellWidth * 4,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        ctx.closePath();
      } else {
        ctx.fillStyle = transparentColor(this.state.currentColor, 0.2);
        ctx.fillRect(c.x * CellWidth, 0, CellWidth, c.y * CellHeight);
        ctx.fillRect(
          c.x * CellWidth,
          (c.y + 1) * CellHeight,
          CellWidth,
          (BoardHeight - c.y - 1) * CellHeight
        );
        ctx.fillRect(0, c.y * CellHeight, c.x * CellWidth, CellHeight);
        ctx.fillRect(
          (c.x + 1) * CellWidth,
          c.y * CellHeight,
          (BoardWidth - c.x - 1) * CellWidth,
          CellHeight
        );

        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.fillStyle = intToColor(this.state.currentColor);
        ctx.strokeStyle = intToColor(this.state.currentColor);
        ctx.rect(c.x * CellWidth, c.y * CellHeight, CellWidth, CellHeight);
        ctx.stroke();
        ctx.closePath();
      }
    }

    if (!this.state.boardLoaded) {
      this.setState({
        boardLoaded: true,
      });
    }
  }

  async requestSignIn() {
    const appTitle = "Dacha Finance";
    this._modal.show();
  }

  async logOut() {
    this._accountId = null;
    this.setState({
      signedIn: !!this._accountId,
      accountId: this._accountId,
    });
  }

  // async alphaColorChange(c) {
  //   this.setState(
  //     {
  //       alpha: c.rgb.a,
  //     },
  //     () => {
  //       this.changeColor(c, c.rgb.a);
  //     }
  //   );
  // }

  hueColorChange(c) {
    this.setState({
      gammaColors: generateGamma(c.hsl.h),
    });
    this.changeColor(c);
  }

  saveColor() {
    const newColor = intToColor(this.state.currentColor);
    const index = this.state.colors.indexOf(newColor);
    if (index >= 0) {
      this.state.colors.splice(index, 1);
    }
    this.setState({
      colors: [newColor].concat(this.state.colors).slice(0, MaxNumColors),
    });
  }

  changeColor(c, alpha) {
    alpha = alpha || 1.0;
    const currentColor = c.rgb.r * 0x010000 + c.rgb.g * 0x000100 + c.rgb.b;
    c.hex = intToColorWithAlpha(currentColor, alpha);
    c.rgb.a = alpha;
    c.hsl.a = alpha;
    c.hsv.a = alpha;
    this.setState(
      {
        pickerColor: c,
        alpha,
        currentColor,
      },
      () => {
        this.renderCanvas();
      }
    );
  }

  async isTokenRegistered() {
    const storageBalance = await this._near.viewCall(
      NearConfig.wrapNearContractName,
      "storage_balance_of",
      {
        account_id: this._accountId,
      }
    );
    return storageBalance && storageBalance.total !== "0";
  }

  async tokenRegisterStorageAction(actions) {
    if (!(await this.isTokenRegistered())) {
      actions.push([
        NearConfig.wrapNearContractName,
        functionCallCreator(
          "storage_deposit",
          {
            account_id: this._accountId,
            registration_only: true,
          },
          TGas.mul(5).toFixed(0),
          Big(125).mul(StorageCostPerByte).toFixed(0)
        ),
      ]);
    }
  }

  adjustRefPool(refPool, unmintedAmount) {
    if (!unmintedAmount || unmintedAmount.eq(0)) {
      return refPool;
    }
    const { fee, near, potato } = refPool;

    const amountWithFee = Big(unmintedAmount).mul(Big(10000 - fee));
    const nearOut = amountWithFee
      .mul(near)
      .div(Big(10000).mul(potato).add(amountWithFee))
      .round(0, 0);
    return {
      fee,
      potato: potato.add(unmintedAmount),
      near: near.sub(nearOut),
    };
  }

  nearPotato(refPool, unmintedAmount, near, potato) {
    refPool = this.adjustRefPool(refPool, unmintedAmount);

    let nearIn, potatoOut;
    if (near) {
      nearIn = Big(near).mul(OneNear).round(0, 0);
      potatoOut = this.getRefReturn(refPool, nearIn);
    } else {
      potatoOut = Big(potato).mul(OnePotato).round(0, 0);
      nearIn = this.getRefInverseReturn(refPool, potatoOut);
    }
    return { nearIn, potatoOut };
  }

  async availableNearBalance() {
    const accountState = await this._near.accountState(this._accountId);
    const balance = Big(accountState.amount).sub(
      Big(accountState.storage_usage).mul(Big(StorageCostPerByte))
    );
    if (balance.gt(AccountSafetyMargin)) {
      return balance.sub(AccountSafetyMargin);
    }
    return Big(0);
  }

  async buyTokens(near, potato) {
    this.setState({
      loading: true,
    });

    const actions = [];

    console.log(await this._contract.ping());

    const [nearBalance, rawTokenBalance] = await Promise.all([
      this.availableNearBalance(),
      this._wrapNearContract.ft_balance_of({
        account_id: this._accountId,
      }),
      this.tokenRegisterStorageAction(actions),
      this._contract.ping(),
    ]);
    const tokenBalance = Big(rawTokenBalance);

    const refPool = await this._fetchRefPool();

    const { nearIn, potatoOut } = this.nearPotato(
      refPool,
      Big(0),
      near,
      potato
    );

    if (nearIn.gt(tokenBalance)) {
      const needDeposit = nearIn.sub(tokenBalance);
      if (nearBalance.lt(nearBalance)) {
        alert("Not enough NEAR balance");
        return;
      }
      actions.push([
        NearConfig.wrapNearContractName,
        functionCallCreator(
          "near_deposit",
          {},
          TGas.mul(5).toFixed(0),
          needDeposit.toFixed(0)
        ),
      ]);
    }

    actions.push([
      NearConfig.wrapNearContractName,
      functionCallCreator(
        "ft_transfer_call",
        {
          receiver_id: NearConfig.refContractName,
          amount: nearIn.toFixed(0),
          msg: JSON.stringify({
            actions: [
              {
                pool_id: this._potatoPoolId,
                token_in: NearConfig.wrapNearContractName,
                token_out: NearConfig.contractName,
                min_amount_out: potatoOut.mul(0.995).round(0, 0).toFixed(0),
              },
            ],
          }),
        },
        TGas.mul(180).toFixed(0),
        1
      ),
    ]);

    await this._sendTransactions(actions);
  }

  setHover(accountIndex, v) {
    if (v) {
      this.setState(
        {
          highlightedAccountIndex: accountIndex,
        },
        () => {
          this.renderCanvas();
        }
      );
    } else if (this.state.highlightedAccountIndex === accountIndex) {
      this.setState(
        {
          highlightedAccountIndex: -1,
        },
        () => {
          this.renderCanvas();
        }
      );
    }
  }

  async renderImg(img, potatoNeeded) {
    this.imageData = img;
    this.setState({
      weaponsOn: false,
      rendering: true,
      pickingColor: false,
      potatoNeeded,
    });
  }

  enableWatchMode() {
    this.setState({
      watchMode: true,
      weaponsOn: false,
    });
    document.body.style.transition = "3s";
    document.body.style.backgroundColor = "#333";
  }

  getRefReturn(refPool, amountIn) {
    let amountWithFee = Big(amountIn).mul(Big(10000 - refPool.fee));
    return amountWithFee
      .mul(refPool.potato)
      .div(Big(10000).mul(refPool.near).add(amountWithFee))
      .round(0, 0);
  }

  getRefInverseReturn(refPool, amountOut) {
    if (amountOut.gte(refPool.potato)) {
      return null;
    }
    return Big(10000)
      .mul(refPool.near)
      .mul(amountOut)
      .div(Big(10000 - refPool.fee).mul(refPool.potato.sub(amountOut)))
      .round(0, 3);
  }

  buyButton(near, potato) {
    const { nearIn, potatoOut } = this.nearPotato(
      this.state.refPool,
      this.state.unmintedAmount,
      near,
      potato
    );
    return (
      <button
        className="btn btn-primary"
        disabled={!nearIn || this.state.loading}
        onClick={() => this.buyTokens(near, potato)}
      >
        Buy{" "}
        <span className="font-weight-bold">
          {potatoOut.div(OnePotato).toFixed(1)}
          {Potato}
        </span>{" "}
        for{" "}
        <span className="font-weight-bold">
          {nearIn?.div(OneNear)?.toFixed(2)}Ⓝ
        </span>
      </button>
    );
  }

  async pingContract(e) {
    e.preventDefault();

    this.setState({
      loading: true,
    });

    await this._contract.ping();
    await this._refreshRef();

    this.setState({
      loading: false,
    });
  }

  rules(watchClass, dachaToken) {
    return (
      <div className={`container${watchClass}`}>
        <div>
          <h3>Dacha Rules</h3>
          <div>{dachaToken}</div>
          <p>
            Dacha Finance is an evolution of the berryclub project with improved
            tokenomics.
          </p>
          <p>
            The biggest change is the limited supply of the main token $POTATO{" "}
            {Potato} which makes the price of {Potato} dynamic.
            <li>
              100 {Potato} per day is minted by the contract and given to the
              REF pool.
            </li>
            <li>250 {Potato} per day is farmed from the pixel board.</li>
            <li>1 {Potato} is burned by drawing a pixel.</li>
          </p>
          <p>
            In order to draw a pixel you need to consume one {Potato} token,
            which removes it from circulation.
            <br /> To get {Potato} you can either farm them (by having your
            pixels on the board) or buy them from the market.
            <br /> The token is listed on REF Finance.
          </p>
          <p>
            There are few for you to attempt to make a profit:
            <li>Trade {Potato}</li>
            <li>
              Plant {Potato} to farm {Potato}
            </li>
            <li>Add {Potato} liquidity and earn fees</li>
            It's up to you.
          </p>
        </div>
      </div>
    );
  }

  computePotatoPrice() {
    const refPool = this.adjustRefPool(
      this.state.refPool,
      this.state.unmintedAmount
    );

    return refPool.potato
      .mul(OneNear.div(OnePotato))
      .div(refPool.near)
      .toFixed(3);
  }

  render() {
    const watchClass = this.state.watchMode ? " hidden" : "";

    const prices =
      !this.state.watchMode && this.state.refPool ? (
        <div>
          <div>
            <div>
              Price:{" "}
              <span className="balances">
                <span className="font-weight-bold">
                  1Ⓝ = {this.computePotatoPrice()}
                </span>
              </span>
              {Potato}
            </div>
            <div>
              Circulating supply:{" "}
              <span className="balances">
                <span className="font-weight-bold">
                  {this.state.totalSupply
                    .add(this.state.unmintedAmount)
                    .div(OnePotato)
                    .toFixed(2)}
                  {Potato}
                </span>
              </span>
            </div>
          </div>
          {this.state.signedIn && (
            <div className={`buttons${watchClass}`}>
              <div>
                {this.buyButton(0.1, null)}
                {this.buyButton(1, null)}
                {this.buyButton(5, null)}
              </div>
              <div>
                {this.buyButton(null, 40)}
                {this.buyButton(null, 200)}
                {this.buyButton(null, 1000)}
              </div>
            </div>
          )}
        </div>
      ) : (
        ""
      );
    const dachaToken =
      !this.state.watchMode && this.state.refPool ? (
        <div>
          <div>
            <div>
              {Dacha} Treasury:{" "}
              <span className="balances">
                <span className="font-weight-bold">
                  {this.state.refBalance
                    .add(this.state.accountBalance)
                    .div(OneNear)
                    .toFixed(2)}
                  Ⓝ
                </span>
              </span>
            </div>
            <div>
              Circulating supply:{" "}
              <span className="balances">
                <span className="font-weight-bold">
                  {this.state.dachaSupply.div(OneDacha).toFixed(2)}
                  {Dacha}
                </span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        ""
      );

    const content = !this.state.connected ? (
      <div>
        Connecting...{" "}
        <span
          className="spinner-grow spinner-grow-sm"
          role="status"
          aria-hidden="true"
        />
      </div>
    ) : this.state.signedIn ? (
      <div>
        <div className={`float-right${watchClass}`}>
          <button
            className="ms-2 btn btn-outline-secondary"
            onClick={() => this.logOut()}
          >
            Log out ({this.state.accountId})
          </button>
        </div>
        <div className={`your-balance${watchClass}`}>
          Balance:{" "}
          <Balance
            account={this.state.account}
            pendingPixels={this.state.pendingPixels}
            detailed={true}
          />
        </div>
        {prices}
        <div className={`color-picker${watchClass}`}>
          <HuePicker
            color={this.state.pickerColor}
            width="100%"
            onChange={(c) => this.hueColorChange(c)}
          />
          {/*<AlphaPicker*/}
          {/*  color={this.state.pickerColor}*/}
          {/*  width="100%"*/}
          {/*  onChange={(c) => this.alphaColorChange(c)}*/}
          {/*/>*/}

          <GithubPicker
            className="circle-picker"
            colors={this.state.gammaColors}
            color={this.state.pickerColor}
            triangle="hide"
            width="100%"
            onChangeComplete={(c) => this.changeColor(c)}
          />
          <GithubPicker
            className="circle-picker"
            colors={this.state.colors}
            color={this.state.pickerColor}
            triangle="hide"
            width="100%"
            onChangeComplete={(c) => this.hueColorChange(c)}
          />
        </div>
      </div>
    ) : (
      <div style={{ marginBottom: "10px" }}>
        <div>
          <button
            className="btn btn-primary"
            onClick={() => this.requestSignIn()}
          >
            Log in with NEAR Wallet
          </button>
        </div>
        {prices}
      </div>
    );
    const weapons = this.state.weaponsOn ? (
      <div>
        <Weapons
          account={this.state.account}
          renderIt={(img, potatoNeeded) => this.renderImg(img, potatoNeeded)}
          enableWatchMode={() => this.enableWatchMode()}
        />
      </div>
    ) : (
      ""
    );

    return (
      <div>
        <div className={`header${watchClass}`}>
          <h2>
            {Potato} Dacha Finance
            {this.state.loading ? (
              <span className="text-muted"> (Loading...)</span>
            ) : (
              ""
            )}
          </h2>{" "}
          <a
            className="btn btn-outline-none"
            href={`https://app.skyward.finance/swap/${NearConfig.wrapNearContractName}/${NearConfig.contractName}`}
          >
            Trade {Potato}
          </a>
          <a
            className="btn btn-outline-none"
            href={`https://app.ref.finance/pool/${this._potatoPoolId}`}
          >
            REF Pool {Potato}
          </a>
          {content}
        </div>
        <div className="container">
          <div className="row">
            <div>
              <div>
                <canvas
                  ref={this.canvasRef}
                  width={600}
                  height={600}
                  className={
                    this.state.boardLoaded
                      ? `pixel-board${
                          this.state.watchMode ? " watch-mode" : ""
                        }`
                      : "pixel-board c-animated-background"
                  }
                />
              </div>
            </div>
            <div className={`leaderboard${watchClass}`}>
              <div>
                <Leaderboard
                  owners={this.state.owners}
                  accounts={this.state.accounts}
                  setHover={(accountIndex, v) => this.setHover(accountIndex, v)}
                  selectedOwnerIndex={this.state.selectedOwnerIndex}
                  highlightedAccountIndex={this.state.highlightedAccountIndex}
                />
              </div>
            </div>
          </div>
        </div>
        {this.rules(watchClass, dachaToken)}
        {weapons}
        <a
          className={`github-fork-ribbon right-bottom fixed${watchClass}`}
          href="https://github.com/evgenykuzyakov/dacha"
          data-ribbon="Fork me on GitHub"
          title="Fork me on GitHub"
        >
          Fork me on GitHub
        </a>
      </div>
    );
  }
}

const Balance = (props) => {
  const account = props.account;
  if (!account) {
    return "";
  }
  const fraction = props.detailed ? 3 : 1;
  const potatoBalance = account.potatoBalance - (props.pendingPixels || 0);
  const potatoFarm =
    account.potatoRewardPerDay > 0 ? (
      <span>
        {"(+"}
        <span className="font-weight-bold">{account.potatoRewardPerDay}</span>
        {Potato}
        {"/day)"}
      </span>
    ) : (
      ""
    );
  return (
    <span className="balances font-small">
      <span className="font-weight-bold">
        {potatoBalance.toFixed(fraction)}
      </span>
      {Potato} {potatoFarm}
      {props.pendingPixels ? <span> ({props.pendingPixels} pending)</span> : ""}
    </span>
  );
};

const Leaderboard = (props) => {
  const owners = props.owners.map((owner) => {
    if (owner.accountIndex in props.accounts) {
      owner.account = props.accounts[owner.accountIndex];
    }
    return (
      <Owner
        key={owner.accountIndex}
        {...owner}
        isSelected={owner.accountIndex === props.selectedOwnerIndex}
        setHover={(v) => props.setHover(owner.accountIndex, v)}
        isHighlighted={owner.accountIndex === props.highlightedAccountIndex}
      />
    );
  });
  return (
    <table className="table table-hover table-sm">
      <tbody>{owners}</tbody>
    </table>
  );
};

const Owner = (props) => {
  const account = props.account;
  return (
    <tr
      onMouseEnter={() => props.setHover(true)}
      onMouseLeave={() => props.setHover(false)}
      className={props.isSelected ? "selected" : ""}
    >
      <td>{account ? <Account accountId={account.accountId} /> : "..."}</td>
      <td className="text-nowrap">
        <small>
          <Balance account={account} />
        </small>
      </td>
    </tr>
  );
};

const Account = (props) => {
  const accountId = props.accountId;
  const shortAccountId =
    accountId.length > 6 + 6 + 3
      ? accountId.slice(0, 6) + "..." + accountId.slice(-6)
      : accountId;
  return (
    // <a className="account" href={`https://wayback.berryclub.io/${accountId}`}>
    <span>{shortAccountId}</span>
    // </a>
  );
};
