import AWS from 'aws-sdk';
export declare const TABLE_NAME = "destination";
export declare function createTable(dynamoDbClient: AWS.DynamoDB): Promise<void>;
export declare function deleteTable(dynamoDbClient: AWS.DynamoDB): Promise<void>;
declare global {
    interface String {
        hashCode(): number;
    }
}
