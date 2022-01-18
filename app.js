const evenColColor = [40, 170, 100];
const oddColColor = [0, 0, 0];
const blankCellColor = [255, 255, 255];

function genPDF() {
    var words = getWords();
    var wordTable = genWordTable(words, 6);
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
      })
      
    doc.save("Test.pdf");
}

function getCellColor(colIndex) {
    return colIndex % 2 === 0 ? evenColColor : oddColColor;
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

function genWords(numWords) {
    var words = [];
    for(var i = 0; i < numWords; ++i) {
        words.push("a");
    }
    return words;
}

function getWords() {
    var words = [];
    var lines = document.getElementsByName('words')[0].value.split("\n");
    for(var i = 0; i < lines.length; ++i) {
        var wordsOnLine = lines[i].split(" ");
        for(var j = 0; j < wordsOnLine.length; ++j) {
            var word = wordsOnLine[j].trim();
            if(word.length > 0) {
                words.push(word);
            }
        }
    }
    return words;
}