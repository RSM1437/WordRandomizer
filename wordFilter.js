class WordFilter {
    
    constructor() {
        this.includeHyphenated = false;
        this.includeProper = false;
        this.includePhrases = false;
        this.includePrefixes = false;
        this.includeSuffixes = false;
        this.includeAcronyms = false;
        this.includeProfanity = false;
    }

    filter(words, progressCallback) {
        let filteredWords = [];
        let wordsProcessed = 0;
        words.forEach(word => {
            if(this.shouldAdd(word)) {
                filteredWords.push(word);
            }
            wordsProcessed++;
            progressCallback(wordsProcessed / words.length);
        });
        return filteredWords;
    }

    shouldAdd(word) {
        if(WordUtils.hasNumber(word) || WordUtils.hasUnsupportedChars(word)) {
            return false;
        }

        if(!this.includeHyphenated && WordUtils.isHyphenated(word)) {
            return false;
        }

        if(!this.includeProper && WordUtils.isProper(word)) {
            return false;
        }
        
        if(!this.includePhrases && WordUtils.isPhrase(word)) {
            return false;
        }

        if(!this.includePrefixes && WordUtils.isPrefix(word)) {
            return false;
        }

        if(!this.includeSuffixes && WordUtils.isSuffix(word)) {
            return false;
        }

        if(!this.includeAcronyms && WordUtils.isAcronym(word)) {
            return false;
        }

        if(!this.includeProfanity && WordUtils.isProfane(word)) {
            return false;
        }

        return true;
    }
}