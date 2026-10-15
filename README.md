# Motion Atlas

以動畫展示、即時預覽、參數調整及動畫技術探索為核心的互動式網站，包含三大分類：

| 分類 | 數量 | 技術 |
| --- | --- | --- |
| 基礎動態 Basic Motion | 20（2D 17、3D 3） | Web Animations API、SVG、Three.js |
| 文字動態 Typography Motion | 100（十種分類各 10） | Web Animations API、SVG、requestAnimationFrame |
| 建築動態 Architectural Motion | 1（台南舊火車站） | Three.js |

## 技術

- Vue 3 + TypeScript（Composition API、`<script setup lang="ts">`）
- Vue Router、Vite、Sass
- Web Animations API / CSS / SVG：2D、文字及介面動畫
- Three.js：即時 3D 場景與 3D 動畫
- 狀態管理使用 Vue Reactivity，未引入額外套件

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 型別檢查（vue-tsc）並打包
npm run preview  # 預覽打包結果
```

## 頁面

| 路徑 | 說明 |
| --- | --- |
| `/` | 首頁：所有作品的卡片網格，支援名稱與描述搜尋、分類、技術、2D / 3D 與標籤篩選，條件會同步到網址（`?q=&category=&tech=&dim=&tags=`） |
| `/motion/:id` | 詳細頁：桌面版左右兩欄 3:2、高度一致，左欄為預覽與即時資訊、右欄為設定；行動版依序為預覽、即時資訊、設定 |

舊網址 `/basic`、`/text`、`/architecture` 與 `/:category/:id` 會導向新的頁面。

## 架構

```
src/
├── app.vue                         # header（分類導覽、主題切換）、頁面、footer
├── motions/
│   ├── registry.ts                 # 註冊表：所有作品的 Metadata、分類、篩選選項
│   ├── core/
│   │   ├── types.ts                # Metadata、參數、生命週期與診斷介面
│   │   ├── params.ts               # 預設參數與 Easing 預設值
│   │   ├── principles.ts           # 動畫十二項原則
│   │   ├── easing.ts               # cubic-bezier 與彈簧（剛性、阻尼、質量）緩動
│   │   ├── controllers.ts          # Web Animations 群組、逐幀時鐘、播放方向
│   │   ├── dom.ts / scene.ts       # 2D 舞台、基本幾何物件
│   │   └── webgl.ts                # 將 Three.js 場景包裝成統一生命週期
│   ├── basic/                      # 基礎動態：Metadata 與 2D 動畫
│   ├── basic3d/                    # 基礎動態：3D 場景
│   ├── typography/
│   │   ├── index.ts                # 100 種文字動畫的 Metadata
│   │   ├── effects.ts              # Preset 的 keyframes
│   │   ├── text-preset.ts          # Preset 引擎（拆字、錯開、遮罩、光澤、倒影等）
│   │   └── standalone/             # 獨立模組（打字機、亂碼解碼、翻牌看板、彈簧鏈等）
│   └── architecture/
│       ├── index.ts                # 建築動態 Metadata
│       ├── tainan-station.ts       # 台南舊火車站場景
│       └── scene-clock.vue         # 場景時間標籤（CSS 疊加層）
├── three/                          # 共用 WebGL renderer、場景、物理與時間軸
├── components/
│   ├── motion-preview.vue          # 預覽：載入模組並管理生命週期、尺寸與可見性
│   ├── motion-card.vue             # 卡片：編號、預覽、標題、分類與標籤（整體 3:2）
│   ├── controls-panel.vue          # 設定：只顯示動畫支援的控制項
│   ├── diagnostics-panel.vue       # 即時資訊：FPS、Frame Time、進度、Keyframe、播放狀態、渲染模式
│   └── bezier-editor.vue           # Cubic Bézier 編輯器
└── views/                          # home、motion（詳細頁）、error
```

### Metadata

每個作品在 `src/motions/*/index.ts` 以 `MotionMeta` 描述：`id`、`title`、`description`、`category`、`tags`、`renderMode`、`dimension`、`technique`、`previewConfig`、`supportedControls`、`animationPrinciples`、`route`、`defaults` 與延遲載入的 `load()`。首頁、搜尋、篩選與路由都由註冊表自動產生，新增作品只需加入一筆 Metadata；註冊表會在 ID 重複時丟出錯誤。

### 生命週期

所有動畫實作 `MotionModule.create(context)`，回傳統一的 `MotionInstance`：`play`、`pause`、`reset`、`resize`、`update(params)`、`diagnostics()`、`dispose()`，3D 場景另提供 `camera`。`motion-preview.vue` 負責建立與釋放，並在預覽離開畫面時暫停。

- **Preset**：一般動畫由共用引擎與參數組成（文字的 `text-preset.ts`）。
- **Standalone**：複合、逐幀或 3D 動畫為獨立模組，仍遵循相同介面。
- **Three.js**：所有場景共用一個 WebGL renderer，再繪製到各自的 canvas；不可見的預覽不繪製，卡片預覽限制為 30 fps。釋放時清除幾何、材質、事件監聽與鏡頭控制。

### 控制項與診斷

- 控制項：Duration、Delay、Repeat、Direction、Easing、Cubic Bézier、Amplitude、Stiffness、Damping、Mass、Camera、文字替換；依 `supportedControls` 顯示，皆直接改變動畫參數。調整參數時會保留目前的播放位置。
- 彈簧類動畫以剛性、阻尼比與質量產生 `linear()` 緩動；3D 場景的物理回饋使用相同參數。
- 診斷：FPS 與 Frame Time 取自實際的繪製迴圈；進度、Keyframe 與播放狀態取自動畫實例（Web Animations 的計算時間或場景時鐘）。逐幀動畫沒有固定 keyframe，會顯示「無」並說明原因。

## 建築動態：台南舊火車站

- **建築**：依文獻建模——1936 年落成的二層樓鋼骨鋼筋混凝土建築，折衷主義風格；門廊三個圓拱門、屋簷浮雕；正面七扇圓拱長窗，中間三扇由四根壁柱框起；長窗上方嵌圓鐘；平頂上有小山形壁；外牆上部白色方磚、下部人造石腰牆；二樓曾為鐵道飯店。兩翼與端棟的開窗數量與比例為藝術化補充。
- **環狀鐵道**：火車環繞車站行駛是微縮城市的藝術設計，並非真實地理配置。列車方向依軌道切線，車廂維持固定間距。
- **平交道**：依列車位置放下柵欄（物理彈簧回彈）並閃爍警示燈，行人在柵欄放下時停步等候。
- **時間與季節**：太陽東升西落、天色與燈光平滑變化；四季依台南氣候：春季木棉、夏季鳳凰花與午後雷陣雨、秋季乾燥、冬季東北季風的乾燥薄霧與較低日照，樹木四季常綠並隨風擺動。
- **鏡頭**：左鍵旋轉、滾輪縮放、右鍵平移；觸控為單指旋轉、雙指縮放與平移。限制俯角、距離與平移範圍，鏡頭維持在屋頂之上。環境動畫不受鏡頭操作影響。
- **配色**：`#CB914A`、`#86A0BB`、`#14233A`、`#B71F24`、`#C0B8B4`，僅用於場景，不影響網站主題色。

參考資料：[臺南車站（維基百科）](https://zh.wikipedia.org/zh-tw/臺南車站)、[Tainan railway station（Wikipedia）](https://en.wikipedia.org/wiki/Tainan_railway_station)。

## 主題與設計系統

- Light / Dark 主題由 header 切換，預設跟隨系統並記住選擇；UI 色彩定義於 `styles/main.scss` 的 `--ui-*` 變數。
- 動畫預設色票：`#cfc1ab`、`#6a6b65`、`#354449`、`#efe9db`、`#a89985`。
- 卡片、預覽區、按鈕使用同一套樣式，hover 與按壓以彈簧曲線回饋。
