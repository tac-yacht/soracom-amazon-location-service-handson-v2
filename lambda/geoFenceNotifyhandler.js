

import * as qs from 'querystring';
const lineNotifyToken = process.env.LINE_NOTIFY_TOKEN;
const REQUEST_TIMEOUT_MS = 10000;

exports.sendNotificationHandler = async function (event, context) {
  console.log('event:', JSON.stringify(event, null, 2));
  console.log('context:', JSON.stringify(context, null, 2));
  console.log(event.detail);
  const message = await createMessage(event.detail);
  const result = await sendNotifyMessage(message);
  if (result) {
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Line Notify Send Successful.',
        },
        null,
        2
      ),
    };
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Line Notify Send Error.',
        },
        null,
        2
      ),
    };
  }
};

async function createMessage(eventDetail) {
  const eventType = eventDetail.EventType;
  let eventName = '';
  if (eventType == 'ENTER') {
    eventName = 'に間もなく到着します';
  } else {
    eventName = 'から出発しました。';
  }
  return `DeviceId: ${eventDetail.DeviceId}がGeoFence: ${eventDetail.GeofenceId}${eventName} 位置: https://www.google.com/maps?q=${eventDetail.Position[1]},${eventDetail.Position[0]}`;
}
async function sendNotifyMessage(
  message
) {
  const lineNotifyUrl = 'https://notify-api.line.me/api/notify';
  // リクエスト設定
  const payload = {
    message: message,
  };

  console.log('payload:', JSON.stringify(payload, null, 2));
  const config = {
    url: lineNotifyUrl,
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${lineNotifyToken}`,
    },
    data: qs.stringify({
      message: message,
    }),
  };
  // メッセージ送信
  try {
    const response = await fetch(
      lineNotifyUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${lineNotifyToken}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body:qs.stringify({
          message: message,
        })
      }
    );
    console.log(response);
    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}
async function sendNotifyMessageAxios(
  lineNotifyToken ,
  message
) {
  const lineNotifyUrl = 'https://notify-api.line.me/api/notify';
  // リクエスト設定
  const payload = {
    message: message,
  };

  console.log('payload:', JSON.stringify(payload, null, 2));
  const config = {
    url: lineNotifyUrl,
    method: 'post',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${lineNotifyToken}`,
    },
    data: qs.stringify({
      message: message,
    }),
  };
  // メッセージ送信
  try {
    const result = await axios.request(config);
    console.log(result);
    if (result.data.message === 'ok') {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}
