# Motion Atlas — Project Specification

Motion Atlas 是以動畫展示、即時預覽、參數調整及動畫技術探索為核心的互動式網站。

本文件是專案的主要依據，分為四部分：

1. **固定原則**（第 1–4 節）：所有階段都必須遵守。
2. **擴充架構**（第 5–6 節）：新增動畫或分類的方式與規則。
3. **已完成項目**（第 7 節）：各階段的交付紀錄。
4. **未來階段**（第 8 節）：新需求寫在這裡，實作完成後移到第 7 節。

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

---

## 2. Design System

沿用既有設計系統，不另行建立第二套。

- **主題**：Light / Dark 切換，預設跟隨系統並記住選擇；UI 色彩使用 `src/styles/main.scss` 的 `--ui-*` 變數。
- **動畫預設色票**：`#cfc1ab`、`#6a6b65`、`#354449`、`#efe9db`、`#a89985`（`DEFAULT_COLORS`，舞台中為 `--c1` ~ `--c5`）。
- **場景專屬色票**：個別場景可使用獨立配色，但不得覆蓋網站全域主題色彩。
- **響應式**：Desktop、Tablet、Mobile 皆可操作，不得產生水平捲動。
- **平面優先**：以 2D 為預設；基礎動態與文字動態需要空間深度或立體形變時使用 CSS 3D Transform，Three.js 只用於建築動態。不需要陰影的動畫不加陰影。
- **網站結構**：Header（分類導覽、主題切換）、Footer、首頁、作品詳細頁。

### 卡片

- 整體寬高比 3:2，預覽區背景完整填滿。
- 左上角順序編號、持續運作的預覽、標題、分類與標籤。
- 所有列表使用同一張卡片元件 `motion-card.vue`。

### 作品詳細頁

- Desktop 左右兩欄，寬度 3:2、主要區域高度一致；左欄為預覽與下方的即時資訊，右欄為設定。
- Mobile 依序為預覽、即時資訊、設定。
- 預覽區靠上對齊，底色填滿。
- 只顯示該作品真正支援的控制項，每個控制項都必須連結到實際動畫行為。

### 搜尋與篩選

名稱、描述搜尋，以及分類、技術、2D / 3D、標籤篩選；可同時使用、即時更新，提供清除條件與無結果狀態。條件同步到網址。

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
- 元件卸載時釋放 Renderer、Scene、Geometry、Material、Texture、事件監聽、動畫迴圈與 Resize Observer。
- 首頁避免同時執行過多高成本動畫：不可見的預覽暫停、卡片中的 3D 預覽降頻；詳細頁的主要動畫保持正常運作。
- 診斷數據必須來自實際運作的動畫；沒有可辨識 keyframe 時顯示替代資訊，不製造假數值。
- 不得將未實作、未測試或未取得素材的功能宣稱為已完成。

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
│   ├── css3d.ts         # css3dScene()、Node3D、cube()、plane()、shade()：CSS 3D 動畫
│   └── webgl.ts         # webglModule()：將 Three.js 場景包裝成統一生命週期（僅建築動態）
├── basic/               # 分類：基礎動態（index.ts 為 Metadata）
├── basic3d/             # 基礎動態的 3D 場景（CSS 3D Transform）
├── typography/          # 分類：文字動態（Preset 引擎、keyframes、獨立模組）
└── architecture/        # 分類：建築動態（3D 場景）

src/three/               # WebGL renderer、場景（createStage）供建築動態使用；物理（Body）、時間軸（keyframes）為純 TS，各分類共用
src/components/          # motion-preview、motion-card、controls-panel、diagnostics-panel、bezier-editor
src/views/               # home（作品網格＋搜尋篩選）、motion（詳細頁）、error
```

### 5.2 Metadata（`MotionMeta`）

每個作品必填：

| 欄位 | 說明 |
| --- | --- |
| `id` | 穩定且全站唯一，用於網址 `/motion/:id` |
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
| `duration` | `duration` | 所有動畫（3D 場景為時間倍率） |
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
2. 3D：在 `src/motions/basic3d/scenes.ts` 以 `css3dScene(floorY, build)` 匯出（座標為設計 px、y 向上、原點在地面中心），以 `node()` 建立物件、`cube()` / `plane()` 建立面、`shade()` 模擬受光；需要點擊物理回饋的物件以 `node(parent, pose, true)` 註冊。不使用 Three.js。
3. 在 `src/motions/basic/index.ts` 的 `ENTRIES` 加入一筆：id、名稱、說明、標籤（動態類型與物件）、原則、預設參數、控制項、`source`。

### 6.2 新增文字動態

1. Preset：在 `typography/effects.ts` 加入 keyframes（CSS 寫法：px、y 向下、順時針為正），在 `typography/index.ts` 加入一筆 `preset({ text, split, animation, stagger, order, origin, size, variant, spring })`。
2. 獨立模組：在 `typography/standalone/` 以 `waapiText()` 或 `rafText()` 實作，在 `index.ts` 以 `standalone(() => import(...))` 註冊。
3. `group` 必須是十種分類之一：Entrance、Exit、Emphasis、Transform、Reveal、Stagger、Kinetic、Loop、Elastic、Distortion。
4. 新增後確認與現有作品的動作機制有實質差異。

### 6.3 新增建築場景

1. 在 `src/motions/architecture/` 新增場景檔，匯出 `MotionFactory`：`createStage({ mode: '3d', ... })`，提供 `timeline`、`update(time, ease)`、選用的 `controls(element)`（回傳 `CameraHandle`）、`diagnostics(time)` 與 `overlay`。
2. 在 `architecture/index.ts` 加入 Metadata，`load: () => import('./xxx').then((m) => webglModule(m.default))`。
3. 場景須包含：可辨識的建築特徵、持續運作的環境動畫、平滑的時間或光照變化、滑鼠與觸控鏡頭操作（限制不合理角度與穿透建築）。
4. 以可信的歷史照片、建築資料或地理資訊為建模參考，並記錄來源與藝術化補充的部分；未經驗證不得宣稱精確比例。

### 6.4 新增分類

1. `core/types.ts` 的 `Category` 加入新 ID。
2. 建立 `src/motions/<category>/index.ts`，匯出 `MotionMeta[]`。
3. `registry.ts` 的 `CATEGORIES` 加入名稱與說明，`MOTIONS` 合併新清單。

Header 導覽、首頁篩選、搜尋、路由與詳細頁會自動納入，不需修改頁面元件。

### 6.5 驗證新增項目

- `npm run build` 通過，無 Console Error。
- 首頁卡片、詳細頁、搜尋與篩選皆能找到新作品。
- 詳細頁每個顯示的控制項都能改變動畫；診斷數據隨播放更新。
- 反覆進出詳細頁不會累積動畫或 canvas。

---

## 7. Completed Phases

### Phase 1（已完成）

**網站**

- 首頁作品網格（121 件），名稱與描述搜尋，分類、技術、2D / 3D、標籤篩選，條件同步網址，清除條件與無結果狀態。
- 作品詳細頁 `/motion/:id`：預覽、即時資訊（FPS、Frame Time、Progress、Keyframe、Playback、Rendering）、播放／暫停／重設、只顯示支援的控制項。
- Header、Footer、Light / Dark Theme、響應式版面；舊網址 `/basic`、`/text`、`/architecture`、`/:category/:id` 自動導向。

**基礎動態：20 件**

- 2D（Web Animations API / SVG）17 件：位移、旋轉、縮放、透明度、色彩轉換、彈跳（重力與反彈係數計算）、彈性（彈簧緩動）、搖晃（衰減震盪）、脈動、環繞、路徑、交錯、形狀變形、無限循環、跟隨動作、線條描繪、預備跳躍。
- 3D（CSS 3D Transform）3 件：立體球體彈跳、立方體翻滾、陀螺儀；點擊預覽給予物理衝量。
- 涵蓋 Position / Translation、Rotation、Scale、Opacity、Color Transition、Bounce、Elastic Motion、Shake、Pulse、Orbit、Path Motion、Stagger、Shape Morphing、Loop、Follow Through；物件包含圓形、球體、正方形、矩形、三角形、多邊形、線條與環形。

**文字動態：100 件**

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

**建築動態：台南舊火車站（1 件）**

- 建築依文獻：1936 年落成的二層樓鋼骨鋼筋混凝土建築、折衷主義；門廊三個圓拱門；正面七扇圓拱長窗，中間三扇由四根壁柱框起；長窗上方圓鐘；平頂小山形壁；上部白色方磚、下部人造石腰牆。兩翼與端棟的開窗數量與比例為藝術化補充。
- 環狀鐵道為微縮城市的藝術設計；列車依軌道切線行駛、車廂間距固定；平交道依列車位置運作；行人等候與散步；街屋、站前圓環、機車、紅燈籠。
- 24 小時日夜、台南氣候的四季（春木棉、夏鳳凰花與午後雷陣雨、秋乾燥、冬季薄霧與較低日照），樹木隨風擺動。
- 鏡頭：左鍵旋轉、滾輪縮放、右鍵平移，觸控單指旋轉與雙指縮放平移；自動環繞與重設視角；環境動畫不受鏡頭操作影響。
- 場景配色：`#CB914A`、`#86A0BB`、`#14233A`、`#B71F24`、`#C0B8B4`。
- 參考來源：[臺南車站（維基百科）](https://zh.wikipedia.org/zh-tw/臺南車站)、[Tainan railway station（Wikipedia）](https://en.wikipedia.org/wiki/Tainan_railway_station)。

**驗證**

- `vue-tsc` 與正式建置通過，無 Console Error。
- 121 個詳細頁皆確認動畫實際播放、進度推進。
- 控制項（Duration、Easing、Cubic Bézier、Stiffness、文字替換、播放／暫停／重設、鏡頭操作）皆確認改變實際動畫。
- 反覆進出詳細頁，動畫數量、canvas 與記憶體未累積；1280、820、390 px 寬度無水平捲動。

**已知限制**

- 100 件文字動畫以自動化檢查與抽樣目視確認，未逐一逐格人工檢視。
- 實機 FPS 未測量（測試環境為軟體渲染）。
- 部分效果需較新瀏覽器：`offset-path`、`linear()` 緩動（Chrome 116+、Safari 17.2+、Firefox 112+）。
- 建築模型依文字資料建模，未以實測圖面或照片比對，未宣稱達成 90% 還原度。
- CSS 3D 沒有真實光照：立方體以面法向量計算亮度、球體以漸層表現受光。

---

## 8. Future Phases

新階段需求寫在此處，格式如下；完成後將交付紀錄移到第 7 節，並更新相關的固定原則或擴充架構。

```
### Phase N

**目標**：……

**範圍**：
- [ ] 項目
- [ ] 項目

**驗收條件**：
- ……
```

### Phase 2（待規劃）

尚未定義。
