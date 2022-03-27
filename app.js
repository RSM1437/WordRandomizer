const blankCellColor = [255, 255, 255];
var fileText = "";
var pageNum = 1;
var readingFile = false;
var generatingPdf = false;
var pdfWorker;
var merriamWebsterWords = [];
var filteredDictionaryWords = [];
var oedWords = [];
var downloadInProgress = false;
var refPdf = null;
var refPdfWords = null;
var prevWords;

// Initialize the Amazon Cognito credentials provider
AWS.config.region = 'us-east-1'; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    //this pool id is from a new Cognito identity pool confifured to be able to execute the proper AWS lambda function
    IdentityPoolId: 'us-east-1:3275e330-53dc-4449-9a73-5f89165171a0',
});
var lambdaOptions = {
    maxRetries: 1,
    httpOptions: {
        timeout: 600000
    }
};
var lambda = new AWS.Lambda(lambdaOptions);

//As a worker normally take another JavaScript file to execute we convert the function in an URL: http://stackoverflow.com/a/16799132/2576706
function getScriptPath(foo){ return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'})); }

function genPDF() {

    pdfWorker = new Worker(getScriptPath(function(){
        self.addEventListener('message', function(e) {
            var words = e.data.words;
            if(words.length == 0) {
                self.postMessage({
                    row: [],
                });
                return;
            }

            var numColumns = e.data.numColumns;
            var row = [];
            var highlightInRow = new Set();
            var refWords = e.data.refWords;
            var colIndex = 0;
            
            for(var i = 0; i < words.length; i++) {
                var word = words[i];
                row.push(word);
                if(refWords && !refWords.has(word)) {
                    highlightInRow.add(word);
                }
                ++colIndex;
                if(colIndex == numColumns) {
                    colIndex = 0;
                    self.postMessage({
                        row: row,
                        highlight: highlightInRow
                    });
                    row = [];
                    highlightInRow = new Set();
                }
            }
            if(row.length > 0) {
                self.postMessage({
                    row: row,
                    highlight: highlightInRow
                });
                row = [];
                highlightInRow = new Set();
            }
        }, false);
    }));
    var wordsProcessed = 0;
    var words = [];
    if(document.getElementById('keepWordsCheckbox').checked) {
        words = prevWords;
    } 
    else {
        words = getWords();
        shuffle(words);
        prevWords = words;
    }
    var numWords = words.length;
    var numColumns = document.getElementById('numColumnsOption').value;
    var doc = new jsPDF();
    var textColor = hexToRgb(document.getElementById('textColorOption').value);
    var fontSize = document.getElementById('fontSizeOption').value;
    var fontStyle = getFontStyle();
    var borderWidth = document.getElementById('cellBordersOption').checked ? 0.1 : 0;
    var outputFilename = getPdfFilename();
    pdfWorker.addEventListener('message', function(e) {
        doc.autoTable({
            body: [e.data.row],
            startY: doc.lastAutoTable ? doc.lastAutoTable.finalY : 20,
            didParseCell: function (data) {
                if(data.cell.raw != undefined) {
                    if(e.data.highlight && e.data.highlight.has(data.cell.raw)) {
                        data.cell.styles.fillColor = hexToRgb(document.getElementById('highlightColorOption').value);
                        data.cell.styles.textColor = hexToRgb(document.getElementById('highlightedTextColorOption').value);
                    }
                    else {
                        data.cell.styles.fillColor = getCellColor(data.column.index);
                        data.cell.styles.textColor = textColor;
                    }
                }
                else {
                    data.cell.styles.fillColor = blankCellColor;
                }
                
                data.cell.styles.lineWidth = borderWidth;
                data.cell.styles.lineColor = [0, 0, 0];
                data.cell.styles.fontStyle = fontStyle;
                data.cell.styles.fontSize = fontSize;
                data.cell.styles.cellWidth = 181 / numColumns;
        }});
        var progBar = document.getElementById("pdfProgressBar");
        wordsProcessed += e.data.row.length;
        var progPct = numWords > 0 ? Math.round((wordsProcessed / numWords) * 100) : 100;
        progBar.style.width = progPct + "%";
        progBar.innerHTML = progPct + "%";
        if(wordsProcessed == numWords) {
            doc.save(outputFilename);
            generatingPdf = false;
            document.getElementById("PdfSuccessMsg").style.display = "block";
            document.getElementById('pdfCancelBtn').style.display = "none";
            document.getElementById("keepWords").style.display = "block";
            pdfWorker.terminate();
        }
    }, false);
    generatingPdf = true;
    document.getElementById("PdfSuccessMsg").style.display = "none";
    var progBar = document.getElementById("pdfProgressBar");
    progBar.style.display = "block";
    progBar.style.width = 0 + "%";
    progBar.innerHTML = 0 + "%";
    document.getElementById('pdfCancelBtn').style.display = "block";
    var highlightNewWords = document.getElementById('highlightNewWordsCheckbox').checked;
    if(highlightNewWords) {
        getRefPdfWords().then(refWords => {
            pdfWorker.postMessage({
                numColumns: numColumns,
                words: words,
                refWords: refWords
            });
        });
    }
    else {
        pdfWorker.postMessage({
            numColumns: numColumns,
            words: words,
            refWords: null
        });
    }
    
}

function cancelPDF() {
    document.getElementById('pdfCancelBtn').style.display = "none";
    document.getElementById("pdfProgressBar").style.display = "none";
    pdfWorker.terminate();
}

function getCellColor(colIndex) {
    var evenColumnColor = hexToRgb(document.getElementById('columnColor1').value);
    var oddColumnColor = hexToRgb(document.getElementById('columnColor2').value);
    return colIndex % 2 === 0 ? evenColumnColor : oddColumnColor;
}

function getPdfFilename() {
    var outputFilenameBox = document.getElementById("outputFilename");
    var outputFilename = outputFilenameBox.value;
    if(outputFilename.length === 0) {
        outputFilename = outputFilenameBox.placeholder;
    }
    if(!outputFilename.endsWith(".pdf")) {
        outputFilename += ".pdf";
    }
    return outputFilename;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        [parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)]
        : null;
}

function getWords() {
    var words = [];
    if(document.getElementById("wordSourceText").checked) {
        words = getWordsFromText(document.getElementById('wordSourceTextarea').value);
    }
    else if (document.getElementById("wordSourceFile").checked) {
        words = getWordsFromText(fileText);
    }
    else if(document.getElementById("wordSourceDictionary").checked) {
        words = filteredDictionaryWords;
    }
    return words;
}

function getWordsFromText(text) {
    var words = [];
    var lines = text.split("\n");
    for(var i = 0; i < lines.length; ++i) {
        var wordsOnLine = lines[i].split(" ");
        for(var j = 0; j < wordsOnLine.length; ++j) {
            var word = wordsOnLine[j].trim().replace('\r', '');
            if(word.length > 0) {
                words.push(word);
            }
        }
    }
    return words;
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

function nextPage() {
    if(downloadInProgress) {
        return;
    }

    document.getElementById('page' + pageNum).style.display = "none";
    ++pageNum;
    document.getElementById('page' + pageNum).style.display = "block";
}

function prevPage() {
    document.getElementById('page' + pageNum).style.display = "none";
    --pageNum;
    document.getElementById('page' + pageNum).style.display = "block";
}

function getFontStyle() {
    var bold = document.getElementById('fontStyleOptionBold').checked;
    var italic = document.getElementById('fontStyleOptionItalic').checked;
    var style = "";
    if(!bold && !italic) {
        style = 'normal';
    }
    else {
        if(bold) {
            style = 'bold';
        }
        if(italic) {
            style += 'italic';
        }
    }
    return style;
}



document.getElementById('wordSourceFileInput').addEventListener('change', function() {
    var fileWorker = new Worker(getScriptPath(function(){
        self.addEventListener('message', function(e) {
            var fr = new FileReader();;
            fr.onload = function() {
                self.postMessage({text: fr.result});
            } 
            fr.onprogress = function(pe) {
                if(pe.lengthComputable) {
                    var progressPct = Math.round((pe.loaded / pe.total) * 100);
                    self.postMessage({prog: progressPct});
                }
            }
            fr.readAsText(e.data);
        }, false);
    }));
    fileWorker.addEventListener('message', function(e) {
        var progBar = document.getElementById("fileUploadProgressBar");
        progBar.style.display = "block";
        if(e.data.hasOwnProperty('prog')) {
            var progress = e.data.prog;
            progBar.style.width = progress + "%";
            progBar.innerHTML = progress + "%";
        }
        if(e.data.hasOwnProperty('text')) {
            readingFile = false;
            fileText = e.data.text;
            fileWorker.terminate();
        }
    }, false);
    readingFile = true;
    fileWorker.postMessage(this.files[0]);
})

function downloadWordsFromDictionary() {
    if(downloadInProgress) {
        return;
    }

    if(document.getElementById('dictionaryOptionMerriamWebster').checked) {
        downloadWordsFromMerriamWebster();
    }
    else {
        downloadWordsFromOxfordEnglishDictionary();
    }
}

function downloadWordsFromMerriamWebster() {
    var dispRes = function() {
        document.getElementById("DictionaryDownloadSuccessMsg").innerText = "Successfully imported " + filteredDictionaryWords.length.toLocaleString() + " words from Merriam-Webster!";
        document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'block';
        document.getElementById('nextBtn').style.display = "block";
        document.getElementById("dictionaryImportButton").disabled = false;
    }
    var progBar = document.getElementById("dictionaryDownloadProgressBar");
    var updateProgress = function(progressPct) {
        progBar.style.width = progressPct + "%";
        progBar.innerHTML = progressPct + "%";
    };
    document.getElementById("dictionaryImportButton").disabled = true;
    document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'none';
    document.getElementById('nextBtn').style.display = "none";
    downloadInProgress = true;
    progBar.style.display = "block";
    updateProgress(1);
    if(merriamWebsterWords.length > 0) {
        downloadInProgress = true;
        new Promise((resolve) => {
            filterDictionaryWords(merriamWebsterWords, (progress) => updateProgress(Math.round(progress * 100)), (newWords) => {
                resolve(newWords);
            });
        }).then((newWords) => {
            filteredDictionaryWords = newWords;
            updateProgress(100);
            dispRes();
            downloadInProgress = false;
        });
        return;
    }

    var onProgress = function(progressPct) {
        updateProgress(progressPct);
    }
    var onComplete = function(downloadedWords) {
        merriamWebsterWords = downloadedWords;
        filterDictionaryWords(merriamWebsterWords, (progress) => {}, (newWords) => {
            filteredDictionaryWords = newWords;
            updateProgress(100);
            dispRes();
            downloadInProgress = false;
        });
    };
    getWordsFromMerriamWebster(onProgress, onComplete);
}

function filterDictionaryWords(words, progressCallback, completeCallback) {
    var worker = new Worker(getScriptPath(function(){
        self.postMessage({});
    }));
    worker.addEventListener('message', function(e) {
        var includeHyphenated = document.getElementById('wordFilterOptionIncludeHyphenated').checked;
        var includeProper = document.getElementById('wordFilterOptionIncludeProper').checked;
        var includePhrases = document.getElementById('wordFilterOptionIncludePhrases').checked;
        var includePrefixes = document.getElementById('wordFilterOptionIncludePrefixes').checked;
        var includeSuffixes = document.getElementById('wordFilterOptionIncludeSuffixes').checked;
        var includeAcronyms = document.getElementById('wordFilterOptionIncludeAcronyms').checked;
        var wordFilter = new WordFilter();
        wordFilter.includeHyphenated = includeHyphenated;
        wordFilter.includeProper = includeProper;
        wordFilter.includePhrases = includePhrases;
        wordFilter.includePrefixes = includePrefixes;
        wordFilter.includeSuffixes = includeSuffixes;
        wordFilter.includeAcronyms = includeAcronyms;
        completeCallback(wordFilter.filter(words, progressCallback));
        worker.terminate();
    }, false);
    worker.postMessage({});
}

function downloadWordsFromOxfordEnglishDictionary() {
    var downloadMsgElement = document.getElementById("DictionaryDownloadSuccessMsg");
    var progBar = document.getElementById("dictionaryDownloadProgressBar");
    progBar.style.display = "block";
    document.getElementById('nextBtn').style.display = "none";
    var updateProgress = function(progressPct) {
        progressPct = Math.round(progressPct);
        progBar.style.width = progressPct + "%";
        progBar.innerHTML = progressPct + "%";
    };

    if(oedWords.length > 0) {
        updateProgress(1);
        downloadInProgress = true;
        downloadMsgElement.style.display = 'none';
        document.getElementById('dictionaryImportButton').disabled = true;
        new Promise((resolve) => {
            filterDictionaryWords(oedWords, (progress) => {updateProgress(Math.round(progress * 100))}, (newWords) => {
                resolve(newWords);
            });
        }).then((newWords) => {
            filteredDictionaryWords = newWords;
            downloadMsgElement.style.display = 'block';
            downloadMsgElement.innerHTML = 'Successfully imported ' + filteredDictionaryWords.length.toLocaleString() + ' words from the Oxford English Dictionary!';
            downloadInProgress = false;
            document.getElementById('dictionaryImportButton').disabled = false;
            document.getElementById('nextBtn').style.display = "block";
        });
        return;
    }

    let username = document.getElementById('dictionaryUsername').value;
    let password = document.getElementById('dictionaryPassword').value;
    if(username.length == 0 || password.length == 0) {
        alert('You must enter a username and password to continue. They should be the same username and password you log into oed.com with. You can get more information about registering for an OED account at public.oed.com/help/.');
    }
    else {
        downloadInProgress = true;
        downloadMsgElement.style.display = 'none';
        updateProgress(1);
        document.getElementById('dictionaryImportButton').disabled = true;
        const letters = ['x', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'y', 'z'];
        const pages = new Map();
        pages.set('s', [1, 200]);
        pages.set('p', [1, 185]);
        pages.set('c', [1, 130]);
        pages.set('m', [1, 130]);
        const numTotalRequests = 30; //at least one for each letter
        var progress = 0;
        const onRequestComplete = function() {
            progress += 100 / numTotalRequests;
            updateProgress(progress);
        };
        const onOverallSuccess = function(wordLists) {
            wordLists.forEach(wordList => {
                wordList.forEach(word => {
                    oedWords.push(word);
                });
            });
            updateProgress(100);
            downloadMsgElement.style.display = 'block';
            document.getElementById('nextBtn').style.display = "block";
            filterDictionaryWords(oedWords, (progress) => {}, (newWords) => {
                filteredDictionaryWords = newWords;
                downloadMsgElement.innerHTML = 'Successfully imported ' + filteredDictionaryWords.length.toLocaleString() + ' words from the Oxford English Dictionary!';
                downloadInProgress = false;
                document.getElementById('dictionaryImportButton').disabled = false;
            });
        };
        const onOverallError = function(errorMsg) {
            progBar.style.display = "none";
            downloadMsgElement.style.display = 'none';
            alert('ERROR: ' + errorMsg);
            downloadInProgress = false;
            document.getElementById('dictionaryImportButton').disabled = false;
        };

        var initialRequest = getWordsFromOedStartingWith(letters[0], username, password, 3, onRequestComplete);
        initialRequest.then(
            (words) => {
                words.forEach(word => {
                    oedWords.push(word);
                });
                var requests = [];
                for(let i = 1; i < letters.length; i++) {
                    if(!pages.has(letters[i])) {
                        requests.push(getWordsFromOedStartingWith(letters[i], username, password, 3, onRequestComplete));
                    }
                    else {
                        const pagesForLetter = pages.get(letters[i]);
                        for(var p = 0; p < pagesForLetter.length; p++) {
                            if(p < pagesForLetter.length - 1) {
                                requests.push(getWordsFromOedStartingWith(letters[i], username, password, 3, onRequestComplete, pagesForLetter[p], pagesForLetter[p+1]-1));
                            }
                            else {
                                requests.push(getWordsFromOedStartingWith(letters[i], username, password, 3, onRequestComplete, pagesForLetter[p]));
                            }
                        }
                    }
                }
                Promise.all(requests).then(onOverallSuccess, onOverallError).catch(error => alert('Unexpected error: ' + error.message));
            },
            onOverallError
        ).catch(error => alert('Unexpected error: ' + error.message));
    }
}

function getWordsFromOedStartingWith(letter, username, password, retries, onRequestComplete, firstPageNum=null, lastPageNum=null) {
    return new Promise((resolve, reject) => {
        const key = 'hqsadpkhhdvyouwwadaugdoaazlctush';
        const ivStr = randomBytes(16).toString('hex');
        let tryCount = 0;
        const request = () => {
            var payload = {
                encryptedUsername: encrypt(username, ivStr, key),
                encryptedPassword: encrypt(password, ivStr, key),
                letter: letter,
                iv: ivStr,
            };
            if(firstPageNum != null) payload.firstPageNum = firstPageNum;
            if(lastPageNum != null) payload.lastPageNum = lastPageNum;
            const params = {
                FunctionName: 'GetWordsFromOed',
                InvocationType: 'RequestResponse',
                Payload: JSON.stringify(payload),
            };
            lambda.invoke(params, function(err, data) {
                if(err) {
                    console.log(err, err.stack);
                }
                else {
                    let responsePayload = JSON.parse(data.Payload);
                    if(responsePayload.body != undefined) {
                        const {words, canRetry, errorMsg} = JSON.parse(responsePayload.body);
                        let success = responsePayload.statusCode == 200;
                        if(success) {
                            onRequestComplete();
                            let splitWords = words.split("\n");
                            resolve(splitWords);
                        }
                        else {
                            tryCount++;
                            if(tryCount < retries && canRetry) {
                                request();
                            }
                            else {
                                reject(errorMsg);
                            }
                            return;
                        }
                    }
                    else {
                        reject("Function Error.");
                    }
                }
            });
        };
        request();
    });
}
         
document.getElementById('refPdfInput').addEventListener('change', function() {
    var file = this.files[0];
    if(file instanceof Blob) {
        refPdf = file;
        refPdfWords = null;
        document.getElementById('genPdfBtn').disabled = false;
    }
    else {
        refPdf = null;
        document.getElementById('genPdfBtn').disabled = true;
    }
});

function getPdfText(file) {
    return new Promise(function(onResolve) {
        var fileReader = new FileReader();
        fileReader.onload = function() {
            const loadingTask = pdfjsLib.getDocument(this.result);
            loadingTask.promise.then(pdf => {
                var maxPages = pdf.numPages;
                var countPromises = [];
                for (var j = 1; j <= maxPages; j++) {
                    var page = pdf.getPage(j);
                    countPromises.push(page.then(function(page) {
                            var textContent = page.getTextContent();
                            return textContent.then(function(text){
                                return text.items.map(function (s) { return s.str; }).filter(s => s != ' ').join(' ');
                        });
                    }));
                }
                return Promise.all(countPromises).then(function (texts) {
                    onResolve(texts.join(''));
                });
            });
        };
        fileReader.readAsArrayBuffer(file);
    });
}

function onClickHighlightNewWords() {
    var checked = document.getElementById('highlightNewWordsCheckbox').checked;
    var genPdfBtn = document.getElementById('genPdfBtn');
    document.getElementById('refPdfOptions').style.display = checked ? 'block' : 'none';
    if(checked && refPdf == null) {
        genPdfBtn.disabled = true;
    }

    if(!checked) {
        genPdfBtn.disabled = false;
    }
}

function getRefPdfWords() {
    var promise = new Promise(function(onResolve) {
        onResolve(refPdfWords);
    });
    if(refPdfWords == null) {
        refPdfWords = new Set();
        promise = getPdfText(refPdf).then(text => {
            var nextWord = "";
            var inQuotes = false;
            for(var i = 0; i < text.length; i++) {
                var c = text[i];
                if(c == '"') {
                    inQuotes = !inQuotes;
                }
                else if(c == ' ') {
                    refPdfWords.add(nextWord);
                    nextWord = "";
                }
                else {
                    nextWord += c;
                }
            }
            if(nextWord.length > 0) {
                refPdfWords.add(nextWord);
            }
            return refPdfWords;
        });
    }
    return promise;
}

function formatMsTime(ms) {
    const msInMinute = 60000;
    const msInSecond = 1000;
    var str = "";
    if(ms >= msInMinute) {
        str += Math.floor(ms / msInMinute) + " m  ";
        ms %= msInMinute;
    }
    if(ms >= msInSecond || str.length > 0) {
        str += Math.floor(ms / msInSecond) + " s  ";
        ms %= msInSecond;
    }
    str += Math.round(ms) + " ms";
    return str;
}