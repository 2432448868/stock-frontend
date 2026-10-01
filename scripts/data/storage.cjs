const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
// 所有成员先准备完成，再替换；失败回滚整个关联组。
// 站点发布以 Git 提交/Pages artifact 为快照边界，不边抓边发布。
function publishGroup(directory, files) {
  const token = crypto.randomUUID();
  const staged = [];
  const replaced = [];
  try {
    for (const [name, data] of Object.entries(files)) {
      if (!/^(history\/)?[a-z0-9-]+\.json$/.test(name)) throw new Error('非法数据文件名');
      const file = path.join(directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = file + '.' + token + '.tmp';
      const item = { file, temp, before: fs.existsSync(file) ? fs.readFileSync(file) : null };
      staged.push(item);
      fs.writeFileSync(temp, JSON.stringify(data));
    }
    for (const item of staged) {
      fs.renameSync(item.temp, item.file);
      replaced.push(item);
    }
  } catch (error) {
    for (const item of replaced.reverse()) {
      if (item.before === null) fs.unlinkSync(item.file);
      else fs.writeFileSync(item.file, item.before);
    }
    throw error;
  } finally {
    for (const item of staged) if (fs.existsSync(item.temp)) fs.unlinkSync(item.temp);
  }
}
function pruneHistory(directory, today) {
  const history = path.join(directory, 'history');
  if (!fs.existsSync(history)) return;
  const cutoff = new Date(today + 'T00:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const date = cutoff.toISOString().slice(0, 10);
  for (const name of fs.readdirSync(history)) {
    const match = name.match(/^(?:capital-)?(?:industry|concept|region)-(\d{4}-\d{2}-\d{2})\.json$/);
    if (match && match[1] < date) fs.unlinkSync(path.join(history, name));
  }
}
module.exports = { readJson, publishGroup, pruneHistory };
