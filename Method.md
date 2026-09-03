## 如何編寫教材

這份文件說明如何在 `tutorial_website` 新增/修改課程章節內容，以及新增練習題(code 題與選擇題)。所有範例都以現有的 `001`(Python 初級課程)為準。

### 檔案總覽

```
data/courses.json                     -- 課程 id 清單
data/document/001/metadata.md         -- 該課程的章節清單(YAML front matter)
data/document/001/2-1-1a.html         -- 每一章的教材內容(Markdown + 少量 HTML)
data/exercise/001/2-1-1a/             -- 該章節對應的練習題(可省略，見下)
  0init_code.py
  meta.json
  1request / 1expectout.txt / 1refsol.py
  2request / 2expectout.txt / 2refsol.py
  ...
```

一個章節(`chapters` 裡的一筆)只會對應**一個**練習題目錄(`exercise` 欄位)，但一個練習題目錄裡可以有多個「子任務(subtask)」，也就是 `1request`、`2request`... 依序編號。

---

## 一、新增章節內容

### 1. 在 `metadata.md` 註冊章節

打開 `data/document/001/metadata.md`，在 `chapters:` 陣列裡新增一筆：

```yaml
  - id: "2-5-1"
    title: "章節標題"
    file: "2-5-1.html"
    exercise: "2-5-1"   # 沒有練習題就整行省略(參考 1-1-2)
```

- `id`：命名規則是 `大章-小章-子章`(例如 `2-4-2`)，若同一小章要拆成多篇(見下方「5 分鐘原則」)，用字母尾綴，例如 `2-1-1a`、`2-1-1b`。
- `file`：對應 `data/document/001/<id>.html`。
- `exercise`：對應 `data/exercise/001/<id>/`；純觀念課(如 1-1-2 英文盲打)可以完全不放這個欄位，該章節就不會出現練習分頁。
- 章節在網站上顯示的順序就是 `chapters` 陣列的順序，新章節要插在正確的位置，不是永遠加在最後。

如果新章節屬於一個**新的小節**(例如新開一個 `2-5`)，記得在檔案最上面的 `sections:` map 也加一筆，側邊欄才會顯示縮排的小節標題：

```yaml
sections:
  "2-1": "輸入與輸出"
  ...
  "2-5": "新小節的名稱"
```

`sections` 的 key 是章節 id 的前兩段(`2-5-1` → `2-5`)，同一個 `2-5-x` 只要出現第一次就會插入一次標題列，不用每筆都加。

### 2. 寫 `<id>.html` 內容檔

內容檔其實是 **Markdown**，只是副檔名是 `.html`(歷史因素)，`marked.js` 會把它整篇轉成 HTML，原生 HTML 標籤(像 `<pre><code>`、`<details>`)也會被原樣保留，可以混用。固定格式如下(參考 `data/document/001/2-1-1b.html`)：

```html
<script type="application/json" id="meta">
{ "title": "輸出(output)(2)" }
</script>

<p class="eyebrow">CHAPTER 2-1-1(2／2)</p>
<h1>輸出(output)(2)</h1>

這裡開始寫課程內容，可以用 Markdown 語法...

## 二級標題

<pre><code>print("Hello")</code></pre>

輸出：

<pre><code>Hello</code></pre>

<p class="placeholder-note">補充說明可以用這個 class，會顯示成灰色斜體小字。</p>
```

- 開頭的 `<script id="meta">` 是必須的，`title` 會顯示在瀏覽器分頁標題等地方。
- `<p class="eyebrow">` + `<h1>` 是章節標頭的固定寫法，`eyebrow` 那行通常寫 `CHAPTER x-y-z` 或「(1／2)」這種分頁提示。
- 程式碼區塊一律用 `<pre><code>...</code></pre>`，不要用 Markdown 的三個反引號(現有內容都是這個寫法，混用會讓風格不一致)。
- 章節內文字提到程式碼片段(例如 `print()`)可以用單一反引號 `` `print()` `` 讓 Markdown 轉成 `<code>`。

**內容撰寫原則(照之前訂的規範)：**

1. **高中生等級的口吻**：假設讀者是完全沒學過程式的台灣高中生，避免不必要的英文術語堆疊，專有名詞第一次出現要附中文解釋。
2. **5 分鐘閱讀原則**：一篇讀完應該在 5 分鐘內。如果內容太多，拆成 `(1)`、`(2)` 兩個子章節(id 用 `a`、`b` 尾綴，例如 `2-1-1a` + `2-1-1b`)，並在 `eyebrow` 標注「CHAPTER 2-1-1(1／2)」。
3. **不要假設還沒教過的東西**：新章節如果要用到某個語法，先確認前面章節真的教過，不要寫「上一章你已經學過 XXX」但其實沒有(之前 2-1-1 就犯過這個錯，已修正)。
4. **一律使用半形括號 `()`**，不要用全形 `（）`。
5. 段落結尾如果該章節有練習題，通常會用一句「準備好了嗎？下面有練習...」收尾，銜接下方的練習題分頁。

---

## 二、新增練習題

練習題目錄路徑是 `data/exercise/001/<exercise_id>/`(`<exercise_id>` 通常跟章節 `id` 相同)。裡面固定要有：

```
meta.json          -- { "subtaskCount": N }
0init_code.py       -- 學生一進來看到的初始程式碼(選填，見下)
1request            -- 子任務 1 的題目
1input.txt           -- 子任務 1 的標準輸入(只有需要 input() 的 code 題才需要，見下)
1expectout.txt       -- 子任務 1 的標準輸出(只有 code 題需要)
1refsol.py           -- 子任務 1 的參考解答(只有 code 題需要，方便自己驗證用，網站不會載入它)
2request / 2input.txt / 2expectout.txt / 2refsol.py ...   -- 依此類推到第 N 題
```

- `meta.json` 的 `subtaskCount` 一定要等於你放了幾個 `Nrequest`，數量不對子任務清單會顯示錯誤。
- `0init_code.py` 是可以省略的：如果整個練習題目錄裡的子任務全部都是選擇題(像 `1-1-1`)，可以不放這個檔案；只要有任何一個子任務是 code 題，就一定要放。
- 每個章節建議放 **2 到 5 題**子任務，難度遞增(例如第 1 題暖身、最後一題稍微綜合前面教過的東西)。

### Code 題(`Nrequest` 格式)

```
題目敘述(可以多行、可以用 Markdown)

範例：如果輸入是 XXX，輸出應該是：

```
預期輸出範例
```
```

- 如果這題需要 `input()`，把要餵給程式的標準輸入寫進同一資料夾的 `Ninput.txt`(純文字，內容就是學生執行/送出這題時會吃到的 stdin)。**切換子任務時，網站會自動把畫面上的 stdin 輸入框重新替換成這個檔案的內容**，所以不用擔心學生手動改過 stdin 後忘記換回來。不需要輸入的題目，這個檔案整個不用建立。
- 對應的 `Nexpectout.txt` 放這組 `stdin` 跑出來**應該要有的輸出**，一字不差(除了下面提到的容錯規則)。
- 對應的 `Nrefsol.py` 放你自己驗證用的參考解答，寫完之後**務必**用本機 Python(建議跟 Pyodide 版本相近的 3.12)實際執行一次：

  ```
  python 1refsol.py < 1request的STDIN部分 
  ```

  再手動比對輸出跟 `1expectout.txt` 是否一致，避免手寫的預期輸出跟實際執行結果不同(尤其中文字、標點、空白很容易手滑)。

- **批改規則(已確認不用改，保留現況)**：`js/diff.js` 的 `outputsMatch()` 只會容錯「每行結尾多餘的空白」跟「檔案結尾多出來的空行」，其餘一律精準比對，所以 `expectout.txt` 內容(含中間的空白、換行位置)一定要跟正確程式的實際輸出完全一致。

### 選擇題(MC 題，`Nrequest` 格式)

```
題目文字(可以多行)

<select1>A. 選項一</select1>
<select2>B. 選項二</select2>
<select3>C. 選項三</select3>
<select4>D. 選項四</select4>
<ans>C</ans>
<detail>
作答完後顯示的詳解，可以多行、可以用 Markdown。
</detail>
```

- 選項數量不限於 4 個，`<selectN>` 的 N 只是識別用，不影響顯示順序(用陣列裡出現的順序)。
- `<ans>` 裡填答案選項的字母(對應 `<selectN>` 內文開頭的 `A.`/`B.`...)，一定要能對應到某個 `<selectN>`，否則載入會直接丟錯誤。
- `<detail>` 選填，但建議都寫，是作答後看到的詳解。
- 選擇題**不需要**、也不會用到 `Nexpectout.txt` / `Nrefsol.py`。

### 已停用、不用理會的東西

- `---HINT---` 這個分隔符在 `dataLoader.js` 裡還看得到(舊的「提示」功能格式)，但提示功能整個已經從 UI 移除，寫新題目時**不需要**加這段，加了也不會顯示。
- `---STDIN---` 這個分隔符(舊版把 stdin 直接寫在 `Nrequest` 檔案結尾)還能繼續解析，是為了不動到舊題目才留著的相容寫法；**新題目一律改用 `Ninput.txt`**(見上方)。如果一個子任務兩者都有，`Ninput.txt` 優先。

---

## 三、新增全新課程(不只是新章節)

目前 `data/courses.json` 只有 `"001"` 一個課程。如果要開一個全新課程(例如 `"002"`)：

1. `data/courses.json` 的 `courses` 陣列加上新 id。
2. 新增 `data/document/002/metadata.md`(格式同上，含 `id`/`title`/`description`/`sections`/`chapters`)。
3. 依序建立 `data/document/002/<chapter id>.html` 跟(選填)`data/exercise/002/<exercise id>/`。

---

## 四、送出前檢查清單

- [ ] `metadata.md` 的 `chapters` 順序跟 `sections` 有沒有插對位置
- [ ] 內容全篇沒有全形括號 `（）`
- [ ] 每個 code 題的 `Nrefsol.py` 有沒有實際跑過一次(記得餵 `Ninput.txt` 的內容)，輸出跟 `Nexpectout.txt` 逐字相符
- [ ] `meta.json` 的 `subtaskCount` 跟實際 `Nrequest` 檔案數量一致
- [ ] 新章節有沒有用到還沒教過的語法/函式
- [ ] 內容篇幅是否在 5 分鐘閱讀內，太長要拆成 `(1)/(2)`
