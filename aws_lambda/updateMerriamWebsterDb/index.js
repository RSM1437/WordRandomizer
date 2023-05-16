const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({
    region: 'us-east-1',
    httpOptions: {
        timeout: 900000,
        connectTimeout: 900000
    }
});
const dynamoDB = new AWS.DynamoDB();
let totalNumWordsUploaded = 0;

exports.handler = async (event, context) => {
    const letter = event.letter;
    const startPage = event.startPage || 1;
    const endPage = event.endPage || await get_num_pages(letter);

    const pagePromises = [];
    for (let i = startPage; i <= endPage; i++) {
        pagePromises.push(get_words_and_defintions_and_update_db(letter, i));
    }
    await Promise.all(pagePromises);
    
    const response = {
        statusCode: 200,
        body: 'Uploaded ' + totalNumWordsUploaded + ' words for letter ' + letter + ' (' + (endPage - startPage + 1) + ' pages)',
    };
    return response;
}

async function get_num_pages(letter)
{
    const params = {
        FunctionName: 'mwScraper',
        Payload: JSON.stringify({
            'function': 'get_num_pages',
            'letter': letter,
        })
    };

    const result = await lambda.invoke(params).promise();
    if (result.StatusCode !== 200) {
        throw new Error(`Failed to get number of pages for letter ${letter}.`);
    }

    const resultPayload = JSON.parse(result.Payload);
    const numPages = resultPayload.body;
    return numPages;
}

async function get_words_and_defintions_and_update_db(letter, pageNumber) {
    const result = await get_words_and_defintions(letter, pageNumber);
    if (result.StatusCode !== 200) {
        throw new Error(`Failed to retrieve words and definitions for letter ${letter} page ${pageNumber}. Response: ${JSON.stringify(result)}}`);
    }

    const resultPayload = JSON.parse(result.Payload);
    if (!resultPayload.body) {
        throw new Error(`Failed to retrieve words and definitions for letter ${letter} page ${pageNumber}. Response: ${JSON.stringify(result)}}`);
    }
    jsonPerWord = {};
    let definitionsPerWord = JSON.parse(resultPayload.body);
    Object.entries(definitionsPerWord).forEach(([word, definitions]) => {
        const definitionsString = JSON.stringify(definitions);
        if (definitionsString === '{}') {
            throw new Error(`Failed to retrieve definitions for word ${word} on page ${pageNumber}: no definitions found.`);
        }
        jsonPerWord[word] = definitionsString;
    });
    await upload_to_db(jsonPerWord);
}

async function get_words_and_defintions(letter, pageNumber) {
    const params = {
        FunctionName: 'mwScraper',
        Payload: JSON.stringify({
            'function': 'get_words_and_defintions',
            'letter': letter,
            'page_number': pageNumber,
        })
    };

    let res = await lambda.invoke(params).promise();
    return res;
}

async function upload_to_db(wordsAndDefinitions) {
    let putRequests  = [];
    let deleteRequests = [];
    for (let word in wordsAndDefinitions) {
        let definitions = wordsAndDefinitions[word];

        let deleteRequest = {
            DeleteRequest: {
                Key: {
                    "word": { "S": word },
                }
            }
        };
        deleteRequests.push(deleteRequest);

        let putRequest = {
            PutRequest: {
                Item: {
                    "word": { "S": word },
                    "definitions": { "S": definitions },
                }
            }
        };
        putRequests.push(putRequest);

        if (putRequests.length >= 25) {
            await batchWriteToDb(deleteRequests);
            await batchWriteToDb(putRequests);
            totalNumWordsUploaded += putRequests.length;
            putRequests.length = 0;
            deleteRequests.length = 0;
        }
    }

    if (putRequests.length > 0) {
        await batchWriteToDb(deleteRequests);
        await batchWriteToDb(putRequests);
        totalNumWordsUploaded += putRequests.length;
    }
}

async function batchWriteToDb(requests) {
    var params = {
        RequestItems: {
            "DictionaryData_MW_2": requests
        }
    };
    await dynamoDB.batchWriteItem(params).promise();
}
