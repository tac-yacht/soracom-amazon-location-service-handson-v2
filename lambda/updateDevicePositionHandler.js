import {LocationClient, BatchUpdateDevicePositionCommand } from '@aws-sdk/client-location';
const trackerName = process.env.AMAZON_LOCATION_SERVICE_TRACKER_NAME;
  
async function putDevicePostion(lon, lat, deviceId) {

  const config = { region: process.env.AWS_DEFAULT_REGION };
  const location = new LocationClient([config]);
  const input = {
    TrackerName: trackerName,
    Updates: [
    {
      // DevicePositionUpdate
      DeviceId: deviceId,
      SampleTime: new Date(),
      Position: [Number(lon), Number(lat)],
    },
    ],
  };
  console.log(
    'batchUpdateDevicePosition param:',
    JSON.stringify(input, null, 2)
  );
  try {
    const command = new BatchUpdateDevicePositionCommand(input);
    const response = await location.send(command);
    console.log(
      'batchUpdateDevicePosition result:',
      JSON.stringify(response, null, 2)
    );
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
export const gpsMulchUnitHandler = async function (event, context) {
  console.log('event:', JSON.stringify(event, null, 2));
  console.log('context:', JSON.stringify(context, null, 2));
  /**
   * bodyから緯度・経度を取得
   */
  const bodyJson = JSON.parse(event.body);
  const lat = bodyJson.lat;
  const lon = bodyJson.lon;
  // DeviceId は環境変数から取得
  const deviceId = String(process.env.DEVICE_ID);
  const result = await putDevicePostion(lon, lat, deviceId);
  if (result) {
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
        message: 'Device Position Update Successful!',
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
      message: 'Device Position Update Failed!',
      },
      null,
      2
    ),
    };
  }
};
  