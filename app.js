const blankCellColor = [255, 255, 255];
var fileText = "";
var pageNum = 1;
var readingFile = false;
var generatingPdf = false;
var pdfWorker;
var merriamWebsterWords = [];
var downloadInProgress = false;

//As a worker normally take another JavaScript file to execute we convert the function in an URL: http://stackoverflow.com/a/16799132/2576706
function getScriptPath(foo){ return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'})); }

function genPDF() {

    pdfWorker = new Worker(getScriptPath(function(){
        self.addEventListener('message', function(e) {
            var words = e.data.words;
            if(words.length == 0) {
                self.postMessage([]);
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
                    self.postMessage(row);
                    row = [];
                }
            }
            if(row.length > 0) {
                self.postMessage(row);
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
            body: [e.data],
            startY: doc.lastAutoTable ? doc.lastAutoTable.finalY : 20,
            didParseCell: function (data) {
                if(data.cell.raw != undefined) {
                    data.cell.styles.fillColor = getCellColor(data.column.index);
                }
                else {
                    data.cell.styles.fillColor = blankCellColor;
                }
                data.cell.styles.textColor = textColor;
                data.cell.styles.lineWidth = borderWidth;
                data.cell.styles.lineColor = [0, 0, 0];
                data.cell.styles.fontStyle = fontStyle;
                data.cell.styles.fontSize = fontSize;
                data.cell.styles.cellWidth = 181 / numColumns;
        }});
        var progBar = document.getElementById("pdfProgressBar");
        wordsProcessed += e.data.length;
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
    pdfWorker.postMessage({
        numColumns: numColumns,
        words: words,
    });
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
    else if(document.getElementById("wordSourceMerriamWebster").checked) {
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

function downloadWordsFromMerriamWebster() {
    document.getElementById("MerriamWebsterDownloadSuccessMsg").style.display = 'none';
    downloadInProgress = true;
    var progBar = document.getElementById("merriamWebsterDownloadProgressBar");
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
        document.getElementById("MerriamWebsterDownloadSuccessMsg").innerText = "Successfully imported " + words.length + " words!";
        document.getElementById("MerriamWebsterDownloadSuccessMsg").style.display = 'block';
        downloadInProgress = false;
    };
    var includeHyphenated = document.getElementById('merriamWebsterOptionIncludeHyphenated').checked;
    var includeProper = document.getElementById('merriamWebsterOptionIncludeProper').checked;
    var includePhrases = document.getElementById('merriamWebsterOptionIncludePhrases').checked;
    var includePrefixes = document.getElementById('merriamWebsterOptionIncludePrefixes').checked;
    var includeSuffixes = document.getElementById('merriamWebsterOptionIncludeSuffixes').checked;
    var includeAcronyms = document.getElementById('merriamWebsterOptionIncludeAcronyms').checked;
    getWordsFromMerriamWebster(includeHyphenated, includeProper, includePhrases, includePrefixes, includeSuffixes, includeAcronyms, onProgress, onComplete);
}
