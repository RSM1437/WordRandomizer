const request = require('request-promise');
const cheerio = require('cheerio');

class WordScrape {
    constructor(letter) {
        this.letter = letter;
        this.pageNum = 1;
        this.website = 'https://www.merriam-webster.com';
        this.page = '/browse/dictionary/';
    }

    scrape(onComplete) {
        var words = [];
        var f = (error, response, html) => {
            if(!error && response.statusCode == 200) {
                const $= cheerio.load(html);
                $(".d-block").each((i, data) => {
                    const item = $(data).text().replace(/^\s+|\s+$/gm,'');
                    var newWords = item.split('\n');
                    newWords.forEach(newWord => {
                        newWord = WordUtils.cleanSpecialChars(newWord);
                        if(WordUtils.isPhrase(newWord)) {
                            newWord = WordUtils.wrapInQuotes(newWord);
                        }
                        words.push(newWord);
                    });
                })
                this.pageNum++;
                var nextPageLink = this.page + this.letter + "/" + this.pageNum;
                var foundNextPageLink = false;
                $("a").each((i, data) => {
                    var link = ($(data).attr('href'));
                    if(link == nextPageLink) {
                        request(this.website + link, f);
                        foundNextPageLink = true;
                        return false;
                    }
                });
                if(!foundNextPageLink) {
                    onComplete(words);
                }
            }
        };
        var initialLink = this.website + this.page + this.letter;
        request(initialLink, f);
    }
}

window.getWordsFromMerriamWebster = function(onProgress, onComplete) {
    var letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
    var letterIdx = 0;
    var allWords = [];
    var letterIsDoneCallback = function(words) {
        allWords.push(words);
        if(++letterIdx < letters.length) {
            var progressPct = Math.round(letterIdx / letters.length * 100);
            onProgress(progressPct);
            var wordScrape = new WordScrape(letters[letterIdx]);
            wordScrape.scrape(letterIsDoneCallback);
        }
        else {
            allWords = allWords.flat();
            onComplete(allWords);
        }
    };
    var wordScrape = new WordScrape(letters[0]);
    wordScrape.scrape(letterIsDoneCallback);
}
