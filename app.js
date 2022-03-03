const blankCellColor = [255, 255, 255];
var fileText = "";
var pageNum = 1;
var readingFile = false;
var generatingPdf = false;
var pdfWorker;
var merriamWebsterWords = [];
var downloadInProgress = false;
var refPdf = null;
var refPdfWords = null;

//As a worker normally take another JavaScript file to execute we convert the function in an URL: http://stackoverflow.com/a/16799132/2576706
function getScriptPath(foo){ return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'})); }

function genPDF() {

    pdfWorker = new Worker(getScriptPath(function(){
        self.addEventListener('message', function(e) {
            var words = e.data.words;
            if(words.length == 0) {
                self.postMessage({
                    row: [],
                    refWords: e.data.refWords
                });
                return;
            }

            var numColumns = e.data.numColumns;
            let currentIndex = words.length,  randomIndex;
            while (currentIndex != 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [words[currentIndex], words[randomIndex]] = [words[randomIndex], words[currentIndex]];
            }
            var row = [];
            var colIndex = 0;
            
            for(var i = 0; i < words.length; i++) {
                row.push(words[i]);
                ++colIndex;
                if(colIndex == numColumns) {
                    colIndex = 0;
                    self.postMessage({
                        row: row,
                        refWords: e.data.refWords
                    });
                    row = [];
                }
            }
            if(row.length > 0) {
                self.postMessage({
                    row: row,
                    refWords: e.data.refWords
                });
                row = [];
            }
        }, false);
    }));
    var wordsProcessed = 0;
    var words = getWords();
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
                    if(e.data.refWords != undefined && !e.data.refWords.has(data.cell.raw)) {
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
        if(progPct == 100) {
            doc.save(outputFilename);
            generatingPdf = false;
            document.getElementById("PdfSuccessMsg").style.display = "block";
            document.getElementById('pdfCancelBtn').style.display = "none";
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
        words = merriamWebsterWords;
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
        }
    }, false);
    readingFile = true;
    fileWorker.postMessage(this.files[0]);
})

function downloadWordsFromDictionary() {
    if(downloadInProgress) {
        return;
    }
    document.getElementById("dictionaryImportButton").disabled = true;
    document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'none';
    downloadInProgress = true;
    var progBar = document.getElementById("dictionaryDownloadProgressBar");
    progBar.style.display = "block";
    var updateProgress = function(progressPct) {
        progBar.style.width = progressPct + "%";
        progBar.innerHTML = progressPct + "%";
    };
    updateProgress(1);
    var onProgress = function(progressPct) {
        updateProgress(progressPct);
    }
    var onComplete = function(words) {
        merriamWebsterWords = words;
        updateProgress(100);
        document.getElementById("DictionaryDownloadSuccessMsg").innerText = "Successfully imported " + words.length.toLocaleString() + " words from Merriam-Webster!";
        document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'block';
        downloadInProgress = false;
        document.getElementById('nextBtn').style.display = "block";
        document.getElementById("dictionaryImportButton").disabled = false;
    };
    var includeHyphenated = document.getElementById('wordFilterOptionIncludeHyphenated').checked;
    var includeProper = document.getElementById('wordFilterOptionIncludeProper').checked;
    var includePhrases = document.getElementById('wordFilterOptionIncludePhrases').checked;
    var includePrefixes = document.getElementById('wordFilterOptionIncludePrefixes').checked;
    var includeSuffixes = document.getElementById('wordFilterOptionIncludeSuffixes').checked;
    var includeAcronyms = document.getElementById('wordFilterOptionIncludeAcronyms').checked;
    getWordsFromMerriamWebster(includeHyphenated, includeProper, includePhrases, includePrefixes, includeSuffixes, includeAcronyms, onProgress, onComplete);
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