# Motion Atlas — Project Specification

Motion Atlas 是以動畫展示、即時預覽、參數調整及動畫技術探索為核心的互動式網站。

本文件是專案的主要依據：

| 部分 | 章節 | 內容 |
| --- | --- | --- |
| 固定原則 | 1–4 | 技術、設計、動畫品質與驗收要求，所有工作都必須遵守 |
| 擴充架構 | 5–6 | 目錄、介面與新增作品的方式 |
| 目前內容 | 7–8 | 網站與作品的現況、已知限制 |
| 變更紀錄 | 9 | 各階段的交付摘要 |
| 未來階段 | 10 | 新需求寫在這裡；完成後更新第 7、8 節，並在第 9 節加一筆紀錄 |

開始任何工作前，先檢查現有程式與本文件；已存在的功能優先沿用並補足，不重複建立、不無必要地重構。

---

## 1. Technical Constraints

- Vue 3、TypeScript、Composition API、`<script setup lang="ts">`
- Vue Router、Vite、Sass
- 依分類決定渲染技術：
  - **基礎動態、文字動態**：CSS / Web Animations API / SVG；需要立體效果時使用 CSS 3D Transform（`preserve-3d` + `perspective`），不使用 Three.js
  - **建築動態**：Three.js（即時 3D 場景、攝影機、材質與光線）
- Three.js 只在進入建築場景時延遲載入，不得被首頁或其他分類靜態引用
- 狀態管理優先使用 Vue Reactivity；只有實際出現跨頁面共享狀態需求時，才引入額外套件
- 禁止引入 React、React Three Fiber，或以其他框架取代既定技術
- 不使用外部圖檔素材；紋理以程式產生

---

## 2. Design System

沿用既有設計系統，不另行建立第二套。

- **主題**：Light / Dark 切換，預設跟隨系統並記住選擇；UI 色彩使用 `src/styles/main.scss` 的 `--ui-*` 變數。
- **動畫預設色票**：`#cfc1ab`、`#6a6b65`、`#354449`、`#efe9db`、`#a89985`（`src/data/motion.ts` 的 `DEFAULT_COLORS`，舞台中為 `--c1` ~ `--c5`）。
- **場景專屬色票**：個別場景可使用獨立配色，但不得覆蓋網站全域主題色彩。
- **響應式**：Desktop、Tablet、Mobile 皆可操作，不得產生水平捲動。
- **平面優先**：以 2D 為預設；基礎動態與文字動態需要空間深度或立體形變時使用 CSS 3D Transform，Three.js 只用於建築動態。不需要陰影的動畫不加陰影。
- **3D 寫實材質**：3D 作品（`dimension: '3d'`）使用接近真實的材質表現：
  - Three.js：`MeshStandardMaterial`／`MeshPhysicalMaterial`（PBR），設定 roughness、metalness；紋理取自 `src/three/textures.ts`；Motion 設定 `toneMapping`（ACES）與 `environment`（共用環境光照貼圖）。
  - CSS 3D：以 `css3d.ts` 的 `surface(color, 'matte' | 'metal')` 表現霧面烤漆（顆粒、倒角）與髮絲紋金屬；球體以多層漸層表現鏡面高光、明暗交界與地面反光，並加接觸陰影。數值為設計 px，倒角與陰影維持在 1px 以下，避免放大後模糊。
- **網站結構**：Header（橫式標誌、分類導覽、主題切換）、Footer（標誌符號、品牌色票、品牌識別連結）、首頁、作品詳細頁、品牌識別頁（`/brand`）。

### 品牌識別（CIS）

品牌的單一來源為 `src/data/brand.ts`（理念、標誌構成、色票、字體、動態規範），標誌元件與品牌頁都從這裡讀取；完整規範呈現在 `/brand`。新增或修改任何品牌元素時，先改 `brand.ts`，不可在頁面中另行定義。

- **理念（MI）**：Motion Atlas（動態圖鑑）以動畫十二法則為座標，為網頁上的動態繪製可探索、可調整的地圖。關鍵字：精準（Precision）、律動（Rhythm）、溫度（Warmth）。
- **標誌符號**：地球儀（Atlas）與環繞的小星（Motion），以 32 單位方格繪製——地球半徑 9、赤道短半徑 2.7；軌道 13.5 × 4.5（地球的 1.5 倍與 0.5 倍）、傾斜 -18°；小星前方半徑 2、後方 1.5；線寬 1.5 / 0.9 / 0.8。
- **標準字**：Motion 700、Atlas 400 的字重對比，字距 -0.01em；符號高度為字級的 1.75 倍。中文名稱「動態圖鑑」用於直式組合。
- **組合**：`site-logo.vue` 的 `variant`——`symbol`（網站圖示、Footer）、`horizontal`（Header）、`stacked`（品牌頁）；`tone`——`auto`（隨主題）、`positive`（淺底）、`reversed`（深底）；`animated` 控制是否播放。
- **淨空區與最小尺寸**：四周保留小星直徑（4 單位）；最小尺寸符號 16px、橫式 96px 寬。
- **色彩**：沿用動畫預設色票並命名——墨青 `#354449`（主色）、砂岩 `#cfc1ab`（強調）、象牙 `#efe9db`（基底）、石墨 `#6a6b65`（輔助）、陶土 `#a89985`（點綴）；CSS 變數為 `--brand-*`，標誌用色為 `--logo-*`（正向版與反白版）。
- **動態**：品牌緩動 Atlas Ease `cubic-bezier(0.45, 0, 0.55, 1)`（`--brand-ease`），互動回饋 Atlas Spring（`--spring`）；標誌經線往返 3 秒、小星環繞 3.6 秒（5 : 6 錯落），小星在軌道兩端減速、繞到後方時被遮住；`prefers-reduced-motion` 或 `animated: false` 時停在小星位於前方的靜止畫面。
- **使用規範**：不可變形、改色、旋轉、加效果或侵入淨空區；淺色背景用正向版、深色背景用反白版；印刷與靜態圖片使用靜態版本。Favicon 為同構成的靜態符號（`index.html` 內嵌 SVG，小尺寸加粗線條）。

### 進場、退場與過場

控制邏輯在 `src/router/transitions.ts`，樣式在 `src/styles/transitions.scss`；速度以 Atlas Ease 與 Atlas Spring 為主。順序為「目前頁面即時退場 → 共用元素過場 → 新頁依序進場」，不讓整頁快照與新頁的動畫重疊（重疊會在新頁掛載時卡頓）。

- **首次進場**（`playIntro()`，`html.is-intro`）：Header 由上方滑入，標誌符號以彈簧放大、軌道沿路徑描繪、標準字淡入，接著頁面內容依序浮現。
- **頁面進場**：需要依序浮現的元素加上 `.reveal`，以 `--i` 指定順序（每階 60ms）；首頁卡片依位置交錯（第 12 張之後同時出現）。共用元素（預覽、標題）不加 `.reveal`。
- **退場**（`leave()`，換頁前在目前頁面即時演出，結束後才換頁）：以 `.is-leaving` 與元素上的 `data-leaving`、`--leave` 順序驅動 CSS 動畫，不持有 JS 動畫物件（避免留住舊頁元素與其中的 3D 場景）；動態區塊（`data-leave="shrink"`：首頁卡片、詳細頁的預覽、即時資訊與設定面板、品牌頁的標誌組合）縮小到 0.88 並淡出，其餘 `.reveal` 文字上移淡出；每個 220ms、依序間隔 15ms（最多 6 階），加速曲線離開。只處理畫面內可見的元素，共用元素（被點選的卡片、返回時的詳細頁預覽）不退場、留給過場變形。新頁渲染後移除標記（同一元件內換頁時元素會被沿用）。
- **過場**（View Transitions API，於 `router.beforeResolve` 啟動、`afterEach` 渲染後結束）：整頁快照不再淡化（舊頁已退場），新頁直接出現並由 `.reveal` 依序浮現；
  - `open` / `close`：卡片預覽與標題（`sharedMotion` 指定的卡片掛上 `view-transition-name: motion-stage / motion-title`）連續變形為詳細頁的預覽與標題，返回時反向；返回時還原捲動位置，讓共用元素回到原卡片。
  - `next` / `prev`：詳細頁的上一件、下一件，新頁往行進方向滑入；此時詳細頁預覽不做共用元素變形，隨整頁滑動。
  - `page`：其他頁面之間，只有退場與進場。
  - Header（`view-transition-name: site-header`）不參與過場；只改變篩選條件（query）時不換頁、不過場。
- 不支援 View Transitions 的瀏覽器同樣有退場與進場，只是沒有共用元素變形。
- **捲動**：換頁回到頂端，返回時還原原本的位置。
- `prefers-reduced-motion` 時不做首次進場、頁面進場與過場。

### 卡片

- 整體寬高比 3:2，預覽區背景完整填滿。
- 左上角順序編號、持續運作的預覽、標題、分類與標籤。
- 所有列表使用同一張卡片元件 `motion-card.vue`。

### 作品詳細頁

- 由上而下：標題列（返回、編號、名稱與英文名稱；右側為「即時資訊」「動態設定」「放大」按鈕）→ 動態預覽 → 說明區（操作提示、說明、分類與技術、標籤、主要原則）→ 上一件、下一件。說明與標籤放在預覽下方，讓預覽能放大顯示。
- 預覽滿版寬度，高度最多填滿視窗中扣除 Header 與標題列的空間（`max(320px, 100svh - 190px)`）。
- 「放大」：以瀏覽器全螢幕顯示預覽（`requestFullscreen`），不支援元素全螢幕時改為覆蓋整個視窗並鎖住頁面捲動；以 Esc 或右上角「結束放大」結束，離開頁面時一併結束。預覽依新尺寸重新縮放。
- 「即時資訊」「動態設定」使用 `aria-expanded`、`aria-controls`，兩個面板預設收合且不掛載，收合時停止讀取診斷數據；切換上一件、下一件時維持目前的展開狀態。即時資訊展開在預覽下方。
- 動態設定在 Desktop 展開於右側（左右 3:2），面板停在固定 Header 下方（`position: sticky`），內容過長時在面板內捲動；900px 以下改為接在預覽下方，展開時平滑捲動到面板。
- 播放／暫停／重設位於即時資訊面板內。
- 預覽區靠上對齊，底色填滿。
- 只顯示該作品真正支援的控制項，每個控制項都必須連結到實際動畫行為。

### 搜尋與篩選

名稱、描述搜尋，以及分類、技術、2D / 3D、標籤篩選；可同時使用、即時更新，提供清除條件與無結果狀態。條件同步到網址（`q`、`category`、`tech`、`dim`、`tags`）。

- 首頁預設只顯示搜尋欄與「篩選」按鈕，分類、技術、標籤三組篩選收合（`aria-expanded`、`aria-controls`）；已套用條件時按鈕顯示條件數量（搜尋文字不計），結果數量與「清除條件」維持顯示。網址帶有條件進入時同樣維持收合。

---

## 3. Animation Principles and Motion Quality

所有動畫依實際用途遵循動畫十二項原則：Squash and Stretch、Anticipation、Staging、Straight Ahead and Pose to Pose、Follow Through and Overlapping Action、Slow In and Slow Out、Arcs、Secondary Action、Timing、Exaggeration、Solid Drawing、Appeal。

- 不要求每個動畫使用全部原則，但須在 Metadata 的 `animationPrinciples` 記錄主要使用的原則。
- 速度、緩動、慣性、彈性與阻尼須符合設計目的；簡單的 UI 動畫不強制加入重力或複雜物理，需要真實回饋的動態才採用物理模型。
- 不依賴固定影格位移，使用時間差或原生動畫機制，避免不同裝置影格率造成速度差異。
- 動畫須持續循環、自然銜接，不留下殘影、錯誤透明度或錯誤位置。
- 不可為了增加數量而建立本質相同的動畫；只改顏色、持續時間、方向或單一參數不構成新作品。不可用佔位卡片、靜態圖或重複的 Preset 湊數。

---

## 4. Quality Requirements

- TypeScript 檢查與正式建置（`npm run build`）必須通過。
- 不得有 Console Error。
- 不得因反覆進入詳細頁而建立重複的動畫迴圈、Renderer 或持續增加的記憶體。
- 元件卸載時釋放 Renderer、Scene、Geometry、Material、Texture、事件監聽、動畫迴圈與 Resize Observer。全站共用的資源（WebGL renderer、環境光照貼圖、程序紋理）只建立一次、數量固定，不隨進出頁面增加。
- 首頁避免同時執行過多高成本動畫：不可見的預覽暫停、卡片中的 3D 預覽降頻；詳細頁的主要動畫保持正常運作。
- 診斷數據必須來自實際運作的動畫；沒有可辨識 keyframe 時顯示替代資訊，不製造假數值。
- 不得將未實作、未測試或未取得素材的功能宣稱為已完成。
- 依文獻或照片建模的內容須記錄來源與藝術化補充的部分；未經驗證不得宣稱精確比例或還原。

---

## 5. Extension Architecture

所有作品由本地 Metadata 驅動：首頁、搜尋、篩選、路由與詳細頁都從註冊表自動產生。**新增作品時不應修改首頁、搜尋、篩選或詳細頁的核心程式。**

### 5.1 Directory Structure

```
src/motions/
├── registry.ts          # 註冊表：CATEGORIES 與 MOTIONS，ID 重複時丟出錯誤
├── core/                # 共用核心（新增作品時通常不需修改）
│   ├── types.ts         # MotionMeta、MotionParams、ControlKey、MotionInstance、MotionDiagnostics
│   ├── params.ts        # 預設參數 BASE_PARAMS、withDefaults()、Easing 預設值
│   ├── principles.ts    # 十二項原則的 ID 與名稱
│   ├── easing.ts        # cubic-bezier 與彈簧緩動（CSS linear() / JS 函式）
│   ├── controllers.ts   # waapiGroup()、rafClock()、timing()、directedProgress()
│   ├── dom.ts           # createDomStage()、el()、svg()、PALETTE
│   ├── scene.ts         # domScene()、shape()、ground()：2D 幾何動畫
│   ├── css3d.ts         # css3dScene()、Node3D、cube()、plane()、shade()、surface()：CSS 3D 動畫與表面材質
│   └── webgl.ts         # webglModule()：將 Three.js 場景包裝成統一生命週期（僅建築動態）
├── basic/               # 分類：基礎動態（index.ts 為 Metadata，basic-2d.ts 為 2D 實作）
├── basic3d/             # 基礎動態的 3D 場景（CSS 3D Transform）
├── typography/          # 分類：文字動態（Preset 引擎、keyframes、獨立模組）
└── architecture/        # 分類：建築動態（tainan-station.ts 場景、trains.ts 列車模型、sky.ts 天空與日月、scene-clock.vue 時間標籤）

src/three/
├── renderer.ts          # 全站共用的 WebGL renderer：可見性、降頻、色調映射、共用環境光照貼圖
├── stage.ts             # createStage()、Motion 介面、CameraHandle
├── textures.ts          # 程序紋理 getTextures()（全站共用一組）與 projectUV()
├── physics.ts           # 彈簧物理 Body（純 TS，各分類共用）
└── timeline.ts          # keyframes()、cubicBezier()、loop()、alternate()（純 TS，各分類共用）

src/data/                # DEFAULT_COLORS、Bezier 型別、彈簧緩動、brand.ts（品牌識別的單一來源）
src/stores/              # theme（Light / Dark）、palette
src/router/              # 路由、舊網址導向、捲動行為與換頁過場（transitions.ts）
src/components/          # motion-preview、motion-card、controls-panel、diagnostics-panel、bezier-editor、site-logo
src/views/               # home（作品網格＋搜尋篩選）、motion（詳細頁）、brand（品牌識別）、error
```

### 5.2 Metadata（`MotionMeta`）

每個作品必填：

| 欄位 | 說明 |
| --- | --- |
| `id` | 穩定且全站唯一，用於網址 `/motion/:id`；改名時維持 id 不變 |
| `title` / `titleEn` / `description` | 名稱與說明，供搜尋 |
| `category` | 所屬分類（`Category`） |
| `tags` | 標籤，供篩選（文字動態第一個標籤為十種分類之一） |
| `renderMode` | `css`、`svg` 或 `webgl` |
| `dimension` | `2d` 或 `3d` |
| `technique` | 主要技術，供篩選（例如 Web Animations API、Three.js） |
| `implementation` | `preset` 或 `standalone` |
| `previewConfig` | 設計尺寸 `{ width, height }`，預覽時等比縮放 |
| `supportedControls` | 支援的控制項（`ControlKey[]`） |
| `animationPrinciples` | 主要使用的原則 |
| `route` | `/motion/${id}` |
| `defaults` | 以 `withDefaults({...})` 產生的完整預設參數 |
| `load` | 延遲載入實作，回傳 `MotionModule`；Metadata 本身不包含 Three.js 實例或大型物件 |

### 5.3 Lifecycle（`MotionModule` / `MotionInstance`）

實作匯出 `MotionModule`，其 `create(context)` 回傳：

```ts
interface MotionInstance {
  play(): void
  pause(): void
  reset(): void
  resize(width: number, height: number): void
  update(params: MotionParams): void   // 參數改變時套用，並保留目前播放位置
  diagnostics(): MotionDiagnostics       // 播放狀態、進度、輪次、keyframe 或替代說明
  dispose(): void                        // 釋放所有資源與監聽
  overlay?: MotionOverlay                // 疊在預覽上的 CSS 元件（選用）
  camera?: { reset(); setAutoRotate(enabled) }  // 3D 鏡頭（選用）
}
```

`motion-preview.vue` 負責建立、尺寸、可見性暫停與釋放；作品本身只需實作上述介面。

Three.js 場景另外實作 `Motion`（`src/three/stage.ts`），由 `webglModule()` 包裝成 `MotionInstance`：

| 欄位 | 說明 |
| --- | --- |
| `scene` / `camera` / `timeline` | 場景、相機與主要動作的時間軸（keyframe 分頁） |
| `update(time, ease)` | 每格更新，`time` 為場景秒數 |
| `controls?(element)` | 鏡頭操作，回傳 `CameraHandle` |
| `diagnostics?(time)` | 自訂進度或說明（例如場景時間） |
| `overlay?` | 疊在 canvas 上的 CSS 元件 |
| `toneMapping?` | `{ exposure }`：以 ACES 色調映射輸出，寫實材質使用 |
| `environment?` | `true` 時使用共用環境光照貼圖，強度由 `scene.environmentIntensity` 調整 |
| `physics?` / `poke?` | 彈簧物理與點擊衝量 |

`createStage({ mode, ground, ... })` 建立相機、燈光與材質；`ground: 'none'` 不建立接收陰影的地面（漂浮場景）。`stage.dispose()` 釋放場景內的 Mesh、Line、Points。

### 5.4 Implementation Selection

新增動畫時依序判斷：

1. **Preset**：現有 Preset 引擎能完整表達 → 加入 keyframes 與設定。
2. **Standalone（Web Animations）**：需要多階段、多物件協同或特殊時間軸 → `domScene()` 或 `waapiText()`。
3. **Standalone（逐幀）**：需要逐幀計算（字元變換、物理模擬、連續函數）→ `rafText()` / `rafClock()`，診斷不回報 keyframe。
4. **CSS 3D**：基礎或文字動態需要立體結構、空間深度 → `css3dScene()`（基礎動態）或 CSS 3D Transform（文字動態）。
5. **Three.js**：僅限建築動態 → 匯出 `MotionFactory`，以 `webglModule()` 包裝。

不可為了重用而把複雜動畫簡化成缺乏辨識度的效果。

### 5.5 Controls（`ControlKey`）

| 控制項 | 參數 | 適用 |
| --- | --- | --- |
| `duration` | `duration` | 所有動畫；建築動態為時間倍率，介面標示為「發車間隔（秒）」 |
| `delay` | `delay` | 有開始延遲的動畫 |
| `repeat` | `iterations` | 可設定播放次數的動畫 |
| `direction` | `direction` | 支援播放方向的動畫 |
| `easing` | `easing` | 使用 cubic-bezier 的動畫（預設值清單） |
| `cubicBezier` | `easing` | 使用 cubic-bezier 的動畫（編輯器） |
| `amplitude` | `amplitude` | 位移、旋轉、縮放幅度可調的動畫 |
| `stiffness` / `damping` / `mass` | 同名 | 彈簧緩動或物理回饋的動畫 |
| `camera` | `autoRotate` | 可操作鏡頭的 3D 場景 |
| `text` | `text` | 可替換示範文字的文字動畫 |

新增控制項時：在 `ControlKey` 與 `MotionParams` 加入欄位、在 `BASE_PARAMS` 給預設值、在 `controls-panel.vue` 加入介面，並確保動畫的 `update()` 實際讀取該參數。

---

## 6. How to Extend

### 6.1 新增基礎動態

1. 2D：在 `src/motions/basic/basic-2d.ts` 以 `domScene()` 匯出新動畫（舞台 150 × 100，使用 `shape()` 建立物件、`cssEasing(params)` 取得緩動、`timing(params)` 取得時間設定）。
2. 3D：在 `src/motions/basic3d/scenes.ts` 以 `css3dScene(floorY, build)` 匯出（座標為設計 px、y 向上、原點在地面中心），以 `node()` 建立物件、`cube(parent, size, colors, radius, finish)` / `plane()` 建立面、`surface()` 設定材質、`shade()` 模擬受光；需要點擊物理回饋的物件以 `node(parent, pose, true)` 註冊。不使用 Three.js。
3. 在 `src/motions/basic/index.ts` 的 `ENTRIES` 加入一筆：id、名稱、說明、標籤（動態類型與物件）、原則、預設參數、控制項、`source`。

### 6.2 新增文字動態

1. Preset：在 `typography/effects.ts` 加入 keyframes（CSS 寫法：px、y 向下、順時針為正），在 `typography/index.ts` 加入一筆 `preset({ text, split, animation, stagger, order, origin, size, variant, spring })`。
2. 獨立模組：在 `typography/standalone/` 以 `waapiText()` 或 `rafText()` 實作，在 `index.ts` 以 `standalone(() => import(...))` 註冊。
3. `group` 必須是十種分類之一：Entrance、Exit、Emphasis、Transform、Reveal、Stagger、Kinetic、Loop、Elastic、Distortion。
4. 新增後確認與現有作品的動作機制有實質差異。

### 6.3 新增建築場景

1. 在 `src/motions/architecture/` 新增場景檔，匯出 `MotionFactory`：`createStage({ mode: '3d', ground: 'none', ... })`，提供 `timeline`、`update(time, ease)`、`controls(element)`（回傳 `CameraHandle`）、`diagnostics(time)`、`overlay`，並設定 `toneMapping` 與 `environment`。
2. 在 `architecture/index.ts` 加入 Metadata，`load: () => Promise.all([import('../core/webgl'), import('./xxx')]).then(([{ webglModule }, m]) => webglModule(m.default))`。
3. 場景須包含：可辨識的建築特徵、持續運作的環境動畫、平滑的時間或光照變化、滑鼠與觸控鏡頭操作（限制不合理角度與穿透建築）。
4. 以可信的歷史照片、建築資料或地理資訊為建模參考，並記錄來源與藝術化補充的部分。
5. **漂浮島表現形式**（建築動態的統一風格）：
   - 島頂為圓形平台（y = 0），以該城市代表建築為中心，周圍配置能代表城市的**意象、人文、歷史、美食與城市美學**元素（地標、街景、小吃、在地植物、生活場景）。
   - 島身為分層的土壤剖面與往下收窄、邊緣參差的岩石底部，垂掛根鬚與藤蔓；周圍有環繞的雲朵、碎石或飛鳥，整座島緩慢上下漂浮。島上物件放在同一個群組內，隨小島一起漂浮。
   - 鏡頭可 360 度環繞並從島底仰望（極角約 8°～172°），以最小距離與平移範圍確保鏡頭始終在小島外側；詳細頁預設自動環繞（`autoRotate: true`），卡片預覽沒有鏡頭操作時由小島自行緩慢旋轉。雲朵靠近鏡頭時淡出，避免遮住畫面。
6. **材質**：以 `getTextures()` 取得共用紋理，透過 `textured(color, set, tile)` 建立材質並以 `projectUV()` 依世界尺寸鋪設；金屬、玻璃、烤漆以 roughness / metalness 區分，車身等烤漆可用 `MeshPhysicalMaterial` 的 clearcoat。共用紋理不在場景中 dispose。

### 6.4 新增分類

1. `core/types.ts` 的 `Category` 加入新 ID。
2. 建立 `src/motions/<category>/index.ts`，匯出 `MotionMeta[]`。
3. `registry.ts` 的 `CATEGORIES` 加入名稱與說明，`MOTIONS` 合併新清單。

Header 導覽、首頁篩選、搜尋、路由與詳細頁會自動納入，不需修改頁面元件。

### 6.5 驗證新增項目

- `npm run build` 通過，無 Console Error。
- 首頁卡片、詳細頁、搜尋與篩選皆能找到新作品。
- 詳細頁每個顯示的控制項都能改變動畫；診斷數據隨播放更新。
- 反覆進出詳細頁不會累積動畫、canvas 或 Three.js 物件。
- 1280、820、390 px 寬度無水平捲動。

---

## 7. Current Content

### 7.1 網站

- 首頁作品網格（121 件），名稱與描述搜尋，分類、技術、2D / 3D、標籤篩選（預設收合），條件同步網址，清除條件與無結果狀態。
- 作品詳細頁 `/motion/:id`：預覽、即時資訊（FPS、Frame Time、Progress、Keyframe、Playback、Rendering）、播放／暫停／重設、只顯示支援的控制項；即時資訊與動態設定預設收合（見第 2 節）。
- 品牌識別頁 `/brand`：理念、標誌組合（橫式、直式、符號 × 正向版、反白版）、構成方格、淨空區與最小尺寸、色彩、字體、動態規範與使用規範。
- Header（動態標誌）、Footer（品牌識別連結）、Light / Dark Theme、響應式版面；舊網址 `/basic`、`/text`、`/typography`、`/architecture`、`/:category/:id` 自動導向。

### 7.2 基礎動態（20 件）

- 2D（Web Animations API / SVG）17 件：位移、旋轉、縮放、透明度、色彩轉換、彈跳（重力與反彈係數計算）、彈性（彈簧緩動）、搖晃（衰減震盪）、脈動、環繞、路徑、交錯、形狀變形、無限循環、跟隨動作、線條描繪、預備跳躍。
- 3D（CSS 3D Transform）3 件，點擊預覽給予物理衝量：
  - 立體球體彈跳：烤漆球的鏡面高光、明暗交界、地面暖色反光，落地時的接觸陰影。
  - 立方體翻滾：霧面烤漆的細微顆粒與邊緣倒角。
  - 陀螺儀：錐形漸層的拋光金屬環、髮絲紋金屬核心。
- 涵蓋 Position / Translation、Rotation、Scale、Opacity、Color Transition、Bounce、Elastic Motion、Shake、Pulse、Orbit、Path Motion、Stagger、Shape Morphing、Loop、Follow Through；物件包含圓形、球體、正方形、矩形、三角形、多邊形、線條與環形。

### 7.3 文字動態（100 件）

| 分類 | 數量 | 分類 | 數量 |
| --- | --- | --- | --- |
| Entrance | 10 | Stagger | 10 |
| Exit | 10 | Kinetic | 10 |
| Emphasis | 10 | Loop | 10 |
| Transform | 10 | Elastic | 10 |
| Reveal | 10 | Distortion | 10 |

- Preset 86 件、獨立模組 14 件（打字機、亂碼解碼、描邊書寫、分行揭示、換字輪播、堆疊標題、穿越縮放、環形文字、翻牌看板、立體換字、液態波浪、彈簧拖曳、切片錯位、波形扭曲）。
- 支援示範文字替換；彈性類以剛性、阻尼與質量產生彈簧緩動。
- 以 keyframe 曲線比對檢查相似度，相近的組合已重新設計，剩餘相近者在單位、順序、基準點或圖形互動上有差異。

### 7.4 建築動態：台南漂浮島（1 件）

id 為 `tainan-station`（網址 `/motion/tainan-station`），實作於 `architecture/tainan-station.ts` 與 `trains.ts`。

**島身與環境**

- 島半徑 13：草皮、土壤、砂岩、深色土層的分層剖面（沿圓周起伏），往下收窄、頂點色漸變的參差岩石底部與鐘乳狀岩柱，隨風擺動的根鬚與藤蔓；整座島緩慢上下漂浮、輕微傾擺。
- 環繞的雲朵、漂浮碎石，白天出現、入夜歸巢的白鷺鷥；從下方打亮岩石的反光。
- 24 小時日夜（1 秒 = 1 小時，每天換一個季節）與台南氣候的四季：春木棉、夏鳳凰花與芒果盛產並有午後雷陣雨、秋乾燥、冬季薄霧與較低日照。雨落在島頂，島外的雨落到島下。左上角疊加時間與季節標籤（`scene-clock.vue`，日夜由場景提供）。
- 天空（`sky.ts`）：漸層穹頂（天頂、地平線、地平線以下的雲海）跟著鏡頭移動；太陽圓盤與光暈、月亮（月海明暗）與星空。日月以 `celestialDirection()` 由東經南方天空到西，低於地平線時被地平線遮住，看得到升起與落下。
  - 日出、日落時刻與太陽中天高度依季節變化（取四、七、十、一月中旬的台南近似值：春 05:36–18:20、77°；夏 05:15–18:50、88°；秋 05:55–17:40、59°；冬 06:40–17:35、46°），換季時於深夜漸變。
  - 天色依「太陽時」（日出 = 6 時、日落 = 18 時）取樣，晝長改變時天色仍與日照同步；日出日落時地平線最暖、太陽圓盤偏橘紅且較暗，高掛時接近白色。
  - 月亮以滿月表示，與太陽相對：日落後約 30 分鐘升起、日出後約 30 分鐘落下，中天高度與太陽相反（冬季的滿月高、夏季的滿月低）；月光為另一盞不投影的平行光。
  - 直射陽光只在太陽升到地平線上後出現，陰影隨太陽方向移動；星空在夜晚浮現並緩慢轉動，霧與雨會遮蔽星空與日月。

**地標（歷史）**

- 台南舊火車站（島中心）：依文獻為 1936 年落成的二層樓鋼骨鋼筋混凝土建築、折衷主義；門廊三個圓拱門；正面七扇圓拱長窗，中間三扇由四根壁柱框起；長窗上方圓鐘（指針隨場景時間走動）；平頂小山形壁；上部白色方磚、下部人造石腰牆。
- 赤崁樓：荷蘭時期普羅民遮城的紅磚基座上，清代興建的兩座二層、重簷樓閣（以四角起翹的屋面簡化表現）。
- 林百貨：1932 年開幕的五層樓百貨，裝飾藝術風格，屋頂有末廣社神社與鳥居。
- 安平古堡：荷蘭時期熱蘭遮城的紅磚城垣，上方為白色瞭望塔與飄動的旗幟。

**城市、人文與美食**

- 運河從安平一側流向島緣，在島緣（草皮層的實際半徑）截止，越過石砌堰口與兩側大石後落下成瀑布：水幕、水滴沿同一條拋物線（水平初速 + 重力加速）展開並逐漸變寬，水流條紋往下捲動，下方散成水霧；運河上有拱橋與往返的小船。
- 沿島緣排列的騎樓街屋與直立招牌，夜晚窗戶亮燈；站前廣場、圓環與繞行的機車；路燈與紅燈籠。
- 夜市攤車：條紋帆布遮棚、招牌燈泡、擔仔麵攤的紅燈籠、圓桌與板凳；湯鍋熱氣在清晨（牛肉湯早餐）與傍晚到深夜（夜市）最旺。
- 鳳凰木（傘狀樹冠、依季節開花與飄落花瓣）、芒果園（夏季結果）、島緣灌木與九重葛；「空氣中的糖分」金色微光（台南小吃偏甜）。
- 行人在廣場、夜市與林百貨前散步，並沿步道往返圓環與島緣觀景台。

**環島鐵道與觀光列車**

- 軌道為沿島嶼最外圍的圓形（半徑 12.2），月台在島緣後方（`PLATFORM_DEG`），跨越運河出口處設鐵道橋；平交道設在通往伸出島緣的木造觀景台的步道上（`CROSS_DEG`）。
- 平交道的安全規則（`CROSSING`，場景秒數）：每格預測各列車未來數秒的位置（`headAt()`），以時間而非距離判斷，因此發車間隔或緩動曲線改變時仍保有相同的警示時間。
  - 列車抵達前 3.2 秒警示燈閃爍；行人不再進入危險區（柵欄之間），停在停止線等候。
  - 列車抵達前 2.2 秒柵欄放下（彈簧物理回彈），柵欄長度橫跨整條步道；車尾通過 0.5 秒後才升起、警示解除。
  - 警示開始時已在危險區內的行人加快腳步（2.2 倍）離開。
  - 行人靠右通行，每人固定內側或外側車道，掉頭時換到另一側，彼此不重疊。
  - 診斷資訊在警示期間顯示「平交道警示中」。
- 四列台鐵觀光列車（各三節）以四分之一圈的間隔同時行駛；每個週期（發車間隔，預設 12 秒）全體前進四分之一圈，依序由山嵐號、海風號、鳴日號、藍皮解憂號輪流停靠月台，緩動曲線作用在出站與進站的加減速。診斷資訊顯示場景時間、季節與月台上的列車。
  - 山嵐號（淡黃綠）、海風號（薄荷綠）：EMU500 改裝電聯車。方正車體、側面水平壓紋、黑框圓角側窗與門窗；車頭平整、三扇圓角窗，窗下圓形頭燈與紅色尾燈，車頂前緣雙頭燈，黑色排障器；頭尾兩端皆為駕駛室。
  - 鳴日號：黑色車身、延續莒光號的橘色腰帶與車頂細線、寬幅景觀車窗。
  - 藍皮解憂號：浪漫藍車身、白色腰線、成排小車窗、圓弧車頂與車端門。
  - 夜晚車窗與頭燈亮起，尾燈常亮。

**材質與渲染**

- PBR 材質與程序紋理：車站白色方磚與洗石子腰牆、紅磚、筒瓦、灰泥外牆、木造觀景台與枕木、柏油與道碴、金屬鐵軌、不鏽鋼湯鍋與瓷碗、透明漆層的列車與機車車身、會反射天光的玻璃窗、法線貼圖流動的運河水面、帶紋理的草地、土層、岩石與樹葉。
- ACES 色調映射、共用環境光照貼圖（強度隨日夜與雨天變化）、陰影 bias。

**鏡頭**

- 左鍵拖曳旋轉、滾輪縮放、右鍵拖曳平移；觸控單指旋轉、雙指縮放與平移。可 360 度環繞並從島底仰望，鏡頭不會穿入島身；詳細頁預設自動環繞，可重設視角；環境動畫不受鏡頭操作影響。

**場景色票**：`#CB914A`、`#86A0BB`、`#14233A`、`#B71F24`、`#C0B8B4`。

**參考來源**

- 建築與地標：[臺南車站（維基百科）](https://zh.wikipedia.org/zh-tw/臺南車站)、[Tainan railway station（Wikipedia）](https://en.wikipedia.org/wiki/Tainan_railway_station)、[赤崁樓（維基百科）](https://zh.wikipedia.org/zh-tw/赤崁樓)、[林百貨（維基百科）](https://zh.wikipedia.org/zh-tw/林百貨)、[安平古堡（維基百科）](https://zh.wikipedia.org/zh-tw/安平古堡)、[臺南運河（維基百科）](https://zh.wikipedia.org/zh-tw/臺南運河)。
- 列車：山嵐號、海風號依使用者提供的照片；[鳴日號（微笑台灣）](https://smiletaiwan.cw.com.tw/article/3855)、[藍皮解憂號（天下雜誌）](https://www.cw.com.tw/article/5119916)、[藍皮解憂號（中央社）](https://www.cna.com.tw/news/ahel/202309250197.aspx)。
- 視覺風格：使用者提供的漂浮島插圖（分層土壤剖面、岩石底部、島頂微縮城市）。

**藝術化補充**（並非真實資料）

- 島上配置：各地標的相對位置、環島鐵道與島緣月台、觀景台、運河流向與瀑布。
- 建築：車站兩翼與端棟的開窗數量與比例；赤崁樓、林百貨、安平古堡的比例、細部與開窗數量。
- 列車：鳴日號與藍皮解憂號的牽引機車頭造型、各車比例、車窗數量與編組長度（實車更長）。

---

## 8. Known Limitations

- 100 件文字動畫以自動化檢查與抽樣目視確認，未逐一逐格人工檢視。
- 實機 FPS 未測量：測試環境為軟體渲染，PBR 著色器在軟體渲染下首次編譯較慢。
- 部分效果需較新瀏覽器：`offset-path`、`linear()` 緩動（Chrome 116+、Safari 17.2+、Firefox 112+）。
- CSS 3D 沒有真實光照：立方體以面法向量計算亮度、球體以漸層表現受光，金屬環的反光隨物件一起轉動。文字動態中標記 3D 的作品未套用寫實材質。
- 建築模型依文字資料建模，未以實測圖面或照片比對，未宣稱達成精確比例或特定還原度；建築材質的色彩依文獻描述選用，未經實地比對。
- 紋理為程序產生的近似表現，非實景照片材質；首次產生約 0.3 秒（之後全站共用）。
- 鳴日號、藍皮解憂號依報導描述的配色建模，未取得照片比對；藍皮解憂號目前的牽引車型與塗裝未查證。
- 日出日落時刻與太陽高度為各季中旬的近似值，不隨日期連續變化；日月方位以東升西落、經南方天空簡化，非依天文演算法計算。月亮固定為滿月，沒有月相變化。
- 反覆進出台南漂浮島，離開後存活的 Three.js 物件數量不變，但 JS heap 會小幅上升後趨緩（約 49 → 53 MB），研判為瀏覽器的編譯快取。
- 測試環境（軟體渲染）中，台南漂浮島佔用大量主執行緒，從該頁離開時退場與換頁可能延遲超過 1 秒；實機 GPU 上未量測。

---

## 9. Change Log

| 階段 | 內容 | 驗證 |
| --- | --- | --- |
| Phase 1 | 網站架構、搜尋篩選、詳細頁；基礎動態 20 件、文字動態 100 件、建築動態台南舊火車站（微縮城市、日夜四季、鏡頭操作） | 121 個詳細頁皆實際播放；控制項皆改變動畫；1280、820、390 px 無水平捲動 |
| Phase 2 | 建築動態改為漂浮島形式：島身、赤崁樓、林百貨、安平古堡、運河瀑布、夜市小吃、芒果園；360 度鏡頭；環島鐵道移到島嶼最外圍、島緣月台、鐵道橋與觀景台平交道；`stage.dispose()` 補上 Points 的釋放；`createStage` 新增 `ground: 'none'` | 白天、夜晚、正上方、島底與卡片截圖；進出 6 次 canvas 維持 1 |
| Phase 3 | 3D 寫實材質：`renderer.ts` 色調映射與共用環境光照、`textures.ts` 程序紋理與 `projectUV()`、台南漂浮島 PBR 材質；CSS 3D 的 `surface()`、球體高光與接觸陰影、金屬陀螺儀 | 漂浮島與三件 CSS 3D 作品截圖；進出 6 次無累積 |
| Phase 4 | 環島列車改為山嵐號、海風號、鳴日號、藍皮解憂號（`trains.ts`），四列同時行駛、輪流進站；`duration` 改為「發車間隔」 | 獨立渲染確認車頭、側面、車尾；離開後 Three.js 物件數量不變 |
| Phase 5 | 詳細頁的即時資訊與動態設定預設收合，以預覽下方按鈕展開；單欄版面，動態設定顯示在下方並捲動到面板 | 1280、390 px 確認收合與展開、`aria-expanded`、診斷數據更新 |
| Phase 6 | 平交道安全規則（時間預測、先警示後放下柵欄、停止線等候、危險區內加速離開、靠右分道）；瀑布在島緣截止、石砌堰口與大石、拋物線水幕與流動條紋、水霧；天空穹頂與太陽、月亮升起落下、星空，日出日落依季節變化；診斷資訊的天數修正 | 模擬 300 秒（含 2 倍速與兩組極端緩動），行人與車廂的最小距離 ≥ 0.59，從未重疊；日出、日落、月出、夜晚、瀑布、平交道截圖；離開後 Three.js 物件數量不變 |
| Phase 7 | 詳細頁的展開按鈕移到預覽上方；動態設定在 Desktop 展開於右側（3:2、sticky），窄螢幕接在預覽下方 | 1280、390 px 確認收合與展開、無水平捲動 |
| Phase 8 | 首頁篩選預設收合：搜尋欄旁的「篩選」按鈕展開，按鈕顯示已套用的條件數量 | 1280、390 px 確認預設收合、展開、網址帶條件時的數量顯示，無水平捲動 |
| Phase 9 | 網站 Logo：地球儀與環繞小星的動態標誌（`site-logo.vue`）取代原本的圓點，Favicon 改為同構圖的靜態版本 | 淺色、深色主題多個時間點截圖；減少動態時動畫暫停；Favicon 於 16、64 px 顯示正常 |
| Phase 10 | 品牌識別（CIS）：`brand.ts` 單一來源、標誌構成方格化、標準字字重對比、橫式／直式／符號與正向／反白版、`--brand-*`／`--logo-*` 色彩變數、品牌緩動；新增 `/brand` 品牌識別頁、Footer 品牌連結、theme-color 與 description meta | 淺色、深色、390 px 截圖，無水平捲動；最小尺寸量測（符號 16px）；減少動態時暫停 |
| Phase 11 | 進場、退場與過場：首次進場（Header 滑入、標誌描繪）、頁面內容依序浮現與卡片交錯、View Transitions 的共用元素變形（卡片 ↔ 詳細頁）、上一件／下一件方向滑動、換頁回到頂端與返回還原捲動 | 首次進場、開啟、下一件、上一件、返回的過場皆觸發並截圖確認中間影格；減少動態時全部停用；離開後 Three.js 物件數量不變 |
| Phase 12 | 修正退場卡頓：改為換頁前即時退場（CSS 類別驅動），動態區塊縮小淡出、文字上移淡出（依序、只處理可見元素），整頁快照不再交叉淡化；上一件／下一件只保留滑入 | 開啟、下一件、返回的最長影格 17 ~ 33ms；退場中途截圖確認縮小與共用卡片保留；反覆進出台南漂浮島 8 次（等換頁完成後計數），Three.js 物件數量不變 |
| Phase 13 | 詳細頁：標題與按鈕合併為一列，說明、標籤與原則移到預覽下方，預覽高度填滿可用空間；新增「放大」全螢幕預覽（不支援時改為覆蓋視窗） | 1280、1440、390 px 截圖；預覽由約 585px 提高到 710px 且不超出視窗；全螢幕、Esc 結束、覆蓋視窗與捲動鎖定皆確認；無水平捲動 |

---

## 10. Future Phases

新階段需求寫在此處，格式如下。完成後：更新第 7 節（目前內容）與第 8 節（已知限制），在第 9 節加一筆紀錄，並刪除此處的需求；若改變了原則或架構，同步更新第 1–6 節。

```
### Phase N

**目標**：……

**範圍**：
- [ ] 項目
- [ ] 項目

**驗收條件**：
- ……
```

### Phase 14（待規劃）

尚未定義。
