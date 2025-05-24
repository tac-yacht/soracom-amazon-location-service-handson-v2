import * as cdk from "aws-cdk-lib";
import * as geo from "aws-cdk-lib/aws-location";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from "constructs";
const path = require('node:path'); 

export class SoracomAmazonLocationServiceHandsonV2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // params
    const soracomAccountId = '762707677580'; // Japan coverage
    // const soracomAccountId = '950858143650'; // Global coverage
    const externalId = 'soracomug'; // You'll need a longer value for practical use.
    const notifyReceivedEmail = 'YOUR_EMAIL_ADDRESS@example.jp'
    const deviceId = 'Enter a device ID for you. Upper and lower case letters, numbers, hyphens, underscores, and dots are allowed, up to 100 characters.'
    
    /**
     * Amazon Location Service
     */
    new geo.CfnMap(this, "AmazonLocationServiceHandsonMap", {
      mapName: "amazon-location-servicehandson-map",
      pricingPlan: "RequestBasedUsage",
      description: "Map For Amazon Location Service Handson",
      configuration: {
        style: "VectorEsriStreets",
      },
    });
    const amazonLocationServiceHandsonTracker = new geo.CfnTracker(
      this,
      "AmazonLocationServiceHandsonTracker",
      {
        trackerName: "AmazonLocationServiceHandsonTracker",
        description: "Tracker For Amazon Location Service Handson",
      }
    );
    const amazonLocationServiceHandsonPlace = new geo.CfnPlaceIndex(
      this,
      "AmazonLocationServiceHandsonPlace",
      {
        indexName: "AmazonLocationServiceHandsonPlace",
        dataSource: "Esri",
        pricingPlan: "RequestBasedUsage",
        description: "Place Index For Amazon Location Service Handson",
      }
    );
    const amazonLocationServiceHandsonRoute = new geo.CfnRouteCalculator(
      this,
      "AmazonLocationServiceHandsonRoute",
      {
        calculatorName: "AmazonLocationServiceHandsonRoute",
        dataSource: "Esri",
        pricingPlan: "RequestBasedUsage",
        description: "Route Index For Amazon Location Service Handson",
      }
    );

    const amazonLocationServiceHandsonGeoFence = new geo.CfnGeofenceCollection(
      this,
      "AmazonLocationServiceHandsonGeoFence",
      {
        collectionName: "AmazonLocationServiceHandsonGeoFence",
        description: "GeoFence For Amazon Location Service Handson",
      }
    );
    new geo.CfnTrackerConsumer(
      this,
      'AmazonLocationServiceHandsonGeoFenceTrackerConsumer',
      {
        consumerArn: amazonLocationServiceHandsonGeoFence.attrCollectionArn,
        trackerName: amazonLocationServiceHandsonTracker.trackerName,
      }
    );
    /**
     * AWS IAM
     */
    const batchUpdateDevicePositionPolicyStatement = new iam.PolicyStatement(
      {
      effect: iam.Effect.ALLOW,
      resources: ["*"],
      actions: ["geo:BatchUpdateDevicePosition"],
      }
    );
    /**
     * AWS Lambda
     */
    // Put Device Postion From SORACOM GPS Multi Unit For SORACOM Funk
    const batchUpdateDevicePositionFromGpsMultiUnitForFunk = new lambda.Function(
      this,
      "BatchUpdateDevicePositionFromGpsMultiUnitForFunk",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "updateDevicePositionHandler.gpsMulchUnitHandler",
        code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
        timeout: cdk.Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        description:
          "Amazon Location Service Update Device Position. From SORACOM GPS Mutil Unit Use SORACOM Funk",
        environment: {
          AMAZON_LOCATION_SERVICE_TRACKER_NAME:
            amazonLocationServiceHandsonTracker.trackerName,
            DEVICE_ID: deviceId
        },
      }
    );

    batchUpdateDevicePositionFromGpsMultiUnitForFunk.addToRolePolicy(
      batchUpdateDevicePositionPolicyStatement
    );

    /**
     * SNS
     */
    const getFanceEventsTopic = new sns.Topic(this,'GeoFenceEventTopic', {
      topicName: 'GeoFenceEventTopic',
      displayName: 'SORACOM x Amazon Location Serviceハンズオン',
    });
    getFanceEventsTopic.addSubscription(new subscriptions.EmailSubscription(notifyReceivedEmail));

    /**
     * EventBridge Events
     */
    const geoFenceEventsRule = new events.Rule(
      this,
      'amazonLocationServiceGeoFenceEventRule',
      {
        description: 'SORACOM Handson Geofence EventRule',
        eventPattern: {
          source: ['aws.geo'],
          resources: [amazonLocationServiceHandsonGeoFence.attrCollectionArn],
          detailType: ['Location Geofence Event'],
        },
      }
    );

    geoFenceEventsRule.addTarget(new targets.SnsTopic(getFanceEventsTopic, {
      message: events.RuleTargetInput.fromMultilineText(
`デバイスがジオフェンスを入退出しました
DeviceId: ${events.EventField.fromPath('$.detail.DeviceId')}
GeoFence: ${events.EventField.fromPath('$.detail.GeofenceId')}
EventType: ${events.EventField.fromPath('$.detail.EventType')}
位置: https://www.google.com/maps?q=${events.EventField.fromPath('$.detail.Position[1]')},${events.EventField.fromPath('$.detail.Position[0]')}`
      ),
    }));

    /**
     * AWS IAM Authentication Information for SORACOM 
     */
    const iamAuthenticationInformationForSoracomPolicy = new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources:[
          batchUpdateDevicePositionFromGpsMultiUnitForFunk.functionArn
        ],
        actions: ["lambda:InvokeFunction"]
      }
    );
    const iamAuthenticationInformationForSoracomPrincipal = new iam.AccountPrincipal(
      soracomAccountId
    );
    const iamAuthenticationInformationForSoracomRole = new iam.Role(this, 'IamAuthenticationInformationForSoracomRole',
       {
        assumedBy :iamAuthenticationInformationForSoracomPrincipal,
        externalIds : [externalId],
       }
    );
    iamAuthenticationInformationForSoracomRole.addToPolicy(iamAuthenticationInformationForSoracomPolicy);
    // Output
    new cdk.CfnOutput(
      this,
      "OutputIamAuthenticationInformationForSoracomRoleRoleArn",
      {
        value: iamAuthenticationInformationForSoracomRole.roleArn,
      }
    );
    new cdk.CfnOutput(
      this,
      "OutputBatchUpdateDevicePositionFromGpsMultiUnitForFunkFunctionArn",
      {
        value: batchUpdateDevicePositionFromGpsMultiUnitForFunk.functionArn
      }
    );
    new cdk.CfnOutput(
      this,
      "OutputAmazonLocationServiceHandsonTrackerTrackerName",
      {
        value: amazonLocationServiceHandsonTracker.trackerName
      }
    );
  }
}
