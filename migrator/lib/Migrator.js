"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migrator = void 0;
class Migrator {
    constructor(dynamoDBClient, newTable, imageConverter, newKeyFields) {
        this.dynamoDBClient = dynamoDBClient;
        this.newTable = newTable;
        this.imageConverter = imageConverter;
        this.newKeyFields = newKeyFields;
    }
    async handleEvent(event) {
        var _a;
        const writes = [];
        for (const record of event.Records) {
            const convertedImage = this.imageConverter(record.dynamodb.NewImage ? record.dynamodb.NewImage : record.dynamodb.OldImage);
            const keys = this.getNewKeys(convertedImage, (_a = this.newKeyFields) !== null && _a !== void 0 ? _a : Object.keys(record.dynamodb.Keys));
            // if we come across a record that we've already seen we need to go ahead and run that batch because we can't include the same key in the batch more than once
            if (writes.findIndex(w => this.compareKeys(w.key, keys)) !== -1) {
                await this.batchWriteRecursive({
                    [this.newTable]: writes.map(w => w.writeRequest)
                });
                // clear our array
                writes.splice(0, writes.length);
            }
            if ((record === null || record === void 0 ? void 0 : record.eventName) === 'INSERT' || (record === null || record === void 0 ? void 0 : record.eventName) === 'MODIFY') {
                writes.push({
                    key: keys,
                    writeRequest: {
                        PutRequest: {
                            Item: convertedImage
                        }
                    }
                });
            }
            else if ((record === null || record === void 0 ? void 0 : record.eventName) === 'REMOVE') {
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
    async batchWriteRecursive(requestItems) {
        var _a;
        const result = await this.dynamoDBClient.batchWriteItem({
            RequestItems: requestItems
        }).promise();
        if (result.UnprocessedItems && ((_a = result.UnprocessedItems[this.newTable]) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            await this.batchWriteRecursive(result.UnprocessedItems);
        }
    }
    getNewKeys(convertedItem, keyFields) {
        const newKeys = {};
        for (const key of Object.keys(convertedItem)) {
            if (keyFields.includes(key)) {
                newKeys[key] = convertedItem[key];
            }
        }
        return newKeys;
    }
    compareKeys(key1, key2) {
        for (const key of Object.keys(key1)) {
            if ((key1[key].N && key1[key].N === key2[key].N)
                ||
                    (key1[key].S && key1[key].S === key2[key].S)
                ||
                    (key1[key].B && key1[key].B === key2[key].B)) {
                return true;
            }
        }
        return false;
    }
}
exports.Migrator = Migrator;
//# sourceMappingURL=Migrator.js.map