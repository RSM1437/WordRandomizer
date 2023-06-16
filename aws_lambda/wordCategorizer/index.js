exports.handler = async (event, context) => {
    const words = event.words;
    const wordsPerCategory = {};
    var Filter = require('bad-words');
    var profanityFilter = new Filter();
    for (const word of words) {
        const category = await categorize(word, profanityFilter);
        if (!wordsPerCategory[category]) {
            wordsPerCategory[category] = [];
        }
        wordsPerCategory[category].push(word);
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify(wordsPerCategory),
    };
    return response;
}

async function categorize(word, profanityFilter) {
    if (profanityFilter.isProfane(word)) {
        return 'profanity';
    }

    if (word.startsWith('-')) {
        return 'suffix';
    }

    if (word.endsWith('-')) {
        return 'prefix';
    }

    if (word.includes(' ')) {
        return 'phrase';
    }

    if (word.includes('-')) {
        return 'hyphenated';
    }

    if (isProperNoun(word)) {
        return 'proper noun';
    }

    if (isAcronym(word)) {
        return 'acronym';
    }
    
    return 'other';
}


function isProperNoun(word) {
    var firstLetterAt = indexOfFirstLetter(word);
    if(firstLetterAt == null || !isUpperCaseLetter(word.charAt(firstLetterAt))) {
        return false;
    }
    for(let i = firstLetterAt + 1; i < word.length; i++) {
        if(isLetter(word.charAt(i)) && !isLowerCaseLetter(word.charAt(i))) {
            return false;
        }
    }
    return true;
}

function isAcronym(word) {
    var isLowercaseAcronym = true;
    for(let i = 0; i < word.length; i += 2) {
        if(i+1 >= word.length || !isLetter(word.charAt(i)) || word.charAt(i+1) != '.') {
            isLowercaseAcronym = false;
            break;
        }
    }

    var isUppercaseAcronym = true;
    for (let i = 0; i < word.length; i++) {
        if(!isUpperCaseLetter(word.charAt(i)) && word.charAt(i) != "." && word.charAt(i) != '/' && word.charAt(i) != '&' && (i != word.length - 1 || word.charAt(i) != 's') && (i != word.length - 2 || word.charAt(i) != '\'')) {
            isUppercaseAcronym = false;
            break;
        }
    }
    if(!isLowercaseAcronym && !isUppercaseAcronym) {
        return false;
    }
    return true;
}

function indexOfFirstLetter(string) {
    var firstLetterIndex = null;
    for(let i = 0; i < string.length; i++) {
        if(isLetter(string.charAt(i))) {
            firstLetterIndex = i;
            break;
        }
    }
    return firstLetterIndex;
}

function isUpperCaseLetter(c) {
    return isLetter(c) && c === c.toUpperCase();
}

function isLetter(c) {
    return c.toLowerCase() != c.toUpperCase();
}

function isLowerCaseLetter(c) {
    return isLetter(c) && c === c.toLowerCase();
}
