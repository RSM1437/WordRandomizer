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

    async filter(words, progressCallback) {
        const batchSize = 1000;
        let filteredWords = [];
        let wordsProcessed = 0;
      
        return new Promise((resolve) => {
          const processBatch = async (startIndex) => {
            const endIndex = Math.min(startIndex + batchSize, words.length);
            const batchWords = words.slice(startIndex, endIndex);
      
            for (const word of batchWords) {
              if (this.shouldAdd(word)) {
                filteredWords.push(word);
              }
              wordsProcessed++;
            }
      
            progressCallback(wordsProcessed / words.length * 100);
      
            if (endIndex < words.length) {
              // Delay between processing batches to avoid blocking the UI
              setTimeout(() => {
                processBatch(endIndex);
              }, 0);
            } else {
              resolve(filteredWords);
            }
          };
      
          processBatch(0);
        });
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