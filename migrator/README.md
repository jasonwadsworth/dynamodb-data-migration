# dyanamodb-data-migrations-migrator

Use this module to simplify a data migration with DynamoDB Streams.

This module is designed to take care of much of the work related to migrating data from one DynamoDB table to another using DynamoDB Streams. If you find yourself needing to make a change in you data you can use DynamoDB streams to track changes from the source table and push the changes to the new table. Because DynamoDB streams are guaranteed to be in order for a given partion you can be sure that the latest data in the new table will be based on the most recent change in the old.

To use the module you simply need to supply the `Migrator` class a `DynamoDB` client, the name of the destination, a function to convert the data from the old table to the new, and optionally the names of the keys in the new table (required if they are not the same as the old).

Your code would look something like this:

```
import AWS from 'aws-sdk';
import { AttributeValue, DynamoDBStreamEvent } from 'aws-lambda';
import { Migrator } from 'dynamodb-data-migration-migrator';

const migrator = new Migrator(
    new AWS.DynamoDB(),
    'my-destination-table',
    converter,
    ['pk', 'sk']
);

export const handler = async (event: DynamoDBStreamEvent) => {
    await migrator.handleEvent(event);
}

function converter(image: { [key: string]: AttributeValue }): { [key: string]: AttributeValue } {
    const converted = {
        ...image,
        pk: image.PartitionKey,
        sk: image.SortKey,
        gsi1_pk: image.SortKey,
        gsi1_sk: {
            S: `new-${image.myValue1.S}`
        }
    };

    // @ts-ignore
    delete converted.PartitionKey;
    // @ts-ignore
    delete converted.SortKey;

    return converted;
}
```

The migrator will take each insert/update to the old table and convert the item into an item matching your new format before putting the item in the new table. All deletes from the old table will also be converted so that the new keys can be used to perform a delete in the new table.
