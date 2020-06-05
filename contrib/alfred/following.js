'use strict';

const config = require('./config');

const dateFormat = require('dateformat');
const request = require('co-request');

async function main() {
  const contextId = process.argv[2];

  const qs = {
    contextId,
  };
  const url = `${config.origin}/task/following`;
  const response = await request({
    json: true,
    qs,
    url
  });
  const { tasks } = response.body;
  const items = [];
  let lastDate = null;
  for (const t of tasks) {
    const { plan_alarm_at, task } = t;

    const currentDate = dateFormat(plan_alarm_at * 1000, 'yyyy-mm-dd');
    if (!lastDate || lastDate !== currentDate) {
      // 更新lastDate并写入items中，以作为下拉列表的一行显示。
      lastDate = currentDate;
      items.push({
        icon: { path: '' },
        title: `下列为${lastDate}的提醒`
      });
    }
    // subtitle展示的是任务下一次提醒的时刻，以及它的重复模式
    let subtitle = dateFormat(plan_alarm_at * 1000, 'yyyy-mm-dd HH:MM:ss');
    if (task.remind && task.remind.repeat) {
      subtitle += ` *${task.remind.repeat.type}`;
    }

    items.push({
      arg: `${task.id}`,
      icon: {
        path: task.icon_file || ''
      },
      subtitle,
      title: `#${task.id} ${task.brief} ${task.context ? '@' + task.context.name : ''}`
    });
  }
  console.log(JSON.stringify({ items }, null, 2));
}

main();
