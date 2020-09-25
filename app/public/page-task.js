'use strict';

/**
 * @param {number} id - 要更新图标的任务的id
 */
window.uploadIcon = async function (id) {
  // 先取出待上传的图标的完整路径
  const iconFile = document.getElementById('iconFile').files[0];
  // 执行文件上传
  const formData = new FormData();
  formData.append('file', iconFile);
  const response = await axios({
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data; charset=utf-8',
    },
    method: 'patch',
    url: `/task/${id}/icon`,
  });
  console.log('response', response);
  alert('任务图标更新成功。');
  location.reload();
};

/**
 * 更新这一行提醒的属性。
 * @param {number} id - 待更新的提醒的ID
 */
window.updateRemindContext = async function (id) {
  // 取出当前的场景的ID，并更新提醒的场景
  const selectElement = document.getElementById('remindContextName');
  const contextId = parseInt(selectElement.value);
  // 取出当前的持续时长并更新
  const durationElement = document.getElementById('remindDuration');
  let duration = parseInt(durationElement.value);

  const data = {
    contextId,
    duration
  };
  console.log('data', data);
  const response = await axios({
    data,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    method: 'patch',
    url: `/remind/${id}`,
  });
  console.log('response', response);
  alert('提醒更新成功。');
  location.reload();
};
