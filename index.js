/*
 * @Author: chengquan
 * @Date: 2020-08-05 15:28:57
 * @LastEditTime: 2020-12-02 15:16:04
 * @Description: 爱奇艺每日签到和会员抽奖
 * @FilePath: \iqy_checkin\iqiyi.js
 */
const axios = require('axios');
const cookieParser = require('cookie');
const cryptoJs = require('crypto-js');
const queryString = require('query-string');
/**
 * 修改cookie为请求头中整个cookie 并将config中cookie修改为在下方填写
 * cookie注意网页cookie在请求头中不要右键copy value，请手动复制！！！且用'单引号'填入下方数组！多个同理
 * 可以使用青龙环境变量添加cookie 请用&连接多个cookie 变量名为 IQY_COOKIE
 */
 let cookies = [''];

 if (process.env.IQY_COOKIE) {
     if (process.env.IQY_COOKIE.indexOf('&') > -1) {
     cookies = process.env.IQY_COOKIE.split('&');
   } else if (process.env.IQY_COOKIE.indexOf('\n') > -1) {
     cookies = process.env.IQY_COOKIE.split('\n');
   } else {
     cookies = [process.env.IQY_COOKIE];
   }
 }
 
// 新增消息通知
const sendKey = ''; // server酱
const bark = ''; // bark app
const push = ''; // pushplus

const serverSend = (title) => {
  const url = `https://sctapi.ftqq.com/${sendKey}.send?title=${encodeURI(title)}`;
  axios.get(url);
}

const barkSend = (title) => {
  const url = `https://api.day.app/${bark}/${encodeURI(title)}`;
  axios.get(url);
}


const pushSend = (title) => {
  const url = `https://www.pushplus.plus/send?token=${push}&content=${encodeURI(title)}`;
  axios.get(url);
}

const sendMsg = (title) => {
  if (sendKey) {
    serverSend(title);
  }
  if (bark) {
    barkSend(title);
  }
  if (push) {
    pushSend(title);
  }
}

let isLottery = true; // true查询 false抽奖

const parseCookies = cookies.map(cookie => {
  const cookie_ = cookieParser.parse(cookie);
  return {
    cookie,
    authCookie: cookie_.P00001,
    qyid: cookie_.QC005,
    userId: cookie_.P00003,
    dfp: cookie_.__dfp,
  }
})

async function sign() {
  for (let index = 0; index < parseCookies.length; index++) {
    const cookie = parseCookies[index];
    let check;
    try {
      check = await checkin(cookie);
    } catch (error) {
      console.log(`cookie${index}：iqy签到发生错误：${error}`);
      sendMsg(`cookie${index}：iqy签到发生错误：${error}`);
    }
    if (check.data && (check.data.code !== "A00000" || !check.data.data.success)) {
      console.log(`cookie${index}` + check.data);
      sendMsg(`cookie${index}：iqy签到发生错误：${JSON.stringify(check.data)}`);
    } else {
      console.log(`cookie${index}：` + JSON.stringify(check.data));
      const reward = check?.data?.data?.data?.rewards.find(reward => reward.rewardType === 1) || {};
      console.log(`cookie${index}：今日签到成长值：${reward.rewardCount}`)
      sendMsg(`cookie${index}：今日签到成长值：${reward.rewardCount}`);
    }


    await lottery(cookie, index);

    await dailyTask(cookie, index);

  }
}

async function getPlatform(cookie) {
  const url = 'https://static.iqiyi.com/js/qiyiV2/20200212173428/common/common.js';
  const res = await axios.get(url, {
    headers: {
      Cookie: cookie
    }
  });
  const platform = /platform:\"(.*?)\"/.exec(res.data);
  return platform;
}

/**
 * 抽奖
 * @param {*} cookie 
 */
async function lottery(cookie, index) {
  let daysurpluschance = 0;
  const res = await lottery_activity(cookie, isLottery);
  console.log(res.data);
  daysurpluschance = parseInt(res.data.daysurpluschance || 0);
  isLottery = false;
  if (daysurpluschance === 0) {
    sendMsg(`cookie${index}：iqy今日已抽奖`);
    return console.log(`cookie${index}：iqy今日已抽奖`);
  }
  console.log(`cookie${index}：今日可抽奖${daysurpluschance}次`);
  for (let i = 0; i < daysurpluschance; i++) {
    const lotteryRes = await lottery_activity(cookie, isLottery);
    console.log(lotteryRes.data);
  }
  sendMsg(`cookie${index}：iqy抽奖已完成`);
}

async function lottery_activity(cookie, isLottery) {
  const data = {
    "app_k": "b398b8ccbaeacca840073a7ee9b7e7e6",
    "app_v": "11.6.5",
    "platform_id": 10,
    "dev_os": "8.0.0",
    "dev_ua": "FRD-AL10",
    "net_sts": 1,
    "qyid": cookie.qyid,
    "psp_uid": cookie.userId,
    "psp_cki": cookie.authCookie,
    "psp_status": 3,
    "secure_p": "GPhone",
    "secure_v": 1,
    "req_sn": new Date().getTime(),
    lottery_chance: isLottery ? 1 : 0
  };
  const url = "https://iface2.iqiyi.com/aggregate/3.0/lottery_activity?" + queryString.stringify(data);
  return axios.get(url);
}

function checkin(cookie) {
  const timestamp = new Date().getTime();
  const sign = cryptoJs.MD5("agentType=1|agentversion=1.0|appKey=basic_pcw|authCookie=" + cookie.authCookie + "|qyid=" + cookie.qyid + "|task_code=natural_month_sign|timestamp=" + timestamp + "|typeCode=point|userId=" + cookie.userId + "|UKobMjDMsDoScuWOfp6F")
  const url = `https://community.iqiyi.com/openApi/task/execute?agentType=1&agentversion=1.0&appKey=basic_pcw&authCookie=${cookie.authCookie}&qyid=${cookie.qyid}&task_code=natural_month_sign&timestamp=${timestamp}&typeCode=point&userId=${cookie.userId}&sign=${sign}`;
  const data = {
    "natural_month_sign": {
      "agentType": 1,
      "agentversion": 1,
      "authCookie": cookie.authCookie,
      "qyid": cookie.qyid,
      "verticalCode": "iQIYI",
      "taskCode": "iQIYI_mofhr"
    }
  }
  const headers = {
    Cookie: cookie,
    "Content-Type": "application/json"
  };
  return axios.post(url, data, {
    headers
  });
}

async function dailyTask(cookie, index) {
  const taskcodeList = [{
    code: '8ba31f70013989a8',
    name: '每日观影成就'
  }, {
    code: 'freeGetVip',
    name: '浏览会员兑换活动'
  }, {
    code: 'GetReward',
    name: '逛领福利频道'
  }];
  let url;
  let res;
  for (let i = 0; i < taskcodeList.length; i++) {
    const task = taskcodeList[i];
     // 领任务
     url = `https://tc.vip.iqiyi.com/taskCenter/task/joinTask?P00001=${cookie.authCookie}&taskCode=${task.code}&platform=b6c13e26323c537d&lang=zh_CN&app_lm=cn`;
     res = await axios.get(url);
     if (res.data.code === 'A00000') {
       console.log(`cookie${index}：领取${task.name}任务成功`);
       await sleep(10000)
     } else {
      console.log(`cookie${index}：已完成${task.name}`);
      continue;
     }
 
     // 完成任务
     url = `https://tc.vip.iqiyi.com/taskCenter/task/notify?taskCode=${task.code}&P00001=${cookie.authCookie}&platform=b6c13e26323c537d&lang=cn&bizSource=component_browse_timing_tasks&_=${new Date().getTime()}`;
     res = await axios.get(url);
     if (res.data.code === 'A00000') {
       console.log(`cookie${index}：完成${task.name}任务成功`);
       await sleep(2000)
     }
 
     // 领取奖励
     url = `https://tc.vip.iqiyi.com/taskCenter/task/getTaskRewards?P00001=${cookie.authCookie}&taskCode=${task.code}&lang=zh_CN&platform=b6c13e26323c537d`;
     res = await axios.get(url);
     try {
       const price = res.data.dataNew[0].value;
       console.log(`cookie${index}：领取${task.name}任务奖励成功, 获得${price}点成长值`);
     } catch (error) {
       console.log(`cookie${index}：领取${task.name}任务奖励出错`);
     }
     await sleep(5000);
  }
  sendMsg(`cookie${index}：iqy每日任务已完成`);
}

const sleep = (ts) => {
  return new Promise((resolve) => setTimeout(resolve, ts));
}

function random(min, max) {
  return Math.round(Math.random() * (max - min)) + min;
}


exports.handler = () => {
  sign();
}

sign();
