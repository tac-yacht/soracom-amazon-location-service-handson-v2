import * as cdk from "aws-cdk-lib";
import * as geo from "aws-cdk-lib/aws-location";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
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
    const lineNotifyToken = 'YOUR LINE NOTIFY TOKEN'
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

    const geoFenceNotify = new lambda.Function(this, 'geoFenceNotify', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "geoFenceNotifyhandler.sendNotificationHandler",
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      description: 'Amazon Location Service GeoFence Notify for LINE',
      environment: {
        LINE_NOTIFY_TOKEN: lineNotifyToken,
      },
    });

    /**
     * SQS DLQ
     */
    const geoFenceEventsDlq = new sqs.Queue(
      this,
      'amazonLocationServiceGeoFenceEventDlq'
    );
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
    geoFenceEventsRule.addTarget(
      new targets.LambdaFunction(geoFenceNotify, {
        deadLetterQueue: geoFenceEventsDlq,
        maxEventAge: cdk.Duration.hours(2),
        retryAttempts: 2,
      })
    );
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
