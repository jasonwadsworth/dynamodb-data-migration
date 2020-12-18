# dyanmodb-data-migration
Migrates data from one DynamoDB table to another to address changing access patterns.

## Migrator
[Migrator](migrator) - this does the work of moving the data from one table (via DynamoDB streams) to another.

## Scanner
COMING SOON! - this does the work of making sure each record in the current table is pushed through the stream
