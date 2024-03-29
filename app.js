const blankCellColor = [255, 255, 255];
var fileText = "";
var pageNum = 1;
var readingFile = false;
var generatingPdf = false;
var pdfWorker;
var merriamWebsterWords = {};
var merriamWebsterDefinitions = {};
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
        timeout: 900000
    }
};
var lambda = new AWS.Lambda(lambdaOptions);

//As a worker normally take another JavaScript file to execute we convert the function in an URL: http://stackoverflow.com/a/16799132/2576706
function getScriptPath(foo){ return window.URL.createObjectURL(new Blob([foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1]],{type:'text/javascript'})); }

function genFile() {
    if(document.getElementById('outputTypePdf').checked) {
        genPDF();
    }
    else {
        genWebPage();
    }
}

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

                // resize font if needed so text fits in cell without wrapping
                var cellWidth = data.cell.styles.cellWidth - (data.cell.styles.cellPadding * 2);
                doc.setFontSize(fontSize);
                var newFontSize = fontSize;
                if(cellWidth) {
                    while(doc.getTextWidth(data.cell.raw) > cellWidth) {
                        --newFontSize;
                        doc.setFontSize(newFontSize);
                    }
                }

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
                data.cell.styles.fontSize = newFontSize;
                data.cell.styles.cellWidth = 181 / numColumns;
        }});
        wordsProcessed += e.data.row.length;
        var progPct = numWords > 0 ? Math.round((wordsProcessed / numWords) * 100) : 100;
        showProgress(progPct);
        if(wordsProcessed == numWords) {
            doc.save(outputFilename);
            generatingPdf = false;
            document.getElementById('pdfCancelBtn').style.display = "none";
            document.getElementById("keepWords").style.display = "block";
            pdfWorker.terminate();
        }
    }, false);
    generatingPdf = true;
    showProgress(0);
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

function showProgress(progressPct) {
    var progressBar = document.getElementById("pdfProgressBar");
    progressBar.style.width = progressPct + "%";
    progressBar.innerHTML = progressPct + "%";
    progressBar.style.display = "block";
}

function genWebPage() {
    showProgress(0);
    const words = getWords();
    var numColumns = document.getElementById('numColumnsOption').value;
    var columnColor1 = document.getElementById('columnColor1').value;
    var columnColor2 = document.getElementById('columnColor2').value;
    const showCellBorders = document.getElementById('cellBordersOption').checked;
    var textColor = document.getElementById('textColorOption').value;
    var fontSize = 6 + parseInt(document.getElementById('fontSizeOption').value);
    var bold = document.getElementById('fontStyleOptionBold').checked;
    var italic = document.getElementById('fontStyleOptionItalic').checked;
    const html = generateTableHTML(words, numColumns, 32, columnColor1, columnColor2, showCellBorders, textColor, fontSize, bold, italic);
    saveHTML(html, getWebPageFilename());
    showProgress(100);
    document.getElementById("keepWords").style.display = "block";
}
  
function generateTableHTML(words, numColumns, numRowsPerPage, columnColor1, columnColor2, showCellBorders, textColor, fontSize, bold, italic) {
    let html = `<html><head><style>
        body {
            padding-top: 100px;
            padding-bottom: 100px;
            background-color: #373737;
        }
        table { 
            border-collapse: collapse; 
            width: 90%; 
            height: 90%;
            margin: auto; 
            font-family: sans-serif; 
            table-layout: fixed;
        }
        .b {
            margin-top: 5%;
        }
        .g {
            border: 1px solid;
            padding: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            background-color: white;
            width: 85%;
            margin: auto;
            padding-top: 5%;
            padding-bottom: 5%;
        }
        .page-number {
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 18px;
            color: white;
            z-index: 3;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 50px;
            background-color: #373737;
            z-index: 2;
        }    
        td { 
            ` + (showCellBorders ? `border: 1px solid black; ` : ``) +
            `padding: 10px; 
            color: ${textColor};
            font-size: ${fontSize}px;
            font-weight: ` + (bold ? `bold` : `normal`) + `;
            font-style: ` + (italic ? `italic` : `normal`) + `;
            width: ` + (100 / numColumns) + `%;
            overflow-wrap: break-word;
        }
        .q { background-color: ${columnColor1}; }
        .w { background-color: ${columnColor2}; }
        .d1 {
            text-align: center;
        }
        .d2 {
            font-size: 27px;
            margin: 5px 0 10px;
        }
        .d3 {
            border: 1px solid #ccc;
            border-radius: 5px;
            margin: 10px 0;
            padding: 10px;
            box-shadow: 0 2px 2px rgba(0,0,0,0.1);
        }
        .d4 {
            font-size: 23px;
            margin: 5px 0 10px;
        }
        .d5 {
            margin: 0;
            padding: 0 0 0 40px;
        }
        .d6 {
            margin-bottom: 5px;
            font-size: 17px;
            line-height: 1.5;
            font-weight: bold;
        }
        .d7 {
            font-weight: normal;
            font-size: 17px
        }
        #close-button:hover { cursor: pointer; }
        #definition-modal {
        display: none;
        position: fixed;
        z-index: 1;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0, 0, 0);
        background-color: rgba(0, 0, 0, 0.4);
        }
        #definition-content {
        background-color: #fefefe;
        margin: 15% auto;
        padding: 20px;
        border: 1px solid #888;
        width: 50%;
        }`;
    if (shouldShowDefinitionsOnHtmlOutput()) {
        html += `table td:hover { cursor: pointer; }`;
    }
    html += `</style></head><body>`;
    html = minifyHTML(html);
    let numPages = 0;
    let wordIndex = 0;
    html += `<div id=tablePages>`;
    while (numPages * numRowsPerPage * numColumns < words.length) {
        html += generateTablePageHTML(words, wordIndex, numRowsPerPage, numColumns);
        numPages++;
        wordIndex += numRowsPerPage * numColumns;
    }
    html += `</div>`;
    html += generateClickListenerScript();
    html += `<div class="page-number">Page <input style="background-color: #373737; color: white; font-size: 16px; width: 50px; text-align: right;" min="1" max="${numPages}" value="1" onblur="updatePageNumber(this.value)" onkeydown="if (event.keyCode === 13) updatePageNumber(this.value);"> of ${numPages}</div>`;
    html += generateDefinitionModalHTML() + `</body></html>`;
    html += `<script>`;
    html += generateScrollListenerScript(numPages);
    html += `</script>`;
    return html;
}

function generateTablePageHTML(words, startIndex, numRowsPerPage, numColumns) {
    let html = `<div class="g">`;
    html += `<table>`;
    let endIndex = startIndex + numRowsPerPage * numColumns;
    for (let i = startIndex; i < endIndex && i < words.length; i++) {
        if (i % numColumns === 0) {
            html += "<tr>";
        }

        html += `<td class="` + (i % 2 === 0 ? `q` : `w`) + `"`;
        if(shouldShowDefinitionsOnHtmlOutput()) {
            html += ` d="${generateDefinitionStringForMw(words[i])}"`;
        }
        html += `>` + words[i] + "</td>";

        if (i % numColumns === numColumns - 1 || i === words.length - 1) {
            html += "</tr>";
        }
    }
    html += `</table>`;
    html += `</div>`;
    html += `<div class="b"></div>`;
    html = minifyHTML(html);
    return html;
}

function generateClickListenerScript() {
    let html = `<script>
        document.getElementById("tablePages").addEventListener("click", function() {
            const target = event.target;
            if (target.tagName === 'TD') {
                let html = '<div class="d1"><h2 class="d2">' + target.textContent + '</h2></div>';
                let str = target.getAttribute('d');
                let parts = str.split('|');
                for (let i = 0; i < parts.length; ) {
                    let partOfSpeech = parts[i];
                    html += '<div class="d3">';
                    html += '<h2 class="d4">' + partOfSpeech + '</h2>';
                    html += '<ol class="d5">';
                    let numDefs = parseInt(parts[i+1]);
                    for (let j = 0; j < numDefs; j++) {
                        let def = parts[i+2+j];
                        html += '<li class="d6"><span class="d7">' + def + '</span></li>';
                    }
                    html += '</ol>';
                    html += '</div>';
                    i += 2 + numDefs;
                }
                document.body.style.overflow = "hidden";
                document.getElementById("definition-content").innerHTML = html;
                document.getElementById("definition-modal").style.display = "flex";
            }
        });
    </script>`;
    html = minifyHTML(html);
    return html;
}

function shouldShowDefinitionsOnHtmlOutput() {
    return document.getElementById("wordSourceDictionary").checked && document.getElementById('dictionaryOptionMerriamWebster').checked;
}

function generateDefinitionStringForMw(word) {
    let str = '';
    for (const [partOfSpeech, definitions] of Object.entries(merriamWebsterDefinitions[word])) {
        str += partOfSpeech + '|';
        str += definitions.size + '|';
        definitions.forEach(d => {
            str += d + '|';
        });
    }
    str = str.substring(0, str.length - 1);
    return str;
}

function generateDefinitionModalHTML() {
    let html = `<div id="definition-modal" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); overflow-y: hidden">
        <div id="definition-content" style="background-color: white; padding: 20px; border-radius: 5px; height: 50%; overflow-y: auto">
        </div>
        </div>
        <script>
            let modal = document.getElementById("definition-modal");
            modal.addEventListener("click", function(event) {
                if (event.target === modal) {
                    modal.style.display = "none";
                    document.body.style.overflow = "";
                }
            });
        </script>`;
    html = minifyHTML(html);
    return html;
}

function generateScrollListenerScript(numPages) {
    let js = "window.addEventListener('scroll', function() {";
    js += "const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;";
    js += "const page = document.getElementsByClassName(\"g\")[0];";
    js += "const pageHeight = page.offsetHeight;";
    js += `let pageNum = Math.min(${numPages} - 1, Math.floor(scrollTop / pageHeight));`;
    js += "const pageNumberElement = document.querySelector('.page-number');";
    js += `pageNumberElement.innerHTML = 'Page <input style="background-color: #373737; color: white; font-size: 16px; width: 50px; text-align: right;\" min=\"1\" max=\"${numPages}\" value=\"' + (pageNum + 1) + '\" onblur=\"updatePageNumber(this.value)\" onkeydown=\"if (event.keyCode === 13) updatePageNumber(this.value);\"> of ${numPages}';`;
    js += "});";

    js += "function updatePageNumber(pageNum) {";
    js += "const page = document.getElementsByClassName(\"g\")[0];";
    js += "const pageHeight = page.offsetHeight;";
    js += "window.scrollTo(0, (pageNum - 1) * (pageHeight + 95.5));";
    js += "}";
    return js;
}

function saveHTML(html, filename) {
    const blob = new Blob([html], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
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
    return getOutputFilenameWithExtension(".pdf");
}

function getWebPageFilename() {
    return getOutputFilenameWithExtension(".html");
}

function getOutputFilenameWithExtension(extension) {
    var outputFilenameBox = document.getElementById("outputFilename");
    var outputFilename = outputFilenameBox.value;
    if(outputFilename.length === 0) {
        outputFilename = outputFilenameBox.placeholder;
    }
    if(!outputFilename.endsWith(extension)) {
        outputFilename += extension;
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
    if(document.getElementById('keepWordsCheckbox').checked) {
        words = prevWords;
    } 
    else {
        if(document.getElementById("wordSourceText").checked) {
            words = getWordsFromText(document.getElementById('wordSourceTextarea').value);
        }
        else if (document.getElementById("wordSourceFile").checked) {
            words = getWordsFromText(fileText);
        }
        else if(document.getElementById("wordSourceDictionary").checked) {
            var dictionaryWords = document.getElementById('dictionaryOptionMerriamWebster').checked ? merriamWebsterWords : oedWords;
            words = getFilteredDictionaryWords(dictionaryWords);
        }
        shuffle(words);
        prevWords = words;
    }
    return words;
}

function getWordsFromText(text) {
    var words = [];
    var lines = text.split("\n");
    for(var i = 0; i < lines.length; ++i) {
        var word = lines[i].trim().replace('\r', '');
        if(word.length > 0) {
            words.push(word);
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
    var dispRes = function(numWords) {
        document.getElementById("DictionaryDownloadSuccessMsg").innerText = "Successfully imported " + numWords.toLocaleString() + " words from Merriam-Webster!";
        document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'block';
        document.getElementById('nextBtn').style.display = "block";
        document.getElementById("dictionaryImportButton").disabled = false;
    }
    var progBar = document.getElementById("dictionaryDownloadProgressBar");
    var updateProgress = function(progressPct) {
        roundedProgressPct = Math.floor(progressPct);
        roundedProgressPct = Math.min(Math.max(roundedProgressPct, 0), 100);
        progBar.style.width = roundedProgressPct + "%";
        progBar.innerHTML = roundedProgressPct + "%";
    };
    document.getElementById("dictionaryImportButton").disabled = true;
    document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'none';
    document.getElementById('nextBtn').style.display = "none";
    downloadInProgress = true;
    progBar.style.display = "block";
    updateProgress(1);
    if(Object.keys(merriamWebsterWords).length > 0) {
        downloadInProgress = true;
        updateProgress(100);
        dispRes(getNumberOfFilteredDictionaryWords(merriamWebsterWords));
        downloadInProgress = false;
        progBar.style.display = "none";
        return;
    }

    const onOverallError = function(errorMsg) {
        progBar.style.display = "none";
        document.getElementById("DictionaryDownloadSuccessMsg").style.display = 'none';
        alert('ERROR: ' + errorMsg);
        downloadInProgress = false;
        document.getElementById('dictionaryImportButton').disabled = false;
    };
    const wordFetchTotalProgress = 90;
    var onWordFetchProgress = function(progressPct) {
        updateProgress(wordFetchTotalProgress * (progressPct / 100));
    }
    var onComplete = function(definitionsPerWord) {
        var words = [];
        for (const [word, defsPerPartOfSpeech] of Object.entries(definitionsPerWord)) {
            if (WordUtils.hasNumber(word) || WordUtils.hasUnsupportedChars(word)) {
                continue;
            }

            words.push(word);
            merriamWebsterDefinitions[word] = {};
            for (const [partOfSpeech, defs] of Object.entries(defsPerPartOfSpeech)) {
                merriamWebsterDefinitions[word][partOfSpeech] = new Set();
                defs.forEach(definition => {
                    if (definition.length > 0) {
                        merriamWebsterDefinitions[word][partOfSpeech].add(definition);
                    }
                });
            }
        }
        updateProgress(wordFetchTotalProgress);

        categorizeAllDictionaryWords(words, (progress) => {
            var catTotalProgress = 99 - wordFetchTotalProgress;
            updateProgress((catTotalProgress * (progress / 100)) + wordFetchTotalProgress);
        }).then((allWords) => {
            updateProgress(99);

            // allWords contains an array of objects, instead combine them into a single object
            var wordsPerCategory = {};
            allWords.forEach((words) => {
                for (const [category, wordsInCategory] of Object.entries(words)) {
                    if (!wordsPerCategory.hasOwnProperty(category)) {
                        wordsPerCategory[category] = [];
                    }
                    wordsPerCategory[category] = wordsPerCategory[category].concat(wordsInCategory);
                }
            });

            merriamWebsterWords = wordsPerCategory;
            updateProgress(100);
            dispRes(getNumberOfFilteredDictionaryWords(merriamWebsterWords));
            downloadInProgress = false;
            progBar.style.display = "none";
        });
    };
    getWordsFromMerriamWebsterLambdaVersion(1000, onWordFetchProgress).then(onComplete, onOverallError).catch(error => alert('Unexpected error: ' + error.message));
}

function categorizeAllDictionaryWords(words, onProgress) {
    // categorize words in chunks of 1000 in parallel
    const chunkSize = 1000;
    const numChunks = Math.ceil(words.length / chunkSize);
    const promises = [];
    var numChunksCompleted = 0;
    for (let i = 0; i < numChunks; i++) {
        const chunk = words.slice(i * chunkSize, (i + 1) * chunkSize);
        var p = categorizeDictionaryWords(chunk);
        p.then(() => {
            numChunksCompleted++;
            if (onProgress) {
                onProgress(numChunksCompleted / numChunks * 100);
            }
        });
        promises.push(p);
    }
    return Promise.all(promises);
}

function categorizeDictionaryWords(words) {
    const params = {
        FunctionName: 'categorizeWords',
        InvocationType: 'RequestResponse',
        Payload:JSON.stringify({
            words: words,
        }),
    };
    return new Promise((resolve, reject) => {
        lambda.invoke(params, function(err, data) {
            if(err) {
                reject(err);
            }
            else {
                let responsePayload = JSON.parse(data.Payload);
                let wordsPerCategory = JSON.parse(responsePayload.body);
                resolve(wordsPerCategory);
            }
        });
    });
}

function getNumberOfFilteredDictionaryWords(wordsPerCategory) {
    var includeHyphenated = document.getElementById('wordFilterOptionIncludeHyphenated').checked;
    var includeProper = document.getElementById('wordFilterOptionIncludeProper').checked;
    var includePhrases = document.getElementById('wordFilterOptionIncludePhrases').checked;
    var includePrefixes = document.getElementById('wordFilterOptionIncludePrefixes').checked;
    var includeSuffixes = document.getElementById('wordFilterOptionIncludeSuffixes').checked;
    var includeAcronyms = document.getElementById('wordFilterOptionIncludeAcronyms').checked;
    var includeProfanity = document.getElementById('wordFilterOptionIncludeBadWords').checked;

    var len = wordsPerCategory.other ? wordsPerCategory.other.length : 0;

    if (includeHyphenated) {
        len += wordsPerCategory.hyphenated ? wordsPerCategory.hyphenated.length : 0;
    }
    if (includeProper) {
        len += wordsPerCategory.proper ? wordsPerCategory.proper.length : 0;
    }
    if (includePhrases) {
        len += wordsPerCategory.phrase ? wordsPerCategory.phrase.length : 0;
    }
    if (includePrefixes) {
        len += wordsPerCategory.prefix ? wordsPerCategory.prefix.length : 0;
    }
    if (includeSuffixes) {
        len += wordsPerCategory.suffix ? wordsPerCategory.suffix.length : 0;
    }
    if (includeAcronyms) {
        len += wordsPerCategory.acronym ? wordsPerCategory.acronym.length : 0;
    }
    if (includeProfanity) {
        len += wordsPerCategory.profanity ? wordsPerCategory.profanity.length : 0;
    }
    return len;
}

function getFilteredDictionaryWords(wordsPerCategory) {
    var includeHyphenated = document.getElementById('wordFilterOptionIncludeHyphenated').checked;
    var includeProper = document.getElementById('wordFilterOptionIncludeProper').checked;
    var includePhrases = document.getElementById('wordFilterOptionIncludePhrases').checked;
    var includePrefixes = document.getElementById('wordFilterOptionIncludePrefixes').checked;
    var includeSuffixes = document.getElementById('wordFilterOptionIncludeSuffixes').checked;
    var includeAcronyms = document.getElementById('wordFilterOptionIncludeAcronyms').checked;
    var includeProfanity = document.getElementById('wordFilterOptionIncludeBadWords').checked;

    var filteredWords = wordsPerCategory.other ? wordsPerCategory.other : [];

    if (includeHyphenated && wordsPerCategory.hyphenated) {
        filteredWords = filteredWords.concat(wordsPerCategory.hyphenated);
    }
    if (includeProper && wordsPerCategory.proper) {
        filteredWords = filteredWords.concat(wordsPerCategory.proper);
    }
    if (includePhrases && wordsPerCategory.phrase) {
        filteredWords = filteredWords.concat(wordsPerCategory.phrase);
    }
    if (includePrefixes && wordsPerCategory.prefix) {
        filteredWords = filteredWords.concat(wordsPerCategory.prefix);
    }
    if (includeSuffixes && wordsPerCategory.suffix) {
        filteredWords = filteredWords.concat(wordsPerCategory.suffix);
    }
    if (includeAcronyms && wordsPerCategory.acronym) {
        filteredWords = filteredWords.concat(wordsPerCategory.acronym);
    }
    if (includeProfanity && wordsPerCategory.profanity) {
        filteredWords = filteredWords.concat(wordsPerCategory.profanity);
    }

    return filteredWords;
}

function filterDictionaryWords(words, progressCallback) {
    var wordFilter = new WordFilter();
    wordFilter.includeHyphenated = document.getElementById('wordFilterOptionIncludeHyphenated').checked;
    wordFilter.includeProper = document.getElementById('wordFilterOptionIncludeProper').checked;
    wordFilter.includePhrases = document.getElementById('wordFilterOptionIncludePhrases').checked;
    wordFilter.includePrefixes = document.getElementById('wordFilterOptionIncludePrefixes').checked;
    wordFilter.includeSuffixes = document.getElementById('wordFilterOptionIncludeSuffixes').checked;
    wordFilter.includeAcronyms = document.getElementById('wordFilterOptionIncludeAcronyms').checked;
    wordFilter.includeProfanity = document.getElementById('wordFilterOptionIncludeBadWords').checked;
    return wordFilter.filter(words, progressCallback);
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
        filterDictionaryWords(oedWords, (progress) => {updateProgress(Math.round(progress * 100))}).then((newWords) => {
            filteredDictionaryWords = newWords;
            downloadMsgElement.style.display = 'block';
            downloadMsgElement.innerHTML = 'Successfully imported ' + filteredDictionaryWords.length.toLocaleString() + ' words from the Oxford English Dictionary!';
            downloadInProgress = false;
            document.getElementById('dictionaryImportButton').disabled = false;
            document.getElementById('nextBtn').style.display = "block";
        });
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
            filterDictionaryWords(oedWords, (progress) => {}).then((newWords) => {
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

function getWordsFromMerriamWebsterLambdaVersion(limitPerCall = 10_000, onProgress = null, startKey = null, totalLimit = null, currTotal = 0) {
    const params = {
        FunctionName: 'getMerriamWebsterWordsAndDefintitions',
        InvocationType: 'RequestResponse',
        Payload:JSON.stringify({
            limit: limitPerCall,
            start_key: startKey
        }),
    };
    const target = totalLimit ? ((totalLimit / limitPerCall) + (totalLimit % limitPerCall == 0 ? 0 : 1)) * limitPerCall : 350_000;
    return new Promise((resolve, reject) => {
        lambda.invoke(params, function(err, data) {
            if(err) {
                reject(err);
            }
            else {
                let responsePayload = JSON.parse(data.Payload);
                if(responsePayload.body != undefined) {
                    let responseBody = JSON.parse(responsePayload.body);
                    let words = responseBody.definitions;
                    currTotal += Object.keys(words).length;
                    if (onProgress) {
                        onProgress(currTotal / target * 100);
                    }
                    if (totalLimit && currTotal >= totalLimit) {
                        resolve(words);
                    } else {
                        let nextStartKey = responseBody.start_key;
                        if (nextStartKey) {
                            getWordsFromMerriamWebsterLambdaVersion(limitPerCall, onProgress, nextStartKey, totalLimit, currTotal).then((nextWords) => {
                                Object.assign(words, nextWords);
                                resolve(words);
                                return;
                            }).catch((error) => {
                                reject(error);
                            });
                        } else {
                            // If there are no more results, return the final list of words
                            resolve(words);
                        }
                    }
                }
                else {
                    reject("Function Error: " + JSON.stringify(responsePayload));
                }
            }
        });
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

function minifyHTML(html) {
    // Remove leading and trailing white spaces
    html = html.trim();
    
    // Replace multiple spaces with a single space
    html = html.replace(/\s+/g, ' ');
  
    // Remove comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');
  
    // Remove whitespace between HTML tags
    html = html.replace(/>[\s]+</g, '><');
  
    // Remove whitespace inside tags
    html = html.replace(/(<[^\/]+?>)\s+(<\/[^>]+?>)/g, '$1$2');
  
    // Remove line breaks
    html = html.replace(/[\r\n]+/g, '');
  
    return html;
  }
