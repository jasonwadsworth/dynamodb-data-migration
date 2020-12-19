import AWS from 'aws-sdk';
import { Context } from 'aws-lambda';
import { Key } from 'aws-sdk/clients/dynamodb';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: any, context: Context) => {
    console.log(JSON.stringify(event));

    let lastEvaluatedKey: Key = event?.input?.Payload?.LastEvaluatedKey;

    do {
        const response = await dynamodb.scan({
            TableName: 'source',
            Limit: 25,
            ExclusiveStartKey: lastEvaluatedKey,
            ProjectionExpression: 'PartitionKey,SortKey'
        }).promise();

        const promises: Promise<AWS.DynamoDB.DocumentClient.UpdateItemOutput>[] = [];
        for (const item of response.Items) {
            promises.push(dynamodb.update({
                Key: item,
                TableName: 'source',
                ConditionExpression: 'attribute_exists(#pk)',
                ExpressionAttributeNames: {
                    '#pk': 'PartitionKey',
                    '#migrated': '_migrated'
                },
                ExpressionAttributeValues: {
                    ':now': new Date().toISOString()
                },
                UpdateExpression: 'SET #migrated = :now'
            }).promise());
        }

        await Promise.all(promises);

        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey && context.getRemainingTimeInMillis() > 30000);

    return {
        LastEvaluatedKey: lastEvaluatedKey
    };
}
