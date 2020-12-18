import AWS from 'aws-sdk';
import { AttributeValue, DynamoDBStreamEvent } from 'aws-lambda';
export declare class Migrator {
    private dynamoDBClient;
    private newTable;
    private imageConverter;
    private newKeyFields;
    constructor(dynamoDBClient: AWS.DynamoDB, newTable: string, imageConverter: (image: {
        [key: string]: AttributeValue;
    }) => {
        [key: string]: AttributeValue;
    }, newKeyFields?: string[] | undefined);
    handleEvent(event: DynamoDBStreamEvent): Promise<void>;
    private batchWriteRecursive;
    private getNewKeys;
    private compareKeys;
}
