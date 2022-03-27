class WordUtils {
    //jspdf doesn't support UTF-8 characters :(
    static cleanSpecialChars(string) {
        var newString = string.replace('ʽ', '\'');
        return newString;
    }

    static wrapInQuotes(str) {
        var newString = "";
        if(!str.startsWith('"')) {
            newString += '"';
        }
        newString += str;
        if(!str.endsWith('"')) {
            newString += '"';
        }
        return newString;
    }

    static hasNumber(myString) {
        return /\d/.test(myString);
    }

    //jspdf doesn't support UTF-8 characters :(
    static hasUnsupportedChars(string) {
        return/[^\x00-\x7F]/g.test(string);
    }

    static isLetter(c) {
        return c.toLowerCase() != c.toUpperCase();
    }

    static isUpperCaseLetter(c) {
        return this.isLetter(c) && c === c.toUpperCase();
    }

    static isLowerCaseLetter(c) {
        return this.isLetter(c) && c === c.toLowerCase();
    }

    static isHyphenated(word) {
        return word.includes("-") && !word.startsWith("-") && !word.endsWith("-") && !word.includes(" ");
    }

    static indexOfFirstLetter(string) {
        var firstLetterIndex = null;
        for(let i = 0; i < string.length; i++) {
            if(this.isLetter(string.charAt(i))) {
                firstLetterIndex = i;
                break;
            }
        }
        return firstLetterIndex;
    }

    static isProper(word) {
        var firstLetterAt = this.indexOfFirstLetter(word);
        if(firstLetterAt == null || !this.isUpperCaseLetter(word.charAt(firstLetterAt))) {
            return false;
        }
        for(let i = firstLetterAt + 1; i < word.length; i++) {
            if(this.isLetter(word.charAt(i)) && !this.isLowerCaseLetter(word.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    static isPhrase(word) {
        return word.includes(" ");
    }

    static isPrefix(word) {
        return word.endsWith("-");
    }

    static isSuffix(word) {
        return word.startsWith("-");
    }

    static isAcronym(word) {
        var isLowercaseAcronym = true;
        for(let i = 0; i < word.length; i += 2) {
            if(i+1 >= word.length || !this.isLetter(word.charAt(i)) || word.charAt(i+1) != '.') {
                isLowercaseAcronym = false;
                break;
            }
        }

        var isUpeprcaseAcronym = true;
        for (let i = 0; i < word.length; i++) {
            if(!this.isUpperCaseLetter(word.charAt(i)) && word.charAt(i) != "." && word.charAt(i) != '/' && word.charAt(i) != '&' && (i != word.length - 1 || word.charAt(i) != 's') && (i != word.length - 2 || word.charAt(i) != '\'')) {
                isUpeprcaseAcronym = false;
                break;
            }
        }
        if(!isLowercaseAcronym && !isUpeprcaseAcronym) {
            return false;
        }
        return true;
    }
}