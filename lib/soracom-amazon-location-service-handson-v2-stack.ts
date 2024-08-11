import * as cdk from "aws-cdk-lib";
import * as geo from "aws-cdk-lib/aws-location";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class SoracomAmazonLocationServiceHandsonV2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // params
    const soracomAccountId = '762707677580'; // Japan coverage
    // const soracomAccountId = '950858143650'; // Global coverage
    const externalId = 'soracomug'; // You'll need a longer value for practical use.
    const lineNotifyToken = 'YOUR LINE_NOTIFY_TOKEN'
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
        pricingPlan: "RequestBasedUsage",
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
        pricingPlan: "RequestBasedUsage",
        description: "GeoFence For Amazon Location Service Handson",
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
    // Put Device Postion From SORACOM GPS Multi Unit For SORACOM Beam
    const batchUpdateDevicePositionFromGpsMultiUnitBeam = new NodejsFunction(
      this,
      "BatchUpdateDevicePositionFromGpsMultiUnitBeam",
      {
        runtime: lambda.Runtime.NODEJS_LATEST,
        entry: "lambda/updateDevicePositionBeamHandler.ts",
        handler: "gpsMultiUnitHandler",
        timeout: cdk.Duration.seconds(30),
        tracing: lambda.Tracing.ACTIVE,
        description:
          "Amazon Location Service Update Device Position. From SORACOM GPS Mutil Unit Use SORACOM Beam",
        environment: {
          AMAZON_LOCATION_SERVICE_TRACKER_NAME:
            amazonLocationServiceHandsonTracker.trackerName,
        },
      }
    );

    batchUpdateDevicePositionFromGpsMultiUnitBeam.addToRolePolicy(
      batchUpdateDevicePositionPolicyStatement
    );
    const batchUpdateDevicePositionFromGpsMultiUnitBeamUrl =
      new lambda.FunctionUrl(
        this,
        "BatchUpdateDevicePositionFromGpsMultiUnitBeamUrl",
        {
          function: batchUpdateDevicePositionFromGpsMultiUnitBeam,
          authType: lambda.FunctionUrlAuthType.AWS_IAM
        }
      );
    new cdk.CfnOutput(
      this,
      "TheBatchUpdateDevicePositionFromGpsMultiUnitBeamUrl",
      {
        value: batchUpdateDevicePositionFromGpsMultiUnitBeamUrl.url,
      }
    );
    // IAM Role
    const lambdaFunctionUrlsInvokeIamPolicy = new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        resources:[
          batchUpdateDevicePositionFromGpsMultiUnitBeamUrl.functionArn
        ],
        actions: ["lambda:InvokeFunctionUrl"]
      }
    );
    const lambdaFunctionUrlsInvokePrincipal = new iam.AccountPrincipal(
      soracomAccountId
    );
    const lambdaFunctionUrlsInvokeIamRole = new iam.Role(this, 'LambdaFunctionUrlsInvokeRole',
       {
        assumedBy :lambdaFunctionUrlsInvokePrincipal,
        externalIds : [externalId],
       }
    );
    lambdaFunctionUrlsInvokeIamRole.addToPolicy(lambdaFunctionUrlsInvokeIamPolicy);
    new cdk.CfnOutput(
      this,
      "LambdaFunctionUrlsInvokeIamRoleArn",
      {
        value: lambdaFunctionUrlsInvokeIamRole.roleArn,
      }
    );

    const geoFenceNotify = new NodejsFunction(this, 'geoFenceNotify', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      entry: 'lambda/geoFenceNotifyhandler.js',
      handler: 'sendNotificationHandler',
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      description: 'Amazon Location Service GeoFence Notify for LINE',
      environment: {
        LINE_NOTIFY_TOKEN: lineNotifyToken,
      },
    });
    const geoFenceNotifyPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'kms:Decrypt'],
    });
    geoFenceNotify.addToRolePolicy(geoFenceNotifyPolicyStatement);

    /**
     * SQS DLQ
     */
    const geoFenceEventsDlq = new sqs.Queue(
      this,
      'necklaceOfArtemisSystemGeoFenceEventDlq'
    );
    /**
     * EventBridge Events
     */
    const geoFenceEventsRule = new events.Rule(
      this,
      'necklaceOfArtemisSystemGeoFenceEventRule',
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
  }
}
