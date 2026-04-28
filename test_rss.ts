import Parser from 'rss-parser';
const parser = new Parser();
const feeds = [
  'https://www.yystv.cn/rss/feed',
  'http://www.chuapp.com/feed',
  'https://feedx.net/rss/a9vg.xml',
  'https://plando.cn/feed'
];
async function test() {
  for (const f of feeds) {
    try {
      const res = await parser.parseURL(f);
      console.log(f, res.items.length);
    } catch(e) {
      console.log(f, 'FAILED');
    }
  }
}
test();
