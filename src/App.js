import "./App.scss";
import "./gh-fork-ribbon.css";
import React from "react";
import Big from "big.js";
import * as nearAPI from "near-api-js";
import { HuePicker, GithubPicker } from "react-color";
import { Weapons } from "./Weapons";

const defaultCodeHash = "11111111111111111111111111111111";

const TGas = Big(10).pow(12);
const MaxGasPerTransaction = TGas.mul(300);
const MaxGasPerTransaction2FA = TGas.mul(220);
const randomPublicKey = nearAPI.utils.PublicKey.from(
  "ed25519:8fWHD35Rjd78yeowShh9GwhRudRtLLsGCRjZtgPjAtw9"
);
const StorageCostPerByte = Big(10).pow(19);
const AccountSafetyMargin = Big(10).pow(24).div(2);

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

export const Potato = (
  <span role="img" aria-label="potato" className="berry">
    🥔
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

const WeaponsCheat = "whendacha";

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
      weaponsCodePosition: 0,
      watchMode: false,
      refPool: false,
      unmintedAmount: Big(0),
      loading: false,
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
          ircAccountId: this._accountId.replace(".", "_"),
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
      if (this.state.weaponsCodePosition < WeaponsCheat.length) {
        if (
          e.key.toLowerCase() === WeaponsCheat[this.state.weaponsCodePosition]
        ) {
          this.setState({
            weaponsCodePosition: this.state.weaponsCodePosition + 1,
            weaponsOn:
              this.state.weaponsCodePosition + 1 === WeaponsCheat.length,
          });
        } else {
          this.setState({
            weaponsCodePosition: 0,
          });
        }
      }
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
    account.potatoRewardPerMs = account.potatoPixels / (24 * 60 * 60 * 1000);
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
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect(
      Object.assign({ deps: { keyStore } }, NearConfig)
    );
    this._keyStore = keyStore;
    this._near = near;

    this._walletConnection = new nearAPI.WalletConnection(
      near,
      NearConfig.contractName
    );
    this._accountId = this._walletConnection.getAccountId();

    this._account = this._walletConnection.account();
    this._contract = new nearAPI.Contract(
      this._account,
      NearConfig.contractName,
      {
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
      }
    );
    this._refFinanceContract = new nearAPI.Contract(
      this._account,
      NearConfig.refContractName,
      {
        viewMethods: ["get_pool"],
        changeMethods: [],
      }
    );
    this._wrapNearContract = new nearAPI.Contract(
      this._account,
      NearConfig.wrapNearContractName,
      {
        viewMethods: ["storage_balance_of", "ft_balance_of"],
        changeMethods: ["storage_deposit", "near_deposit", "ft_transfer_call"],
      }
    );

    const fetchBlockHash = async () => {
      const block = await near.connection.provider.block({
        finality: "final",
      });
      return nearAPI.utils.serialize.base_decode(block.header.hash);
    };

    const fetchNextNonce = async () => {
      const accessKeys = await this._account.getAccessKeys();
      return accessKeys.reduce(
        (nonce, accessKey) => Math.max(nonce, accessKey.access_key.nonce + 1),
        1
      );
    };

    this._sendTransactions = async (items, callbackUrl) => {
      let [nonce, blockHash, accountState] = await Promise.all([
        fetchNextNonce(),
        fetchBlockHash(),
        this._account.state(),
      ]);

      const maxGasPerTransaction =
        accountState.code_hash === defaultCodeHash
          ? MaxGasPerTransaction
          : MaxGasPerTransaction2FA;

      const transactions = [];
      let actions = [];
      let currentReceiverId = null;
      let currentTotalGas = Big(0);
      items.push([null, null]);
      items.forEach(([receiverId, action]) => {
        const actionGas =
          action && action.functionCall ? Big(action.functionCall.gas) : Big(0);
        const newTotalGas = currentTotalGas.add(actionGas);
        if (
          receiverId !== currentReceiverId ||
          newTotalGas.gt(maxGasPerTransaction)
        ) {
          if (currentReceiverId !== null) {
            transactions.push(
              nearAPI.transactions.createTransaction(
                this._accountId,
                randomPublicKey,
                currentReceiverId,
                nonce++,
                actions,
                blockHash
              )
            );
            actions = [];
          }
          currentTotalGas = actionGas;
          currentReceiverId = receiverId;
        } else {
          currentTotalGas = newTotalGas;
        }
        actions.push(action);
      });
      return await this._walletConnection.requestSignTransactions(
        transactions,
        callbackUrl
      );
    };
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

  async _refreshRef() {
    const [rawPool, rawUnmintedAmount, rawTotalSupply] = await Promise.all([
      this._refFinanceContract.get_pool({
        pool_id: this._potatoPoolId,
      }),
      this._contract.get_unminted_amount(),
      this._contract.ft_total_supply(),
    ]);
    const unmintedAmount = Big(rawUnmintedAmount);
    const totalSupply = Big(rawTotalSupply);
    const potato = Big(rawPool.amounts[0]);
    const near = Big(rawPool.amounts[1]);
    const fee = rawPool.total_fee;
    this.setState({
      unmintedAmount,
      totalSupply,
      refPool: { potato, near, fee },
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
    await this._walletConnection.requestSignIn(
      NearConfig.contractName,
      appTitle
    );
  }

  async logOut() {
    this._walletConnection.signOut();
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
    const storageBalance = await this._account.viewFunction(
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
        nearAPI.transactions.functionCall(
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

  nearPotato(near, potato) {
    let nearIn, potatoOut;
    if (near) {
      nearIn = Big(near).mul(Big(10).pow(24)).round(0, 0);
      potatoOut = this.getRefReturn(nearIn);
    } else {
      potatoOut = Big(potato).mul(Big(10).pow(18)).round(0, 0);
      nearIn = this.getRefInverseReturn(potatoOut);
    }
    return { nearIn, potatoOut };
  }

  async availableNearBalance() {
    const accountState = await this._account.state();
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

    const [nearBalance, rawTokenBalance] = await Promise.all([
      this.availableNearBalance(),
      this._wrapNearContract.ft_balance_of({
        account_id: this._accountId,
      }),
      this.tokenRegisterStorageAction(actions),
      this._contract.ping(),
    ]);
    const tokenBalance = Big(rawTokenBalance);

    const { nearIn, potatoOut } = this.nearPotato(near, potato);

    if (nearIn.gt(tokenBalance)) {
      const needDeposit = nearIn.sub(tokenBalance);
      if (nearBalance.lt(nearBalance)) {
        alert("Not enough NEAR balance");
        return;
      }
      actions.push([
        NearConfig.wrapNearContractName,
        nearAPI.transactions.functionCall(
          "near_deposit",
          {},
          TGas.mul(5).toFixed(0),
          needDeposit.toFixed(0)
        ),
      ]);
    }

    actions.push([
      NearConfig.wrapNearContractName,
      nearAPI.transactions.functionCall(
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
      weaponsCodePosition: 0,
      rendering: true,
      pickingColor: false,
      potatoNeeded,
    });
  }

  enableWatchMode() {
    this.setState({
      watchMode: true,
      weaponsOn: false,
      weaponsCodePosition: 0,
    });
    document.body.style.transition = "3s";
    document.body.style.backgroundColor = "#333";
  }

  getRefReturn(amountIn) {
    let amountWithFee = Big(amountIn).mul(Big(10000 - this.state.refPool.fee));
    return amountWithFee
      .mul(this.state.refPool.potato)
      .div(Big(10000).mul(this.state.refPool.near).add(amountWithFee))
      .round(0, 0);
  }

  getRefInverseReturn(amountOut) {
    if (amountOut.gte(this.state.refPool.potato)) {
      return null;
    }
    return Big(10000)
      .mul(this.state.refPool.near)
      .mul(amountOut)
      .div(
        Big(10000 - this.state.refPool.fee).mul(
          this.state.refPool.potato.sub(amountOut)
        )
      )
      .round(0, 3);
  }

  buyButton(near, potato) {
    const { nearIn, potatoOut } = this.nearPotato(near, potato);
    return (
      <button
        className="btn btn-primary"
        disabled={!nearIn || this.state.loading}
        onClick={() => this.buyTokens(near, potato)}
      >
        Buy{" "}
        <span className="font-weight-bold">
          {potatoOut.div(Big(10).pow(18)).toFixed(1)}
          {Potato}
        </span>{" "}
        for{" "}
        <span className="font-weight-bold">
          {nearIn.div(Big(10).pow(24)).toFixed(2)}Ⓝ
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

  rules() {
    return (
      <div className="container">
        <div>
          <p>
            Dacha Finance is an evolution of the berryclub project with improved
            tokenomics.
          </p>
          <p>
            The biggest change is the limited supply of the main token $POTATO{" "}
            {Potato} which makes the price of {Potato} dynamic.
            <li>
              10000 {Potato} per day is minted by the contract and given to the
              REF pool.
            </li>
            <li>2500 {Potato} per day is farmed from the pixel board.</li>
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
          <p>
            Planning to introduce $DACHA token, which will act like a Skyward
            Treasury and be entitled the full revenue generated by the contract.
            <br />
            The contract makes revenue by supplying (selling) {Potato} to the
            REF pool and from contract gas rewards.
          </p>
          <p>
            There may or may not be an airdrop of $DACHA token for the early
            users of dacha finance based on the number of {Potato} farmed and
            the number of {Potato} planted. <br />
            Enjoy!
          </p>
        </div>
      </div>
    );
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
                  1Ⓝ ={" "}
                  {this.state.refPool.potato
                    .mul(1000000)
                    .div(this.state.refPool.near)
                    .toFixed(3)}
                </span>
              </span>
              {Potato}
            </div>
            <div>
              Circulating supply:{" "}
              <span className="balances">
                <span className="font-weight-bold">
                  {this.state.totalSupply.div(Big(10).pow(18)).toFixed(2)}
                  {Potato}
                </span>
              </span>
            </div>
          </div>
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
        {this.rules()}
        {/*<div className={`padded${watchClass}`}>*/}
        {/*  {this.state.signedIn ? (*/}
        {/*    <div>*/}
        {/*      <iframe*/}
        {/*        title="irc"*/}
        {/*        className="irc"*/}
        {/*        frameBorder="0"*/}
        {/*        src={`https://kiwiirc.com/client/irc.kiwiirc.com/?nick=${this.state.ircAccountId}#berryclub`}*/}
        {/*      />*/}
        {/*    </div>*/}
        {/*  ) : (*/}
        {/*    ""*/}
        {/*  )}*/}
        {/*</div>*/}
        {/*<div className={`padded${watchClass}`}>*/}
        {/*  <div className="video-container">*/}
        {/*    <iframe*/}
        {/*      title="youtube3"*/}
        {/*      className="youtube"*/}
        {/*      src="https://www.youtube.com/embed/wfTa-Kgw2DM"*/}
        {/*      frameBorder="0"*/}
        {/*      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"*/}
        {/*      allowFullScreen*/}
        {/*    />*/}
        {/*  </div>*/}
        {/*</div>*/}
        {/*<div className={`padded${watchClass}`}>*/}
        {/*  <div className="video-container">*/}
        {/*    <iframe*/}
        {/*      title="youtube2"*/}
        {/*      className="youtube"*/}
        {/*      src="https://www.youtube.com/embed/PYF6RWd7ZgI"*/}
        {/*      frameBorder="0"*/}
        {/*      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"*/}
        {/*      allowFullScreen*/}
        {/*    />*/}
        {/*  </div>*/}
        {/*</div>*/}
        {/*<div className={`padded${watchClass}`}>*/}
        {/*  <div className="video-container">*/}
        {/*    <iframe*/}
        {/*      title="youtube"*/}
        {/*      className="youtube"*/}
        {/*      src="https://www.youtube.com/embed/lMSWhCwstLo"*/}
        {/*      frameBorder="0"*/}
        {/*      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"*/}
        {/*      allowFullScreen*/}
        {/*    />*/}
        {/*  </div>*/}
        {/*</div>*/}
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
    account.potatoPixels > 0 ? (
      <span>
        {"(+"}
        <span className="font-weight-bold">{account.potatoPixels}</span>
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
