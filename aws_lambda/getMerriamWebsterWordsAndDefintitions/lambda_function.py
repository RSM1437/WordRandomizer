import boto3
import json

db_client = boto3.client('dynamodb')
table_name = 'DictionaryData_MW_2'


def lambda_handler(event, context):
    # Parse the pagination parameters from the request event
    limit = event.get('limit', 10_000)
    start_key = event.get('start_key', None)

    # Scan the DynamoDB table with pagination parameters
    scan_args = {'TableName': table_name, 'Limit': limit}
    if start_key:
        scan_args['ExclusiveStartKey'] = start_key
    response = db_client.scan(**scan_args)

    # Build the response object with the paginated data
    definitions = {}
    for item in response['Items']:
        word = item['word']['S']
        definitions_json = item['definitions']['S']
        definitions[word] = json.loads(definitions_json)

    next_start_key = response.get('LastEvaluatedKey', None)
    response_obj = {
        'statusCode': 200,
        'body': json.dumps(definitions),
    }

    # Include the next start key in the response if there are more results
    if next_start_key:
        response_obj['start_key'] = next_start_key

    return response_obj
