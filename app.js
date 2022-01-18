const evenColumnColor = [224, 224, 224];
const oddColumnColor = [160, 160, 160];
const blankCellColor = [255, 255, 255];
var fileText = "";

function genPDF() {
    var wordTable = genWordTable(getWords(), 6);
    var doc = new jsPDF();
    doc.autoTable({
        body: wordTable,
        didParseCell: function (data) {
            if(data.cell.raw != undefined) {
                data.cell.styles.fillColor = getCellColor(data.column.index);
            }
            else {
                data.cell.styles.fillColor = blankCellColor;
            }
        },
    });
    doc.save("Test.pdf");
}

function getCellColor(colIndex) {
    return colIndex % 2 === 0 ? evenColumnColor : oddColumnColor;
}

function genWordTable(words, numColumns) {
    var wordTable= [];
    var row = [];
    var colIndex = 0;
    for(var i = 0; i < words.length; i++) {
        row.push(words[i]);
        ++colIndex;
        if(colIndex === numColumns) {
            colIndex = 0;
            wordTable.push(row);
            row = [];
        }
    }
    if(row.length > 0) {
        wordTable.push(row);
    }
    return wordTable;
}

function getWords() {
    var words = [];
    if(document.getElementById("wordSourceText").checked) {
        words = getWordsFromText(document.getElementById('wordSourceTextarea').value);
    }
    else if (document.getElementById("wordSourceFile").checked) {
        words = getWordsFromText(fileText);
    }
    else if(document.getElementById("wordSourceURL").checked) {

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

document.getElementById('wordSourceFileInput').addEventListener('change', function() {
    var fr = new FileReader();
    fr.onload = function() {
        fileText = fr.result;
    } 
    fr.readAsText(this.files[0]);
})