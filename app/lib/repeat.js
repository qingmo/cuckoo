'use strict';

const dateMath = require('date-arithmetic');

/**
 * 重复模式
 * @typedef {Object} Repeat
 * @property {string} create_at - 该行的创建时刻
 * @property {number} id - 该行的主键
 * @property {string} type - 重复模式
 * @property {string} update_at - 该行的最后一次修改的时刻
 */

class Repeat {
  /**
   * Create a repeat.
   * @param {Object} row - 从数据库返回的一行
   * @param {string} row.type - 重复模式
   * @returns {Repeat}
   */
  constructor(row) {
    const {
      type
    } = row;
    // TODO: 检查type是否为合法的字符串
    this.type = type;
  }

  /**
   * @param {number} current - 作为计算起点的当前时间戳，单位为毫秒
   * @return {number} 按照这个重复模式迭代的下一个时刻的时间戳
   */
  nextTimestamp(current) {
    const now = Date.now();
    const type = this.type;
    let nextTime = current;
    do {
      if (type === 'daily') {
        nextTime += 24 * 60 * 60 * 1000;
      } else if (type === 'end_of_month') {
        // 先算出2个月后的日期，再通过setDate回到上一个月的最后一天
        const twoMonthLater = dateMath.add(new Date(nextTime), 2, 'month');
        nextTime = new Date(twoMonthLater.getTime()).setDate(0);
      } else if (type === 'hourly') {
        nextTime += 60 * 60 * 1000;
      } else if (type === 'minutely') {
        nextTime += 60 * 1000;
      } else if (type === 'monthly') {
        const nextDate = dateMath.add(new Date(nextTime), 1, 'month');
        nextTime = nextDate.getTime();
      } else if (type === 'weekly') {
        nextTime += 7 * 24 * 60 * 60 * 1000;
      } else if (type === 'yearly') {
        const nextDate = dateMath.add(new Date(nextTime), 1, 'year');
        nextTime = nextDate.getTime();
      } else if (type.match(/^every_[0-9]+_days$/)) {
        const nDays = parseInt(type.match(/^every_([0-9]+)_days$/)[1]);
        nextTime += nDays * 24 * 60 * 60 * 1000;
      } else if (type.match(/^every_[0-9]+_hours$/)) {
        const nHours = parseInt(type.match(/^every_([0-9]+)_hours$/)[1]);
        nextTime += nHours * 60 * 60 * 1000;
      } else if (type.match(/^every_[0-9]+_minutes$/)) {
        const nMinutes = parseInt(type.match(/^every_([0-9]+)_minutes$/)[1]);
        nextTime += nMinutes * 60 * 1000;
      } else {
        throw new Error(`${type}不是一个合法的重复模式`);
      }
    } while (nextTime < now);
    return nextTime;
  }

  patch(changes) {
    const FIELDS = [
      'type',
    ];
    for (const field of FIELDS) {
      if (field in changes) {
        this[field] = changes[field];
      }
    }
    this.update_at = new Date();
  }

  /**
   * 检查重复模式是否合法
   */
  static validateType(type) {
    if (['daily', 'end_of_month', 'hourly', 'minutely', 'monthly', 'weekly', 'yearly'].includes(type)) {
      return;
    }
    if (type.match(/^every_[0-9]+_days$/)) {
      return;
    }
    if (type.match(/^every_[0-9]+_hours$/)) {
      return;
    }
    if (type.match(/^every_[0-9]+_minutes$/)) {
      return;
    }
    throw new Error(`${type}不是一个合法的重复模式`);
  }
}

module.exports = Repeat;
