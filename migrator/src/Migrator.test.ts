import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import AWS from 'aws-sdk';
import { DynamoDBTestHelper } from 'dynamodb-local-test-helper';
import { Migrator } from './Migrator';

describe('Migrator', () => {
    const dynamoDBTestHelper: DynamoDBTestHelper = new DynamoDBTestHelper();
    let dynamoDbClient: AWS.DynamoDB;

    beforeAll(async () => {
        await dynamoDBTestHelper.init();

        dynamoDbClient = dynamoDBTestHelper.dynamoDbClient;
    });

    beforeEach(async () => {
        await createTable(dynamoDbClient);
    });

    afterEach(async () => {
        await deleteTable(dynamoDbClient);
    });

    afterAll(async () => {
        await dynamoDBTestHelper.finish();
    });

    it('should handle a single insert', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'INSERT',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value1'
            },
            myValue1: {
                S: 'value1'
            }
        });
    });

    it('should handle a single modify', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'MODIFY',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'oldvalue1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value1'
            },
            myValue1: {
                S: 'value1'
            }
        });
    });

    it('should handle a single remove', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        // insert the record into the database so we can delete
        await dynamoDbClient.putItem({
            Item: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                },
                myValue1: {
                    S: 'value1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'REMOVE',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toBeUndefined();
    });

    it('should handle a mix of types', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        // insert the "REMOVE" record into the database so we can delete
        await dynamoDbClient.putItem({
            Item: {
                pk: {
                    S: 'key3'
                },
                sk: {
                    S: 'sort3'
                },
                myValue1: {
                    S: 'value3'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'INSERT',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                },
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'MODIFY',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key2'
                            },
                            sk: {
                                S: 'sort2'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key2'
                            },
                            sk: {
                                S: 'sort2'
                            },
                            myValue1: {
                                S: 'value2'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key2'
                            },
                            sk: {
                                S: 'sort2'
                            },
                            myValue1: {
                                S: 'oldvalue2'
                            }
                        }
                    }
                },
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'REMOVE',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key3'
                            },
                            sk: {
                                S: 'sort3'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key3'
                            },
                            sk: {
                                S: 'sort3'
                            },
                            myValue1: {
                                S: 'value3'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        let result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value1'
            },
            myValue1: {
                S: 'value1'
            }
        });

        result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key2'
                },
                sk: {
                    S: 'sort2'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key2'
            },
            sk: {
                S: 'sort2'
            },
            gsi1_pk: {
                S: 'sort2'
            },
            gsi1_sk: {
                S: 'some-new-value2'
            },
            myValue1: {
                S: 'value2'
            }
        });

        result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key3'
                },
                sk: {
                    S: 'sort3'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toBeUndefined();
    });

    it('should handle a duplicate keys', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        // insert the "REMOVE" record into the database so we can delete
        await dynamoDbClient.putItem({
            Item: {
                pk: {
                    S: 'key3'
                },
                sk: {
                    S: 'sort3'
                },
                myValue1: {
                    S: 'value3'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'INSERT',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                },
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'MODIFY',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value2'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        // this should be the second value
        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value2'
            },
            myValue1: {
                S: 'value2'
            }
        });
    });

    it('should handle large record count', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    gsi1_pk: image.sk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };
            },
            undefined);

        const records: DynamoDBRecord[] = [];
        for (let i = 0; i < 51; i++) {
            records.push({
                awsRegion: 'us-midwest-1',
                eventName: 'INSERT',
                dynamodb: {
                    Keys: {
                        pk: {
                            S: `key${i}`
                        },
                        sk: {
                            S: `sort${i}`
                        }
                    },
                    NewImage: {
                        pk: {
                            S: `key${i}`
                        },
                        sk: {
                            S: `sort${i}`
                        },
                        myValue1: {
                            S: `value${i}`
                        }
                    }
                }
            });
        }

        const event: DynamoDBStreamEvent = {
            Records: records
        };

        await migrator.handleEvent(event);

        for (let i = 0; i < 51; i++) {
            const result = await dynamoDbClient.getItem({
                Key: {
                    pk: {
                        S: `key${i}`
                    },
                    sk: {
                        S: `sort${i}`
                    }
                },
                TableName: TABLE_NAME
            }).promise();

            expect(result.Item).toMatchObject({
                pk: {
                    S: `key${i}`
                },
                sk: {
                    S: `sort${i}`
                },
                gsi1_pk: {
                    S: `sort${i}`
                },
                gsi1_sk: {
                    S: `some-new-value${i}`
                },
                myValue1: {
                    S: `value${i}`
                }
            });
        }
    });

    it('should handle new key fields on insert', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                const converted = {
                    ...image,
                    pk: image.oldpk,
                    sk: image.oldsk,
                    gsi1_pk: image.oldsk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };

                // @ts-ignore
                delete converted.oldpk;
                // @ts-ignore
                delete converted.oldsk;

                return converted;
            },
            ['pk', 'sk']
        );

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'INSERT',
                    dynamodb: {
                        Keys: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const scan = await dynamoDbClient.scan({
            TableName: TABLE_NAME
        }).promise();

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value1'
            },
            myValue1: {
                S: 'value1'
            }
        });
    });

    it('should handle new key fields on modify', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                const converted = {
                    ...image,
                    pk: image.oldpk,
                    sk: image.oldsk,
                    gsi1_pk: image.oldsk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };

                // @ts-ignore
                delete converted.oldpk;
                // @ts-ignore
                delete converted.oldsk;

                return converted;
            },
            ['pk', 'sk']
        );

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'MODIFY',
                    dynamodb: {
                        Keys: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        },
                        OldImage: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'oldvalue1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const scan = await dynamoDbClient.scan({
            TableName: TABLE_NAME
        }).promise();

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toMatchObject({
            pk: {
                S: 'key1'
            },
            sk: {
                S: 'sort1'
            },
            gsi1_pk: {
                S: 'sort1'
            },
            gsi1_sk: {
                S: 'some-new-value1'
            },
            myValue1: {
                S: 'value1'
            }
        });
    });

    it('should handle new key fields on remove', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                const converted = {
                    ...image,
                    pk: image.oldpk,
                    sk: image.oldsk,
                    gsi1_pk: image.oldsk,
                    gsi1_sk: {
                        S: `some-new-${image.myValue1.S}`
                    }
                };

                // @ts-ignore
                delete converted.oldpk;
                // @ts-ignore
                delete converted.oldsk;

                return converted;
            },
            ['pk', 'sk']
        );

        // insert the record into the database so we can delete
        await dynamoDbClient.putItem({
            Item: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                },
                myValue1: {
                    S: 'value1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'REMOVE',
                    dynamodb: {
                        Keys: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            }
                        },
                        OldImage: {
                            oldpk: {
                                S: 'key1'
                            },
                            oldsk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        const result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'sort1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toBeUndefined();
    });

    it('should handle a modify where the new key changes', async () => {
        const migrator: Migrator = new Migrator(
            dynamoDbClient,
            TABLE_NAME,
            (image) => {
                return {
                    ...image,
                    sk: image.newSk,
                };
            },
            undefined);

        // insert the record into the database so we can delete
        await dynamoDbClient.putItem({
            Item: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'old'
                },
                myValue1: {
                    S: 'value1'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        const event: DynamoDBStreamEvent = {
            Records: [
                {
                    awsRegion: 'us-midwest-1',
                    eventName: 'MODIFY',
                    dynamodb: {
                        Keys: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            }
                        },
                        NewImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            },
                            newSk: {
                                S: 'new'
                            }
                        },
                        OldImage: {
                            pk: {
                                S: 'key1'
                            },
                            sk: {
                                S: 'sort1'
                            },
                            myValue1: {
                                S: 'value1'
                            },
                            newSk: {
                                S: 'old'
                            }
                        }
                    }
                }
            ]
        };

        await migrator.handleEvent(event);

        // the new record should exist
        let result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'new'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toBeDefined();

        // the old record should be deleted
        result = await dynamoDbClient.getItem({
            Key: {
                pk: {
                    S: 'key1'
                },
                sk: {
                    S: 'old'
                }
            },
            TableName: TABLE_NAME
        }).promise();

        expect(result.Item).toBeUndefined();
    });
});

export const TABLE_NAME = 'destination';

export async function createTable(dynamoDbClient: AWS.DynamoDB): Promise<void> {
    await dynamoDbClient.createTable({
        AttributeDefinitions: [
            {
                AttributeName: 'pk',
                AttributeType: 'S'
            },
            {
                AttributeName: 'sk',
                AttributeType: 'S'
            },
            {
                AttributeName: 'gsi1_pk',
                AttributeType: 'S'
            },
            {
                AttributeName: 'gsi1_sk',
                AttributeType: 'S'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [
            {
                IndexName: 'gsi1',
                KeySchema: [
                    {
                        AttributeName: 'gsi1_pk',
                        KeyType: 'HASH'
                    },
                    {
                        AttributeName: 'gsi1_sk',
                        KeyType: 'RANGE'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                }
            }
        ],
        KeySchema: [
            {
                AttributeName: 'pk',
                KeyType: 'HASH'
            },
            {
                AttributeName: 'sk',
                KeyType: 'RANGE'
            }
        ]
        ,
        TableName: TABLE_NAME
    }, undefined).promise();

    await dynamoDbClient.waitFor('tableExists', {
        TableName: TABLE_NAME
    }).promise();

}

export async function deleteTable(dynamoDbClient: AWS.DynamoDB): Promise<void> {
    await dynamoDbClient.deleteTable({
        TableName: TABLE_NAME
    }).promise();
}

declare global {
    interface String {
        hashCode(): number;
    }
}

String.prototype.hashCode = function (): number {
    var hash = 0;
    for (var i = 0; i < this.length; i++) {
        var character = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}
