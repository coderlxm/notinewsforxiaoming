# AV Feature Extension — Acceptance Checklist

## 1. Cheerio Parsing

- [ ] `parseAvContent()` extracts cover URL from `a.bigImage` href
- [ ] `parseAvContent()` extracts metadata: 識別碼, 發行日期, 長度, 導演, 製作商, 發行商, 系列
- [ ] `parseAvContent()` extracts genres as array from `span.genre > label > a`
- [ ] `parseAvContent()` extracts all magnets from the 磁力連結投稿 table (name, link, size, shareDate)
- [ ] `parseAvContent()` extracts all sample image URLs after 樣品圖像 header

## 2. Magnet Picker

- [ ] `pickBestMagnet()` selects magnet with 中字/-C/CN/SUB keyword when available
- [ ] `pickBestMagnet()` prefers 4GB–10GB range among keyword matches
- [ ] `pickBestMagnet()` falls back to largest-by-size when no keyword match
- [ ] `parseSizeToGB()` correctly parses "7.72GB", "1.38GB", "500MB" to float values

## 3. AI Enhancement (requires DEEPSEEK_API_KEY)

- [ ] `aiPickBestMagnet()` calls DeepSeek with magnet name list, returns best pick name
- [ ] `aiPickBestMagnet()` falls back gracefully (returns null) on API error
- [ ] `enhanceGenresWithAI()` calls DeepSeek, returns emoji-grouped genre string
- [ ] `enhanceGenresWithAI()` falls back gracefully on API error

## 4. Premium Message Format

- [ ] Message shows actor name, code, title, maker, genres with emoji headers
- [ ] Genres display as hashtags (or AI-enhanced grouped format)
- [ ] Best magnet link displayed in `<code>` block with size and share date
- [ ] Magnet line shows "(含中字)" suffix when keyword match detected
- [ ] Link to JavBus detail page present
- [ ] Footer tags include #新作推送, #磁力直达, and actor hashtag

## 5. Gallery Publishing

- [ ] Cover image sent with caption when no samples available
- [ ] Media group sent when samples available (cover + up to 9 samples)
- [ ] `sendMediaGroup` failure gracefully falls back to cover-only `sendPhoto`
- [ ] No cover: text-only message sent as fallback

## 6. End-to-End Test

```bash
TEST_MODE_ENABLED=true TEST_FORCE_MODE=av_update pnpm start
```

- [ ] Command runs without crash
- [ ] Console shows no cheerio parse errors
- [ ] Telegram channel receives AV update message(s)
- [ ] Message format matches premium design
- [ ] Sample image gallery displays correctly (if samples available)
- [ ] Magnet link is copyable from `<code>` block
- [ ] Existing tracked targets continue to work (no regression)
- [ ] Duplicate detection still works (push_history consulted)

## 7. Interactive Bot Test

In Telegram, send `/fetchav` to the bot:

- [ ] Bot replies "开始手动检查 AV 更新..."
- [ ] AV update delivered with new premium format
- [ ] `/fetchav force` triggers force resend as before
