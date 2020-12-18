import AWS from 'aws-sdk';
import { AttributeValue, DynamoDBStreamEvent } from 'aws-lambda';
import { Migrator } from 'dynamodb-data-migration-migrator';

const migrator = new Migrator(
    new AWS.DynamoDB(),
    'destination',
    converter,
    ['pk', 'sk']
);

export const handler = async (event: DynamoDBStreamEvent) => {
    console.log(JSON.stringify(event));
    await migrator.handleEvent(event);
}

function converter(image: { [key: string]: AttributeValue }): { [key: string]: AttributeValue } {
    const converted = {
        ...image,
        pk: image.PartitionKey,
        sk: image.SortKey,
        gsi1_pk: image.SortKey,
        gsi1_sk: {
            S: `new-${image.someKey.S}`
        }
    };

    // @ts-ignore
    delete converted.PartitionKey;
    // @ts-ignore
    delete converted.SortKey;

    return converted;
}
