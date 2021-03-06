'use strict';

const Service = require('egg').Service;

class TaskService extends Service {
  async create({ brief, detail, device, icon, icon_file }) {
    return await this.ctx.service.taskRepository.create({ brief, detail, device, icon, icon_file });
  }

  async delete(id) {
    await this.ctx.service.taskRepository.delete(id);
  }

  async duplicate(task) {
    const { service } = this;

    const copy = await this.create(Object.assign({}, task, {
      detail: `复制自${task.id} ` + task.detail
    }));

    const reminds = await service.remind.search({
      taskId: task.id
    });
    for (const remind of reminds) {
      await service.remind.duplicate(remind, copy.id);
    }

    return await this.get(copy.id);
  }

  async get(id) {
    return await this.ctx.service.taskRepository.get(id);
  }

  /**
   * @param {Object} [context] - 场景
   */
  async getFollowing(context = null) {
    const { logger, service } = this;

    const messages = await service.queue.list();
    const tasks = [];
    for (const message of messages) {
      const {
        remind_id: remindId,
        score: plan_alarm_at,
      } = message;
      const remind = await service.remind.get(remindId);
      if (!remind) {
        continue;
      }
      const task = await this.get(remind.taskId);
      if (!task) {
        continue;
      }
      if (task.state !== 'active') {
        logger.info(`任务${task.id}的状态为${task.state}，接下来不会弹出提醒`);
        continue;
      }
      if (context && remind.context && remind.context.id !== context.id) {
        logger.info(`任务${task.id}所要求的场景为${remind.context.name}（${remind.context.id}），与目标场景“${context.name}”（${context.id}）不符，接下来不会弹出提醒`);
        continue;
      }
      const hour = new Date(plan_alarm_at * 1000).getHours();
      if (remind && Array.isArray(remind.restricted_hours) && !remind.restricted_hours[hour]) {
        logger.info(`任务${task.id}在${hour}时不需要弹出提醒`);
        continue;
      }
      tasks.push({
        plan_alarm_at,
        task,
      });
    }
    return tasks;
  }

  async put(task) {
    await this.ctx.service.taskRepository.put(task);
  }

  /**
   * 触发一次指定任务的提醒
   * @param {number} id - 任务的ID
   * @param {number} alarmAt - 触发提醒的时刻，单位为秒
   * @param {Object} remind - 导致本次触发的提醒对象
   */
  async remind(id, alarmAt, remind) {
    const { logger, service } = this;

    logger.info(`开始处理任务${id}的提醒流程`);
    const currentContext = service.context.getCurrent();
    const task = await this.get(id);
    if (task.state !== 'active') {
      logger.info(`任务${id}没有被启用，不需要弹出提醒`);
    } else if (!remind.context || currentContext === remind.context.name) {
      await service.remindLog.create({
        plan_alarm_at: alarmAt,
        real_alarm_at: Math.round(Date.now() / 1000),
        task_id: id,
      });
      const result = await service.remind.notify(remind, {
        alarmAt,
        brief: `#${task.id} ${task.brief}`,
        detail: task.detail,
        device: task.device,
        icon: task.icon,
        taskId: task.id,
      });
      const stdout = result && result.stdout;
      let rv;
      if (typeof stdout === 'string' && stdout.length > 0) {
        rv = JSON.parse(stdout);
      }
      // FIXME: 避免字符串常量重复出现在下一行以及remind.js中
      const pattern = /([0-9]+)分钟后再提醒/;
      if (rv && typeof rv.activationValue === 'string' && rv.activationValue.match(pattern)) {
        const matches = rv.activationValue.match(pattern);
        const minutes = parseInt(matches[0]);
        logger.info(`这里应当往Redis中写入一条${minutes}分钟后执行的任务`);
        await service.queue.send(task.id, Math.round(Date.now() / 1000) + minutes * 60, remind.id);
      } else if (rv && typeof rv.activationValue === 'string' && rv.activationValue.match(/8点时再提醒/)) {
        let consumeUntil = new Date().setHours(8, 0, 0, 0);
        while (consumeUntil < Date.now()) {
          consumeUntil += 12 * 60 * 60 * 1000;
        }
        await service.queue.send(task.id, Math.round(consumeUntil / 1000), remind.id);
      } else if (rv && typeof rv.activationValue === 'string' && rv.activationValue.match(/([0-9]+)小时后再提醒/)) {
        const matches = rv.activationValue.match(/([0-9]+)小时后再提醒/);
        const hours = parseInt(matches[0]);
        logger.info(`这里应当往Redis中写入一条${hours}小时后执行的任务`);
        await service.queue.send(task.id, Math.round(Date.now() / 1000) + hours * 60 * 60, remind.id);
      } else {
        await this._schedule(remind);
      }
    } else {
      logger.info(`当前场景（${currentContext}）与任务要求的场景（${remind.context.name}）不一致，不需要弹出提醒`);
      await this._schedule(remind);
    }
    logger.info(`任务${id}的提醒流程处理完毕`);
  }

  async search(query) {
    return await this.ctx.service.taskRepository.search(query);
  }

  /**
   * 安排下一个提醒的时刻
   * @param {Object} remind - 提醒的实体对象
   */
  async _schedule(remind) {
    const { service } = this;

    remind.close();
    if (remind.isRepeated()) {
      await service.remind.put(remind);
      await service.queue.send(remind.taskId, remind.timestamp, remind.id);
    }
  }
}

module.exports = TaskService;
