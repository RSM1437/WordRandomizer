const evenColColor = [40, 170, 100];
const oddColColor = [0, 0, 0];
const blankCellColor = [255, 255, 255];

function genPDF() {
    var wordTable = genWordTable(genWords(1000), 6);
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