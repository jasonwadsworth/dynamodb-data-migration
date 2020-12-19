import AWS from 'aws-sdk';
import { AttributeValue, DynamoDBStreamEvent } from 'aws-lambda'

export class Migrator {
    private dynamoDBClient: AWS.DynamoDB;
    private newTable: string;
    private imageConverter: (image: { [key: string]: AttributeValue }) => { [key: string]: AttributeValue };
    private newKeyFields: string[] | undefined;

    constructor(
        dynamoDBClient: AWS.DynamoDB,
        newTable: string,
        imageConverter: (image: { [key: string]: AttributeValue }) => { [key: string]: AttributeValue },
        newKeyFields?: string[] | undefined
    ) {
        this.dynamoDBClient = dynamoDBClient;
        this.newTable = newTable;
        this.imageConverter = imageConverter;
        this.newKeyFields = newKeyFields;
    }

    public async handleEvent(event: DynamoDBStreamEvent): Promise<void> {
        const writes: {
            key: { [key: string]: AttributeValue }, writeRequest: AWS.DynamoDB.WriteRequest
        }[] = [];

        for (const record of event.Records) {
            const convertedImage = this.imageConverter(record.dynamodb!.NewImage ? record.dynamodb!.NewImage! : record.dynamodb!.OldImage!);
            const keys = this.getNewKeys(convertedImage, this.newKeyFields ?? Object.keys(record.dynamodb!.Keys!));

            // if we come across a record that we've already seen we need to go ahead and run that batch because we can't include the same key in the batch more than once
            if (writes.findIndex(w => this.compareKeys(w.key, keys)) !== -1) {
                await this.batchWriteRecursive({
                    [this.newTable]: writes.map(w => w.writeRequest)
                });

                // clear our array
                writes.splice(0, writes.length);
            }

            if (record?.eventName === 'INSERT' || record?.eventName === 'MODIFY') {
                writes.push({
                    key: keys,
                    writeRequest: {
                        PutRequest: {
                            Item: convertedImage
                        }
                    }
                });
            }

            if (record?.eventName === 'MODIFY') {
                const convertedOldImage = this.imageConverter(record.dynamodb!.OldImage!);
                const oldImageKeys = this.getNewKeys(convertedOldImage, this.newKeyFields ?? Object.keys(record.dynamodb!.Keys!));

                if (!this.compareKeys(keys, oldImageKeys)) {
                    writes.push({
                        key: oldImageKeys, // TODO: there is a chance this key is already in the array
                        writeRequest: {
                            DeleteRequest: {
                                Key: oldImageKeys
                            }
                        }
                    });
                }
            }

            if (record?.eventName === 'REMOVE') {
                writes.push({
                    key: keys,
                    writeRequest: {
                        DeleteRequest: {
                            Key: keys
                        }
                    }
                });
            }

            // max batch size is 25
            // TODO: need to protect against the max batch size of 16MB
            if (writes.length === 25) {
                await this.batchWriteRecursive({
                    [this.newTable]: writes.map(w => w.writeRequest)
                });

                // clear our array
                writes.splice(0, writes.length);
            }
        }

        // write whatever might be left
        if (writes.length !== 0) {
            await this.batchWriteRecursive({
                [this.newTable]: writes.map(w => w.writeRequest)
            });
        }
    }

    private async batchWriteRecursive(requestItems: AWS.DynamoDB.BatchWriteItemRequestMap): Promise<void> {
        const result = await this.dynamoDBClient.batchWriteItem({
            RequestItems: requestItems
        }).promise()

        if (result.UnprocessedItems && result.UnprocessedItems[this.newTable]?.length > 0) {
            await this.batchWriteRecursive(result.UnprocessedItems);
        }
    }

    private getNewKeys(convertedItem: { [key: string]: AttributeValue }, keyFields: string[]): { [key: string]: AttributeValue } {
        const newKeys: { [key: string]: AttributeValue } = {};
        for (const key of Object.keys(convertedItem)) {
            if (keyFields.includes(key)) {
                newKeys[key] = convertedItem[key];
            }
        }

        return newKeys;
    }

    private compareKeys(key1: { [key: string]: AttributeValue }, key2: { [key: string]: AttributeValue }): boolean {
        for (const key of Object.keys(key1)) {
            if (
                (key1[key].N && key1[key].N !== key2[key].N)
                ||
                (key1[key].S && key1[key].S !== key2[key].S)
                ||
                (key1[key].B && key1[key].B !== key2[key].B)
            ) {
                return false;
            }
        }

        return true;
    }
}
